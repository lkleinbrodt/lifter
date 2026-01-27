import * as Haptics from 'expo-haptics';

import { Alert, GestureResponderEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Maxes, clearCompleted, defaultMaxes, loadCompleted, loadMaxes, saveCompleted } from '@/lib/storage';
import React, { useCallback, useRef, useState } from 'react';
import Reanimated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { calculateSetWeight, lifts, workoutId, workoutWeeks } from '@/lib/workout-plan';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WorkoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [maxes, setMaxes] = useState<Maxes>(defaultMaxes);
  const [completed, setCompleted] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        const [storedMaxes, storedCompleted] = await Promise.all([loadMaxes(), loadCompleted()]);
        if (active) {
          setMaxes(storedMaxes);
          setCompleted(storedCompleted);
        }
      };
      load();
      return () => {
        active = false;
      };
    }, []),
  );

  const updateCompletion = useCallback(
    async (id: string, shouldComplete: boolean) => {
      const next = shouldComplete
        ? Array.from(new Set([...completed, id]))
        : completed.filter((item) => item !== id);
      setCompleted(next);
      await saveCompleted(next);
    },
    [completed],
  );

  const handleResetCycle = useCallback(() => {
    Alert.alert('Reset cycle?', 'This will clear all workout completions', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await clearCompleted();
          setCompleted([]);
          setStatus('Cycle reset');
          setTimeout(() => setStatus(''), 1500);
        },
      },
    ]);
  }, []);

  const handleOpenWorkout = useCallback(
    (id: string) => {
      router.push(`/workout/${id}`);
    },
    [router],
  );

  return (
    <SafeAreaContainer edges={['top', 'right', 'left']}>
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}>
          <ThemedText type="display">
            Workouts
          </ThemedText>
          {workoutWeeks.map((week) => (
            <View key={week.week} style={styles.weekBlock}>
              <ThemedText type="subtitle" style={styles.weekHeader}>
                Week {week.week}
              </ThemedText>
              <View style={styles.liftsRow}>
                {lifts.map((lift) => {
                  const id = workoutId(week.week, lift.key);
                  const isDone = completed.includes(id);
                  const sets = week.sets.map((set) => ({
                    ...set,
                    weight: calculateSetWeight(maxes[lift.key] ?? 0, set.percent),
                  }));
                  const schemeLabel = `${week.label}${week.sets.some((set) => set.amrap) ? '+' : ''}`;
                  return (
                    <WorkoutCard
                      key={lift.key}
                      id={id}
                      liftLabel={lift.label}
                      schemeLabel={schemeLabel}
                      sets={sets}
                      isDone={isDone}
                      weekNumber={week.week}
                      onToggleComplete={(shouldComplete) => updateCompletion(id, shouldComplete)}
                      onOpenDetails={() => handleOpenWorkout(id)}
                    />
                  );
                })}
              </View>
            </View>
          ))}

          <Button title="Reset Cycle" variant="secondary" onPress={handleResetCycle} style={styles.resetButton} />
          {status ? <ThemedText style={styles.status}>{status}</ThemedText> : null}
        </ScrollView>
      </ThemedView>
    </SafeAreaContainer>
  );
}

type CardSet = {
  weight: number;
  reps: string;
  amrap?: boolean;
};

type WorkoutCardProps = {
  id: string;
  liftLabel: string;
  schemeLabel: string;
  sets: CardSet[];
  isDone: boolean;
  onToggleComplete: (complete: boolean) => void;
  onOpenDetails: () => void;
  weekNumber: number;
};

