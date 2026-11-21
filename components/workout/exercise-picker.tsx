// Exercise picker sheet: the slot's own pool first (when replacing an accessory), then recent
// exercises, then the whole catalog A–Z. Each row shows equipment and last session's top set.

import { ALL_EXERCISES, exerciseMeta, getExercise, splitExerciseName } from '@/lib/exercises';
import { Modal, Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { type WorkoutSet, isWorkingSet } from '@/lib/workout';

import { C, Fonts, Radius, numStyle } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { formatSet } from './set-row';
import { latestSessions } from '@/lib/db';

const RECENT_COUNT = 8;
const catalogIds = new Set(ALL_EXERCISES.map((exercise) => exercise.id));

type ExercisePickerProps = {
  visible: boolean;
  title: string;
  /** e.g. "Lateral Raise · vertical push slot". */
  subtitle?: string;
  /** The slot's pool (catalog ids), shown first. */
  slotIds?: string[];
  /** The exercise being replaced, checked in the list. */
  currentId?: string;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
};

type Latest = Awaited<ReturnType<typeof latestSessions>>;

/** Last session's best working set, e.g. "160 × 5". */
export function lastTopSet(sets: WorkoutSet[] | undefined, exerciseId: string) {
  const working = (sets ?? []).filter(isWorkingSet);
  if (!working.length) return '';
  const best = working.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) || ((b.weight ?? 0) === (a.weight ?? 0) && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a));
  return formatSet(best, getExercise(exerciseId).tracking);
}

export function ExercisePicker({ visible, title, subtitle, slotIds, currentId, onClose, onPick }: ExercisePickerProps) {
  const [query, setQuery] = useState('');
  const [latest, setLatest] = useState<Latest>({});

  useEffect(() => {
    if (!visible) return;
    let active = true;
    latestSessions().then((rows) => active && setLatest(rows));
    return () => {
      active = false;
    };
  }, [visible]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byName = (a: string, b: string) => getExercise(a).name.localeCompare(getExercise(b).name);
    const allIds = ALL_EXERCISES.map((exercise) => exercise.id);
    if (q) {
      const data = allIds.filter((id) => getExercise(id).name.toLowerCase().includes(q) || getExercise(id).pattern.toLowerCase().includes(q)).sort(byName);
      return [{ title: 'Results', data }];
    }
    const slot = slotIds ?? [];
    const recent = Object.entries(latest)
      .filter(([id]) => !slot.includes(id) && catalogIds.has(id))
      .sort((a, b) => b[1].startedAt.localeCompare(a[1].startedAt))
      .slice(0, RECENT_COUNT)
      .map(([id]) => id);
    return [
      { title: 'For this slot', data: slot },
      { title: 'Recent', data: recent },
      { title: 'All · A–Z', data: [...allIds].sort(byName) },
    ].filter((section) => section.data.length > 0);
  }, [query, slotIds, latest]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            {subtitle ? <ThemedText type="subhead">{subtitle}</ThemedText> : null}
          </View>
          <Pressable onPress={close} hitSlop={10} style={styles.close} accessibilityLabel="Close">
            <IconSymbol name="xmark" size={15} color={C.t2} />
          </Pressable>
        </View>
        <View style={styles.search}>
          <IconSymbol name="magnifyingglass" size={16} color={C.t3} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${ALL_EXERCISES.length} exercises`}
            placeholderTextColor={C.t3}
            keyboardAppearance="dark"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item}-${index}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <ThemedText type="caption" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
          )}
          renderItem={({ item, index, section }) => {
            const { title: name } = splitExerciseName(getExercise(item).name);
          const meta = exerciseMeta(item);
            const selected = item === currentId;
            return (
              <Pressable
                onPress={() => {
                  setQuery('');
                  onPick(item);
                }}
                style={({ pressed }) => [
                  styles.row,
                  index === 0 && styles.rowFirst,
                  index === section.data.length - 1 && styles.rowLast,
                  index > 0 && styles.rowDivider,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.flex}>
                  <ThemedText style={[styles.name, selected && { color: C.accent }]} numberOfLines={1}>
                    {name}
                  </ThemedText>
                  {meta ? (
                    <ThemedText style={styles.meta} numberOfLines={1}>
                      {meta}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText num style={styles.last}>
                  {lastTopSet(latest[item]?.sets, item)}
                </ThemedText>
                {selected ? <IconSymbol name="checkmark" size={16} weight="bold" color={C.accent} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: Radius.field,
    backgroundColor: C.s2,
  },
  searchInput: { flex: 1, height: 42, color: C.t1, fontFamily: Fonts.text, fontSize: 16 },
  list: { padding: 16, paddingBottom: 48 },
  sectionTitle: { marginTop: 18, marginBottom: 8, marginLeft: 4 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: C.s1 },
  rowFirst: { borderTopLeftRadius: Radius.card, borderTopRightRadius: Radius.card },
  rowLast: { borderBottomLeftRadius: Radius.card, borderBottomRightRadius: Radius.card },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  pressed: { backgroundColor: C.s2 },
  name: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 13, color: C.t3, marginTop: 1 },
  last: { ...numStyle, fontSize: 14, color: C.t2 },
});
