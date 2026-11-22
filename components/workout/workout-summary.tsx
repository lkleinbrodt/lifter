// Finished workout: a hero card (check medallion, workout number and week streak, Time/Sets/Volume),
// new personal records, what GSLP will load next time, and each exercise on one line.
//
// Right after Finish (`celebrate`), it plays once: confetti and the medallion, stats count up,
// weight increases and records pop in, each with a haptic tick. Reduce Motion skips all of that
// (the Finish success haptic still fires). Opened later from History, it renders still.

import * as Haptics from 'expo-haptics';

import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Pressable, StyleSheet, View } from 'react-native';
import { type GslpSessionLog, formatNumber, gslpLifts } from '@/lib/gslp';
import { type PersonalRecord, type WorkoutStreak, ordinal, personalRecords, workoutStreak } from '@/lib/workout-wins';
import React, { useEffect, useState } from 'react';
import { type Workout, type WorkoutSet, isWorkingSet } from '@/lib/workout';
import { finishedStartTimes, setsBefore } from '@/lib/db';
import { formatLoad, getExercise, splitExerciseName } from '@/lib/exercises';
import { formatMinutes, lateFinishSuggestion, setFinishedAt, workoutStats } from '@/lib/workout-edit';

import { C, Radius, numStyle } from '@/constants/theme';
import { Confetti, CountUp, Medallion, PopIn } from './celebration';
import { FinishTimeSheet, clockTime } from './finish-time-sheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Pill } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { formatSet } from './set-row';

const n = (value: number | undefined) => (value === undefined ? '–' : formatNumber(value));

const MAIN_SLOTS: ReadonlySet<string> = new Set(Object.keys(gslpLifts));

// Celebration timeline (ms after Finish).
const T = {
  stats: 350, // first count-up starts; each next one 120 later
  cards: 1350, // cards below the hero slide in
  pills: 1700, // weight-increase pills, 220 apart
  pillGap: 220,
};

type Wins = { streak: WorkoutStreak; records: PersonalRecord[] };

