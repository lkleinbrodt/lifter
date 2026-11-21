import { Pressable, StyleSheet, View } from 'react-native';
import { restRemaining, useSession } from '@/lib/session-store';

import { C, Shadows, numStyle } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import React from 'react';
import { ThemedText } from '@/components/themed-text';
import { formatDuration } from '@/lib/workout-edit';
import { useNow } from './rest-bar';
import { useRouter } from 'expo-router';

const RING = 30;

/** Floating card above the tab bar while a workout is in progress; the whole card returns to it. */
export function ActiveWorkoutBar() {
  const router = useRouter();
  const { active, rest } = useSession();
  const now = useNow(!!active, rest ? 250 : 1000);
  if (!active) return null;

  const elapsed = Math.max(0, Math.round((now - new Date(active.startedAt).getTime()) / 1000));
  const left = restRemaining(rest, now);
  const fraction = rest && left !== null ? Math.min(1, left / rest.durationSec) : 0;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={() => router.push(`/workout/${active.id}`)}
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Return to ${active.name}`}>
        <RestRing fraction={fraction} active={left !== null} />
        <View style={styles.text}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {active.name}
          </ThemedText>
          <ThemedText num style={styles.meta}>
            {formatDuration(elapsed)} · {active.doneSets}/{active.totalSets} sets
          </ThemedText>
        </View>
        {left !== null ? (
          <ThemedText num style={styles.rest}>
            {formatDuration(left)}
          </ThemedText>
        ) : null}
        <IconSymbol name="chevron.up" size={15} color={C.t3} />
      </Pressable>
    </View>
  );
}

/**
 * Rest progress as a ring, drawn without svg: two half-discs rotate to reveal the arc.
 * Empty ring when no rest is running.
 */
function RestRing({ fraction, active }: { fraction: number; active: boolean }) {
  const deg = fraction * 360;
  return (
    <View style={styles.ring}>
      {active ? (
        <>
          {/* Each clip shows one half of the ring; a full-size square with one filled half rotates into it. */}
          <View style={[styles.half, styles.halfRight]}>
            <View style={[styles.disc, styles.discInRight, { transform: [{ rotate: `${Math.min(deg, 180) - 180}deg` }] }]}>
              <View style={[styles.fill, styles.fillRight]} />
            </View>
          </View>
          <View style={[styles.half, styles.halfLeft]}>
            <View style={[styles.disc, { transform: [{ rotate: `${Math.max(deg - 180, 0) - 180}deg` }] }]}>
              <View style={[styles.fill, styles.fillLeft]} />
            </View>
          </View>
        </>
      ) : null}
      <View style={styles.ringHole} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingBottom: 8 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    height: 60,
    borderRadius: 18,
    backgroundColor: C.s2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Shadows.float,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { ...numStyle, fontSize: 13, color: C.t2 },
  rest: { ...numStyle, fontSize: 17, fontWeight: '600', color: C.accent },
  ring: { width: RING, height: RING, borderRadius: RING / 2, backgroundColor: C.s3, overflow: 'hidden' },
  half: { position: 'absolute', top: 0, width: RING / 2, height: RING, overflow: 'hidden' },
  halfRight: { right: 0 },
  halfLeft: { left: 0 },
  disc: { position: 'absolute', top: 0, left: 0, width: RING, height: RING },
  discInRight: { left: -RING / 2 },
  fill: { position: 'absolute', top: 0, bottom: 0, width: RING / 2, backgroundColor: C.accent },
  fillRight: { right: 0 },
  fillLeft: { left: 0 },
  ringHole: { position: 'absolute', top: 4, left: 4, width: RING - 8, height: RING - 8, borderRadius: (RING - 8) / 2, backgroundColor: C.s2 },
});
