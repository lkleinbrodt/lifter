import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { type ExerciseSession, exerciseHistory } from '@/lib/db';
import React, { useEffect, useState } from 'react';

import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { formatSet } from './set-row';
import { getExercise } from '@/lib/exercises';

type ExerciseHistorySheetProps = {
  exerciseId: string | null; // null = hidden
  onClose: () => void;
};

export function ExerciseHistorySheet({ exerciseId, onClose }: ExerciseHistorySheetProps) {
  const [sessions, setSessions] = useState<ExerciseSession[] | null>(null);

  useEffect(() => {
    if (!exerciseId) return;
    let active = true;
    setSessions(null);
    exerciseHistory(exerciseId, { limit: 50 }).then((rows) => active && setSessions(rows));
    return () => {
      active = false;
    };
  }, [exerciseId]);

  const exercise = exerciseId ? getExercise(exerciseId) : null;

  return (
    <Modal visible={!!exerciseId} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <ThemedText type="defaultSemiBold" style={styles.title}>
            {exercise?.name}
          </ThemedText>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <IconSymbol name="xmark" size={20} color={Colors.dark.textMuted} />
          </Pressable>
        </View>
        {!sessions || !exercise ? (
          <ActivityIndicator style={styles.loading} color={Colors.dark.tint} />
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.workoutId}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<ThemedText style={styles.muted}>Not done before.</ThemedText>}
            renderItem={({ item }) => (
              <View style={styles.session}>
                <ThemedText type="label" style={styles.muted}>
                  {new Date(item.startedAt).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  · {item.workoutName}
                </ThemedText>
                {item.sets.map((set, i) => (
                  <ThemedText key={set.id} style={set.type === 'warmup' ? styles.muted : undefined}>
                    {set.type === 'warmup' ? 'W' : i + 1 - item.sets.slice(0, i).filter((s) => s.type === 'warmup').length}
                    {'  '}
                    {formatSet(set, exercise.tracking)}
                  </ThemedText>
                ))}
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  title: {
    flex: 1,
  },
  loading: {
    marginTop: 32,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 12,
  },
  session: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
  },
  muted: {
    color: Colors.dark.textMuted,
  },
});