export function WorkoutSummary({
  workout,
  log,
  celebrate = false,
  onChange,
}: {
  workout: Workout;
  log?: GslpSessionLog;
  celebrate?: boolean;
  /** Saves an edit made from the summary (the finish time). */
  onChange: (workout: Workout) => void;
}) {
  const reduceMotion = useReducedMotion();
  const play = celebrate && !reduceMotion;
  const stats = workoutStats(workout);
  const template = workout.source.kind === 'program' ? workout.source.template : undefined;
  const [wins, setWins] = useState<Wins | null>(null);
  const [timeSheet, setTimeSheet] = useState(false);
  const late = lateFinishSuggestion(workout);

  useEffect(() => {
    let active = true;
    const ids = [...new Set(workout.exercises.map((entry) => entry.exerciseId))];
    Promise.all([finishedStartTimes(), setsBefore(ids, workout.startedAt)])
      .then(([starts, history]) => {
        if (active) setWins({ streak: workoutStreak(workout, starts), records: personalRecords(workout, history, MAIN_SLOTS) });
      })
      .catch((error) => console.warn('Loading workout wins failed', error));
    return () => {
      active = false;
    };
    // The record list only depends on what was lifted, not on the finish time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout.id, workout.exercises]);

  const lifts = log?.lifts ?? [];
  const recordDelay = T.pills + lifts.filter((entry) => entry.nextWeight !== entry.weight).length * T.pillGap + 120;
  const recordIds = new Set(wins?.records.map((record) => record.exerciseId));
  const enter = (delay: number) => (play ? FadeInDown.duration(380).delay(delay) : undefined);

  return (
    <View style={styles.wrap}>
      {/* ---- Hero ---- */}
      <View style={styles.hero}>
        <View style={styles.burst}>
          <Medallion play={play} />
          <Confetti play={play} />
        </View>
        <View style={styles.heroText}>
          <ThemedText type="caption" style={styles.heroCaption}>
            Workout complete
          </ThemedText>
          <ThemedText type="title2" style={styles.heroTitle}>
            {wins ? `Workout ${wins.streak.number}` : ' '}
          </ThemedText>
          <View style={styles.streakRow}>
            {wins ? (
              <>
                <ThemedText style={styles.streakText}>{ordinal(wins.streak.thisWeek)} of the week</ThemedText>
                {wins.streak.weeks >= 2 ? (
                  <>
                    <ThemedText style={styles.streakText}>·</ThemedText>
                    <IconSymbol name="flame.fill" size={13} color={C.amrap} />
                    <ThemedText style={[styles.streakText, styles.streakHot]}>{wins.streak.weeks}-week streak</ThemedText>
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.heroStats}>
          <Pressable
            onPress={() => setTimeSheet(true)}
            style={({ pressed }) => [styles.heroStat, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Time ${formatMinutes(stats.durationSec)}. Change finish time`}>
            <CountUp value={stats.durationSec} format={formatMinutes} play={play} delay={T.stats} style={[styles.heroValue, late && styles.lateValue]} />
            <View style={styles.statLabel}>
              <ThemedText type="caption">Time</ThemedText>
              <IconSymbol name="pencil" size={11} color={C.t3} />
            </View>
          </Pressable>
          <View style={styles.statRule} />
          <View style={styles.heroStat}>
            <CountUp value={stats.sets} format={(v) => String(Math.round(v))} play={play} delay={T.stats + 120} style={styles.heroValue} />
            <ThemedText type="caption">Sets</ThemedText>
          </View>
          <View style={styles.statRule} />
          <View style={styles.heroStat}>
            <CountUp
              value={stats.volume}
              format={(v) => Math.round(v).toLocaleString()}
              play={play}
              delay={T.stats + 240}
              style={styles.heroValue}
            />
            <ThemedText type="caption">Volume</ThemedText>
          </View>
        </View>

        {late ? (
          <View style={styles.late}>
            <ThemedText style={styles.lateText}>
              Last set at {clockTime(late)}, {formatMinutes((new Date(workout.finishedAt!).getTime() - late.getTime()) / 1000)} before Finish.
            </ThemedText>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(setFinishedAt(workout, late));
              }}
              hitSlop={6}
              style={({ pressed }) => [styles.lateButton, pressed && styles.pressed]}
              accessibilityRole="button">
              <ThemedText num style={styles.lateButtonText}>
                End {clockTime(late)}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* ---- Records ---- */}
      {wins && wins.records.length ? (
        <Animated.View entering={enter(T.cards)} style={styles.card}>
          <View style={styles.cardTitle}>
            <IconSymbol name="star.fill" size={12} color={C.amrap} />
            <ThemedText type="caption" style={{ color: C.amrap }}>
              {wins.records.length === 1 ? 'New record' : `${wins.records.length} new records`}
            </ThemedText>
          </View>
          {wins.records.map((record, index) => {
            const { name, tracking } = getExercise(record.exerciseId);
            return (
              <View key={record.exerciseId} style={styles.nextRow}>
                <View style={styles.flex}>
                  <ThemedText style={styles.liftName}>{splitExerciseName(name).title}</ThemedText>
                  <ThemedText num style={styles.detail}>
                    {record.e1rm
                      ? `e1RM ${record.e1rm.now} · was ${record.e1rm.was}`
                      : `was ${compact(record.previous, tracking)}`}
                  </ThemedText>
                </View>
                <PopIn play={play} delay={recordDelay - T.cards + index * T.pillGap} haptic={Haptics.ImpactFeedbackStyle.Heavy}>
                  <ThemedText num style={styles.recordSet}>
                    {compact(record.set, tracking)}
                  </ThemedText>
                </PopIn>
              </View>
            );
          })}
        </Animated.View>
      ) : null}

      {/* ---- Next session ---- */}
      {lifts.length ? (
        <Animated.View entering={enter(T.cards + 80)} style={styles.card}>
          <ThemedText type="caption">Next {template ?? log?.workout}</ThemedText>
          {lifts.map((entry, index) => {
            const lift = gslpLifts[entry.lift];
            const { tracking } = getExercise(lift.exerciseId);
            const delta = entry.nextWeight - entry.weight;
            const hit = entry.outcome !== 'deload';
            const popDelay = T.pills + lifts.slice(0, index).filter((other) => other.nextWeight !== other.weight).length * T.pillGap;
            return (
              <View key={entry.lift} style={styles.nextRow}>
                <View style={styles.flex}>
                  <ThemedText style={styles.liftName}>{lift.label}</ThemedText>
                  <ThemedText num style={[styles.detail, hit && { color: C.amrap }]}>
                    {hit ? '★ ' : ''}AMRAP {formatLoad(entry.weight, tracking)} × {entry.amrapReps ?? '–'}
                  </ThemedText>
                </View>
                {delta > 0 ? (
                  <PopIn play={play} delay={popDelay} haptic={Haptics.ImpactFeedbackStyle.Medium}>
                    <Pill label={entry.outcome === 'double' ? `+${n(delta)} ×2` : `+${n(delta)}`} tone="accent" num />
                  </PopIn>
                ) : null}
                {delta < 0 ? <Pill label={`↓ ${n(-delta)}`} tone="deload" num /> : null}
                <ThemedText num style={[styles.nextWeight, delta < 0 && { color: C.deload }]}>
                  {formatLoad(entry.nextWeight, tracking)}
                </ThemedText>
              </View>
            );
          })}
        </Animated.View>
      ) : null}

      {/* ---- Exercises ---- */}
      <Animated.View entering={enter(T.cards + 160)} style={styles.card}>
        {workout.exercises.map((entry, index) => {
          const { name, tracking } = getExercise(entry.exerciseId);
          const work = entry.sets.filter(isWorkingSet);
          const warm = entry.sets.filter((set) => !isWorkingSet(set));
          return (
            <View key={entry.id} style={[styles.exercise, index > 0 && styles.divider]}>
              <View style={styles.exerciseHeader}>
                <ThemedText style={styles.exerciseName}>{splitExerciseName(name).title}</ThemedText>
                {recordIds.has(entry.exerciseId) ? <IconSymbol name="star.fill" size={12} color={C.amrap} /> : null}
              </View>
              <ThemedText num style={styles.sets}>
                {work.map((set, i) => (
                  <ThemedText key={set.id} num style={[styles.sets, set.type === 'amrap' && { color: C.amrap }]}>
                    {i > 0 ? ' · ' : ''}
                    {compact(set, tracking)}
                  </ThemedText>
                ))}
                {warm.length ? (
                  <ThemedText num style={styles.warm}>
                    {'  · w '}
                    {warm.map((set) => n(set.weight)).join(' ')}
                  </ThemedText>
                ) : null}
              </ThemedText>
            </View>
          );
        })}
      </Animated.View>

      <FinishTimeSheet
        workout={workout}
        visible={timeSheet}
        onClose={() => setTimeSheet(false)}
        onSave={(next) => {
          setTimeSheet(false);
          onChange(next);
        }}
      />
    </View>
  );
}

/** "95×5", "BW×6", "10", "45s". */
function compact(set: WorkoutSet, tracking: Parameters<typeof formatSet>[1]) {
  return formatSet(set, tracking).replace(' × ', '×').replace(' reps', '');
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },

  hero: {
    backgroundColor: '#152019', // s1 with a sage cast
    borderRadius: Radius.hero,
    borderWidth: 1,
    borderColor: 'rgba(157,193,173,0.22)',
    paddingTop: 26,
    paddingBottom: 6,
    alignItems: 'center',
    overflow: 'hidden',
  },
  burst: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  heroText: { alignItems: 'center', marginTop: 16, gap: 2 },
  heroCaption: { color: C.accent },
  heroTitle: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 20 },
  streakText: { fontSize: 15, color: C.t2 },
  streakHot: { color: C.amrap, fontWeight: '600' },

  heroStats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 20,
    marginHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(157,193,173,0.22)',
  },
  heroStat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, borderRadius: Radius.field },
  heroValue: { ...numStyle, fontSize: 24, lineHeight: 30, fontWeight: '700', color: C.t1 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statRule: { width: StyleSheet.hairlineWidth, marginVertical: 14, backgroundColor: 'rgba(157,193,173,0.22)' },
  lateValue: { color: C.amrap },

  late: {
    alignSelf: 'stretch',
    marginHorizontal: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.amrapBg,
    borderRadius: Radius.field,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
  },
  lateText: { flex: 1, fontSize: 14, lineHeight: 19, color: C.amrap },
  lateButton: { backgroundColor: C.amrap, borderRadius: Radius.pill, paddingHorizontal: 12, height: 32, justifyContent: 'center' },
  lateButtonText: { ...numStyle, fontSize: 13, fontWeight: '700', color: C.onAccent },

  card: { backgroundColor: C.s1, borderRadius: Radius.card, padding: 16, gap: 12 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liftName: { fontSize: 17, fontWeight: '600' },
  detail: { ...numStyle, fontSize: 13, color: C.t3, marginTop: 1 },
  recordSet: { ...numStyle, fontSize: 20, fontWeight: '700', color: C.amrap },
  nextWeight: { ...numStyle, fontSize: 22, fontWeight: '600', minWidth: 64, textAlign: 'right' },
  exercise: { gap: 3 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.09)', paddingTop: 12 },
  exerciseName: { fontSize: 16, fontWeight: '600' },
  sets: { ...numStyle, fontSize: 14, color: C.t2 },
  warm: { ...numStyle, fontSize: 14, color: C.t3 },
});
