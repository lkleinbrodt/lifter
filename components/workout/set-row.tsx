import * as Haptics from 'expo-haptics';

import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import React, { useState } from 'react';

import { C, Radius, numStyle } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ThemedText } from '@/components/themed-text';
import { type TrackingType, formatLoad } from '@/lib/exercises';
import type { WorkoutSet } from '@/lib/workout';
import { formatPlatesCompact } from '@/lib/plates';
import { setHasValues } from '@/lib/workout-edit';

export type SetPatch = Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'durationSec' | 'done' | 'completedAt'>>;

const fmt = (value: number | undefined) =>
  value === undefined ? '' : Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

export function weightHeader(tracking: TrackingType) {
  switch (tracking) {
    case 'weightReps':
      return 'lb';
    case 'addedWeightReps':
      return '+lb';
    case 'assistedReps':
      return '−lb';
    default:
      return null;
  }
}

export function formatSet(set: WorkoutSet | undefined, tracking: TrackingType) {
  if (!set) return '—';
  if (tracking === 'duration') return set.durationSec ? `${fmt(set.durationSec)}s` : '—';
  if (tracking === 'reps') return set.reps ? `${fmt(set.reps)} reps` : '—';
  const load = formatLoad(set.weight, tracking);
  const weight = load && !(tracking === 'weightReps' && set.weight === 0) ? `${load} × ` : '';
  return set.reps ? `${weight}${fmt(set.reps)}` : '—';
}

type FieldLook = 'idle' | 'current' | 'done';

/**
 * Numeric cell. Every row's cells stay editable; only the look changes with the row state.
 * Focusing clears it and shows the current number as the placeholder, so typing always
 * replaces it (like Strong's select-all); leaving it empty keeps the old value. The raw text
 * is kept while focused so "132." survives re-renders. `display` replaces the number while
 * not focused (plates, "BW", "5+").
 */
function NumberField({
  value,
  placeholder,
  display,
  displayColor,
  displaySmall,
  decimal,
  look,
  small,
  width,
  onCommit,
}: {
  value: number | undefined;
  placeholder?: number;
  display?: string;
  displayColor?: string;
  /** Long display text (plates): smaller type so "45·10·2.5" fits the column. */
  displaySmall?: boolean;
  decimal?: boolean;
  look: FieldLook;
  small?: boolean; // warm-up rows
  width: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const focused = draft !== null;
  const shown = focused ? draft : value === undefined ? '' : (display ?? fmt(value));
  return (
    <View style={[styles.cell, { width }]}>
      <TextInput
        style={[
          styles.field,
          small && styles.fieldWarmup,
          look === 'done' && styles.fieldDone,
          look === 'current' && styles.fieldCurrent,
          focused && styles.fieldFocused,
          !focused && displayColor ? { color: displayColor } : null,
          !focused && displaySmall && value !== undefined ? styles.fieldSmallText : null,
        ]}
        value={shown}
        placeholder={focused ? fmt(value ?? placeholder) : fmt(placeholder)}
        placeholderTextColor={C.t3}
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
    </View>
  );
}

type SetRowProps = {
  label: string;
  set: WorkoutSet;
  previous?: WorkoutSet;
  tracking: TrackingType;
  /** The workout's current set: highlighted row. */
  current?: boolean;
  /** Show plates per side in the weight column instead of pounds. */
  plates?: boolean;
  onChange: (patch: SetPatch) => void;
  onDelete: () => void;
};

export function SetRow({ label, set, previous, tracking, current, plates, onChange, onDelete }: SetRowProps) {
  const hasWeight = weightHeader(tracking) !== null;
  const isDuration = tracking === 'duration';
  const warmup = set.type === 'warmup';
  const amrap = set.type === 'amrap';
  // Empty fields show the target or last time's number; checking a set adopts them.
  const weightHint = set.target?.weight ?? previous?.weight;
  const repsHint = set.target?.reps ?? previous?.reps;
  const look: FieldLook = set.done ? 'done' : current ? 'current' : 'idle';

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

  const weightDisplay = plates ? formatPlatesCompact(set.weight) : formatLoad(set.weight, tracking);
  // AMRAP: show the target as "5+" in amber until it's logged.
  const amrapHint = amrap && !set.done && set.reps !== undefined && set.reps === set.target?.reps;

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
      {/* Opaque base so the swipe action never shows through the tinted states. */}
      <View style={styles.base}>
        <View
          style={[
            styles.row,
            warmup && styles.rowWarmup,
            current && !set.done && styles.rowCurrent,
            set.done && styles.rowDone,
          ]}>
          <View style={[styles.labelCell]}>
            <View
              style={[
                styles.badge,
                amrap && styles.badgeAmrap,
                warmup && styles.badgeWarmup,
                current && !set.done && styles.badgeCurrent,
              ]}>
              <ThemedText
                num
                style={[
                  styles.badgeText,
                  amrap && { color: C.amrap },
                  warmup && { color: C.warmup },
                  current && !set.done && { color: C.onAccent },
                ]}>
                {label}
              </ThemedText>
            </View>
          </View>
          <ThemedText num style={styles.previous} numberOfLines={1}>
            {formatSet(previous, tracking)}
          </ThemedText>
          {hasWeight ? (
            <NumberField
              value={set.weight}
              placeholder={weightHint}
              display={weightDisplay}
              displaySmall={plates && weightDisplay.length > 5}
              decimal
              look={look}
              small={warmup}
              width={SET_COLUMNS.weight}
              onCommit={(weight) => onChange({ weight })}
            />
          ) : null}
          {isDuration ? (
            <NumberField
              value={set.durationSec}
              placeholder={previous?.durationSec}
              look={look}
              small={warmup}
              width={SET_COLUMNS.reps}
              onCommit={(durationSec) => onChange({ durationSec })}
            />
          ) : (
            <NumberField
              value={set.reps}
              placeholder={repsHint}
              display={amrapHint ? `${fmt(set.reps)}+` : undefined}
              displayColor={amrapHint ? C.amrap : undefined}
              look={look}
              small={warmup}
              width={SET_COLUMNS.reps}
              onCommit={(reps) => onChange({ reps })}
            />
          )}
          <View style={styles.checkCell}>
            <Pressable
              onPress={toggleDone}
              hitSlop={4}
              style={[
                styles.check,
                warmup && styles.checkWarmup,
                current && !set.done && styles.checkCurrent,
                set.done && styles.checkDone,
              ]}
              accessibilityRole="checkbox"
              accessibilityLabel={`Set ${label}`}
              accessibilityState={{ checked: set.done }}>
              <IconSymbol
                name="checkmark"
                size={warmup ? 15 : 18}
                weight="bold"
                color={set.done ? C.onAccent : current ? C.accent : C.t3}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </ReanimatedSwipeable>
  );
}

