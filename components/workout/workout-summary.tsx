// Finished workout: stat tiles, what GSLP will load next time, and each exercise on one line.

import { StyleSheet, View } from 'react-native';
import { type GslpSessionLog, formatNumber, gslpLifts } from '@/lib/gslp';
import { formatLoad, getExercise, splitExerciseName } from '@/lib/exercises';
import { formatMinutes, workoutStats } from '@/lib/workout-edit';
import { type Workout, type WorkoutSet, isWorkingSet } from '@/lib/workout';

import { C, Radius, numStyle } from '@/constants/theme';
import { Pill, Stat } from '@/components/ui/primitives';
import React from 'react';
import { ThemedText } from '@/components/themed-text';
import { formatSet } from './set-row';

const n = (value: number | undefined) => (value === undefined ? '–' : formatNumber(value));

export function WorkoutSummary({ workout, log }: { workout: Workout; log?: GslpSessionLog }) {
  const stats = workoutStats(workout);
  const template = workout.source.kind === 'program' ? workout.source.template : undefined;

  return (
    <View style={styles.wrap}>
      <View style={styles.stats}>
        <Stat label="Time" value={formatMinutes(stats.durationSec)} style={styles.tile} />
        <Stat label="Sets" value={String(stats.sets)} style={styles.tile} />
        <Stat label="Volume" value={Math.round(stats.volume).toLocaleString()} style={styles.tile} />
      </View>

      {log && log.lifts.length ? (
        <View style={styles.card}>
          <ThemedText type="caption">Next {template ?? log.workout}</ThemedText>
          {log.lifts.map((entry) => {
            const lift = gslpLifts[entry.lift];
            const { tracking } = getExercise(lift.exerciseId);
            const delta = entry.nextWeight - entry.weight;
            return (
              <View key={entry.lift} style={styles.nextRow}>
                <View style={styles.flex}>
                  <ThemedText style={styles.liftName}>{lift.label}</ThemedText>
                  <ThemedText num style={styles.amrap}>
                    AMRAP {formatLoad(entry.weight, tracking)} × {entry.amrapReps ?? '–'}
                  </ThemedText>
                </View>
                {delta > 0 ? <Pill label={`+${n(delta)}`} tone="accent" num /> : null}
                {delta < 0 ? <Pill label={`↓ ${n(-delta)}`} tone="deload" num /> : null}
                <ThemedText num style={[styles.nextWeight, delta < 0 && { color: C.deload }]}>
                  {formatLoad(entry.nextWeight, tracking)}
                </ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.card}>
        {workout.exercises.map((entry, index) => {
          const { name, tracking } = getExercise(entry.exerciseId);
          const work = entry.sets.filter(isWorkingSet);
          const warm = entry.sets.filter((set) => !isWorkingSet(set));
          return (
            <View key={entry.id} style={[styles.exercise, index > 0 && styles.divider]}>
              <ThemedText style={styles.exerciseName}>{splitExerciseName(name).title}</ThemedText>
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
      </View>
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
  stats: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: C.s1, borderRadius: Radius.card, padding: 14 },
  card: { backgroundColor: C.s1, borderRadius: Radius.card, padding: 16, gap: 12 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liftName: { fontSize: 17, fontWeight: '600' },
  amrap: { ...numStyle, fontSize: 13, color: C.t3, marginTop: 1 },
  nextWeight: { ...numStyle, fontSize: 22, fontWeight: '600', minWidth: 64, textAlign: 'right' },
  exercise: { gap: 3 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.09)', paddingTop: 12 },
  exerciseName: { fontSize: 16, fontWeight: '600' },
  sets: { ...numStyle, fontSize: 14, color: C.t2 },
  warm: { ...numStyle, fontSize: 14, color: C.t3 },
});
