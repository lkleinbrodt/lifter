// Motion pieces for the finished-workout celebration: a confetti burst, the check medallion with
// its ripple, numbers that count up, and things that pop in with a haptic tick. Views only (no svg).
// Every piece takes `play`: false renders the final state with no motion and no haptics.

import * as Haptics from 'expo-haptics';

import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type StyleProp, StyleSheet, type TextStyle, View, type ViewStyle } from 'react-native';

import { C } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';

// ---- Haptics ----

export const tick = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  void Haptics.impactAsync(style);
};

// ---- Confetti ----

const CONFETTI_COLORS = [C.accentHi, C.amrap, C.superset, '#FFFFFF', C.accent, C.deload];
const PIECES = 34;
const BURST_MS = 1500;

type Piece = { angle: number; distance: number; spin: number; size: number; round: boolean; color: string; delay: number };

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => ({
    // Mostly upward and sideways; gravity pulls them back down past the medallion.
    angle: -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5,
    distance: 70 + Math.random() * 110,
    spin: (Math.random() - 0.5) * 720,
    size: 5 + Math.random() * 4,
    round: i % 3 === 0,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 90,
  }));
}

/** A one-shot burst from the center of its (absolutely filled) parent. */
export function Confetti({ play }: { play: boolean }) {
  const pieces = useMemo(makePieces, []);
  const progress = useSharedValue(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!play) return;
    progress.value = withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.quad) });
    const timer = setTimeout(() => setDone(true), BURST_MS + 100);
    return () => clearTimeout(timer);
  }, [play, progress]);
  if (!play || done) return null;
  return (
    <View pointerEvents="none" style={styles.confetti}>
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} progress={progress} />
      ))}
    </View>
  );
}

function ConfettiPiece({ piece, progress }: { piece: Piece; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const lag = piece.delay / BURST_MS;
    const t = Math.max(0, (progress.value - lag) / (1 - lag)); // reaches 1 with the burst
    const x = Math.cos(piece.angle) * piece.distance * t;
    const y = Math.sin(piece.angle) * piece.distance * t + 140 * t * t; // gravity
    return {
      opacity: t === 0 || t >= 1 ? 0 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${piece.spin * t}deg` }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: piece.size,
          height: piece.round ? piece.size : piece.size * 1.7,
          borderRadius: piece.round ? piece.size / 2 : 1.5,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

// ---- Medallion ----

const MEDALLION = 64;

/** Filled accent check that springs in, with two rings rippling out behind it. */
export function Medallion({ play }: { play: boolean }) {
  const scale = useSharedValue(play ? 0 : 1);
  const ripple = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    scale.value = withSpring(1, { damping: 9, stiffness: 160, mass: 0.8 });
    ripple.value = withDelay(120, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [play, scale, ripple]);

  const badge = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ring1 = useAnimatedStyle(() => rippleStyle(ripple.value, 0));
  const ring2 = useAnimatedStyle(() => rippleStyle(ripple.value, 0.25));

  return (
    <View style={styles.medallionWrap}>
      <Animated.View style={[styles.ring, ring1]} />
      <Animated.View style={[styles.ring, ring2]} />
      <View style={styles.halo} />
      <Animated.View style={[styles.medallion, badge]}>
        <IconSymbol name="checkmark" size={30} color={C.onAccent} weight="bold" />
      </Animated.View>
    </View>
  );
}

/** A ring that starts `lag` into the ripple, grows and fades out. */
function rippleStyle(progress: number, lag: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, (progress - lag) / (1 - lag)));
  return { opacity: progress >= 1 ? 0 : 0.55 * (1 - t), transform: [{ scale: 1 + 1.4 * t }] };
}

// ---- Count-up ----

const COUNT_MS = 900;

/** A number that counts up from 0 to `value`, then ticks a haptic when it lands. */
export function CountUp({
  value,
  format,
  play,
  delay = 0,
  style,
}: {
  value: number;
  format: (value: number) => string;
  play: boolean;
  delay?: number;
  style?: StyleProp<TextStyle>;
}) {
  const [shown, setShown] = useState(play ? 0 : value);
  const played = useRef(false);
  useEffect(() => {
    // Count once; later changes (a trimmed finish time) just show the new value.
    if (!play || played.current) {
      setShown(value);
      return;
    }
    let frame = 0;
    let start = 0;
    const timer = setTimeout(() => {
      played.current = true;
      const step = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / COUNT_MS);
        setShown(value * (1 - Math.pow(1 - t, 3))); // ease-out cubic
        if (t < 1) frame = requestAnimationFrame(step);
        else tick();
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
    // Only replay when the target changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, play]);
  return (
    <ThemedText num style={style}>
      {format(shown)}
    </ThemedText>
  );
}

// ---- Pop-in ----

/** Scales a child in from small with an overshoot, after `delay`, and ticks a haptic as it lands. */
export function PopIn({
  play,
  delay = 0,
  haptic,
  children,
  style,
}: {
  play: boolean;
  delay?: number;
  haptic?: Haptics.ImpactFeedbackStyle;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    scale.value = withDelay(delay, withSequence(withSpring(1.18, { damping: 8, stiffness: 260 }), withSpring(1, { damping: 12 })));
    if (haptic === undefined) return;
    const timer = setTimeout(() => tick(haptic), delay + 60);
    return () => clearTimeout(timer);
  }, [play, delay, haptic, scale]);
  const animated = useAnimatedStyle(() => ({ opacity: Math.min(1, scale.value * 1.5), transform: [{ scale: scale.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  confetti: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute' },
  medallionWrap: { width: MEDALLION, height: MEDALLION, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: MEDALLION + 22,
    height: MEDALLION + 22,
    borderRadius: (MEDALLION + 22) / 2,
    backgroundColor: 'rgba(157,193,173,0.10)',
  },
  ring: {
    position: 'absolute',
    width: MEDALLION,
    height: MEDALLION,
    borderRadius: MEDALLION / 2,
    borderWidth: 2,
    borderColor: C.accent,
  },
  medallion: {
    width: MEDALLION,
    height: MEDALLION,
    borderRadius: MEDALLION / 2,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
