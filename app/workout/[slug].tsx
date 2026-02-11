import { Maxes, defaultMaxes, loadCompleted, loadMaxes, saveCompleted } from '@/lib/storage';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  calculatePlateMath,
  calculateSetWeight,
  getTrainingMaxForLift,
  getWeekSets,
  getWorkoutDay,
  getWorkoutDayLabel,
  is531WorkoutDay,
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
  const day = getWorkoutDay(lift);
  const id = workoutId(week, lift);
  const isDone = completed.includes(id);
  const tm = is531WorkoutDay(lift) ? Math.round(getTrainingMaxForLift(maxes, lift)) : null;
  const isWeightedPullups = lift === 'weighted-pullups';
  const pullupWeight = maxes.weightedPullupWeight ?? 0;
  const sets: { reps: string; amrap?: boolean; weight?: number }[] = is531WorkoutDay(lift)
    ? getWeekSets(week).map((set) => ({
        ...set,
        weight: calculateSetWeight(maxes[lift] ?? 0, set.percent),
      }))
    : Array.from({ length: 5 }, () => ({ reps: '5' }));

  const formatPlateMath = (weight: number) => {
    const plates = calculatePlateMath(weight);
    if (plates.length === 0) {
      return 'Bar only';
    }
    return `Plates per side: ${plates.join(' + ')}`;
  };

  const handleComplete = async () => {
    const updated = Array.from(new Set([...completed, id]));
    setCompleted(updated);
    await saveCompleted(updated);
    router.back();
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
      <Stack.Screen
        options={{
          title: `Week ${week} - ${getWorkoutDayLabel(lift)}`,
        }}
      />
      <SafeAreaContainer edges={['top', 'left', 'right', 'bottom']}>
        <ThemedView style={styles.container}>
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
            <ThemedText type="title">{`Week ${week} - ${getWorkoutDayLabel(lift)}`}</ThemedText>
            {day.is531 ? (
              <ThemedText style={styles.subtle}>Training Max: {tm} lbs</ThemedText>
            ) : isWeightedPullups ? (
              <ThemedText style={styles.subtle}>
                Weight: {pullupWeight ? `${pullupWeight} lbs` : '— (set on main page)'}
              </ThemedText>
            ) : (
              <View style={styles.placeholderRow}>
                <ThemedText style={styles.subtle}>1RM: —</ThemedText>
                <ThemedText style={styles.subtle}>Prescribed Weight: —</ThemedText>
              </View>
            )}

            <Card style={styles.card}>
              <ThemedText type="defaultSemiBold" style={styles.sectionLabel}>
                Main Lift — {day.mainLiftLabel}
              </ThemedText>
              {isWeightedPullups ? (
                <View style={styles.row}>
                  <View style={[styles.bullet, isDone && styles.bulletDone]} />
                  <View style={styles.rowContent}>
                    <ThemedText type="defaultSemiBold">
                      5x5{pullupWeight ? ` @ ${pullupWeight} lbs` : ''}
                    </ThemedText>
                  </View>
                </View>
              ) : (
                sets.map((set, index) => (
                  <View key={`${set.reps}-${index}`} style={styles.row}>
                    <View style={[styles.bullet, isDone && styles.bulletDone]} />
                    <View style={styles.rowContent}>
                      <ThemedText type="defaultSemiBold">
                        {typeof set.weight === 'number'
                          ? `${set.weight} lbs for ${set.reps} reps${set.amrap ? ' (AMRAP)' : ''}`
                          : `Set ${index + 1}: ${set.reps} reps`}
                      </ThemedText>
                      {typeof set.weight === 'number' ? (
                        <ThemedText style={styles.plateMath}>{formatPlateMath(set.weight)}</ThemedText>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </Card>

            <View style={styles.accessoryBlock}>
              <ThemedText type="subtitle" style={styles.accessoryTitle}>
                Accessories
              </ThemedText>
              {day.accessoryArchetypes.map((archetype) => (
                <Pressable
                  key={archetype}
                  onPress={() => router.push(`/archetype/${encodeURIComponent(archetype)}`)}
                  accessibilityRole="button">
                  {({ pressed }) => (
                    <Card style={[styles.accessoryCard, pressed && styles.accessoryCardPressed]}>
                      <ThemedText type="defaultSemiBold">{archetype}</ThemedText>
                    </Card>
                  )}
                </Pressable>
              ))}
            </View>

            <Button
              title={isDone ? 'Session Completed' : 'Complete Session'}
              onPress={handleComplete}
              disabled={isDone}
              style={styles.cta}
            />
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
    flexDirection: 'column',
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
  subtle: {
    color: Colors.dark.textMuted,
  },
  plateMath: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: Colors.dark.tint,
    marginBottom: 2,
  },
  accessoryBlock: {
    gap: 10,
  },
  accessoryTitle: {
    opacity: 0.9,
  },
  accessoryCard: {
    gap: 6,
  },
  accessoryCardPressed: {
    opacity: 0.7,
  },
  placeholderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.dark.surface,
  },
});
