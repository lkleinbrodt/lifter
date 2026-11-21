import { StyleSheet, View, type ViewProps } from 'react-native';

import { C, Radius, Space } from '@/constants/theme';

type CardProps = ViewProps & {
  /** plain: flat s1. hero: larger radius and padding. group: superset ring. */
  variant?: 'plain' | 'hero' | 'group';
};

export function Card({ variant = 'plain', style, children, ...props }: CardProps) {
  return (
    <View style={[styles.plain, variant === 'hero' && styles.hero, variant === 'group' && styles.group, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  plain: {
    backgroundColor: C.s1,
    borderRadius: Radius.card,
    padding: Space.card,
  },
  hero: {
    borderRadius: Radius.hero,
    padding: 18,
  },
  group: {
    borderRadius: Radius.group,
    borderWidth: 1,
    borderColor: C.supersetLine,
  },
});
