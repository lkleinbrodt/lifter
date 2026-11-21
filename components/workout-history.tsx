// History tab: every finished workout, newest first, grouped by week (Mon–Sun). Compact cards:
// name, date/duration/sets, the main lifts' best sets in a small grid, and the rest as one line.

import { ActivityIndicator, Pressable, SectionList, StyleSheet, View } from 'react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { type Workout, type WorkoutSet, isWorkingSet } from '@/lib/workout';
import { formatLoad, getExercise, splitExerciseName } from '@/lib/exercises';
import { formatMinutes, workoutStats } from '@/lib/workout-edit';
import { type GslpLiftKey, gslpLiftOrder, gslpLifts } from '@/lib/gslp';

import { C, Radius, numStyle } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProgramHeader } from '@/components/program-header';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { listWorkouts } from '@/lib/db';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { workoutDisplayName } from '@/lib/workout-names';

const PAGE = 40;

const SHORT: Record<GslpLiftKey, string> = {
  ohp: 'OHP',
  chinup: 'Chin-up',
  latPulldown: 'Pulldown',
  squat: 'Squat',
  bench: 'Bench',
  row: 'Row',
  deadlift: 'Deadlift',
};
const liftByExercise = new Map(gslpLiftOrder.map((key) => [gslpLifts[key].exerciseId, key] as const));

/** Best working set: heaviest, then most reps (or longest hold). */
function bestSet(sets: WorkoutSet[]) {
  return sets.filter(isWorkingSet).reduce<WorkoutSet | undefined>((best, set) => {
    if (!best) return set;
    const a = [set.weight ?? 0, set.reps ?? set.durationSec ?? 0];
    const b = [best.weight ?? 0, best.reps ?? best.durationSec ?? 0];
    return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]) ? set : best;
  }, undefined);
}

const beats = (a: WorkoutSet, b: WorkoutSet) =>
  (a.weight ?? 0) > (b.weight ?? 0) || ((a.weight ?? 0) === (b.weight ?? 0) && (a.reps ?? 0) > (b.reps ?? 0));

