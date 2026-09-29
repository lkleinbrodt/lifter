import * as Haptics from 'expo-haptics';

import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  type GslpSessionLog,
  type GslpState,
  type Outcome,
  defaultGslpState,
  describeOutcome,
  formatLiftWeight,
  formatNumber,
  formatScheme,
  gslpLifts,
  gslpWorkouts,
  isWeightSet,
  nextSession,
  nextWorkoutKey,
  sessionPosition,
  undoLastSession,
} from '@/lib/gslp';
import React, { useCallback, useState } from 'react';
import { loadGslpDraft, loadGslpState, saveGslpState } from '@/lib/gslp-storage';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { ProgramHeader } from '@/components/program-header';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CYCLE_LENGTH = 6; // A/B/A + B/A/B

export default function GslpWorkoutsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [state, setState] = useState<GslpState>(defaultGslpState);
  const [hasDraft, setHasDraft] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([loadGslpState(), loadGslpDraft()]).then(([stored, draft]) => {
        if (active) {
          setState(stored);
          setHasDraft(draft?.sessionIndex === stored.history.length);
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const handleUndo = useCallback(() => {
    Alert.alert('Undo last session?', 'Removes it from history and restores the weights it started from.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo',
        style: 'destructive',
        onPress: async () => {
          const next = undoLastSession(state);
          setState(next);
          await saveGslpState(next);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, [state]);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Loading workouts…</ThemedText>
      </ThemedView>
    );
  }

  const next = nextSession(state);
  const position = sessionPosition(next.index);
  const workout = gslpWorkouts[next.workout];
  const weightsMissing = next.lifts.some((lift) => !isWeightSet(lift, state.weights));
  const cycleStart = next.index - (next.index % CYCLE_LENGTH);
  const history = [...state.history].reverse();

  return (
    <SafeAreaContainer edges={['top', 'right', 'left']}>
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}>
          <ProgramHeader title="Workouts" />

          {weightsMissing ? (
            <Card style={styles.emptyCard}>
              <ThemedText type="defaultSemiBold">Set your starting weights first</ThemedText>
              <ThemedText style={styles.subtle}>
                Go to the Weights tab and enter a starting weight for each lift in this workout.
              </ThemedText>
            </Card>
          ) : null}

          <View style={styles.rotation}>
            {Array.from({ length: CYCLE_LENGTH }, (_, offset) => {
              const index = cycleStart + offset;
              const done = index < next.index;
              const isNext = index === next.index;
              return (
                <React.Fragment key={index}>
                  {offset === 3 ? <View style={styles.rotationDivider} /> : null}
                  <View style={[styles.rotationPill, done && styles.rotationDone, isNext && styles.rotationNext]}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.rotationText, done && styles.rotationTextDone, isNext && styles.rotationTextNext]}>
                      {index % 2 === 0 ? 'A' : 'B'}
                    </ThemedText>
                  </View>
                </React.Fragment>
              );
            })}
          </View>

          <Pressable onPress={() => router.push('/gslp/session')} accessibilityRole="button">
            {({ pressed }) => (
              <Card style={[styles.nextCard, pressed && styles.pressed]}>
                <ThemedText type="label" style={styles.tintLabel}>
                  Next up · Week {position.week} · Day {position.day}
                </ThemedText>
                <ThemedText type="title">
                  {workout.label} · {workout.focus}
                </ThemedText>
                <View style={styles.liftList}>
                  {next.lifts.map((lift) => (
                    <View key={lift.key} style={styles.liftRow}>
                      <ThemedText style={styles.liftName}>{lift.label}</ThemedText>
                      <ThemedText style={styles.subtle}>
                        {isWeightSet(lift, state.weights) ? formatLiftWeight(lift, state.weights[lift.key]) : '—'} ·{' '}
                        {formatScheme(lift)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                <Button
                  title={hasDraft ? 'Resume Session' : 'Start Session'}
                  onPress={() => router.push('/gslp/session')}
                />
              </Card>
            )}
          </Pressable>

          <ThemedText style={styles.subtle}>
            Then {gslpWorkouts[nextWorkoutKey(next.workout)].label}. Three sessions a week on non-consecutive days.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.historyTitle}>
            History
          </ThemedText>
          {history.length === 0 ? (
            <ThemedText style={styles.subtle}>No sessions logged yet.</ThemedText>
          ) : (
            history.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                index={state.history.length - 1 - i}
                onUndo={i === 0 ? handleUndo : undefined}
              />
            ))
          )}
        </ScrollView>
      </ThemedView>
    </SafeAreaContainer>
  );
}

const outcomeColor: Record<Outcome, string> = {
  progress: Colors.dark.tint,
  double: Colors.dark.tint,
  deload: Colors.dark.error,
  repeat: Colors.dark.textMuted,
};

function SessionCard({ session, index, onUndo }: { session: GslpSessionLog; index: number; onUndo?: () => void }) {
  const position = sessionPosition(index);
  const date = new Date(session.date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <View style={styles.historyHeaderText}>
          <ThemedText type="label">
            {date} · Week {position.week} · Day {position.day}
          </ThemedText>
          <ThemedText type="defaultSemiBold">{gslpWorkouts[session.workout].label}</ThemedText>
        </View>
        {onUndo ? (
          <Pressable onPress={onUndo} hitSlop={8} accessibilityRole="button" accessibilityLabel="Undo last session">
            <ThemedText style={styles.undo}>Undo</ThemedText>
          </Pressable>
        ) : null}
      </View>
      {session.lifts.map((log) => {
        const lift = gslpLifts[log.lift];
        return (
          <View key={log.lift} style={styles.liftRow}>
            <ThemedText style={styles.liftName}>{lift.label}</ThemedText>
            <ThemedText style={styles.subtle}>
              {formatNumber(log.weight)} × {log.amrapReps ?? '—'}
            </ThemedText>
            <ThemedText style={[styles.outcome, { color: outcomeColor[log.outcome] }]}>
              {describeOutcome(log.outcome, log.weight, log.nextWeight)}
            </ThemedText>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    padding: 16,
  },
  subtle: {
    color: Colors.dark.textMuted,
  },
  tintLabel: {
    color: Colors.dark.tint,
  },
  emptyCard: {
    gap: 8,
    borderColor: Colors.dark.tint,
    borderWidth: 1,
  },
  rotation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rotationDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 4,
  },
  rotationPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
  },
  rotationDone: {
    backgroundColor: Colors.dark.tintMuted,
  },
  rotationNext: {
    borderColor: Colors.dark.tint,
  },
  rotationText: {
    color: Colors.dark.textMuted,
  },
  rotationTextDone: {
    color: Colors.dark.tint,
  },
  rotationTextNext: {
    color: Colors.dark.text,
  },
  nextCard: {
    gap: 12,
  },
  pressed: {
    opacity: 0.9,
  },
  liftList: {
    gap: 8,
  },
  liftRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  liftName: {
    flex: 1,
  },
  historyTitle: {
    opacity: 0.8,
    marginTop: 8,
  },
  historyCard: {
    gap: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  historyHeaderText: {
    flex: 1,
    gap: 4,
  },
  undo: {
    color: Colors.dark.tint,
  },
  outcome: {
    fontSize: 12,
    minWidth: 64,
    textAlign: 'right',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
