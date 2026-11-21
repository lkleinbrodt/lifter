// GSLP Workout tab: the next session as a hero card (or the live workout while one is in
// progress), the other template and an empty workout, and the last finished session.

import * as Haptics from 'expo-haptics';

import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  type GslpState,
  type GslpWorkoutKey,
  defaultGslpState,
  formatScheme,
  gslpLiftOrder,
  gslpLifts,
  gslpWorkouts,
  isWeightSet,
  nextSession,
  nextWorkoutKey,
  pickedAccessory,
  sessionPosition,
} from '@/lib/gslp';
import { ActionMenu, type MenuAnchor, type MenuState, measureAnchor } from '@/components/ui/action-menu';
import { C, Radius, numStyle } from '@/constants/theme';
import React, { useCallback, useRef, useState } from 'react';
import { formatDuration, formatMinutes } from '@/lib/workout-edit';
import { formatLoad, getExercise, splitExerciseName } from '@/lib/exercises';
import { getActiveWorkout, reopenGslpWorkout, startEmptyWorkout, startGslpWorkout } from '@/lib/workout-actions';
import { gslpTemplateName, workoutDisplayName } from '@/lib/workout-names';
import { restRemaining, useSession } from '@/lib/session-store';
import { type Workout, isWorkingSet } from '@/lib/workout';
import { useFocusEffect, useRouter } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SectionHeader } from '@/components/ui/primitives';
import { ProgramHeader } from '@/components/program-header';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { listWorkouts } from '@/lib/db';
import { loadGslpState } from '@/lib/gslp-storage';
import { nextUpFor } from '@/components/workout/next-up';
import { useNow } from '@/components/workout/rest-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CYCLE_LENGTH = 6; // A/B/A + B/A/B

const liftByExercise = new Map(gslpLiftOrder.map((key) => [gslpLifts[key].exerciseId, gslpLifts[key]] as const));

