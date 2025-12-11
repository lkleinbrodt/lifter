import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Layout, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function Card({ style, children, ...props }: ViewProps) {
  const theme = useColorScheme() ?? 'light';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: Colors[theme].surface, borderColor: Colors[theme].border },
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Layout.radius,
    padding: Layout.spacing,
    borderWidth: 1,
    ...Shadows.card,
  },
});
