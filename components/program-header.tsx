import { Pressable, StyleSheet, View } from 'react-native';
import { getProgram, isProgramKey } from '@/lib/programs';
import { useRouter, useSegments } from 'expo-router';

import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import React from 'react';
import { ThemedText } from '@/components/themed-text';

// Screen title plus a chip showing the active program; tapping it returns to the program picker.
export function ProgramHeader({ title }: { title: string }) {
  const router = useRouter();
  const segments = useSegments();
  const programKey = segments[0];
  const program = isProgramKey(programKey) ? getProgram(programKey) : null;

  return (
    <View style={styles.row}>
      <ThemedText type="display" style={styles.title}>
        {title}
      </ThemedText>
      <View style={styles.actions}>
        {program ? (
          <Pressable
            onPress={() => router.replace('/')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Switch program">
            {({ pressed }) => (
              <View style={[styles.chip, pressed && styles.chipPressed]}>
                <ThemedText type="label" style={styles.chipText}>
                  {program.name}
                </ThemedText>
                <IconSymbol name="arrow.left.arrow.right" size={14} color={Colors.dark.tint} />
              </View>
            )}
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Settings">
          {({ pressed }) => (
            <IconSymbol
              name="gearshape"
              size={22}
              color={Colors.dark.textMuted}
              style={pressed && styles.chipPressed}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.tintMuted,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    color: Colors.dark.tint,
  },
});