export default function GslpWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [state, setState] = useState<GslpState>(defaultGslpState);
  const [active, setActive] = useState<Workout | null>(null);
  const [last, setLast] = useState<Workout | null>(null);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const load = useCallback(async () => {
    const [stored, current, [latest]] = await Promise.all([loadGslpState(), getActiveWorkout(), listWorkouts({ limit: 1 })]);
    setState(stored);
    setActive(current);
    setLast(latest ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const start = useCallback(
    async (begin: () => Promise<Workout>) => {
      setStarting(true);
      try {
        const workout = await begin();
        router.push(`/workout/${workout.id}`);
      } finally {
        setStarting(false);
      }
    },
    [router],
  );

  const undoAndReopen = useCallback(
    (workoutId: string) =>
      Alert.alert('Undo and reopen?', 'Restores the GSLP weights from before this workout and reopens it for editing.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reopen',
          style: 'destructive',
          onPress: async () => {
            const reopened = await reopenGslpWorkout(workoutId);
            if (!reopened) {
              Alert.alert("Can't reopen", 'Finish or discard the workout in progress first.');
              return;
            }
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await load();
            router.push(`/workout/${workoutId}`);
          },
        },
      ]),
    [load, router],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  const next = nextSession(state);
  const other = nextWorkoutKey(next.workout);
  const weightsMissing = next.lifts.some((lift) => !isWeightSet(lift, state.weights));

  return (
    <SafeAreaContainer edges={['top', 'right', 'left']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}>
        <ProgramHeader title="Workout" />

        {active ? (
          <LiveCard workout={active} onResume={() => router.push(`/workout/${active.id}`)} />
        ) : (
          <>
            <NextCard
              state={state}
              template={next.workout}
              index={next.index}
              starting={starting}
              disabled={weightsMissing}
              onStart={() => start(() => startGslpWorkout(next.workout))}
            />
            {weightsMissing ? (
              <Pressable onPress={() => router.push('/gslp/settings')} hitSlop={6}>
                <ThemedText style={styles.missing}>
                  Some weights aren&apos;t set. <ThemedText style={styles.link}>Set them in Settings ›</ThemedText>
                </ThemedText>
              </Pressable>
            ) : null}
            <View style={styles.altRow}>
              <Button
                title={`Do ${other} instead`}
                variant="secondary"
                disabled={starting}
                style={styles.flex}
                onPress={() => start(() => startGslpWorkout(other))}
              />
              <Button title="Empty workout" variant="secondary" disabled={starting} style={styles.flex} onPress={() => start(startEmptyWorkout)} />
            </View>
          </>
        )}

        {last ? (
          <View style={styles.section}>
            <SectionHeader title="Last session" action="History ›" onAction={() => router.push('/gslp/history')} />
            <LastSessionCard
              workout={last}
              state={state}
              onOpen={() => router.push(`/workout/${last.id}`)}
              onMenu={
                state.history.at(-1)?.workoutId === last.id && !active
                  ? (anchor) =>
                      setMenu({
                        anchor,
                        items: [{ label: 'Undo & reopen', icon: 'arrow.uturn.backward', destructive: true, onPress: () => undoAndReopen(last.id) }],
                      })
                  : undefined
              }
            />
          </View>
        ) : null}
      </ScrollView>
      <ActionMenu menu={menu} onClose={() => setMenu(null)} />
    </SafeAreaContainer>
  );
}

// ---- Next up ----

function CycleDots({ index }: { index: number }) {
  const cycleStart = index - (index % CYCLE_LENGTH);
  return (
    <View style={styles.dots} accessibilityLabel={`Session ${(index % CYCLE_LENGTH) + 1} of ${CYCLE_LENGTH} in this cycle`}>
      {Array.from({ length: CYCLE_LENGTH }, (_, offset) => {
        const at = cycleStart + offset;
        return (
          <React.Fragment key={offset}>
            {offset === 3 ? <View style={styles.dotDivider} /> : null}
            <View style={[styles.dot, at < index && styles.dotDone, at === index && styles.dotNext]} />
          </React.Fragment>
        );
      })}
    </View>
  );
}

function NextCard({
  state,
  template,
  index,
  starting,
  disabled,
  onStart,
}: {
  state: GslpState;
  template: GslpWorkoutKey;
  index: number;
  starting: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const { week, day } = sessionPosition(index);
  const config = gslpWorkouts[template];
  const lifts = nextSession(state).lifts;
  const withIds = [
    ...Object.values(config.partners),
    ...config.accessories.filter((slot) => !slot.optional).map((slot) => pickedAccessory(state.accessoryPicks, slot.archetype).exerciseId),
  ].filter((id): id is string => !!id);
  const withNames = [...new Set(withIds.map((id) => splitExerciseName(getExercise(id).name).title.toLowerCase()))];

  return (
    <View style={styles.hero}>
      <View style={styles.eyebrowRow}>
        <ThemedText type="caption" style={styles.eyebrow}>
          GSLP · Week {week} · Day {day}
        </ThemedText>
        <CycleDots index={index} />
      </View>
      <ThemedText style={styles.heroTitle}>{gslpTemplateName(template)}</ThemedText>
      <View style={styles.lifts}>
        {lifts.map((lift) => {
          const { tracking } = getExercise(lift.exerciseId);
          const weight = state.weights[lift.key];
          return (
            <View key={lift.key} style={styles.liftRow}>
              <View style={styles.flex}>
                <ThemedText style={styles.liftName}>{lift.label}</ThemedText>
                <ThemedText num style={styles.scheme}>
                  {formatScheme(lift)}
                </ThemedText>
              </View>
              <ThemedText num style={styles.liftWeight}>
                {isWeightSet(lift, state.weights) ? formatLoad(weight, tracking) : '—'}
              </ThemedText>
            </View>
          );
        })}
      </View>
      {withNames.length ? (
        <ThemedText type="subhead" style={styles.withLine}>
          With {withNames.join(', ')}
        </ThemedText>
      ) : null}
      <Button title={`Start ${template}`} loading={starting} disabled={disabled} onPress={onStart} />
    </View>
  );
}

// ---- In progress ----

function LiveCard({ workout, onResume }: { workout: Workout; onResume: () => void }) {
  const { rest } = useSession();
  const now = useNow(true);
  const elapsed = Math.max(0, Math.round((now - new Date(workout.startedAt).getTime()) / 1000));
  const left = restRemaining(rest, now);
  const sets = workout.exercises.flatMap((entry) => entry.sets);
  const done = sets.filter((set) => set.done).length;
  const upNext = nextUpFor(workout);

  return (
    <View style={styles.hero}>
      <View style={styles.eyebrowRow}>
        <ThemedText type="caption" style={styles.eyebrow}>
          In progress
        </ThemedText>
        <ThemedText num style={styles.elapsed}>
          {formatDuration(elapsed)}
        </ThemedText>
      </View>
      <View style={styles.liveTitleRow}>
        <ThemedText style={[styles.heroTitle, styles.flex]}>{workoutDisplayName(workout)}</ThemedText>
        <ThemedText num style={styles.counter}>
          {done}/{sets.length}
        </ThemedText>
      </View>
      <View style={styles.progress}>
        {workout.exercises.map((entry) => {
          const fraction = entry.sets.length ? entry.sets.filter((set) => set.done).length / entry.sets.length : 0;
          return (
            <View key={entry.id} style={styles.progressSegment}>
              <View style={[styles.progressFill, { width: `${fraction * 100}%` }]} />
            </View>
          );
        })}
      </View>
      {upNext ? (
        <View style={styles.upNext}>
          <ThemedText type="caption">Up next</ThemedText>
          <View style={styles.upNextRow}>
            <ThemedText style={[styles.liftName, styles.flex]} numberOfLines={1}>
              {upNext.name} <ThemedText style={styles.upNextSet}>· {upNext.set}</ThemedText>
            </ThemedText>
            <ThemedText num style={styles.upNextNumbers}>
              {upNext.numbers}
            </ThemedText>
          </View>
        </View>
      ) : null}
      {left !== null ? (
        <View style={styles.restRow}>
          <ThemedText type="caption">Rest</ThemedText>
          <ThemedText num style={styles.restTime}>
            {formatDuration(left)}
          </ThemedText>
        </View>
      ) : null}
      <Button title="Resume" onPress={onResume} />
    </View>
  );
}

// ---- Last session ----

function LastSessionCard({
  workout,
  state,
  onOpen,
  onMenu,
}: {
  workout: Workout;
  state: GslpState;
  onOpen: () => void;
  onMenu?: (anchor: MenuAnchor) => void;
}) {
  const menuRef = useRef<View>(null);
  const start = new Date(workout.startedAt);
  const duration = workout.finishedAt ? (new Date(workout.finishedAt).getTime() - start.getTime()) / 1000 : 0;
  const log = state.history.find((session) => session.workoutId === workout.id);
  const mainLifts = workout.exercises.flatMap((entry) => {
    const lift = liftByExercise.get(entry.exerciseId);
    if (!lift) return [];
    const working = entry.sets.filter((set) => isWorkingSet(set) && set.done);
    const top = working.find((set) => set.type === 'amrap') ?? working.at(-1);
    if (!top) return [];
    const { tracking } = getExercise(entry.exerciseId);
    const nextWeight = log?.lifts.find((item) => item.lift === lift.key)?.nextWeight;
    return [{ lift, set: `${formatLoad(top.weight, tracking) || '–'} × ${top.reps ?? '–'}`, next: nextWeight, tracking, weight: top.weight }];
  });

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.lastCard, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.lastHeader}>
        <View style={styles.flex}>
          <ThemedText style={styles.lastTitle}>{workoutDisplayName(workout)}</ThemedText>
          <ThemedText type="subhead">
            {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            {duration > 0 ? ` · ${formatMinutes(duration)}` : ''}
          </ThemedText>
        </View>
        {onMenu ? (
          <View ref={menuRef} collapsable={false}>
            <Pressable onPress={() => measureAnchor(menuRef.current, onMenu)} style={styles.menuButton} accessibilityLabel="Session options">
              <IconSymbol name="ellipsis" size={20} color={C.t2} />
            </Pressable>
          </View>
        ) : null}
      </View>
      {mainLifts.map(({ lift, set, next, tracking, weight }) => (
        <View key={lift.key} style={styles.lastRow}>
          <ThemedText style={[styles.lastLift, styles.flex]}>{lift.label}</ThemedText>
          <ThemedText num style={styles.lastSet}>
            {set}
            {next !== undefined ? (
              <ThemedText num style={[styles.lastSet, { color: next < (weight ?? 0) ? C.deload : C.accent }]}>
                {'  → '}
                {formatLoad(next, tracking)}
              </ThemedText>
            ) : null}
          </ThemedText>
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  content: { padding: 16, gap: 12, backgroundColor: C.bg, flexGrow: 1 },
  hero: { backgroundColor: C.s1, borderRadius: Radius.hero, padding: 18, gap: 14, marginTop: 8 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: C.accent },
  heroTitle: { fontSize: 27, lineHeight: 32, fontWeight: '700' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.s3 },
  dotDone: { backgroundColor: C.accent },
  dotNext: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.accent },
  dotDivider: { width: 1, height: 10, backgroundColor: C.t4, marginHorizontal: 2 },
  lifts: { gap: 12 },
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liftName: { fontSize: 17, fontWeight: '600' },
  scheme: { ...numStyle, fontSize: 13, color: C.t3, marginTop: 1 },
  liftWeight: { ...numStyle, fontSize: 22, fontWeight: '600', minWidth: 62, textAlign: 'right' },
  withLine: { color: C.t2 },
  missing: { fontSize: 15, color: C.t2, paddingHorizontal: 4 },
  link: { fontSize: 15, color: C.accent },
  altRow: { flexDirection: 'row', gap: 12 },
  section: { gap: 10, marginTop: 14 },
  elapsed: { ...numStyle, fontSize: 15, color: C.accent },
  liveTitleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  counter: { ...numStyle, fontSize: 17, color: C.t2, paddingBottom: 3 },
  progress: { flexDirection: 'row', gap: 3 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.s3, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: C.accent },
  upNext: { gap: 4 },
  upNextRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  upNextSet: { fontSize: 17, color: C.t2 },
  upNextNumbers: { ...numStyle, fontSize: 17, color: C.t1 },
  restRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  restTime: { ...numStyle, fontSize: 20, fontWeight: '600', color: C.accent },
  lastCard: { backgroundColor: C.s1, borderRadius: Radius.card, padding: 16, gap: 10 },
  pressed: { opacity: 0.85 },
  lastHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lastTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  menuButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginRight: -10 },
  lastRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  lastLift: { fontSize: 15, color: C.t2 },
  lastSet: { ...numStyle, fontSize: 15, color: C.t1 },
});
