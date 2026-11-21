# UI overhaul: build spec (Phase 3.5)

Status (2026-11-20): direction **approved** with Landon's feedback folded in. Nothing is built yet. A future session should be able to start from "now build it" and follow this file, phase by phase.

Visual reference: https://claude.ai/artifact/YMwk8Tr5aMqQWsA64EfCfc has real simulator screenshots of every current screen and HTML mockups of the proposal. **Where this file and the artifact disagree, this file wins.** The artifact shows some ideas that were later rejected (Focus layout, barbell diagram, AMRAP outcome line, a "Program" tab).

Scope: the general app and the GSLP side only. **Don't touch `/531`**; it gets rebuilt later (notes at the bottom).

## Start here (for a fresh agent)

This file is self-contained. You don't need the conversation that produced it.

1. Read `CLAUDE.md` and `docs/lifter-2-plan.md` (Phase 3.5), then this whole file.
2. Build one sub-phase at a time (table at the bottom), each on its own branch. Ask Landon before committing, pushing or publishing an OTA update.
3. **Verify in the simulator.**
   - An iPhone 17 Pro simulator has the dev build (`com.lkleinbrodt.lifter`). Start Metro with the `metro` entry in `.claude/launch.json`. If one is already running on 8081 from this repo, reuse it.
   - Deep links: `xcrun simctl openurl booted "lifter:///gslp/workouts"` (also `/gslp/history`, `/gslp`, `/settings`, `/workout/<id>`).
   - The database has 97 imported workouts.
   - To test the workout screen, start a workout, then **discard** it. Never finish one: finishing advances the GSLP progression.
4. **Artifact mockups vs this spec.** The artifact mockups predate the final decisions, so they differ in these places. **Follow this file:**
   - plate math is a text line plus a toggle, not the boxed strip with a barbell drawing
   - idle rows have no boxes
   - the AMRAP row shows ★ reps · e1RM, not "↑ 162.5 next"
   - collapsed exercises show sets only, with no progression pill
   - workout names include the lower-body lift
   - the fourth tab is Settings, not Program
   - Focus (B) is rejected
5. **Confirmed by Landon:**
   - In a superset, the current set alternates A1 → A2 by round.
   - The plates toggle is per card, on the LB column header.
   - A finished exercise auto-collapses about 400ms after its last check.

## Guiding preference

Landon likes the current Strong-style grid and is used to it. **Evolve the grid; don't replace it.** Keep every set visible as a row, keep every number tappable, and keep logging a set to one tap. The changes are about hierarchy, clarity and feedback, not novelty. When unsure, choose the plainer option.

## Decisions

| Topic | Decision |
|---|---|
| Colors | Approved palette (tokens below). |
| Accent | Lifted sage `#9DC1AD`. |
| Typography | **Not final.** Build with SF Pro for text and Menlo for numbers, behind one constant in `theme.ts`, so switching everything to Menlo is a one-line change to compare on the phone. |
| Workout screen | **Ledger** (the evolved grid). Not Focus (B). No barbell diagram for now. |
| Plate math | A one-line readout for the current set, plus a per-card toggle that shows plates in the weight column for every row. |
| AMRAP feedback | A celebratory badge with estimated 1RM. Don't show the progression outcome on the row. |
| Supersets | One grouped card (A1/A2). Rounds ordering stays in Phase 4. |
| Finished exercise | Collapses to one line; tap to reopen. |
| Warm-ups | Shown as their own rows. They collapse to one line once all are checked. |
| Rest timer | Full-width bar (A). Keep the floating pill (B) as a later option. |
| Workout names | `A · Vertical + Squat`, `B · Horizontal + Deadlift`. |
| Workouts tab | "Next up" hero card plus a single "Last session" card. Full history lives only on the History tab. |
| Tabs | **Workout · History · Exercises · Settings.** The Settings tab holds GSLP weights and program switching. No program chip, and no gear in headers. |
| Cold start | Always opens the Workout tab (drop the last-tab restore). |
| History tab | Compact cards (A). |
| Tab bar | Restyle the existing JS `BottomTabBar` (A), since it's the easier path. No NativeTabs. |
| Summary, edit mode, picker, history sheet, Exercises tab | As proposed in the artifact. |
| 5/3/1 | Out of scope. |

