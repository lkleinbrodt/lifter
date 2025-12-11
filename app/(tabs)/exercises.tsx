import { SectionList, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import React from 'react';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ExerciseCategory = {
  name: string;
  items: string[];
};

type ExerciseSection = {
  title: string;
  data: ExerciseCategory[];
};

const EXERCISE_SECTIONS: ExerciseSection[] = [
  {
    title: 'Upper Body Push',
    data: [
      {
        name: 'Horizontal Push',
        items: ['DB incline press', 'Push-ups', 'Close-grip bench press'],
      },
      {
        name: 'Vertical Push',
        items: ['Landmine press', 'Dumbbell Z-press', 'Seated DB overhead press', 'Kettlebell press'],
      },
      {
        name: 'Isolation / Hypertrophy',
        items: ['Lateral Raises', 'Triceps pushdowns', 'Dips'],
      },
    ],
  },
  {
    title: 'Upper Body Pull',
    data: [
      {
        name: 'Horizontal Pull',
        items: ['Barbell row', 'DB row', 'Gorilla Rows', 'Seated cable row'],
      },
      {
        name: 'Vertical Pull',
        items: ['Pull-ups', 'Chin-ups', 'Lat pulldowns'],
      },
      {
        name: 'Upper-Back / Rear Delt / Scapular Stability',
        items: ['Face pulls', 'Band pull-aparts', 'Rear-delt fly', 'Shrugs'],
      },
    ],
  },
  {
    title: 'Lower Body — Unilateral',
    data: [
      {
        name: 'Quad-Dominant',
        items: ['ATG Split Squats', 'Bulgarian split squats', 'Goblet split squat', 'Poliquin Stepdowns'],
      },
      {
        name: 'Glute / Hip-Dominant',
        items: ['Single-Leg RDL', 'Cossack Squats'],
      },
    ],
  },
  {
    title: 'Lower Body — Bilateral',
    data: [
      {
        name: 'Quads',
        items: ['Leg press'],
      },
      {
        name: 'Glutes / Hamstrings',
        items: ['RDL', 'Hip thrusts', 'Glute bridges', 'Back extensions', 'Hamstring curls'],
      },
    ],
  },
  {
    title: 'Core / Bracing / Carrying',
    data: [
      {
        name: 'Anti-Extension / Anti-Flexion',
        items: ['Planks', 'Leg Raises', 'Ab-wheel rollouts'],
      },
      {
        name: 'Anti-Rotation / Anti-Lateral Flexion',
        items: ['Pallof Press', 'Side Planks', 'Suitcase Carries', 'Farmer Carries'],
      },
      {
        name: 'Hinge Integration',
        items: ['Back extensions', 'Reverse hypers', 'Hip extensions with pause', 'Seated Good Mornings'],
      },
    ],
  },
];

export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaContainer edges={['top', 'left', 'right']}>
      <ThemedView style={styles.container}>
        <SectionList
          sections={EXERCISE_SECTIONS}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="display">Exercise Library</ThemedText>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <ThemedText type="title">{section.title}</ThemedText>
            </View>
          )}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <ThemedText type="defaultSemiBold" style={styles.categoryTitle}>
                {item.name}
              </ThemedText>
              <View style={styles.itemsList}>
                {item.items.map((exercise) => (
                  <View key={exercise} style={styles.pill}>
                    <ThemedText style={styles.pillText}>{exercise}</ThemedText>
                  </View>
                ))}
              </View>
            </Card>
          )}
          showsVerticalScrollIndicator={false}
        />
      </ThemedView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    marginBottom: 6,
  },
  header: {
    gap: 4,
    marginBottom: 12,
  },
  card: {
    gap: 12,
  },
  categoryTitle: {
    color: Colors.dark.tint,
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: Colors.dark.tintMuted,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pillText: {
    color: Colors.dark.text,
  },
  gap: {
    height: 12,
  },
  sectionGap: {
    height: 5,
  },
});
