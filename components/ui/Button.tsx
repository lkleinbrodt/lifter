import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Colors, Fonts, Layout, Shadows } from '@/constants/theme';
import { ThemedText } from '../themed-text';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  return (
    <Pressable
      onPress={() => {
        if (!disabled) {
          void Haptics.selectionAsync();
          onPress();
        }
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <ThemedText
        type="defaultSemiBold"
        style={[
          styles.text,
          variant === 'primary' && { color: Colors.dark.background },
          variant === 'secondary' && { color: Colors.dark.text },
        ]}>
        {title}
      </ThemedText>
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
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  text: {
    fontFamily: Fonts.family,
    letterSpacing: 0.5,
  },
});