## 1. Tokens (`constants/theme.ts`)

Add the new tokens and keep the old `Colors.dark.*` names as aliases until every screen has moved over, so each phase ships on its own.

```ts
export const C = {
  bg: '#0E1011',          // screen
  s1: '#171A1C',          // cards
  s2: '#1F2326',          // raised: current row, inputs, rest bar
  s3: '#2A2F33',          // chips, pressed, set badge, current-row fields
  line: 'rgba(255,255,255,0.07)',
  t1: '#ECEEEC',          // names, values
  t2: 'rgba(236,238,236,0.62)', // secondary
  t3: 'rgba(236,238,236,0.40)', // previous column, labels
  t4: 'rgba(236,238,236,0.20)', // rules, disabled, chevrons
  accent: '#9DC1AD', accentHi: '#B4D6C2', accentBg: 'rgba(157,193,173,0.13)', onAccent: '#0E1011',
  amrap: '#E2A65A', amrapBg: 'rgba(226,166,90,0.13)',
  warmup: '#8693A0',
  superset: '#9EA9E8', supersetBg: 'rgba(158,169,232,0.12)', supersetLine: 'rgba(158,169,232,0.26)',
  deload: '#E39270', deloadBg: 'rgba(227,146,112,0.13)', // summary/history only, not an error
  destructive: '#EA6C7E',
};
```

- **Fonts:** `Fonts.text` is `undefined` (System, which is SF Pro) or `'Menlo'`, set by one flag, `USE_MENLO_TEXT = false`. `Fonts.num` is `'Menlo'`. Every number (weights, reps, timers, counts) uses `Fonts.num` with `fontVariant: ['tabular-nums']`.
- **Type scale:** give each as a full style object, not just a size.

  | Style | Spec |
  |---|---|
  | largeTitle | 34/41 bold |
  | title1 | 28/34 bold |
  | title2 | 22/28 semibold |
  | headline | 17–19 semibold |
  | body | 17 |
  | callout | 15 |
  | subhead | 13, t2 |
  | caption | 11, caps, letter-spacing 0.08em, t3 (eyebrows only) |
  | num.xl / num.l / num.m / num.s | 46 / 36 / 20–22 / 14–15 |

- **Space:** 4, 8, 12, 16, 20, 24, 32, 48. Screen gutter 16, card padding 16, 12 between cards, 24–28 between sections.
- **Radius:** 8 (badge), 12 (field), 16 (card), 20 (hero), pill.
- **Elevation:** remove `Shadows.card` and the sage glow in `Shadows.button`. Cards are flat s1. Keep a single `Shadows.float` for the minibar and sheets.
- Remove `Colors.light`. Call `Appearance.setColorScheme('dark')` at startup in `app/_layout.tsx`. This fixes system alerts rendering light, and it's JS-only, so no rebuild. Also pass `userInterfaceStyle: 'dark'` on any remaining `ActionSheetIOS` calls.
- **`ThemedText` variants:** rename to the type scale (`body`, `headline`, `title1`, `title2`, `caption`, `largeTitle`), add a `num` prop that switches to `Fonts.num`, and keep the old names as aliases for now.
- **`Button`:** variants `primary` (56 tall, r14, accent fill, onAccent 17 bold), `secondary` (48, s1/s2 fill), `plain` (text only) and `destructive` (red text only), plus a `size` prop (lg 56 / md 48 / sm 36). Pressed state: opacity 0.85, scale 0.98.
- **`Card`:** variants `plain`, `hero` (r20, p18) and `group` (superset ring).
- **New primitives in `components/ui/`:** `Pill` (24 tall status pill), `Chip` (36 tall swap chip), `Stat`, `ListRow`, `SectionHeader` (15 semibold t2, sentence case, optional accent action on the right).

## 2. Workout screen (`app/workout/[id].tsx`, `components/workout/*`)

### Names

- Split catalog names for display: `"Bench Press (Barbell)"` shows as **Bench Press** with **Barbell** underneath; `"Calf Raise (Standing, Single Leg, Straight)"` shows as **Calf Raise** with **Standing · single leg · straight** underneath. Write a pure helper in `lib/exercises.ts`. Stored names don't change.
- Added load of 0 shows as `BW`.

