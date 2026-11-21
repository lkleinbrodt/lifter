import * as Haptics from 'expo-haptics';

import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import React, { useEffect, useRef, useState } from 'react';
import { adjustRest, restRemaining, skipRest, useSession } from '@/lib/session-store';

import { C, numStyle } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { formatDuration } from '@/lib/workout-edit';
import type { NextUp } from './next-up';

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


/** Bottom bar on the workout screen while a rest timer runs: a fill that drains, the countdown, and what's next. */
export function RestBar({ bottomInset, next }: { bottomInset: number; next?: NextUp }) {
  const { rest } = useSession();
  const now = useNow(!!rest, 250);
  const left = restRemaining(rest, now);
  const fired = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  // In-app nudge when the countdown reaches zero (the notification covers the locked phone):
  // the fill pulses twice. The store clears the timer shortly after.
  useEffect(() => {
    if (!rest || left !== 0 || fired.current === rest.endsAt) return;
    fired.current = rest.endsAt;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!reduceMotion) pulse.value = withRepeat(withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 240 })), 2);
  }, [left, rest, pulse, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value * 0.35 }));

  if (!rest || left === null) return null;
  const progress = Math.min(1, Math.max(0, left / rest.durationSec));

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset + 8 }]}>
      <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pulse, pulseStyle]} />
      <View style={styles.row}>
        <View style={styles.timeBlock}>
          <ThemedText type="caption">{left === 0 ? 'Rest over' : 'Rest'}</ThemedText>
          <ThemedText num style={styles.time}>
            {formatDuration(left)}
          </ThemedText>
        </View>
        <BarButton label="−15" onPress={() => adjustRest(-15)} />
        <BarButton label="+15" onPress={() => adjustRest(15)} />
        <BarButton label="Skip" primary onPress={() => void skipRest()} />
      </View>
      {next ? (
        <View style={styles.next}>
          <ThemedText type="caption" style={styles.nextCaption}>
            Next
          </ThemedText>
          <ThemedText style={styles.nextName} numberOfLines={1}>
            {next.name} <ThemedText style={styles.nextSet}>· {next.set}</ThemedText>
          </ThemedText>
          <ThemedText num style={styles.nextNumbers} numberOfLines={1}>
            {next.numbers}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function BarButton({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.button, primary && styles.primary, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label === 'Skip' ? 'Skip rest' : `${label} seconds`}>
      <ThemedText num={!primary} style={[styles.buttonText, primary && styles.primaryText]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: C.s2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(157,193,173,0.15)',
  },
  pulse: { backgroundColor: C.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBlock: { flex: 1 },
  time: { ...numStyle, fontSize: 36, lineHeight: 40, fontWeight: '700', color: C.t1 },
  button: {
    height: 48,
    minWidth: 58,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.s3,
  },
  primary: { backgroundColor: C.accent, minWidth: 72 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  buttonText: { fontSize: 16, fontWeight: '600', color: C.t1 },
  primaryText: { color: C.onAccent, fontWeight: '700' },
  next: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  nextCaption: { color: C.t3 },
  nextName: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: C.t1 },
  nextSet: { fontSize: 15, fontWeight: '400', color: C.t2 },
  nextNumbers: { ...numStyle, marginLeft: 'auto', fontSize: 15, color: C.t2 },
});
