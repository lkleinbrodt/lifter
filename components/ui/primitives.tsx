// Small shared building blocks from the 3.5 spec: Pill, Chip, Stat, ListRow, SectionHeader.

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { C, Radius, Space } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';

type Tone = 'neutral' | 'accent' | 'amrap' | 'deload' | 'superset';

const TONE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: C.s3, fg: C.t2 },
  accent: { bg: C.accentBg, fg: C.accent },
  amrap: { bg: C.amrapBg, fg: C.amrap },
  deload: { bg: C.deloadBg, fg: C.deload },
  superset: { bg: C.supersetBg, fg: C.superset },
};

/** 24pt status pill, e.g. "+2.5" or "★ 9 reps · e1RM 208". */
export function Pill({ label, tone = 'neutral', num, style }: { label: string; tone?: Tone; num?: boolean; style?: StyleProp<ViewStyle> }) {
  const { bg, fg } = TONE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <ThemedText num={num} style={[styles.pillText, { color: fg }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

/** 36pt swap chip. */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Caption over a number, for stat tiles. */
export function Stat({ label, value, style }: { label: string; value: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stat, style]}>
      <ThemedText type="caption">{label}</ThemedText>
      <ThemedText num style={styles.statValue}>
        {value}
      </ThemedText>
    </View>
  );
}

/** A settings-style row: title, optional subtitle, optional right side, optional chevron. */
export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  chevron = !!onPress,
  style,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, style]}
      accessibilityRole={onPress ? 'button' : undefined}>
      <View style={styles.rowText}>
        <ThemedText type="body">{title}</ThemedText>
        {subtitle ? <ThemedText type="subhead">{subtitle}</ThemedText> : null}
      </View>
      {right}
      {chevron ? <IconSymbol name="chevron.right" size={14} color={C.t4} /> : null}
    </Pressable>
  );
}

/** Section title (15 semibold t2, sentence case) with an optional accent action on the right. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <ThemedText style={styles.sectionAction}>{action}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 24,
    paddingHorizontal: 9,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 13, fontWeight: '600' },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: C.s3,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: C.accentBg },
  chipText: { fontSize: 14, color: C.t2 },
  chipTextSelected: { color: C.accent, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  stat: { gap: 4 },
  statValue: { fontSize: 21, fontWeight: '600' },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    paddingHorizontal: Space.l,
    paddingVertical: Space.s,
    backgroundColor: C.s1,
  },
  rowPressed: { backgroundColor: C.s2 },
  rowText: { flex: 1, gap: 2 },
  section: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: C.t2 },
  sectionAction: { fontSize: 15, color: C.accent },
});
