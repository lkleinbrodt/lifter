// Exercises tab: the catalog (lib/exercises.ts) as a list, filtered by movement pattern. Each
// row shows its equipment and last session's top set; tap for the exercise's history.

import { ALL_EXERCISES, type MovementPattern, exerciseMeta, splitExerciseName } from '@/lib/exercises';
import { Pressable, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import React, { useCallback, useMemo, useState } from 'react';

import { C, Radius, numStyle } from '@/constants/theme';
import { Chip } from '@/components/ui/primitives';
import { ExerciseHistorySheet } from '@/components/workout/exercise-history-sheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProgramHeader } from '@/components/program-header';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { lastTopSet } from '@/components/workout/exercise-picker';
import { latestSessions } from '@/lib/db';
import { useFocusEffect } from '@react-navigation/native';

const PATTERNS: MovementPattern[] = [
  'Horizontal Push',
  'Vertical Push',
  'Horizontal Pull',
  'Vertical Pull',
  'Squat',
  'Hinge',
  'Core',
  'Calves',
  'Arms',
  'Other',
];

export default function ExercisesScreen() {
  const [filter, setFilter] = useState<MovementPattern | null>(null);
  const [latest, setLatest] = useState<Awaited<ReturnType<typeof latestSessions>>>({});
  const [historyId, setHistoryId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      latestSessions().then((rows) => active && setLatest(rows));
      return () => {
        active = false;
      };
    }, []),
  );

  const sections = useMemo(
    () =>
      PATTERNS.filter((pattern) => !filter || pattern === filter)
        .map((pattern) => ({
          title: pattern,
          data: ALL_EXERCISES.filter((exercise) => exercise.pattern === pattern).sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .filter((section) => section.data.length > 0),
    [filter],
  );
  const present = PATTERNS.filter((pattern) => ALL_EXERCISES.some((exercise) => exercise.pattern === pattern));

  return (
    <SafeAreaContainer edges={['top', 'left', 'right']}>
      <SectionList
        style={styles.screen}
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <ProgramHeader title="Exercises" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All" selected={!filter} onPress={() => setFilter(null)} />
              {present.map((pattern) => (
                <Chip key={pattern} label={pattern} selected={filter === pattern} onPress={() => setFilter(pattern)} />
              ))}
            </ScrollView>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <ThemedText type="caption" style={styles.sectionTitle}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item, index, section }) => {
          const { title } = splitExerciseName(item.name);
          const meta = exerciseMeta(item.id);
          return (
            <Pressable
              onPress={() => setHistoryId(item.id)}
              style={({ pressed }) => [
                styles.row,
                index === 0 && styles.rowFirst,
                index === section.data.length - 1 && styles.rowLast,
                index > 0 && styles.rowDivider,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityHint="Shows past sessions">
              <View style={styles.flex}>
                <ThemedText style={styles.name} numberOfLines={1}>
                  {title}
                </ThemedText>
                {meta ? (
                  <ThemedText style={styles.meta} numberOfLines={1}>
                    {meta}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText num style={styles.last}>
                {lastTopSet(latest[item.id]?.sets, item.id)}
              </ThemedText>
              <IconSymbol name="chevron.right" size={13} color={C.t4} />
            </Pressable>
          );
        }}
      />
      <ExerciseHistorySheet exerciseId={historyId} onClose={() => setHistoryId(null)} />
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 140 },
  header: { gap: 14, marginBottom: 4 },
  chips: { gap: 8, paddingRight: 16 },
  sectionTitle: { marginTop: 20, marginBottom: 8, marginLeft: 4 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: C.s1 },
  rowFirst: { borderTopLeftRadius: Radius.card, borderTopRightRadius: Radius.card },
  rowLast: { borderBottomLeftRadius: Radius.card, borderBottomRightRadius: Radius.card },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  pressed: { backgroundColor: C.s2 },
  name: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 13, color: C.t3, marginTop: 1 },
  last: { ...numStyle, fontSize: 14, color: C.t2 },
});
