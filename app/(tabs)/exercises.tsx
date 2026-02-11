import { SectionList, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { getExercisesByPrimaryArchetype, type PrimaryArchetype } from '@/lib/exercises-data';
import React, { useMemo } from 'react';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY_ARCHETYPE_ORDER: PrimaryArchetype[] = ['Vertical Pull', 'Vertical Push', 'Horizontal Pull', 'Horizontal Push', 'Squat', 'Hinge', 'Misc'];

type ExerciseSection = {
  title: string;
  data: string[][]; // Array with single item containing all exercise names for this archetype
};

export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();
  
  const sections = useMemo(() => {
    const grouped = getExercisesByPrimaryArchetype();
    const sectionsList: ExerciseSection[] = [];
    
    for (const archetype of PRIMARY_ARCHETYPE_ORDER) {
      const exercises = grouped[archetype];
      if (exercises.length > 0) {
        sectionsList.push({
          title: archetype,
          data: [exercises.map((ex) => ex.name)], // Single item array containing all exercise names
        });
      }
    }
    
    return sectionsList;
  }, []);

  return (
    <SafeAreaContainer edges={['top', 'left', 'right']}>
      <ThemedView style={styles.container}>
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `archetype-${index}`}
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
              <View style={styles.itemsList}>
                {item.map((exerciseName) => (
                  <View key={exerciseName} style={styles.pill}>
                    <ThemedText style={styles.pillText}>{exerciseName}</ThemedText>
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
