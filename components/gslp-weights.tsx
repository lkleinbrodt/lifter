// GSLP weights for the Settings tab: one row per lift, grouped by workout. Rows read as a
// list; tap the weight to edit it in place. The pull variant is a small switch on the pull row.

import * as Haptics from 'expo-haptics';

import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  type GslpLift,
  type GslpLiftKey,
  type GslpState,
  type PullVariant,
  formatNumber,
  liftsForWorkout,
  nextSession,
} from '@/lib/gslp';
import React, { useState } from 'react';

import { C, Radius, numStyle } from '@/constants/theme';
import { Pill } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { formatLoad, getExercise } from '@/lib/exercises';
import { gslpTemplateName } from '@/lib/workout-names';
import type { TopSet } from '@/lib/workout-actions';

const MAX_WEIGHT = 1500;
const SPARK_SESSIONS = 8;
const pullOptions: { key: PullVariant; label: string }[] = [
  { key: 'latPulldown', label: 'Pulldown' },
  { key: 'chinup', label: 'Chin-up' },
];

/** Each lift's top set per recent session, oldest first (see gslpLiftHistory). */
export type LiftSessions = Partial<Record<GslpLiftKey, TopSet[]>>;

type Props = { state: GslpState; sessions: LiftSessions; onChange: (next: GslpState) => void };

export function GslpWeightsSection({ state, sessions, onChange }: Props) {
  const next = nextSession(state).workout;
  return (
    <View style={styles.section}>
      {(['A', 'B'] as const).map((key) => (
        <View key={key} style={styles.group}>
          <View style={styles.groupHeader}>
            <ThemedText style={styles.groupTitle}>Workout {gslpTemplateName(key)}</ThemedText>
            {key === next ? <Pill label="next" tone="accent" /> : null}
          </View>
          <View style={styles.card}>
            {liftsForWorkout(key, state.pullVariant).map((lift, index) => (
              <LiftRow key={lift.key} lift={lift} state={state} sessions={sessions} onChange={onChange} divider={index > 0} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function LiftRow({ lift, state, sessions, onChange, divider }: Props & { lift: GslpLift; divider: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const weight = state.weights[lift.key];
  const { tracking } = getExercise(lift.exerciseId);
  const logs = sessions[lift.key] ?? [];
  const last = logs.at(-1);
  const isPull = lift.key === 'chinup' || lift.key === 'latPulldown';

  const lastText = last
    ? `last ${formatLoad(last.weight, tracking) || formatNumber(last.weight)}×${last.reps ?? '–'}`
    : 'no sessions yet';
  // The step from last session's weight to today's.
  const delta = last ? weight - last.weight : 0;
  const deltaText = !last ? '' : delta > 0 ? `+${formatNumber(delta)}` : delta < 0 ? `↓${formatNumber(-delta)}` : '=';

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || !Number.isFinite(parsed)) return;
    const value = Math.min(Math.max(parsed, 0), MAX_WEIGHT);
    if (value === weight) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onChange({ ...state, weights: { ...state.weights, [lift.key]: value } as Record<GslpLiftKey, number> });
  };

  const setPull = (variant: PullVariant) => {
    if (variant === state.pullVariant) return;
    void Haptics.selectionAsync();
    onChange({ ...state, pullVariant: variant });
  };

  return (
    <View style={[styles.row, divider && styles.divider]}>
      <View style={styles.rowText}>
        <ThemedText style={styles.name}>{lift.label}</ThemedText>
        <ThemedText style={styles.meta} numberOfLines={1}>
          {lastText}
          {deltaText ? <ThemedText style={[styles.meta, delta < 0 && { color: C.deload }]}> · {deltaText}</ThemedText> : null}
        </ThemedText>
        {isPull ? (
          <View style={styles.segmented}>
            {pullOptions.map((option) => {
              const selected = option.key === state.pullVariant;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setPull(option.key)}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}>
                  <ThemedText style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      <Sparkline values={logs.slice(-SPARK_SESSIONS).map((log) => log.weight)} />
      <TextInput
        style={[styles.weight, draft !== null && styles.weightEditing]}
        value={draft ?? (formatLoad(weight, tracking) || '—')}
        placeholder={formatNumber(weight)}
        placeholderTextColor={C.t3}
        keyboardType="decimal-pad"
        keyboardAppearance="dark"
        clearTextOnFocus
        onFocus={() => setDraft('')}
        onChangeText={(text) => setDraft(text.replace(/[^0-9.]/g, ''))}
        onBlur={commit}
        onSubmitEditing={commit}
        accessibilityLabel={`${lift.label} weight`}
      />
    </View>
  );
}

/** Small bars of the AMRAP weight over recent sessions; the latest is accent. Drawn with Views (no svg in the build). */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <View style={styles.spark} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <View style={styles.spark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {values.map((value, index) => (
        <View
          key={index}
          style={[
            styles.sparkBar,
            { height: 4 + (max === min ? 8 : ((value - min) / (max - min)) * 16) },
            index === values.length - 1 && styles.sparkLast,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 20 },
  group: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  groupTitle: { fontSize: 15, fontWeight: '600', color: C.t2 },
  card: { backgroundColor: C.s1, borderRadius: Radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.09)' },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  meta: { ...numStyle, fontSize: 13, color: C.t3 },
  segmented: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: 6, padding: 2, borderRadius: 9, backgroundColor: C.bg },
  segment: { paddingHorizontal: 10, height: 28, justifyContent: 'center', borderRadius: 7 },
  segmentSelected: { backgroundColor: C.s3 },
  segmentText: { fontSize: 13, color: C.t3 },
  segmentTextSelected: { color: C.accent, fontWeight: '600' },
  spark: { width: 8 * 5, height: 22, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  sparkBar: { width: 3, borderRadius: 1.5, backgroundColor: C.t4 },
  sparkLast: { backgroundColor: C.accent },
  weight: {
    ...numStyle,
    minWidth: 76,
    height: 44,
    paddingHorizontal: 8,
    borderRadius: Radius.field,
    textAlign: 'right',
    fontSize: 22,
    fontWeight: '600',
    color: C.t1,
  },
  weightEditing: { backgroundColor: C.s3, borderWidth: 2, borderColor: C.accent, textAlign: 'center' },
});