### Header and title block

- The nav title is the elapsed time in Menlo; the right side has a plain-text **Finish** (no background, because iOS 26 draws the glass capsule itself).
- Title block:
  - an eyebrow, `GSLP · WEEK 1 · DAY 2`
  - the title, `B · Horizontal + Deadlift` (title1; may wrap to two lines)
  - a set counter, `5/29`, in Menlo on the right
  - a thin segmented progress bar with one segment per exercise
- Notes move into a header ⋯ menu ("Add note" / "Edit note"). They show under the title only when non-empty.

### Exercise card

- Main lift: name 19 semibold, with `Barbell · 2×5, 1×5+` underneath in subhead. Accessory: name 17.
- The ⋯ button is a 44pt target and keeps today's menu (history, replace, remove).
- **Plate line:** barbell exercises show one line under the subtitle, in Menlo t1 (not 12pt grey): `160 lb · 45 · 10 · 2.5 /side`. It follows the **current set of that card**, warm-ups included; when the card has no current set, it shows the card's next unchecked set. No barbell diagram. That image is parked as a maybe-later experiment.
- **Plates toggle:** tapping the weight column header (`LB`) switches that card's weight column to plates per side for every row (`45·10·2.5`, `bar` for 45, `—` when there's no weight). The header then reads `PLATES`. The toggle is per card, kept in memory only, and defaults to lb. Tapping a cell in plates mode still edits the weight; the field shows the number while focused. Only barbell exercises get the toggle.
- Swap chips (accessories) are 36pt tall at 14pt, and they show only until the card's first set is checked. After that, swapping is in ⋯.
- `+ Add Set` becomes a small text button, `+ Set` (44pt tall, t2), in the card footer.

### Set table (the ledger: today's grid, refined)

- Columns: `SET · PREV · LB · REPS · ✓`, widths roughly 40 · flex · 74 · 62 · 50. Headers are caption caps in t3.
- Rows are 52pt for work sets and 44pt for warm-ups. The check button is 44×44 (r12); warm-up checks are 40×36.
- **Every value cell stays a tappable `NumberField`**, on any row, current or not, done or not. Keep today's clear-on-focus behavior. What changes is only how the field looks:
  - **Idle row:** **no box.** Show plain numbers in Menlo 20, t1, still tappable to edit. Keep the hit area the full cell, at least 44pt tall. Landon confirmed this: rows only need to be editable, not to look like inputs.
  - **Current row:** the row background is s2, fields are s3 with a 1px highlight, the set badge is filled accent, and the check is outlined in accent.
  - **Focused field:** a 2px accent ring.
  - **Done row:** accentBg row tint; values go t2 and the field fill goes away, but cells stay tappable. The check is filled accent with a dark checkmark.
  - **Warm-up row:** the badge is a `W` in the warm-up color with no fill, and values are 16pt t2.
  - **AMRAP row:** an amber badge, and the reps target hint shows `5+` in amber.
  - **Previous column:** Menlo 14, t3, centered.
- **Current set:**
  - It's the first unchecked set in workout order. Within a superset group, sets alternate: A1's warm-ups go first, then A1 set 1, A2 set 1, A1 set 2, and so on. When members have different set counts, the leftover sets go last.
  - Checking any set out of order is allowed; the current set is recomputed.
  - It drives: the row highlight, the plate line, the rest bar's "Next" text, and the Workout tab's "Up next".
- **Warm-ups:** at the start, each warm-up is its own row. Once **all** of an exercise's warm-ups are checked, they collapse into one line above the work sets: `✓ Warm-up 3/3   90×4 · 110×3 · 135×2` (t2, values in t3). Tapping it expands them again for editing.
- **Fresh exercise** (nothing checked yet): every row is visible and idle, warm-ups included. If this exercise holds the current set, its first warm-up (or first work set) is highlighted. A workout that has just started has exactly one highlighted row: the first warm-up of the first exercise.
- **AMRAP done:** show a fun badge, not the progression outcome.
  - Put a pill at the right of the row, or a slim line under it: `★ 9 reps · e1RM 208`. e1RM uses Epley: `weight × (1 + reps/30)`, rounded.
  - **Target hit:** a success haptic and an accent pill.
  - **Below target:** a plain t2 pill with the e1RM, no haptic, and no deload wording.
  - **Weightless or added-load lifts** (chin-up: no bodyweight known): skip the e1RM and show `★ 6 reps`.
  - **Optional, only if cheap:** an amber `PR` when the e1RM beats the best working-set e1RM for that exercise in the log. That needs a small `db.ts` query.
