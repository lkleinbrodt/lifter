import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { getExercisesByTag } from '@/lib/exercises-data';

import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ArchetypeDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ name?: string }>();
  const tagName = params.name ? decodeURIComponent(params.name) : '';

  const exercises = getExercisesByTag(tagName);

  return (
    <>
      <Stack.Screen
        options={{
          title: tagName || 'Archetype',
          headerStyle: {
            backgroundColor: Colors.dark.surface,
          },
          headerTintColor: Colors.dark.text,
          headerTitleStyle: {
            color: Colors.dark.text,
          },
          headerBackTitle: 'Back',
        }}
      />
      <SafeAreaContainer edges={['top', 'left', 'right', 'bottom']}>
        <ThemedView style={styles.container}>
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
            <ThemedText type="title">{tagName}</ThemedText>

            {exercises.length === 0 ? (
              <Card style={styles.card}>
                <ThemedText style={styles.emptyText}>
                  No exercises found with the tag "{tagName}".
                </ThemedText>
              </Card>
            ) : (
              <Card style={styles.card}>
                <ThemedText type="defaultSemiBold" style={styles.sectionLabel}>
                  Exercises ({exercises.length})
                </ThemedText>
                <View style={styles.itemsList}>
                  {exercises.map((exercise) => (
                    <View key={exercise.name} style={styles.pill}>
                      <ThemedText style={styles.pillText}>{exercise.name}</ThemedText>
                    </View>
                  ))}
                </View>
              </Card>
            )}
          </ScrollView>
        </ThemedView>
      </SafeAreaContainer>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 24,
  },
  card: {
    gap: 12,
  },
  sectionLabel: {
    color: Colors.dark.tint,
    marginBottom: 2,
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
  emptyText: {
    color: Colors.dark.textMuted,
  },
});
