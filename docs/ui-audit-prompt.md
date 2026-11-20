You're doing a UI/UX audit of Lifter, a personal Expo / React Native workout app, and proposing a redesign. **Propose only: don't change app code.** I (Landon, the only user and the developer) will review the proposals and pick a direction before anyone implements them.

## Read first

- `CLAUDE.md`: stack, structure, and the design principle. The app is for one user who owns the code. There are no settings screens, onboarding, or general-audience copy.
- `docs/lifter-2-plan.md`: what the app is becoming. It replaces the Strong app for in-workout tracking, with program logic (GSLP now, 5/3/1+ later). Phase 3.5 is this polish pass, and Phase 4 adds supersets.
- `constants/theme.ts` and `style_guide.md`: the current "Industrial Zen" tokens. Dark only, sage accent, Menlo monospace everywhere.
- `components/ui/*`, `components/workout/*`, `components/themed-text.tsx`: the current primitives.

## How to see the app

- An iPhone 17 Pro simulator has the dev build installed. Start Metro with the `metro` entry in `.claude/launch.json` (`npx expo start --port 8081`), then launch or relaunch `com.lkleinbrodt.lifter`. If fast refresh doesn't pick up a change, terminate and relaunch the app.
- Use the iOS simulator tool for screenshots and taps. Tap coordinates are in points (402 wide). Divide screenshot pixels by the scale the tool reports.
- Deep links save tapping. Use `xcrun simctl openurl booted "lifter:///gslp/workouts"`; other routes are `/gslp/history`, `/gslp` (Weights), `/gslp/exercises`, `/settings`, `/workout/<id>`, and `/531/...`.
- The simulator's database has 97 workouts imported from Strong, so History and "Previous" have real data.
- To see the active workout screen, start a workout from the Workouts tab. When you're done, **discard it** (bottom of the workout screen). Don't finish it: finishing advances the GSLP progression. Don't leave test workouts behind.
- Look at the real states. Cover:
  - Sets checked and unchecked, the AMRAP set, warmups.
  - The rest timer running: check a work set.
  - The minimized workout bar above the tabs.
  - Swipe-to-delete, the exercise picker, the exercise history sheet.
  - The finished-workout summary and edit mode.
  - Empty states.
- Don't touch the physical phone, publish OTA updates, or commit.

## Priority (spend effort in this order)

1. **The active workout screen** (`app/workout/[id].tsx`, `components/workout/*`). This is where the app is used, mid-set, sweaty, one-handed. It includes:
   - exercise cards and the set table
   - the Previous column, warmup/work/AMRAP rows, the check-off interaction
   - plate math, the slot/archetype chips
   - the superset partner presentation
   - the rest bar and the header (timer + Finish)
2. **Workouts tab** (the start screen: next up, alternate, empty workout).
3. **History tab** and the **finished-workout summary**.
4. **The minimized active-workout bar + tab bar**, and navigation overall.
5. **Weights tab** (GSLP weights).
6. **Exercise picker** and **exercise history sheet**.
7. Program picker, Exercises library, archetype list, Strong import, Settings.
8. The 5/3/1 side. This is lowest priority: it will be rebuilt on the same workout screen later. Just note what should be shared.

## What I've said bothers me

- Cards feel undifferentiated. Use spacing, full vs reduced text opacity, and font weight to build real hierarchy. Example: on the Workouts tab's history cards, the date line has odd spacing and sits too close to the "Workout A" title.
- History appears twice, on the Workouts tab (GSLP session cards with progression) and on the History tab (the full log). Why both? Propose one information architecture.
- The workout screen is "a little boring" and too spreadsheet-like. Make it more dynamic. It should still be fast and glanceable.
- Superset partners show only a green left edge on the card. It doesn't read as "these two are a superset."
- General: "it's not polished."

Find the rest yourself. Look for:
- inconsistent spacing, radii, and type sizes
- weak contrast or touch targets that are too small for gym use
- truncation (long exercise names)
- the all-monospace typography: keep it, limit it to numbers, or replace it
- color used without meaning
- missing feedback (completing a set, a PR, finishing)
- anything that fights iOS 26's liquid-glass headers and tab bar

## What to produce

### 1. A unified design system proposal

- **Tokens:**
  - color: surface levels; text tiers by opacity or weight; accent; semantic states for done set, warmup, AMRAP, PR/progress, deload, superset, destructive
  - type scale with families and weights
  - spacing scale, radii, elevation/borders
  - motion and haptics conventions
- **Component inventory** with specs: Card variants, section header, list row, stat, chip/badge, button variants, header buttons, number field, set row, exercise card, superset group, rest timer, empty state.
- **Mapping from today's tokens** (`theme.ts`, `themed-text.tsx` variants, `Button`, `Card`) to the proposal: what's renamed, replaced, or removed.
- Where there's a real choice (for example monospace vs system font for body text, or how loud the accent should be), show **2–3 options** side by side instead of picking silently.

### 2. Screen-by-screen proposals (in priority order)

For each screen:
- The **current** screenshot or screenshots.
- A ranked list of issues.
- A **proposed** mockup built with the new system, at phone width (402pt). Where the direction is open, show **Option A / Option B** with a sentence on the tradeoff.
- What changes in behavior (not just looks), if anything.
- A rough effort estimate (S/M/L).

### 3. Information architecture

Settle the history duplication. Also cover:
- the tab set
- the program picker / program chip model, now that every workout goes into one shared log
- where Settings lives

### 4. A phased implementation plan

Start with the design system foundation, then the screens in priority order. Each phase should be shippable as an OTA update. Add it to the Phase 3.5 section of `docs/lifter-2-plan.md` only after I approve a direction; in your deliverable, put it at the end of the page.

### 5. Open questions for me

Short and specific: the decisions you need from me to proceed.

## Format

- Deliver it as a published **Artifact** (an HTML page), so I can scroll through before/after comparisons on my phone or laptop:
  - Embed the real simulator screenshots as the "current" images.
  - Build the "proposed" mockups in HTML/CSS using the proposed tokens, with real content from the app (real exercise names, weights, and history) rather than lorem ipsum.
  - Put current and proposed side by side; stack them on narrow screens.
- Keep the prose tight. I care more about seeing the options than reading rationale.
- Also save a short markdown summary to `docs/ui-overhaul-proposal.md` that links the artifact and lists the open questions.
- Then stop and wait for my feedback.

## Constraints for the proposals

- Dark only.
- React Native `StyleSheet`, no CSS-in-JS. Don't propose a new UI library unless you argue why the gain is worth it.
- Expo SDK 54 / RN 0.81, iOS first. Avoid anything that needs a new native module (that means a full rebuild) unless it's clearly worth it; flag it if so.
- iOS 26 draws its own glass capsule around header bar items: header buttons must be plain text or icons with no background. `unstable_headerRightItems` broke navigation in this build.
- Gym usability comes first:
  - big touch targets
  - readable at arm's length
  - one-handed
  - logging a set is one tap
  - nothing slows down the next set
- Single user: no onboarding, explanatory copy, or settings for things that live in code.