- **Swipe to delete:** keep it. The Delete action is full row height, 88 wide, in destructive red.

### Finished exercise

When every set is checked, the card collapses to one line, after a 400ms delay with a light haptic and a 260ms animation:

```
✓  Bench Press
   160 × 5 · 5 · 9
```

Show work sets only, in Menlo t2. Tap to expand; it re-collapses when you check its last set again.

### Superset group (visual only; Phase 4 does the logic)

- Members that share a `supersetGroup` render inside one container: s1 with a 1px `supersetLine` ring and r18. This replaces the 3pt left border.
- A header caption reads `SUPERSET · ROUND 2 OF 3` in the superset color.
- Each member gets an `A1` / `A2` tag (supersetBg, superset text, Menlo 12 bold) before its name. Members are separated by a dashed `supersetLine` divider.
- Drop the "Superset with Bench Press" subtitle.
- When every member is finished, the group shows the collapsed lines stacked inside the same ring.
- Rest still starts on every checked work set for now. "Rest after the last member" is Phase 4.

### Rest bar (A)

- Bottom sheet bar on s2.
  - Background: a full-width fill (accent at 15%) that drains as time passes.
  - Left side: the `REST` caption over the countdown in Menlo 36 bold.
  - Buttons on the right: `−15`, `+15` and `Skip`, each 48pt tall. Skip is the primary (accent fill).
  - Second line: `Next  A1 Bench · set 2  160 × 5`.
- When the timer ends, the fill pulses twice, plus today's haptic and notification.
- The floating pill variant (B) isn't for now.

### Footer and other

- The footer has `Add exercise` (secondary), the optional-slot buttons as today, and `Discard workout` as red text.
- The motion and haptics table is in the artifact. Use Reanimated 4 and `LayoutAnimation`, which are already installed. Reduce Motion switches to fades.

## 3. Information architecture and tabs

- **GSLP tabs:** `workouts` (title **Workout**), `history`, `exercises` and `settings`, with `initialRouteName: 'workouts'`.
  - Move the Weights content (`app/gslp/(tabs)/index.tsx`) into the new Settings tab.
  - Make `app/settings.tsx` a tab screen, or have the tab render its content.
  - Keep the `/settings` route working for deep links.
- **Cold start** always lands on the Workout tab. Remove the last-tab restore in `components/program-tabs.tsx`; the `@gslp_last_tab` write can go too.
- **Headers:** `ProgramHeader` loses the program chip and the gear, leaving a largeTitle only.
- **Program switching:** a row at the top of the Settings tab (`Program · GSLP ›`) that opens the existing picker (`router.replace('/')`, or a small sheet). The `/531` side keeps its own tabs untouched; give it a way back to the picker (it can keep its current chip).
- **Settings tab, top to bottom:**
  1. **GSLP weights.** Read-only list rows, grouped by workout (`Workout A · Vertical + Squat`, then B, with "next" marked). Each row has the name, `last 95×6 · +2.5`, an 8-session sparkline of the AMRAP weight from the log, and the weight in Menlo 22. Tap a row to edit inline. The pull variant is a small segmented control on the chin-up/pulldown row.
  2. **Program** switch row.
  3. **The existing dev sections:** App (version, check for update, restart), Data and Tools (Strong import).
- **Sparkline:** `react-native-svg` isn't in the build, so draw it with Views (small bars or dots) or skip it. Don't add a native module.

## 4. Workout tab (`app/gslp/(tabs)/workouts.tsx`)

