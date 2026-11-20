import { Pressable, StyleSheet, View } from 'react-native';
import { restRemaining, useSession } from '@/lib/session-store';

import { Colors } from '@/constants/theme';
import React from 'react';
import { ThemedText } from '@/components/themed-text';
import { formatDuration } from '@/lib/workout-edit';
import { useNow } from './rest-bar';
import { useRouter } from 'expo-router';

/** Shown above the tab bar while a workout is in progress; tap to return to it. */
export function ActiveWorkoutBar() {
  const router = useRouter();
  const { active, rest } = useSession();
  const now = useNow(!!active);
  if (!active) return null;

  const elapsed = Math.max(0, Math.round((now - new Date(active.startedAt).getTime()) / 1000));
  const left = restRemaining(rest, now);

  return (
    <Pressable
      onPress={() => router.push(`/workout/${active.id}`)}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Resume ${active.name}`}>
      <View style={styles.text}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {active.name}
        </ThemedText>
        <ThemedText style={styles.muted}>{formatDuration(elapsed)}</ThemedText>
      </View>
      {left !== null ? (
        <View style={styles.rest}>
          <ThemedText style={styles.restText}>Rest {formatDuration(left)}</ThemedText>
        </View>
      ) : null}
      <ThemedText style={styles.resume}>Resume</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.dark.surfaceHighlight,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  muted: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontVariant: ['tabular-nums'],
  },
  rest: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.dark.tintMuted,
  },
  restText: {
    fontSize: 13,
    color: Colors.dark.tint,
    fontVariant: ['tabular-nums'],
  },
  resume: {
    color: Colors.dark.tint,
  },
});
