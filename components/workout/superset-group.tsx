import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { cardLayout } from './exercise-card';
import React, { type ReactNode } from 'react';

import { C, Radius } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import type { WorkoutExercise } from '@/lib/workout';

/** "Round 2 of 3": rounds are work sets; the current round is the first one not every member has done. */
export function supersetRound(members: WorkoutExercise[]) {
  const work = members.map((member) => member.sets.filter((set) => set.type !== 'warmup'));
  const rounds = Math.max(0, ...work.map((sets) => sets.length));
  const done = Math.min(...work.map((sets) => sets.filter((set) => set.done).length));
  return { round: Math.min(rounds, done + 1), rounds, finished: work.every((sets) => sets.every((set) => set.done)) };
}

/** Superset members in one ringed container (visual only; Phase 4 does the logic). */
export function SupersetGroup({ members, children }: { members: WorkoutExercise[]; children: ReactNode[] }) {
  const { round, rounds, finished } = supersetRound(members);
  return (
    <Animated.View layout={cardLayout} style={styles.group}>
      <ThemedText type="caption" style={styles.caption}>
        {finished ? 'Superset · done' : `Superset · round ${round} of ${rounds}`}
      </ThemedText>
      {children.map((child, index) => (
        <View key={index}>
          {index > 0 ? <DashedLine /> : null}
          {child}
        </View>
      ))}
    </Animated.View>
  );
}

// iOS draws dashed borders only on all four sides, so clip a dashed box down to its top edge.
function DashedLine() {
  return (
    <View style={styles.dashClip}>
      <View style={styles.dash} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: C.s1,
    borderRadius: Radius.group,
    borderWidth: 1,
    borderColor: C.supersetLine,
    overflow: 'hidden',
    paddingTop: 12,
  },
  caption: { color: C.superset, paddingHorizontal: 16, marginBottom: 2 },
  dashClip: { height: 1, overflow: 'hidden', marginHorizontal: 16 },
  dash: { height: 2, borderWidth: 1, borderColor: C.supersetLine, borderStyle: 'dashed' },
});