/** Column widths: SET · PREV (flex) · LB · REPS · ✓. Shared with the card's header row. */
export const SET_COLUMNS = { label: 40, weight: 74, reps: 62, check: 50 };
export const ROW_PADDING = 10;

const styles = StyleSheet.create({
  base: { backgroundColor: C.s1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: ROW_PADDING,
  },
  rowWarmup: { height: 44 },
  rowCurrent: { backgroundColor: C.s2 },
  rowDone: { backgroundColor: C.accentBg },
  labelCell: { width: SET_COLUMNS.label, alignItems: 'flex-start' },
  badge: {
    minWidth: 28,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: Radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.s3,
  },
  badgeWarmup: { backgroundColor: 'transparent' },
  badgeAmrap: { backgroundColor: C.amrapBg },
  badgeCurrent: { backgroundColor: C.accent },
  badgeText: { fontSize: 13, fontWeight: '700', color: C.t2 },
  previous: {
    flex: 1,
    fontSize: 14,
    color: C.t3,
    textAlign: 'center',
  },
  cell: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  field: {
    ...numStyle,
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: 'transparent',
    color: C.t1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    padding: 0,
  },
  fieldWarmup: { height: 36, fontSize: 16, fontWeight: '500', color: C.t2 },
  fieldCurrent: {
    height: 38,
    backgroundColor: C.s3,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fieldDone: { color: C.t2 },
  fieldSmallText: { fontSize: 12.5, letterSpacing: -0.7 },
  fieldFocused: {
    backgroundColor: C.s3,
    borderWidth: 2,
    borderColor: C.accent,
  },
  checkCell: { width: SET_COLUMNS.check, alignItems: 'flex-end' },
  check: {
    width: 44,
    height: 44,
    borderRadius: Radius.field,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.s2,
  },
  checkWarmup: { width: 40, height: 36 },
  checkCurrent: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.accent },
  checkDone: { backgroundColor: C.accent },
  delete: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    backgroundColor: C.destructive,
  },
  deleteText: {
    color: C.t1,
    fontWeight: '600',
  },
});
