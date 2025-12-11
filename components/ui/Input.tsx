import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Colors, Fonts, Layout } from '@/constants/theme';
import { ThemedText } from '../themed-text';

type InputProps = TextInputProps & {
  label?: string;
  suffix?: string;
};

export function Input({ label, suffix, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label ? <ThemedText type="label" style={styles.label}>{label}</ThemedText> : null}
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.dark.textMuted}
          keyboardAppearance="dark"
          {...props}
        />
        {suffix ? <ThemedText style={styles.suffix}>{suffix}</ThemedText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Layout.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    color: Colors.dark.text,
    fontFamily: Fonts.family,
    fontSize: 18,
    fontWeight: '600',
  },
  suffix: {
    color: Colors.dark.textMuted,
    fontFamily: Fonts.family,
    marginLeft: 8,
  },
});