- Large title **Workout**.
- **Hero card** (s1, r20):
  - Eyebrow `GSLP · WEEK 1 · DAY 2`, with six cycle dots on the right (filled = done, ring = next, a divider after three).
  - Title `B · Horizontal + Deadlift` (about 26–28pt, may wrap).
  - Main-lift rows: name with the scheme under it in Menlo t3, the weight in Menlo 22, and a `+2.5` accent pill for the jump since last time.
  - An accessories line: `With calf raise, 90-90 sit-up, lateral raise, lat pulldown, suitcase carry`.
  - A 56pt **Start B** button. Only the button starts the workout; the card itself isn't pressable.
- **Under the hero:** two secondary buttons, `Do A instead` and `Empty workout`.
- **`Last session` section:**
  - The header has `History ›` on the right.
  - One card shows the latest finished workout: name, `Thu, Nov 19 · 58 min` (4pt below the title, not tracked caps), and per main lift `95 × 6 → 97.5`.
  - Its ⋯ holds **Undo & reopen**.
  - Remove the GSLP session-history list entirely; `@gslp_state.history` stays as data.
  - This also removes today's empty Nov 19 card.
- **In progress:** the hero becomes the live card, with `IN PROGRESS` and the elapsed time, the title, the progress bar, `Up next` (current set name and numbers), the rest countdown if running, and **Resume**. Hide the minimized bar on this tab, and drop the "Workout in progress…" sentence.
- **Weights missing:** one line linking to Settings.

## 5. History tab and summary

### Display names

Name every workout from its template:
- `A · Vertical + Squat` and `B · Horizontal + Deadlift`
- `GSLP A · Vertical` becomes `A · Vertical + Squat`
- Imported Strong workouts ("Full Body-Vertical+Squat", "Afternoon Workout", …) are matched by their main lifts: OHP or squat means A, bench or deadlift means B.
- Empty or unmatched workouts keep their stored name.

This is display only; write it as a pure helper.

### History (compact cards)

- Group by week (Mon–Sun): `This week`, then `Nov 9 – 15` with a count on the right.
- **Each card:**
  - The name (17 semibold) with a chevron.
  - A meta line: `Thu, Nov 19 · 58 min · 29 sets`.
  - A three-column grid of main lifts: caption caps label (`OHP`, `CHIN-UP`, `SQUAT` / `BENCH`, `ROW`, `DEADLIFT`) over the best work set in Menlo 16, with a small accent `↑` when it beats the previous session of that lift.
  - A t3 footer line, `+ calf raise, sit-up, dip, face pull, leg raise`.
- **Durations** under 5 min or over 4 h show in amber with a `?`. These come from bad imported data, e.g. 1 min on Nov 5 and 45h 55m on Oct 29.
- **Empty state:** one t2 line.

### Summary (finished workout)

