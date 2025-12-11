import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'label' | 'display';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  const isLabel = type === 'label';
  const textColor = isLabel ? Colors.dark.textMuted : color;

  return (
    <Text
      style={[
        { color: textColor, fontFamily: Fonts.family },
        type === 'default' && styles.default,
        type === 'defaultSemiBold' && styles.defaultSemiBold,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'label' && styles.label,
        type === 'display' && styles.display,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontSize: Fonts.size.display, fontWeight: '700' },
  title: { fontSize: Fonts.size.header, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: Fonts.size.title, fontWeight: '600' },
  default: { fontSize: Fonts.size.body },
  defaultSemiBold: { fontSize: Fonts.size.body, fontWeight: '600' },
  label: { fontSize: Fonts.size.label, textTransform: 'uppercase', letterSpacing: 1 },
});
