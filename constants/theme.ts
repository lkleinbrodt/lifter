import { Platform, type TextStyle } from 'react-native';

// Design tokens (docs/ui-overhaul-proposal.md §1). New code uses `C`, `Type`, `Space`,
// `Radius`. The old `Colors.dark.*` names stay as aliases until every screen has moved over.

export const C = {
  bg: '#0E1011', // screen
  s1: '#171A1C', // cards
  s2: '#1F2326', // raised: current row, inputs, rest bar
  s3: '#2A2F33', // chips, pressed, set badge, current-row fields
  line: 'rgba(255,255,255,0.07)',
  t1: '#ECEEEC', // names, values
  t2: 'rgba(236,238,236,0.62)', // secondary
  t3: 'rgba(236,238,236,0.40)', // previous column, labels
  t4: 'rgba(236,238,236,0.20)', // rules, disabled, chevrons
  accent: '#9DC1AD',
  accentHi: '#B4D6C2',
  accentBg: 'rgba(157,193,173,0.13)',
  onAccent: '#0E1011',
  amrap: '#E2A65A',
  amrapBg: 'rgba(226,166,90,0.13)',
  warmup: '#8693A0',
  superset: '#9EA9E8',
  supersetBg: 'rgba(158,169,232,0.12)',
  supersetLine: 'rgba(158,169,232,0.26)',
  deload: '#E39270', // summary/history only, not an error
  deloadBg: 'rgba(227,146,112,0.13)',
  destructive: '#EA6C7E',
} as const;

/** Legacy names, mapped onto the new palette. Prefer `C` in new code. */
export const Colors = {
  dark: {
    background: C.bg,
    surface: C.s1,
    surfaceHighlight: C.s3,
    text: C.t1,
    textMuted: C.t2,
    tint: C.accent,
    tintMuted: C.accentBg,
    icon: C.t2,
    error: C.destructive,
    border: C.line,
    tabIconDefault: C.t3,
    tabIconSelected: C.accentHi,
  },
};

// Typography is not final: flip this to compare all-Menlo against SF Pro text on the phone.
export const USE_MENLO_TEXT = false;

const MENLO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const Fonts = {
  /** Body text: System (SF Pro) unless USE_MENLO_TEXT. */
  text: USE_MENLO_TEXT ? MENLO : undefined,
  /** Every number: weights, reps, timers, counts. Pair with `fontVariant: ['tabular-nums']`. */
  num: MENLO,
  /** @deprecated alias for `Fonts.text`. */
  family: USE_MENLO_TEXT ? MENLO : undefined,
  // Legacy sizes, still used by the old ThemedText variants.
  size: {
    display: 32,
    header: 22,
    title: 18,
    body: 16,
    label: 13,
  },
};

/** Number style: Menlo with tabular figures. Spread into a text style. */
export const numStyle: TextStyle = { fontFamily: Fonts.num, fontVariant: ['tabular-nums'] };

const text = (style: TextStyle): TextStyle => ({ fontFamily: Fonts.text, color: C.t1, ...style });
const num = (fontSize: number, fontWeight: TextStyle['fontWeight'] = '600'): TextStyle => ({
  ...numStyle,
  color: C.t1,
  fontSize,
  fontWeight,
});

export const Type = {
  largeTitle: text({ fontSize: 34, lineHeight: 41, fontWeight: '700' }),
  title1: text({ fontSize: 28, lineHeight: 34, fontWeight: '700' }),
  title2: text({ fontSize: 22, lineHeight: 28, fontWeight: '600' }),
  headline: text({ fontSize: 17, lineHeight: 22, fontWeight: '600' }),
  body: text({ fontSize: 17, lineHeight: 22 }),
  callout: text({ fontSize: 15, lineHeight: 20 }),
  subhead: text({ fontSize: 13, lineHeight: 18, color: C.t2 }),
  caption: text({ fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: 'uppercase', color: C.t3 }),
  numXl: num(46, '700'),
  numL: num(36, '700'),
  numM: num(21),
  numS: num(14.5, '500'),
} satisfies Record<string, TextStyle>;

export const Space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48, gutter: 16, card: 16, section: 26 };

export const Radius = { badge: 8, field: 12, button: 14, card: 16, group: 18, hero: 20, pill: 999 };

// Legacy layout constants.
export const Layout = {
  radius: Radius.card,
  spacing: Space.gutter,
};

// Cards are flat; only floating things (minibar, sheets) get a shadow.
export const Shadows = {
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
};
