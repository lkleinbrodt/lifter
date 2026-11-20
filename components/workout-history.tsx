import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import React, { useCallback, useState } from 'react';
import { type Workout, isWorkingSet } from '@/lib/workout';

import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { ProgramHeader } from '@/components/program-header';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatMinutes } from '@/lib/workout-edit';
import { formatSet } from '@/components/workout/set-row';
import { getExercise } from '@/lib/exercises';
import { listWorkouts } from '@/lib/db';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

const PAGE = 30;

/** Best working set: heaviest, then most reps (or longest hold). */
function bestSet(sets: Workout['exercises'][number]['sets']) {
  return sets
    .filter(isWorkingSet)
    .reduce<(typeof sets)[number] | undefined>((best, set) => {
      if (!best) return set;
      const a = [set.weight ?? 0, set.reps ?? set.durationSec ?? 0];
      const b = [best.weight ?? 0, best.reps ?? best.durationSec ?? 0];
      return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]) ? set : best;
    }, undefined);
}

function WorkoutCard({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const start = new Date(workout.startedAt);
  const duration = workout.finishedAt
    ? Math.round((new Date(workout.finishedAt).getTime() - start.getTime()) / 1000)
    : 0;
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Card style={[styles.card, pressed && styles.pressed]}>
          <View style={styles.header}>
            <ThemedText type="defaultSemiBold" style={styles.title} numberOfLines={1}>
              {workout.name}
            </ThemedText>
            {duration > 0 ? <ThemedText style={styles.muted}>{formatMinutes(duration)}</ThemedText> : null}
          </View>
          <ThemedText type="label" style={styles.muted}>
            {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </ThemedText>
          {workout.exercises.map((entry) => {
            const exercise = getExercise(entry.exerciseId);
            const working = entry.sets.filter(isWorkingSet).length;
            return (
              <View key={entry.id} style={styles.row}>
                <ThemedText style={styles.exercise} numberOfLines={1}>
                  {working} × {exercise.name}
                </ThemedText>
                <ThemedText style={styles.muted}>{formatSet(bestSet(entry.sets), exercise.tracking)}</ThemedText>
              </View>
            );
          })}
        </Card>
      )}
    </Pressable>
  );
}

/** Every logged workout, newest first; tap to view, edit or delete. */
export function WorkoutHistoryScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listWorkouts({ limit: PAGE }).then((rows) => {
        if (!active) return;
        setWorkouts(rows);
        setDone(rows.length < PAGE);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const loadMore = async () => {
    if (!workouts || done || loadingMore) return;
    setLoadingMore(true);
    const rows = await listWorkouts({ limit: PAGE, offset: workouts.length });
    setWorkouts([...workouts, ...rows]);
    setDone(rows.length < PAGE);
    setLoadingMore(false);
  };

  return (
    <SafeAreaContainer edges={['top', 'left', 'right']}>
      <ThemedView style={styles.container}>
        {!workouts ? (
          <ActivityIndicator style={styles.loading} color={Colors.dark.tint} />
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={<ProgramHeader title="History" />}
            ListEmptyComponent={<ThemedText style={styles.muted}>No workouts logged yet.</ThemedText>}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.dark.tint} /> : null}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => <WorkoutCard workout={item} onPress={() => router.push(`/workout/${item.id}`)} />}
          />
        )}
      </ThemedView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { marginTop: 48 },
  list: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { gap: 6 },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  exercise: { flex: 1, fontSize: 14 },
  muted: { color: Colors.dark.textMuted, fontSize: 13 },
});
