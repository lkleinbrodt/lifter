import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { ROW_PADDING, SET_COLUMNS, type SetPatch, SetRow, weightHeader } from './set-row';
import { isBarbellExercise, getExercise, splitExerciseName } from '@/lib/exercises';
import { previousSetFor, setLabels, setScheme } from '@/lib/workout-edit';

import { C, Radius, numStyle } from '@/constants/theme';
import { Chip } from '@/components/ui/primitives';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import type { WorkoutExercise, WorkoutSet } from '@/lib/workout';
import { formatPlateLine } from '@/lib/plates';

type ExerciseCardProps = {
  entry: WorkoutExercise;
  previous: WorkoutSet[];
  mainLift?: boolean;
  slotLabel?: string;
  choices?: string[]; // catalog ids offered as one-tap swaps (accessory archetype pool)
  /** The workout's current set, when it's in this card. */
  currentSetId?: string;
  onSetChange: (setId: string, patch: SetPatch) => void;
  onSetDelete: (setId: string) => void;
  onAddSet: () => void;
  onChoose: (exerciseId: string) => void;
  onMenu: () => void;
  onShowHistory: () => void;
};

const fmt = (value: number | undefined) => (value === undefined ? '' : String(Number(value.toFixed(2))));

export function ExerciseCard({
  entry,
  previous,
  mainLift,
  slotLabel,
  choices,
  currentSetId,
  onSetChange,
  onSetDelete,
  onAddSet,
  onChoose,
  onMenu,
  onShowHistory,
}: ExerciseCardProps) {
  const exercise = getExercise(entry.exerciseId);
  const { title, detail } = splitExerciseName(exercise.name);
  const barbell = isBarbellExercise(entry.exerciseId);
  const labels = setLabels(entry.sets);
  const header = weightHeader(exercise.tracking);
  const [plates, setPlates] = useState(false);

  // Warm-ups collapse to one line once all are checked; tapping it reopens them.
  const warmups = entry.sets.filter((set) => set.type === 'warmup');
  const warmupsDone = warmups.length > 0 && warmups.every((set) => set.done);
  const [warmupsOpen, setWarmupsOpen] = useState(false);
  useEffect(() => {
    if (warmupsDone) setWarmupsOpen(false);
  }, [warmupsDone]);
  const hideWarmups = warmupsDone && !warmupsOpen;

  // Plate line follows this card's current set, else its next unchecked set.
  const plateSet = entry.sets.find((set) => set.id === currentSetId) ?? entry.sets.find((set) => !set.done);
  const plateWeight = plateSet?.weight ?? plateSet?.target?.weight;

  const scheme = mainLift ? setScheme(entry.sets) : undefined;
  const subtitle = [detail, mainLift ? scheme : slotLabel].filter(Boolean).join(' · ');
  const showChips = !!choices && choices.length > 1 && !entry.sets.some((set) => set.done);

  return (
    <View style={[styles.card, entry.supersetGroup && styles.superset]}>
      <View style={styles.header}>
        <Pressable style={styles.titleBlock} onPress={onShowHistory} accessibilityRole="button" accessibilityHint="Shows past sessions">
          <ThemedText style={mainLift ? styles.titleMain : styles.title}>{title}</ThemedText>
          {subtitle ? <ThemedText type="subhead">{subtitle}</ThemedText> : null}
          {barbell && plateWeight ? (
            <ThemedText num style={styles.plateLine}>
              {formatPlateLine(plateWeight)}
            </ThemedText>
          ) : null}
        </Pressable>
        <Pressable onPress={onMenu} style={styles.menu} accessibilityLabel="Exercise options">
          <IconSymbol name="ellipsis" size={20} color={C.t2} />
        </Pressable>
      </View>

      {showChips ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {choices.map((id) => {
            const selected = id === entry.exerciseId;
            return <Chip key={id} label={splitExerciseName(getExercise(id).name).title} selected={selected} onPress={() => !selected && onChoose(id)} />;
          })}
        </ScrollView>
      ) : null}

      <View style={styles.columns}>
        <ThemedText type="caption" style={{ width: SET_COLUMNS.label }}>
          Set
        </ThemedText>
        <ThemedText type="caption" style={styles.colPrevious}>
          Prev
        </ThemedText>
        {header ? (
          barbell ? (
            <Pressable
              onPress={() => setPlates((value) => !value)}
              style={styles.colToggle}
              hitSlop={{ top: 10, bottom: 10 }}
              accessibilityRole="button"
              accessibilityLabel={plates ? 'Show pounds' : 'Show plates per side'}>
              <ThemedText type="caption" style={[styles.colHead, plates && styles.colHeadActive]}>
                {plates ? 'Plates' : header}
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="caption" style={[styles.colHead, { width: SET_COLUMNS.weight }]}>
              {header}
            </ThemedText>
          )
        ) : null}
        <ThemedText type="caption" style={[styles.colHead, { width: SET_COLUMNS.reps }]}>
          {exercise.tracking === 'duration' ? 'Sec' : 'Reps'}
        </ThemedText>
        <View style={{ width: SET_COLUMNS.check }} />
      </View>

      {hideWarmups ? (
        <Pressable
          onPress={() => setWarmupsOpen(true)}
          style={({ pressed }) => [styles.warmupLine, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityHint="Shows the warm-up sets">
          <IconSymbol name="checkmark" size={13} weight="bold" color={C.accent} />
          <ThemedText style={styles.warmupLineLabel}>
            Warm-up {warmups.length}/{warmups.length}
          </ThemedText>
          <ThemedText num style={styles.warmupLineSets} numberOfLines={1}>
            {warmups.map((set) => `${fmt(set.weight)}×${fmt(set.reps)}`).join(' · ')}
          </ThemedText>
        </Pressable>
      ) : null}

      {entry.sets.map((set, index) =>
        hideWarmups && set.type === 'warmup' ? null : (
          <SetRow
            key={set.id}
            label={labels[index]}
            set={set}
            previous={previousSetFor(entry.sets, index, previous)}
            tracking={exercise.tracking}
            current={set.id === currentSetId}
            plates={barbell && plates}
            onChange={(patch) => onSetChange(set.id, patch)}
            onDelete={() => onSetDelete(set.id)}
          />
        ),
      )}

      <View style={styles.footer}>
        <Pressable onPress={onAddSet} style={({ pressed }) => [styles.addSet, pressed && styles.pressed]} accessibilityRole="button">
          <ThemedText style={styles.addSetText}>+ Set</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.s1,
    borderRadius: Radius.card,
    overflow: 'hidden',
    paddingTop: 14,
  },
  superset: {
    borderLeftWidth: 3,
    borderLeftColor: C.superset,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 16,
    paddingRight: 6,
    gap: 8,
  },
  titleBlock: { flex: 1, gap: 2, paddingTop: 2 },
  titleMain: { fontSize: 19, lineHeight: 24, fontWeight: '600' },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  plateLine: { ...numStyle, fontSize: 15, color: C.t1, marginTop: 4 },
  menu: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -8 },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ROW_PADDING,
    paddingTop: 14,
    paddingBottom: 6,
  },
  colHead: { textAlign: 'center' },
  colHeadActive: { color: C.accent },
  colPrevious: { flex: 1, textAlign: 'center' },
  colToggle: { width: SET_COLUMNS.weight, alignItems: 'center' },
  warmupLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  warmupLineLabel: { fontSize: 15, color: C.t2 },
  warmupLineSets: { flex: 1, fontSize: 14, color: C.t3, textAlign: 'right' },
  footer: { flexDirection: 'row', paddingHorizontal: 6 },
  addSet: { height: 44, paddingHorizontal: 10, justifyContent: 'center' },
  addSetText: { fontSize: 15, fontWeight: '600', color: C.t2 },
  pressed: { opacity: 0.6 },
});
