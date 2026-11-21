import { Colors } from '@/constants/theme';

// The app is dark-only; `light` is accepted for old call sites and ignored.
export function useThemeColor(props: { light?: string; dark?: string }, colorName: keyof typeof Colors.dark) {
  return props.dark ?? Colors.dark[colorName];
}
