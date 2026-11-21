// Exercise history sheet: a top-set chart for the last 8 sessions, then every session with its
// top set and warm-ups. The chart is Views (no svg in the build).

import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { type ExerciseSession, exerciseHistory } from '@/lib/db';
import React, { useEffect, useState } from 'react';
import { type WorkoutSet, isWorkingSet } from '@/lib/workout';
import { exerciseEquipment, formatLoad, getExercise, splitExerciseName } from '@/lib/exercises';

import { C, Radius, numStyle } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { formatSet } from './set-row';

const CHART_SESSIONS = 8;
const CHART_HEIGHT = 96;

type ExerciseHistorySheetProps = {
  exerciseId: string | null; // null = hidden
  onClose: () => void;
};

/** Heaviest working set, then most reps (or longest hold). */
function topSet(sets: WorkoutSet[]) {
  return sets.filter(isWorkingSet).reduce<WorkoutSet | undefined>((best, set) => {
    if (!best) return set;
    const a = [set.weight ?? 0, set.reps ?? set.durationSec ?? 0];
    const b = [best.weight ?? 0, best.reps ?? best.durationSec ?? 0];
    return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]) ? set : best;
  }, undefined);
}

const n = (value: number | undefined) => (value === undefined ? '–' : String(Number(value.toFixed(2))));

export function ExerciseHistorySheet({ exerciseId, onClose }: ExerciseHistorySheetProps) {
  const [sessions, setSessions] = useState<ExerciseSession[] | null>(null);

  useEffect(() => {
    if (!exerciseId) return;
    let active = true;
    setSessions(null);
    exerciseHistory(exerciseId, { limit: 50 }).then((rows) => active && setSessions(rows));
    return () => {
      active = false;
    };
  }, [exerciseId]);

  const exercise = exerciseId ? getExercise(exerciseId) : null;
  const name = exercise ? splitExerciseName(exercise.name) : null;
  const equipment = exerciseId ? exerciseEquipment(exerciseId) : undefined;

  return (
    <Modal visible={!!exerciseId} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <ThemedText style={styles.title}>{name?.title}</ThemedText>
            <ThemedText type="subhead">
              {[name?.detail ?? equipment, `top set, last ${CHART_SESSIONS} sessions`].filter(Boolean).join(' · ')}
            </ThemedText>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
            <IconSymbol name="xmark" size={15} color={C.t2} />
          </Pressable>
        </View>
        {!sessions || !exercise ? (
          <ActivityIndicator style={styles.loading} color={C.accent} />
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item, index) => `${item.workoutId}-${index}`}
            contentContainerStyle={styles.list}
            ListHeaderComponent={sessions.length > 1 ? <TopSetChart sessions={sessions} tracking={exercise.tracking} /> : null}
            ListEmptyComponent={<ThemedText style={styles.muted}>Not done before.</ThemedText>}
            renderItem={({ item }) => {
              const top = topSet(item.sets);
              const warm = item.sets.filter((set) => !isWorkingSet(set));
              return (
                <View style={styles.session}>
                  <View style={styles.sessionHeader}>
                    <ThemedText style={styles.date}>
                      {new Date(item.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </ThemedText>
                    <ThemedText style={styles.workoutName} numberOfLines={1}>
                      {item.displayName}
                    </ThemedText>
                  </View>
                  <ThemedText num style={styles.top}>
                    {formatSet(top, exercise.tracking)}
                    <ThemedText num style={styles.count}>
                      {'  '}
                      {item.sets.filter(isWorkingSet).length} sets
                    </ThemedText>
                  </ThemedText>
                  {warm.length ? (
                    <ThemedText num style={styles.warm}>
                      w {warm.map((set) => `${n(set.weight)}×${n(set.reps)}`).join(' · ')}
                    </ThemedText>
                  ) : null}
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

/** Vertical bars of the top set's load (or reps, for unloaded lifts), reps above, load below. */
function TopSetChart({ sessions, tracking }: { sessions: ExerciseSession[]; tracking: ReturnType<typeof getExercise>['tracking'] }) {
  const points = sessions
    .slice(0, CHART_SESSIONS)
    .map((session) => ({ session, set: topSet(session.sets) }))
    .filter((point): point is { session: ExerciseSession; set: WorkoutSet } => !!point.set)
    .reverse();
  const loaded = tracking === 'weightReps' || tracking === 'addedWeightReps' || tracking === 'assistedReps';
  const value = (set: WorkoutSet) => (loaded ? (set.weight ?? 0) : (set.reps ?? set.durationSec ?? 0));
  const values = points.map((point) => value(point.set));
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <View style={styles.chart} accessibilityLabel="Top set chart">
      {points.map(({ session, set }, index) => {
        const height = 14 + (max === min ? 0.6 : (value(set) - min) / (max - min)) * (CHART_HEIGHT - 14);
        const last = index === points.length - 1;
        return (
          <View key={`${session.workoutId}-${index}`} style={styles.column}>
            <ThemedText num style={[styles.reps, last && { color: C.accent }]}>
              {loaded ? n(set.reps) : ''}
            </ThemedText>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { height }, last && styles.barLast]} />
            </View>
            <ThemedText num style={styles.load} numberOfLines={1}>
              {loaded ? formatLoad(set.weight, tracking) : n(set.reps ?? set.durationSec)}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center' },
  loading: { marginTop: 32 },
  list: { paddingHorizontal: 16, paddingBottom: 48, gap: 10 },
  muted: { color: C.t2 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    backgroundColor: C.s1,
    borderRadius: Radius.card,
    padding: 14,
    marginBottom: 6,
  },
  column: { flex: 1, alignItems: 'center', gap: 4 },
  reps: { ...numStyle, fontSize: 11, color: C.t3 },
  barTrack: { height: CHART_HEIGHT, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bar: { width: '70%', maxWidth: 22, borderRadius: 4, backgroundColor: C.s3 },
  barLast: { backgroundColor: C.accent },
  load: { ...numStyle, fontSize: 10.5, color: C.t2 },
  session: { gap: 4, padding: 14, borderRadius: Radius.card, backgroundColor: C.s1 },
  sessionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  date: { fontSize: 15, fontWeight: '600' },
  workoutName: { flex: 1, textAlign: 'right', fontSize: 13, color: C.t3 },
  top: { ...numStyle, fontSize: 17, fontWeight: '600', color: C.t1 },
  count: { ...numStyle, fontSize: 13, color: C.t3, fontWeight: '400' },
  warm: { ...numStyle, fontSize: 13, color: C.t3 },
});