/** Monday 00:00 of the week containing `date`. */
function weekStart(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function weekTitle(start: Date, now = new Date()) {
  const thisWeek = weekStart(now).getTime();
  if (start.getTime() === thisWeek) return 'This week';
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  return start.getMonth() === end.getMonth()
    ? `${month(start)} ${start.getDate()} – ${end.getDate()}`
    : `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}`;
}

type MainLift = { key: GslpLiftKey; set: WorkoutSet; up: boolean; tracking: ReturnType<typeof getExercise>['tracking'] };
type Row = { workout: Workout; lifts: MainLift[]; others: string[] };

/** Main lifts with their best set, flagged ↑ when it beats the previous session of that lift. */
function buildRows(workouts: Workout[]): Row[] {
  const rows: Row[] = workouts.map((workout) => {
    const lifts: MainLift[] = [];
    const others: string[] = [];
    for (const entry of workout.exercises) {
      const key = liftByExercise.get(entry.exerciseId);
      const best = bestSet(entry.sets);
      if (key && best) lifts.push({ key, set: best, up: false, tracking: getExercise(entry.exerciseId).tracking });
      else if (!key) others.push(splitExerciseName(getExercise(entry.exerciseId).name).title.toLowerCase());
    }
    return { workout, lifts, others: [...new Set(others)] };
  });
  // Newest first: the previous session of a lift is the next row that has it.
  rows.forEach((row, index) => {
    for (const lift of row.lifts) {
      const older = rows.slice(index + 1).find((other) => other.lifts.some((item) => item.key === lift.key));
      const previous = older?.lifts.find((item) => item.key === lift.key);
      lift.up = !!previous && beats(lift.set, previous.set);
    }
  });
  return rows;
}

function WorkoutCard({ row, onPress }: { row: Row; onPress: () => void }) {
  const { workout, lifts, others } = row;
  const start = new Date(workout.startedAt);
  const stats = workoutStats(workout);
  const minutes = stats.durationSec / 60;
  const suspicious = workout.finishedAt && (minutes < 5 || minutes > 240); // bad imported times

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.header}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {workoutDisplayName(workout)}
        </ThemedText>
        <IconSymbol name="chevron.right" size={13} color={C.t4} />
      </View>
      <ThemedText type="subhead">
        {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        {workout.finishedAt ? (
          <ThemedText type="subhead" style={suspicious ? styles.suspicious : undefined}>
            {' · '}
            {formatMinutes(stats.durationSec)}
            {suspicious ? ' ?' : ''}
          </ThemedText>
        ) : null}
        {` · ${stats.sets} sets`}
      </ThemedText>
      {lifts.length ? (
        <View style={styles.grid}>
          {lifts.slice(0, 3).map((lift) => (
            <View key={lift.key} style={styles.cell}>
              <ThemedText type="caption">{SHORT[lift.key]}</ThemedText>
              <ThemedText num style={styles.best}>
                {formatLoad(lift.set.weight, lift.tracking) || '–'}×{lift.set.reps ?? '–'}
                {lift.up ? <ThemedText style={styles.up}> ↑</ThemedText> : null}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
      {others.length ? (
        <ThemedText style={styles.others} numberOfLines={1}>
          {lifts.length ? '+ ' : ''}
          {others.join(', ')}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

/** Every logged workout, newest first; tap to view, edit or delete. */
export function WorkoutHistoryScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listWorkouts({ limit: PAGE }).then((rows) => {
        if (!active) return;
        setWorkouts(rows);
        setDone(rows.length < PAGE);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const loadMore = async () => {
    if (!workouts || done || loadingMore) return;
    setLoadingMore(true);
    const rows = await listWorkouts({ limit: PAGE, offset: workouts.length });
    setWorkouts([...workouts, ...rows]);
    setDone(rows.length < PAGE);
    setLoadingMore(false);
  };

  const sections = useMemo(() => {
    const groups = new Map<number, Row[]>();
    for (const row of buildRows(workouts ?? [])) {
      const key = weekStart(new Date(row.workout.startedAt)).getTime();
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups].map(([key, data]) => ({ key: String(key), title: weekTitle(new Date(key)), data }));
  }, [workouts]);

  return (
    <SafeAreaContainer edges={['top', 'left', 'right']}>
      {!workouts ? (
        <ActivityIndicator style={styles.loading} color={C.accent} />
      ) : (
        <SectionList
          style={styles.flex}
          sections={sections}
          keyExtractor={(item) => item.workout.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={<ProgramHeader title="History" />}
          ListEmptyComponent={<ThemedText style={styles.empty}>No workouts logged yet.</ThemedText>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={C.accent} /> : <View style={styles.footer} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
              <ThemedText num style={styles.sectionCount}>
                {section.data.length}
              </ThemedText>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => <WorkoutCard row={item} onPress={() => router.push(`/workout/${item.workout.id}`)} />}
        />
      )}
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  loading: { marginTop: 48 },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  footer: { height: 120 },
  empty: { color: C.t2, fontSize: 15, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22, marginBottom: 10, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: C.t2 },
  sectionCount: { ...numStyle, fontSize: 14, color: C.t3 },
  gap: { height: 10 },
  card: { backgroundColor: C.s1, borderRadius: Radius.card, padding: 16, gap: 4 },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '600' },
  suspicious: { color: C.amrap },
  grid: { flexDirection: 'row', marginTop: 10, gap: 8 },
  cell: { flex: 1, gap: 3 },
  best: { ...numStyle, fontSize: 16, fontWeight: '600', color: C.t1 },
  up: { fontSize: 15, color: C.accent, fontWeight: '700' },
  others: { fontSize: 13, color: C.t3, marginTop: 8 },
});
