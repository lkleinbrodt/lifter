

# 5/3/1 App Design System (Code-Ready)

## 1. The Design Philosophy
*   **Vibe:** "Industrial Zen." Heavy lifting meets digital calm.
*   **Visuals:** Dark, slate-heavy interface with distinct separation of layers. High contrast text, but soft on the eyes.
*   **Interaction:** Elements should feel tactile. Buttons have weight; cards float above the background.

## 2. Color Palette
We avoid "Pure Black" (`#000000`) to prevent ghosting when scrolling on OLED screens and to allow shadows to be visible.

```javascript
// constants/theme.js

export const COLORS = {
  // BASE LAYERS
  background: '#121212',       // Very dark charcoal, not pure black
  surface: '#1E2225',          // Slightly lighter slate (for cards)
  surfaceHighlight: '#2C3035', // For pressed states or active cards

  // ACCENTS
  primary: '#8DA399',          // "Sage Green" - Main action color
  primaryLight: '#A4C3B2',     // Lighter Sage for text highlights/icons
  primaryMuted: 'rgba(141, 163, 153, 0.2)', // For subtle backgrounds behind green text

  // FUNCTIONAL
  success: '#8DA399',          // Use Sage for success to keep palette minimal
  error: '#CF6679',            // Soft Red (Material Design standard for Dark Mode)
  inactive: '#454F55',         // For disabled buttons/completed history

  // TEXT
  textPrimary: '#EDEDED',      // Off-white (high legibility)
  textSecondary: '#8B959E',    // Muted blue-grey (labels, subtitles)
};
```

## 3. Typography
We are using System Monospace (`Menlo` on iOS, `monospace` on Android) to give it that raw data/machinery feel.

```javascript
// constants/theme.js

export const FONTS = {
  family: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  
  // Hierarchy
  sizes: {
    display: 32,    // Huge weight numbers (e.g. "225 lbs")
    header: 24,     // Section headers (e.g. "Week 1")
    title: 18,      // Card titles (e.g. "Bench Press")
    body: 16,       // Standard text
    label: 12,      // "Sets", "Reps" small text
  },
  
  weights: {
    regular: '400',
    bold: '700', // Use sparingly, mostly for the heavy weights
  }
};
```

## 4. Shapes & Structure ("The 3D Look")
To get that "Spotify" feel, we don't use flat lines. We use **Cards** and **Shadows**.

*   **Corner Radius:** `16px` (Modern, friendly, but sturdy).
*   **Spacing:** Based on an **8pt grid** (8, 16, 24, 32).

```javascript
// constants/theme.js

export const LAYOUT = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: 16, // The standard curve for all cards and buttons
};
```

## 5. Shadows & Depth (Copy this helper)
Dark mode shadows are hard. The trick is a dark shadow *below* and a very subtle light border (or lighter background) on top.

```javascript
// usage: ...SHADOWS.card
export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8, // for Android
    
    // Optional: Add a subtle border to make it pop off the dark background
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)', 
  },
  
  // For the main "Lift" button
  button: {
    shadowColor: COLORS.primary, // Glow effect
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  }
};
```

---

## 6. Component Examples (How to build)

### The "Card" (e.g., A Workout Set)
*   **Background:** `COLORS.surface`
*   **Border Radius:** `LAYOUT.borderRadius`
*   **Style:** `...SHADOWS.card`
*   **Padding:** `LAYOUT.spacing.md`

### The "Primary Button" (e.g., Complete Set)
*   **Background:** `COLORS.primary`
*   **Text Color:** `COLORS.background` (Dark text on Green background looks premium)
*   **Font Weight:** `Bold`
*   **Shape:** Fully rounded (Pill) or Rounded Rect (`12px`).

### The "Data Display" (e.g., 225 LBS)
*   **Font:** `FONTS.family`
*   **Size:** `FONTS.sizes.display`
*   **Color:** `COLORS.textPrimary`

---

**Ready when you are!** Paste your existing code, and I will refactor it to implement this exact system.