function WorkoutCard({
  liftLabel,
  schemeLabel,
  sets,
  isDone,
  onToggleComplete,
  onOpenDetails,
  weekNumber,
}: WorkoutCardProps) {
  const swipeRef = useRef<SwipeableMethods | null>(null);

  const handleSwipeOpen = () => {
    Haptics.notificationAsync(
      isDone ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    );
    onToggleComplete(!isDone);
    swipeRef.current?.close();
  };

  const handleIconPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    Haptics.notificationAsync(
      isDone ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    );
    onToggleComplete(!isDone);
  };

  return (
    <View style={styles.cardWrapper}>
      <ReanimatedSwipeable
        ref={swipeRef}
        friction={2}
        leftThreshold={32}
        enableTrackpadTwoFingerGesture
        overshootLeft={false}
        renderLeftActions={(progress, dragX) => (
          <SwipeAction progress={progress} dragX={dragX} isDone={isDone} />
        )}
        onSwipeableOpen={handleSwipeOpen}
        containerStyle={styles.swipeContainer}
        childrenContainerStyle={styles.swipeChild}>
        <Pressable onPress={onOpenDetails} accessibilityRole="button">
          <Card
            style={[
              styles.card,
              isDone && {
                borderColor: Colors.dark.tint,
                backgroundColor: 'rgba(141, 163, 153, 0.1)',
              },
            ]}>
            <View style={styles.cardHeader}>
              <View>
                <ThemedText type="label" style={{ color: Colors.dark.tint }}>
                  Week {weekNumber} • {schemeLabel}
                </ThemedText>
                <ThemedText
                  type="title"
                  style={isDone ? { textDecorationLine: 'line-through', color: Colors.dark.textMuted } : undefined}>
                  {liftLabel}
                </ThemedText>
              </View>
              <Pressable
                onPress={handleIconPress}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={isDone ? 'Mark as not complete' : 'Mark as complete'}>
                <IconSymbol
                  name={isDone ? 'checkmark.circle.fill' : 'circle'}
                  size={28}
                  color={isDone ? Colors.dark.tint : Colors.dark.icon}
                />
              </Pressable>
            </View>

            <View style={[styles.setsColumn, isDone && { opacity: 0.5 }]}>
              {sets.map((set, idx) => (
                <ThemedText key={`${set.reps}-${idx}`} style={styles.setLine}>
                  {set.weight} x {set.reps}
                  {set.amrap ? ' (AMRAP)' : ''}
                </ThemedText>
              ))}
            </View>
          </Card>
        </Pressable>
      </ReanimatedSwipeable>
    </View>
  );
}

function SwipeAction({
  progress,
  dragX,
  isDone,
}: {
  progress: SharedValue<number>;
  dragX: SharedValue<number>;
  isDone: boolean;
}) {
  // Use dragX to satisfy lint even if not used visually
  void dragX;
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.5, 1.2], Extrapolation.CLAMP);
    const opacity = interpolate(progress.value, [0, 0.8, 1], [0, 1, 1]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Reanimated.View
      style={[
        styles.actionPanel,
        { backgroundColor: isDone ? Colors.dark.surfaceHighlight : Colors.dark.tint },
      ]}>
      <Reanimated.View style={[styles.actionContent, animatedStyle]}>
        <IconSymbol
          name={isDone ? 'arrow.uturn.backward' : 'checkmark.circle.fill'}
          size={32}
          color={isDone ? Colors.dark.text : Colors.dark.background}
        />
        <ThemedText
          type="defaultSemiBold"
          style={{
            color: isDone ? Colors.dark.text : Colors.dark.background,
            marginTop: 4,
          }}>
          {isDone ? 'Not Complete' : 'Complete'}
        </ThemedText>
      </Reanimated.View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    padding: 16,
    paddingBottom: 100,
  },
  weekBlock: {
    gap: 12,
  },
  weekHeader: {
    opacity: 0.8,
  },
  liftsRow: {
    gap: 12,
  },
  cardWrapper: {
    borderRadius: 16,
  },
  swipeContainer: {
    borderRadius: 16,
  },
  swipeChild: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionPanel: {
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    paddingLeft: 16,
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  card: {
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    color: Colors.dark.textMuted,
  },
  setsColumn: {
    marginTop: 10,
    gap: 6,
  },
  setLine: {
    color: Colors.dark.text,
  },
  resetButton: {
    marginTop: 8,
  },
  status: {
    textAlign: 'center',
    color: Colors.dark.textMuted,
  },
});
