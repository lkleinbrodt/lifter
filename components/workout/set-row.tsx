import * as Haptics from 'expo-haptics';

import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import React, { useState } from 'react';

import { Colors, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ThemedText } from '@/components/themed-text';
import type { TrackingType } from '@/lib/exercises';
import type { WorkoutSet } from '@/lib/workout';
import { setHasValues } from '@/lib/workout-edit';

export type SetPatch = Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'durationSec' | 'done' | 'completedAt'>>;

const fmt = (value: number | undefined) =>
  value === undefined ? '' : Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

export function weightHeader(tracking: TrackingType) {
  switch (tracking) {
    case 'weightReps':
      return 'lbs';
    case 'addedWeightReps':
      return '+lbs';
    case 'assistedReps':
      return '−lbs';
    default:
      return null;
  }
}

export function formatSet(set: WorkoutSet | undefined, tracking: TrackingType) {
  if (!set) return '—';
  if (tracking === 'duration') return set.durationSec ? `${fmt(set.durationSec)}s` : '—';
  if (tracking === 'reps') return set.reps ? `${fmt(set.reps)} reps` : '—';
  const sign = tracking === 'addedWeightReps' ? '+' : tracking === 'assistedReps' ? '−' : '';
  const weight = set.weight ? `${sign}${fmt(set.weight)} × ` : '';
  return set.reps ? `${weight}${fmt(set.reps)}` : '—';
}

/**
 * Numeric field. Focusing clears it and shows the current number as the placeholder, so
 * typing always replaces it (like Strong's select-all); leaving it empty keeps the old value.
 * The raw text is kept while focused so "132." survives re-renders.
 */
function NumberField({
  value,
  placeholder,
  decimal,
  done,
  onCommit,
}: {
  value: number | undefined;
  placeholder?: number;
  decimal?: boolean;
  done: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  return (
    <TextInput
      style={[styles.input, done && styles.inputDone]}
      value={draft ?? fmt(value)}
      placeholder={editing ? fmt(value ?? placeholder) : fmt(placeholder)}
      placeholderTextColor={Colors.dark.textMuted}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      keyboardAppearance="dark"
      // Native clear (iOS) so the first keystroke always replaces the number; clearing
      // through React state alone can lose the race with fast typing.
      clearTextOnFocus
      selectTextOnFocus={Platform.OS !== 'ios'}
      onFocus={() => setDraft('')}
      onChangeText={(text) => {
        setDraft(text);
        const trimmed = text.trim();
        const parsed = Number(trimmed);
        if (trimmed !== '' && Number.isFinite(parsed) && parsed >= 0) onCommit(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

type SetRowProps = {
  label: string;
  set: WorkoutSet;
  previous?: WorkoutSet;
  tracking: TrackingType;
  onChange: (patch: SetPatch) => void;
  onDelete: () => void;
};

export function SetRow({ label, set, previous, tracking, onChange, onDelete }: SetRowProps) {
  const hasWeight = weightHeader(tracking) !== null;
  const isDuration = tracking === 'duration';
  // Empty fields show the target or last time's number; checking a set adopts them.
  const weightHint = set.target?.weight ?? previous?.weight;
  const repsHint = set.target?.reps ?? previous?.reps;

  const toggleDone = () => {
    if (set.done) {
      onChange({ done: false, completedAt: undefined });
      return;
    }
    const filled: WorkoutSet = {
      ...set,
      weight: set.weight ?? (hasWeight ? (weightHint ?? (tracking === 'weightReps' ? undefined : 0)) : undefined),
      reps: set.reps ?? (isDuration ? undefined : repsHint),
      durationSec: set.durationSec ?? (isDuration ? previous?.durationSec : undefined),
    };
    if (!setHasValues(filled, tracking)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange({
      weight: filled.weight,
      reps: filled.reps,
      durationSec: filled.durationSec,
      done: true,
      completedAt: new Date().toISOString(),
    });
  };

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable style={styles.delete} onPress={onDelete} accessibilityLabel="Delete set">
          <ThemedText style={styles.deleteText}>Delete</ThemedText>
        </Pressable>
      )}>
      <View style={[styles.row, set.done && styles.rowDone]}>
        <View style={[styles.labelCell, set.type === 'warmup' && styles.warmupCell]}>
          <ThemedText style={[styles.label, set.type === 'warmup' && styles.warmupLabel]}>
            {label}
            {set.type === 'amrap' ? '+' : ''}
          </ThemedText>
        </View>
        <ThemedText style={styles.previous} numberOfLines={1}>
          {formatSet(previous, tracking)}
        </ThemedText>
        {hasWeight ? (
          <NumberField
            value={set.weight}
            placeholder={weightHint}
            decimal
            done={set.done}
            onCommit={(weight) => onChange({ weight })}
          />
        ) : null}
        {isDuration ? (
          <NumberField
            value={set.durationSec}
            placeholder={previous?.durationSec}
            done={set.done}
            onCommit={(durationSec) => onChange({ durationSec })}
          />
        ) : (
          <NumberField value={set.reps} placeholder={repsHint} done={set.done} onCommit={(reps) => onChange({ reps })} />
        )}
        <Pressable
          onPress={toggleDone}
          hitSlop={6}
          style={[styles.check, set.done && styles.checkDone]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: set.done }}>
          <IconSymbol name="checkmark" size={16} color={set.done ? Colors.dark.background : Colors.dark.textMuted} />
        </Pressable>
      </View>
    </ReanimatedSwipeable>
  );
}

export const SET_COLUMNS = { label: 34, input: 64, check: 36 };

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.dark.surface,
  },
  rowDone: {
    backgroundColor: '#1F2A25', // sage-tinted surface
  },
  labelCell: {
    width: SET_COLUMNS.label,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surfaceHighlight,
  },
  warmupCell: {
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 14,
  },
  warmupLabel: {
    color: Colors.dark.tint,
  },
  previous: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  input: {
    width: SET_COLUMNS.input,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceHighlight,
    color: Colors.dark.text,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: Fonts.family,
    fontVariant: ['tabular-nums'],
  },
  inputDone: {
    backgroundColor: 'transparent',
  },
  check: {
    width: SET_COLUMNS.check,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surfaceHighlight,
  },
  checkDone: {
    backgroundColor: Colors.dark.tint,
  },
  delete: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    backgroundColor: Colors.dark.error,
  },
  deleteText: {
    color: Colors.dark.text,
    fontWeight: '600',
  },
});