- **Nav:** the date as the title; on the right, ⋯ (Edit, Undo & reopen when it's the latest GSLP session, Delete) and a plain-text **Done**. The page body has no buttons.
- **Body:**
  1. An eyebrow and the title.
  2. Three stat tiles: Time, Sets, Volume.
  3. A "Next A" card with one row per main lift: name, `AMRAP 95 × 6`, and on the right the new weight in Menlo 22 with a `+2.5` pill (deload uses the deload color and `↓`).
  4. An exercise list with work sets on one Menlo line (`95×5 · 95×5 · 95×6`, AMRAP in amber), followed by warm-ups in t3 (`· w 45 65 75`).
- **Edit mode** reuses the workout screen, with an amber banner `Editing the log · GSLP weights stay as they are` and **Save** in the nav. Delete the explanatory sentence.

## 6. Minimized bar and tab bar

- **Minimized bar:**
  - A floating card above the tab bar: s2, r18, 10pt side inset, `Shadows.float`.
  - Contents: a rest ring (or just an empty ring when no rest is running), the workout name, `25:02 · 13/29 sets` in Menlo t2, the rest countdown in Menlo accent, and a chevron-up.
  - The whole bar is one target. Drop the word "Resume".
- **Tab bar:** keep `BottomTabBar`, restyled.
  - Surface `rgba(20,23,25,0.97)` with a hairline top border.
  - Labels in SF Pro 10.5 medium; active color accentHi, inactive t3.
  - Remove the indicator bar above the icons.
  - Height about 84 including the home indicator.
- **Icons:** Workout `dumbbell`, History `clock.arrow.circlepath`, Exercises `list.bullet`, Settings `gearshape`.

## 7. Sheets and Exercises tab

- **Exercise picker:**
  - The header reads `Replace` with `Lateral Raise · vertical push slot` under it (or `Add exercise`).
  - Sections, in order: **For this slot** (the archetype pool, with the current pick checked), **Recent**, **All · A–Z**.
  - Rows are 56pt, with the name, the equipment under it in t3, and the last numbers on the right in Menlo t2.
  - The search placeholder is `Search 140 exercises`. Use the real count.
- **Exercise history sheet:**
  - The title is the name with the equipment and `top set, last 8 sessions` under it.
  - Then a top-set chart. It's drawn without svg (Views: dots plus labels, or vertical bars), with rep counts per point.
  - Then sessions: a sentence-case date (`Sun, Nov 15`) with the workout display name on the right, the top set in Menlo 17, and warm-ups in t3 (`w 115×4 · 135×3 · 185×2`).
- **Exercises tab:**
  - Replace the old `exercises-data.ts` chip clouds with a catalog-backed list: name, equipment, last top set.
  - Add an archetype filter row at the top; this absorbs the `archetype/[name]` screen.
  - Rows open the exercise history sheet.
  - This also fixes the three naming schemes for one exercise.

## Phases (each one branch, one OTA update, no native build)

| # | Phase | Scope | Effort |
|---|---|---|---|
| 3.5a | Foundation | Tokens with aliases, the font flag, Text variants, Button/Card variants, Pill/Chip/Stat/ListRow/SectionHeader, dark `Appearance`, name-split, `BW` and display-name helpers. No layout changes. | M |
| 3.5b | Workout ledger | Set-row look (fields on every row), current-set logic, warm-up rows that collapse, plate line and plates toggle, 44pt targets, header and title block, notes in ⋯, chips hide, `+ Set`. | L |
| 3.5c | Workout feedback | AMRAP ★/e1RM badge, exercise collapse, superset grouped card, rest bar A with "Next", motion and haptics. | M |
| 3.5d | IA + Workout tab | Tabs Workout · History · Exercises · Settings; Settings tab absorbs Weights and program switching; cold start on Workout; header chip and gear removed; hero, live state and Last session; GSLP history list removed. | M |
| 3.5e | History + summary | Compact week-grouped cards, duration sanity, summary layout, actions in nav, edit banner. | M |
| 3.5f | Minibar + tab bar | Floating minibar, restyled JS tab bar. | S |
| 3.5g | Sheets + Exercises | Slot-first picker, history sheet with chart, catalog Exercises tab. | M |

After 3.5b, install on the phone and try the ledger mid-workout before going further. Things to judge there:
- the current-row emphasis
- the plates toggle
- SF Pro vs Menlo (flip `USE_MENLO_TEXT`)

Landon has said the current-set view is the part that matters most.

## Parked (maybe later)

- Barbell plate diagram. Neutral greys sized by weight were mocked; it might be gimmicky.
- The floating rest pill (B).
- History calendar view (B).
- NativeTabs (iOS 26 glass). `expo-router` 6 has it, but it's `unstable_` and has no bottom-accessory slot.
- Focus logging layout: rejected.

## Deferred: 5/3/1 notes (for the later port)

- The 5/3/1+ port should run on the same workout screen. Its `+` sets use the AMRAP row and badge, and plate math works the same way.
- The Workout tab hero works as-is with eyebrow `5/3/1 · WEEK 2 · 3/3/3+` and today's top sets.
- Training maxes become rows in the Settings tab, like the GSLP weights.
- The current `/531` screens (Maxes, Workouts, Workout detail) are throwaway; don't polish them.

## Bugs found during the audit (fix along the way)

- System alerts render light (fixed by the `Appearance` call, 3.5a).
- The empty GSLP session card on the Workouts tab (removed in 3.5d).
- Imported durations of 1 min and 45h 55m (amber `?` in 3.5e).
- Replace in the picker ignores the slot's archetype (3.5g).
- Three names for one exercise (3.5g).
- Plate math covers only the next work set, never warm-ups (3.5b).
- Imported sets aren't flagged as warm-ups, so their volume includes them. That's fine for now; keep it in mind for analysis.
