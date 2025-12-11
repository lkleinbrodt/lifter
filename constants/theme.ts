import { Platform } from 'react-native';

// 1. PALETTE: The "Industrial Zen" colors
const PALETTE = {
  // Base
  slate900: '#121212', // Main Background (Deep Charcoal)
  slate800: '#1E2225', // Cards / Surface
  slate700: '#2C3035', // Borders / Accents
  slate400: '#8B959E', // Muted Text

  // Accents
  sage: '#8DA399', // Primary Active
  sageLight: '#A4C3B2', // Highlights
  sageMuted: 'rgba(141, 163, 153, 0.15)', // Light green bg

  // Functional
  white: '#EDEDED',
  error: '#CF6679',
};

// 2. EXPORTED COLORS (The semantic names used in components)
export const Colors = {
  dark: {
    background: PALETTE.slate900,
    surface: PALETTE.slate800,
    surfaceHighlight: PALETTE.slate700,
    text: PALETTE.white,
    textMuted: PALETTE.slate400,
    tint: PALETTE.sage,
    tintMuted: PALETTE.sageMuted,
    icon: PALETTE.slate400,
    border: 'rgba(255,255,255,0.08)', // Subtle border for 3D effect
    tabIconDefault: PALETTE.slate400,
    tabIconSelected: PALETTE.sage,
  },
  // Mapping light mode to dark mode because we prefer the dark aesthetic
  // (You can fill this in later if you really want a light mode)
  light: {
    background: PALETTE.slate900,
    surface: PALETTE.slate800,
    text: PALETTE.white,
    tint: PALETTE.sage,
    icon: PALETTE.slate400,
    tabIconDefault: PALETTE.slate400,
    tabIconSelected: PALETTE.sage,
    border: 'rgba(255,255,255,0.08)',
  },
};

// 3. TYPOGRAPHY: Enforcing Monospace
export const Fonts = {
  family: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
  size: {
    display: 32, // Huge weights
    header: 22,
    title: 18,
    body: 16,
    label: 13,
  },
  weight: {
    regular: '400',
    bold: '700',
  },
};

// 4. LAYOUT & SHADOWS: The "3D" Feel
export const Layout = {
  radius: 16,
  spacing: 16,
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  button: {
    shadowColor: PALETTE.sage,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
};
