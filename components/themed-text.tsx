import { StyleSheet, Text, type TextProps } from 'react-native';

import { C, Fonts, Type, numStyle } from '@/constants/theme';

type ScaleType = 'largeTitle' | 'title1' | 'title2' | 'headline' | 'body' | 'callout' | 'subhead' | 'caption';
/** Pre-3.5 names, kept as aliases (same sizes as before) until every screen has moved over. */
type LegacyType = 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'label' | 'display';

export type ThemedTextProps = TextProps & {
  type?: ScaleType | LegacyType;
  /** Numbers: Menlo with tabular figures. */
  num?: boolean;
};

export function ThemedText({ style, type = 'default', num, ...rest }: ThemedTextProps) {
  return <Text style={[styles.base, styles[type], num && numStyle, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: { color: C.t1, fontFamily: Fonts.text },
  ...Type,
  // Legacy aliases
  default: { fontSize: Fonts.size.body },
  defaultSemiBold: { fontSize: Fonts.size.body, fontWeight: '600' },
  title: { fontSize: Fonts.size.header, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: Fonts.size.title, fontWeight: '600' },
  display: { fontSize: Fonts.size.display, fontWeight: '700' },
  label: { fontSize: Fonts.size.label, textTransform: 'uppercase', letterSpacing: 1, color: C.t2 },
});
