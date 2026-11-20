import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Fonts, Layout, Shadows } from '@/constants/theme';
import { ThemedText } from '../themed-text';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean; // shows a spinner and ignores presses, keeping the button's look
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? Colors.dark.background : Colors.dark.text;
  return (
    <Pressable
      onPress={() => {
        if (!inactive) {
          void Haptics.selectionAsync();
          onPress();
        }
      }}
      disabled={inactive}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        disabled && styles.disabled,
        loading && styles.loading,
        pressed && !inactive && styles.pressed,
        style,
      ]}>
      {loading ? (
        <View style={styles.spinnerRow}>
          <ActivityIndicator color={textColor} />
        </View>
      ) : (
        <ThemedText type="defaultSemiBold" style={[styles.text, variant !== 'danger' && { color: textColor }]}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    borderRadius: Layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: Colors.dark.tint,
    ...Shadows.button,
  },
  secondary: {
    backgroundColor: Colors.dark.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  disabled: {
    backgroundColor: Colors.dark.surfaceHighlight,
    opacity: 0.5,
  },
  loading: {
    opacity: 0.8,
  },
  spinnerRow: {
    height: 20, // about the title's line height, so the button doesn't jump
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  text: {
    fontFamily: Fonts.family,
    letterSpacing: 0.5,
  },
});
