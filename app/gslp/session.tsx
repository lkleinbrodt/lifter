import * as Haptics from 'expo-haptics';

import {
  GSLP_AMRAP_NOTE,
  GSLP_REST_NOTE,
  type GslpLift,
  type GslpLiftKey,
  type GslpSet,
  type GslpState,
  type LiftResult,
  completeSession,
  defaultGslpState,
  describeOutcome,
  evaluateLift,
  formatLiftWeight,
  formatNumber,
  gslpWorkouts,
  isResultComplete,
  isWeightSet,
  nextSession,
  warmupSets,
  workSets,
} from '@/lib/gslp';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { clearGslpDraft, loadGslpDraft, loadGslpState, saveGslpDraft, saveGslpState } from '@/lib/gslp-storage';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatPlateMath } from '@/lib/plates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Results = Partial<Record<GslpLiftKey, LiftResult>>;

const emptyResult: LiftResult = { amrapReps: null, painStop: false };

export default function GslpSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<GslpState>(defaultGslpState);
  const [results, setResults] = useState<Results>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadGslpState(), loadGslpDraft()]).then(([stored, draft]) => {
      const upcoming = nextSession(stored);
      setState(stored);
      if (draft && draft.sessionIndex === upcoming.index && draft.workout === upcoming.workout) {
        setResults(draft.results);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Loading session…</ThemedText>
      </ThemedView>
    );
  }

  const session = nextSession(state);
  const workout = gslpWorkouts[session.workout];
  const title = `${workout.label} · ${workout.focus}`;
  const weightsMissing = session.lifts.some((lift) => !isWeightSet(lift, state.weights));
  const allLogged = session.lifts.every((lift) => isResultComplete(results[lift.key]));

  const updateResult = (key: GslpLiftKey, patch: Partial<LiftResult>) => {
    const next = { ...results, [key]: { ...emptyResult, ...results[key], ...patch } };
    setResults(next);
    void saveGslpDraft({ workout: session.workout, sessionIndex: session.index, results: next });
  };

  const handleFinish = async () => {
    const next = completeSession(state, session.workout, results);
    await saveGslpState(next);
    await clearGslpDraft();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title }} />
      <SafeAreaContainer edges={['left', 'right']}>
        <ThemedView style={styles.container}>
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
            <ThemedText style={styles.subtle}>{GSLP_REST_NOTE}</ThemedText>

            {session.lifts.map((lift) => (
              <LiftCard
                key={lift.key}
                lift={lift}
                weight={state.weights[lift.key]}
                weightSet={isWeightSet(lift, state.weights)}
                result={results[lift.key] ?? emptyResult}
                onChange={(patch) => updateResult(lift.key, patch)}
              />
            ))}

            <View style={styles.accessoryBlock}>
              <ThemedText type="subtitle" style={styles.blockTitle}>
                Accessories
              </ThemedText>
              <Card style={styles.card}>
                {workout.accessories.map((accessory, index) => (
                  <View
                    key={accessory.name}
                    style={[styles.accessoryRow, index < workout.accessories.length - 1 && styles.divider]}>
                    <View style={styles.accessoryText}>
                      <ThemedText type="defaultSemiBold">{accessory.name}</ThemedText>
                      <ThemedText style={styles.subtle}>{accessory.prescription}</ThemedText>
                      {accessory.note ? <ThemedText style={styles.note}>{accessory.note}</ThemedText> : null}
                    </View>
                    {accessory.archetype ? (
                      <Pressable
                        onPress={() => router.push(`/archetype/${encodeURIComponent(accessory.archetype!)}`)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Alternatives to ${accessory.name}`}>
                        <ThemedText style={styles.link}>Swap</ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </Card>
            </View>

            {weightsMissing ? (
              <ThemedText style={styles.warning}>Set starting weights on the Weights tab before logging.</ThemedText>
            ) : !allLogged ? (
              <ThemedText style={styles.subtle}>Log the AMRAP reps for every lift to finish.</ThemedText>
            ) : null}
            <Button title="Finish Session" onPress={handleFinish} disabled={weightsMissing || !allLogged} />
          </ScrollView>
        </ThemedView>
      </SafeAreaContainer>
    </>
  );
}

type LiftCardProps = {
  lift: GslpLift;
  weight: number;
  weightSet: boolean;
  result: LiftResult;
  onChange: (patch: Partial<LiftResult>) => void;
};

function LiftCard({ lift, weight, weightSet, result, onChange }: LiftCardProps) {
  const warmups = warmupSets(lift, weight);
  const sets = workSets(lift, weight);
  const showPlates = lift.equipment === 'barbell';
  const logged = isResultComplete(result);
  const preview = logged && weightSet ? evaluateLift(lift, weight, result) : null;

  const stepReps = (delta: number) => {
    void Haptics.selectionAsync();
    // First tap lands on the target so hitting exactly the minimum is one tap.
    onChange({ amrapReps: result.amrapReps === null ? lift.reps : Math.max(0, result.amrapReps + delta) });
  };

  const formatSet = (set: GslpSet) =>
    lift.equipment === 'bodyweight'
      ? `${set.weight > 0 ? `+${formatNumber(set.weight)}` : 'BW'} × ${set.reps}`
      : `${formatNumber(set.weight)} × ${set.reps}`;

  return (
    <Card style={styles.card}>
      <View>
        <ThemedText type="title">{lift.label}</ThemedText>
        <ThemedText style={styles.tint}>{weightSet ? formatLiftWeight(lift, weight) : 'No weight set'}</ThemedText>
        {showPlates && weightSet ? <ThemedText style={styles.note}>{formatPlateMath(weight)}</ThemedText> : null}
      </View>

      {lift.notes.map((note) => (
        <ThemedText key={note} style={styles.note}>
          • {note}
        </ThemedText>
      ))}

      {warmups.length > 0 ? (
        <View style={styles.setGroup}>
          <ThemedText type="label">Warmup</ThemedText>
          {warmups.map((set, index) => (
            <View key={index} style={styles.setRow}>
              <ThemedText style={styles.subtle}>{formatSet(set)}</ThemedText>
              {showPlates ? <ThemedText style={styles.note}>{formatPlateMath(set.weight)}</ThemedText> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.setGroup}>
        <ThemedText type="label">Work sets</ThemedText>
        {sets.map((set, index) => (
          <ThemedText key={index} type="defaultSemiBold">
            {formatSet(set)}
            {set.amrap ? ' (AMRAP)' : ''}
          </ThemedText>
        ))}
      </View>

      <View style={styles.logBlock}>
        <View style={styles.stepperRow}>
          <View style={styles.stepperLabel}>
            <ThemedText type="defaultSemiBold">AMRAP reps</ThemedText>
            <ThemedText style={styles.note}>{GSLP_AMRAP_NOTE}</ThemedText>
          </View>
          <StepButton icon="minus" onPress={() => stepReps(-1)} label="Fewer reps" />
          <ThemedText type="title" style={styles.repsValue}>
            {result.amrapReps ?? '—'}
          </ThemedText>
          <StepButton icon="plus" onPress={() => stepReps(1)} label="More reps" />
        </View>

        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            onChange({ painStop: !result.painStop });
          }}
          style={styles.checkRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: result.painStop }}>
          <IconSymbol
            name={result.painStop ? 'checkmark.square.fill' : 'square'}
            size={22}
            color={result.painStop ? Colors.dark.tint : Colors.dark.icon}
          />
          <ThemedText style={styles.checkText}>Stopped for pain, not the weight (repeat instead of deload)</ThemedText>
        </Pressable>

        {preview ? (
          <ThemedText style={[styles.preview, preview.outcome === 'deload' && styles.previewDeload]}>
            Next time: {formatLiftWeight(lift, preview.nextWeight)} ·{' '}
            {describeOutcome(preview.outcome, weight, preview.nextWeight)}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

function StepButton({ icon, onPress, label }: { icon: 'plus' | 'minus'; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}>
      <IconSymbol name={icon} size={20} color={Colors.dark.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    gap: 16,
  },
  card: {
    gap: 12,
  },
  subtle: {
    color: Colors.dark.textMuted,
  },
  tint: {
    color: Colors.dark.tint,
  },
  note: {
    color: Colors.dark.textMuted,
    fontSize: 12,
  },
  warning: {
    color: Colors.dark.error,
  },
  setGroup: {
    gap: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  logBlock: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperLabel: {
    flex: 1,
    gap: 2,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  stepButtonPressed: {
    opacity: 0.7,
  },
  repsValue: {
    minWidth: 32,
    textAlign: 'center',
    marginBottom: 0,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  preview: {
    color: Colors.dark.tint,
  },
  previewDeload: {
    color: Colors.dark.error,
  },
  accessoryBlock: {
    gap: 10,
  },
  blockTitle: {
    opacity: 0.9,
  },
  accessoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accessoryText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  link: {
    color: Colors.dark.tint,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
