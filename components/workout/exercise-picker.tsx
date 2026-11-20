import { ALL_EXERCISES, type Exercise, type MovementPattern } from '@/lib/exercises';
import { Modal, Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import React, { useMemo, useState } from 'react';

import { Colors, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';

const PATTERN_ORDER: MovementPattern[] = [
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

type ExercisePickerProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
};

export function ExercisePicker({ visible, title, onClose, onPick }: ExercisePickerProps) {
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (e: Exercise) => !q || e.name.toLowerCase().includes(q) || e.pattern.toLowerCase().includes(q);
    return PATTERN_ORDER.map((pattern) => ({
      title: pattern,
      data: ALL_EXERCISES.filter((e) => e.pattern === pattern && matches(e)).sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((section) => section.data.length > 0);
  }, [query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
          <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
            <IconSymbol name="xmark" size={20} color={Colors.dark.textMuted} />
          </Pressable>
        </View>
        <View style={styles.search}>
          <IconSymbol name="magnifyingglass" size={16} color={Colors.dark.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={Colors.dark.textMuted}
            keyboardAppearance="dark"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <ThemedText type="label" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setQuery('');
                onPick(item.id);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <ThemedText>{item.name}</ThemedText>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: Colors.dark.text,
    fontFamily: Fonts.family,
  },
  list: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionTitle: {
    color: Colors.dark.textMuted,
    marginTop: 16,
    marginBottom: 6,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  pressed: {
    opacity: 0.6,
  },
});
