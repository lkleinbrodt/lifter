import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Maxes, clearCompleted, defaultMaxes, loadCompleted, loadMaxes, saveCompleted } from '@/lib/storage';
import React, { useEffect, useMemo, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  calculateSetWeight,
  getLiftLabel,
  getTrainingMaxForLift,
  getWeekSets,
  parseWorkoutId,
  workoutId,
} from '@/lib/workout-plan';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const barWeight = 45;
const plateOptions = [45, 35, 25, 10, 5, 2.5];

function formatPlate(plate: number) {
  return Number.isInteger(plate) ? String(plate) : plate.toFixed(1).replace(/\.0$/, '');
}

function getPlateBreakdown(totalWeight: number) {
  const perSide = Math.max(0, (totalWeight - barWeight) / 2);
  let remaining = Math.max(0, Math.round(perSide * 100) / 100);
  const plates: number[] = [];

  for (const plate of plateOptions) {
    while (remaining >= plate - 0.01) {
      plates.push(plate);
      remaining = Math.round((remaining - plate) * 100) / 100;
    }
  }

  return { perSide, plates };
}

function getPlateMathLabel(totalWeight: number) {
  if (totalWeight <= barWeight) {
    return 'Per side: no plates';
  }
  const { plates } = getPlateBreakdown(totalWeight);
  if (!plates.length) {
    return 'Per side: no plates';
  }
  return `Per side: ${plates.map(formatPlate).join(' + ')}`;
}

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ slug?: string }>();
  const parsed = useMemo(() => parseWorkoutId(params.slug as string | undefined), [params.slug]);

  const [maxes, setMaxes] = useState<Maxes>(defaultMaxes);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [storedMaxes, storedCompleted] = await Promise.all([loadMaxes(), loadCompleted()]);
      setMaxes(storedMaxes);
      setCompleted(storedCompleted);
      setLoading(false);
    };
    load();
  }, []);

  if (!parsed) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Workout not found.</ThemedText>
      </ThemedView>
    );
  }

  const { week, lift } = parsed;
  const id = workoutId(week, lift);
  const isDone = completed.includes(id);
  const tm = Math.round(getTrainingMaxForLift(maxes, lift));
  const sets = getWeekSets(week).map((set) => ({
    ...set,
    weight: calculateSetWeight(maxes[lift] ?? 0, set.percent),
  }));

  const handleComplete = async () => {
    const updated = Array.from(new Set([...completed, id]));
    setCompleted(updated);
    await saveCompleted(updated);
    router.back();
  };

  const handleReset = () => {
    Alert.alert('Reset cycle?', 'This will clear all workout completions', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await clearCompleted();
          setCompleted([]);
          Alert.alert('Cycle reset', 'All workout completions have been cleared.');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Loading workout…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Week ${week} - ${getLiftLabel(lift)}` }} />
      <SafeAreaContainer edges={['top', 'left', 'right', 'bottom']}>
        <ThemedView style={styles.container}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
            <ThemedText type="title">{`Week ${week} - ${getLiftLabel(lift)}`}</ThemedText>
            <ThemedText style={styles.subtle}>Training Max: {tm} lbs</ThemedText>

            <Card style={styles.card}>
              {sets.map((set, index) => (
                <View key={`${set.reps}-${index}`} style={[styles.row, set.amrap && styles.amrapRow]}>
                  <View style={[styles.bullet, isDone && styles.bulletDone]} />
                  <View style={styles.rowContent}>
                    <ThemedText type="defaultSemiBold">{set.weight} lbs</ThemedText>
                    <ThemedText style={styles.subtle}>
                      {set.reps} reps{set.amrap ? ' (AMRAP)' : ''}
                    </ThemedText>
                    <ThemedText style={styles.plateMath}>
                      {getPlateMathLabel(set.weight)}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </Card>

            <Button
              title={isDone ? 'Session Completed' : 'Complete Session'}
              onPress={handleComplete}
              disabled={isDone}
              style={styles.cta}
            />

            <Button title="Reset Cycle" onPress={handleReset} variant="secondary" style={styles.reset} />
          </ScrollView>
        </ThemedView>
      </SafeAreaContainer>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 24,
  },
  card: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    gap: 12,
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  amrapRow: {
    backgroundColor: Colors.dark.tintMuted,
    borderRadius: 12,
  },
  bullet: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.dark.textMuted,
    backgroundColor: 'transparent',
  },
  bulletDone: {
    borderColor: Colors.dark.tint,
    backgroundColor: Colors.dark.tint,
  },
  cta: {
    marginTop: 8,
  },
  reset: {
    marginTop: 8,
  },
  subtle: {
    color: Colors.dark.textMuted,
  },
  plateMath: {
    color: Colors.dark.textMuted,
    fontSize: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
