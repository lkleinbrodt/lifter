import * as Haptics from 'expo-haptics';

import { Pressable, StyleSheet, View } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { adjustRest, restRemaining, skipRest, useSession } from '@/lib/session-store';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { formatDuration } from '@/lib/workout-edit';

/** Re-renders every `ms` while `active`. */
export function useNow(active: boolean, ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [active, ms]);
  return now;
}

/** Bottom bar on the workout screen while a rest timer runs. */
export function RestBar({ bottomInset }: { bottomInset: number }) {
  const { rest } = useSession();
  const now = useNow(!!rest, 250);
  const left = restRemaining(rest, now);
  const fired = useRef<number | null>(null);

  // In-app nudge when the countdown reaches zero (the notification covers the locked phone).
  // The store clears the timer shortly after.
  useEffect(() => {
    if (!rest || left !== 0 || fired.current === rest.endsAt) return;
    fired.current = rest.endsAt;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [left, rest]);

  if (!rest || left === null) return null;
  const progress = Math.min(1, Math.max(0, left / rest.durationSec));

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset + 10 }]}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <Pressable onPress={() => adjustRest(-15)} style={styles.button} hitSlop={6}>
          <ThemedText style={styles.buttonText}>−15s</ThemedText>
        </Pressable>
        <View style={styles.center}>
          <ThemedText type="label" style={styles.label}>
            {left === 0 ? 'Rest over' : 'Rest'}
          </ThemedText>
          <ThemedText type="title" style={styles.time}>
            {formatDuration(left)}
          </ThemedText>
        </View>
        <Pressable onPress={() => adjustRest(15)} style={styles.button} hitSlop={6}>
          <ThemedText style={styles.buttonText}>+15s</ThemedText>
        </Pressable>
        <Pressable onPress={() => void skipRest()} style={[styles.button, styles.skip]} hitSlop={6}>
          <ThemedText style={styles.skipText}>Skip</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingTop: 0,
    gap: 10,
  },
  track: {
    height: 3,
    marginHorizontal: -16,
    backgroundColor: Colors.dark.surfaceHighlight,
  },
  fill: {
    height: 3,
    backgroundColor: Colors.dark.tint,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    color: Colors.dark.textMuted,
  },
  time: {
    fontVariant: ['tabular-nums'],
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceHighlight,
  },
  buttonText: {
    fontSize: 14,
  },
  skip: {
    backgroundColor: Colors.dark.tintMuted,
  },
  skipText: {
    fontSize: 14,
    color: Colors.dark.tint,
  },
});
