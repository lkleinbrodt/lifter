import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SET_COLUMNS, type SetPatch, SetRow, weightHeader } from './set-row';
import { previousSetFor, setLabels } from '@/lib/workout-edit';

import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import React from 'react';
import { ThemedText } from '@/components/themed-text';
import type { WorkoutExercise, WorkoutSet } from '@/lib/workout';
import { formatPlateMath } from '@/lib/plates';
import { getExercise } from '@/lib/exercises';

type ExerciseCardProps = {
  entry: WorkoutExercise;
  previous: WorkoutSet[];
  slotLabel?: string;
  choices?: string[]; // catalog ids offered as one-tap swaps (accessory archetype pool)
  onSetChange: (setId: string, patch: SetPatch) => void;
  onSetDelete: (setId: string) => void;
  onAddSet: () => void;
  onChoose: (exerciseId: string) => void;
  onMenu: () => void;
  onShowHistory: () => void;
};

const isBarbell = (name: string) => name.endsWith('(Barbell)');

export function ExerciseCard({
  entry,
  previous,
  slotLabel,
  choices,
  onSetChange,
  onSetDelete,
  onAddSet,
  onChoose,
  onMenu,
  onShowHistory,
}: ExerciseCardProps) {
  const exercise = getExercise(entry.exerciseId);
  const labels = setLabels(entry.sets);
  const header = weightHeader(exercise.tracking);
  const nextWorking = entry.sets.find((set) => !set.done && set.type !== 'warmup');
  const plateWeight = nextWorking?.weight ?? nextWorking?.target?.weight;

  return (
    <View style={[styles.card, entry.supersetGroup && styles.superset]}>
      <View style={styles.header}>
        <Pressable style={styles.titleBlock} onPress={onShowHistory} accessibilityRole="button" accessibilityHint="Shows past sessions">
          <ThemedText type="defaultSemiBold" style={styles.title}>
            {exercise.name}
          </ThemedText>
          {slotLabel ? <ThemedText style={styles.subtitle}>{slotLabel}</ThemedText> : null}
          {isBarbell(exercise.name) && plateWeight ? (
            <ThemedText style={styles.subtitle}>
              {plateWeight} lbs · {formatPlateMath(plateWeight).replace('Plates per side: ', '')}
              {plateWeight > 45 ? ' / side' : ''}
            </ThemedText>
          ) : null}
        </Pressable>
        <Pressable onPress={onMenu} hitSlop={10} accessibilityLabel="Exercise options">
          <IconSymbol name="ellipsis.circle" size={22} color={Colors.dark.tint} />
        </Pressable>
      </View>

      {choices && choices.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {choices.map((id) => {
            const selected = id === entry.exerciseId;
            return (
              <Pressable
                key={id}
                onPress={() => !selected && onChoose(id)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>{getExercise(id).name}</ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.columns}>
        <ThemedText style={[styles.colHead, { width: SET_COLUMNS.label }]}>Set</ThemedText>
        <ThemedText style={[styles.colHead, styles.colPrevious]}>Previous</ThemedText>
        {header ? <ThemedText style={[styles.colHead, { width: SET_COLUMNS.input }]}>{header}</ThemedText> : null}
        <ThemedText style={[styles.colHead, { width: SET_COLUMNS.input }]}>
          {exercise.tracking === 'duration' ? 'Sec' : 'Reps'}
        </ThemedText>
        <View style={{ width: SET_COLUMNS.check }} />
      </View>

      {entry.sets.map((set, index) => (
        <SetRow
          key={set.id}
          label={labels[index]}
          set={set}
          previous={previousSetFor(entry.sets, index, previous)}
          tracking={exercise.tracking}
          onChange={(patch) => onSetChange(set.id, patch)}
          onDelete={() => onSetDelete(set.id)}
        />
      ))}

      <Pressable onPress={onAddSet} style={({ pressed }) => [styles.addSet, pressed && styles.pressed]}>
        <ThemedText style={styles.addSetText}>+ Add Set</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
    paddingTop: 12,
  },
  superset: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.tint,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: Colors.dark.tint,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  chips: {
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  chipSelected: {
    backgroundColor: Colors.dark.tintMuted,
    borderColor: Colors.dark.tint,
  },
  chipText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  chipTextSelected: {
    color: Colors.dark.tint,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  colHead: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  colPrevious: {
    flex: 1,
  },
  addSet: {
    margin: 12,
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceHighlight,
  },
  addSetText: {
    fontSize: 14,
  },
  pressed: {
    opacity: 0.8,
  },
});
