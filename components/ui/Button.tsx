import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C, Radius } from '@/constants/theme';
import { ThemedText } from '../themed-text';

type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'destructive';

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** `danger` is the pre-3.5 name for `destructive`. */
  variant?: ButtonVariant | 'danger';
  size?: 'lg' | 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean; // shows a spinner and ignores presses, keeping the button's look
  style?: StyleProp<ViewStyle>;
};

const HEIGHT = { lg: 56, md: 48, sm: 36 };
const FONT = { lg: 17, md: 16, sm: 14 };

export function Button({ title, onPress, variant = 'primary', size, disabled, loading, style }: ButtonProps) {
  const kind: ButtonVariant = variant === 'danger' ? 'destructive' : variant;
  const height = HEIGHT[size ?? (kind === 'primary' ? 'lg' : 'md')];
  const fontSize = FONT[size ?? (kind === 'primary' ? 'lg' : 'md')];
  const inactive = disabled || loading;
  const textColor = kind === 'primary' ? C.onAccent : kind === 'destructive' ? C.destructive : kind === 'plain' ? C.accent : C.t1;
  return (
    <Pressable
      onPress={() => {
        if (!inactive) {
          void Haptics.selectionAsync();
          onPress();
        }
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { minHeight: height },
        kind === 'primary' && styles.primary,
        kind === 'secondary' && styles.secondary,
        disabled && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}>
      {loading ? (
        <View style={styles.spinnerRow}>
          <ActivityIndicator color={textColor} />
        </View>
      ) : (
        <ThemedText style={{ color: textColor, fontSize, fontWeight: kind === 'primary' ? '700' : '600' }}>{title}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 16,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: C.accent },
  secondary: { backgroundColor: C.s2 },
  disabled: { opacity: 0.4 },
  spinnerRow: { height: 22, justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
