# CLAUDE.md - Lifter Codebase Guide

## Project Overview

Lifter is a React Native/Expo mobile fitness app for the **5/3/1 weightlifting program**. It calculates training weights, tracks workout completion, and provides an accessory exercise library. The app runs on iOS, Android, and Web.

**Stack**: Expo SDK 54, React 19, React Native 0.81, TypeScript 5.9, Expo Router 6

This is a **personal, single-user app** for the developer's own iPhone. It is not distributed via the App Store or TestFlight, and there is no plan to ever do so — don't suggest `eas submit` or App Store Connect workflows.

## Quick Commands

```bash
npm start                          # Start Expo dev server
npm run ios                        # Start iOS simulator
npm run android                    # Start Android emulator
npm run web                        # Start web build
npm run lint                       # Run ESLint (expo lint)
./scripts/deploy-update.sh "msg"   # Push an OTA update to the installed build
```

No test framework is configured. There are no test files in the project.

## Deployment & Distribution

- **Primary dev machine**: `chewy` (a Linux box, reachable via `ssh chewy`), project lives at `~/Projects/lifter`. The developer's Mac is only needed if Xcode or the iOS Simulator is required directly — not needed for the normal workflow, since EAS Build compiles iOS in the cloud regardless of what OS you run `eas`/`expo` commands from.
- **Installing on the phone**: built via `eas build --profile preview --platform ios` — this is **internal (ad-hoc) distribution**, installed straight from the build's link/QR code on the phone. There is no App Store Connect / TestFlight step.
- **OTA updates** (JS/asset-only changes, the common case): run `./scripts/deploy-update.sh "what changed"` from the project root. This pushes to the `preview` branch/channel — the one the installed build actually points at. Equivalent to `eas update --branch preview --platform ios --non-interactive --clear-cache --message "..."`.
- **When a new build (not just an OTA update) is required**: native code changes, a new native module/config plugin, or a bump to `version` in `app.json`. `runtimeVersion` policy is `appVersion`, so a version bump requires a matching new build before OTA updates for that version will apply.
- The `production` build profile/channel in `eas.json` is **unused** — it predates the decision to skip the App Store entirely and was never wired to anything installed. Don't push updates there.
- `eas.json` pins `appleTeamId: "DU26G2LJFP"` (the developer's individual Apple Developer team) on every build profile, so the EAS CLI never prompts to choose between it and an unrelated organization team ("De la Cruz Consulting LLC") the developer was briefly added to for an unrelated project.
- `eas-cli` on `chewy` is already authenticated as `lkleinbrodt`; no login step needed there.

## Project Structure

```
app/                    # Screens (Expo Router file-based routing)
  (tabs)/               # Bottom tab navigator
    _layout.tsx         # Tab bar config (3 tabs: Maxes, Workouts, Exercises)
    index.tsx           # Maxes screen — enter 1RM values
    workouts.tsx        # Workout list — view/track weekly workouts
    exercises.tsx       # Exercise library — browse by archetype
  workout/[slug].tsx    # Workout detail (dynamic route, e.g. /workout/1-squat)
  archetype/[name].tsx  # Accessory exercise list by archetype
  _layout.tsx           # Root layout (GestureHandler, ThemeProvider, Stack)
components/             # Reusable React components
  ui/                   # Base primitives (Button, Card, Input, icons, collapsible)
  themed-text.tsx       # Typography with variants (title, subtitle, label, display, etc.)
  themed-view.tsx       # Themed container
  safe-area.tsx         # Safe area wrapper
  haptic-tab.tsx        # Tab button with haptic feedback
lib/                    # Core business logic
  workout-plan.ts       # 5/3/1 calculations, week/set definitions, plate math
  storage.ts            # AsyncStorage persistence (maxes, completed workouts)
  exercises-data.ts     # 250+ exercises categorized by movement archetype
hooks/                  # Custom React hooks (color scheme, theme color)
constants/
  theme.ts              # Design system: colors, fonts, layout, shadows
```

## Architecture & Key Patterns

### Routing
Expo Router with file-based routing. Tab navigation defined in `app/(tabs)/_layout.tsx`. Dynamic routes use `[slug]` and `[name]` parameters.

### State Management
- **Local state**: `useState()` for UI state
- **Persistent storage**: AsyncStorage via `lib/storage.ts` (no backend/database)
- **Focus-based reload**: `useFocusEffect()` to refresh data when navigating between screens

### Data Model
Two AsyncStorage keys:
- `@user_maxes` — `{ squat: number, bench: number, deadlift: number, weightedPullupWeight: number }`
- `@completed_workouts` — `string[]` of workout IDs like `"1-squat"`, `"3-deadlift"`

### 5/3/1 Program Logic (`lib/workout-plan.ts`)
- **Training Max** = 1RM x 0.90
- **Set weights** = Training Max x percentage, rounded to nearest 5 lbs
- **4 weeks**: Week 1 (5/5/5+), Week 2 (3/3/3+), Week 3 (5/3/1+), Week 4 (Deload)
- **4 workout days**: Squat, Bench, Deadlift, Weighted Pull-Ups
- **Plate math**: Calculates plates per side from total weight (bar = 45 lbs)
- Workout IDs follow the pattern `{week}-{day}` (e.g. `"2-bench"`, `"1-weighted-pullups"`)

### Key Types (`lib/storage.ts`, `lib/workout-plan.ts`)
```typescript
type LiftKey = 'squat' | 'bench' | 'deadlift';
type Maxes = Record<LiftKey, number> & { weightedPullupWeight: number };
type WorkoutDayKey = LiftKey | 'weighted-pullups';
type WorkoutSet = { percent: number; reps: string; amrap?: boolean };
```

## Conventions

### TypeScript
- **Strict mode** enabled (`tsconfig.json` extends `expo/tsconfig.base`)
- Path alias: `@/*` maps to project root (e.g. `@/lib/storage`, `@/constants/theme`)

### Styling
- React Native `StyleSheet.create()` — no CSS-in-JS libraries
- All colors from `Colors.dark.*` in `constants/theme.ts` (dark-only theme, "Industrial Zen" aesthetic)
- Monospace font: Menlo (iOS) / monospace (Android)
- Layout constants: `Layout.radius` (16), `Layout.spacing` (16)
- Shadows via `Shadows.card` and `Shadows.button`

### Components
- Function components with hooks (no class components)
- PascalCase for components, camelCase for functions/variables
- kebab-case for filenames (e.g. `themed-text.tsx`, `workout-plan.ts`)
- UI primitives in `components/ui/`, screen-level composition in `app/`
- Haptic feedback via `expo-haptics` on interactive elements

### Linting
- ESLint with `eslint-config-expo/flat` (flat config format)
- Config in `eslint.config.js`, ignores `dist/*`
- Run with `npm run lint`

## Design Reference

Detailed design specs are in:
- `project_design.md` — Full app specification and business logic
- `style_guide.md` — Color palette, typography, component styling guidelines
