# Lifter 2.0 plan

Turn Lifter from "tells me what to do" into the app I use *during* the workout, replacing Strong. Strong's common tracking features plus Lifter's program logic: the workout opens with today's prescribed numbers already filled in.

Status (2026-11-21): Phases 1–4 are on `main` and on the phone (1.1.0 + OTA). Rest timer sounds are in PR #12 (1.2.0, native build). Next up: the lock-screen Live Activity.

## Principles

- **Personal app, one user, who is also the developer.** Anything I can change in code (templates, the exercise catalog, rest defaults, set prescriptions) stays in code. No settings screens, template editors, onboarding or empty-state polish for other people. In-app UI is for things that change *during* a workout.
- **Track first, analyze later.** v1 is done when a full GSLP workout can be run and logged in Lifter instead of Strong. Charts, PRs, badges and e1RM come in a later phase. The data model just has to make them easy.
- **Extensible, not abstract.** Progression rules are program-specific (GSLP reads the AMRAP set; 5/3/1+ will differ). Programs plug in through one small interface. No generic rules engine until a second program actually needs it.
- **One native build up front, then OTA.** Every native module lands in Phase 1, so later phases ship with `npm run update:ota`.

## How a workout works

1. **Start tab** shows *Next up* (e.g. "GSLP · Workout B · Week 4 Day 2") with a Start button, plus the program's other template and "Empty workout".
2. **Workout screen** (modeled on Strong):
   - One card per exercise with the columns Set | Previous | lbs | Reps | ✓. Bodyweight lifts show `+lbs` (added load).
   - **Prefill:**
     - Main lifts and their warmups come from the program (GSLP weight, the 55/70/85% warmups, `5+` on the AMRAP set).
     - Everything else copies the last session of that exercise.
     - *Previous* shows the matching set from last time.
   - Tapping ✓ marks the set done. Values stay editable. You can add a set (copies the last row), swipe to delete a set, add an exercise from the library, or remove an exercise.
   - **Swap:**
     - An accessory card shows chips for the other exercises in its archetype, plus "any exercise" from the library.
     - Swaps apply to this workout only. The last pick per archetype becomes the next default, as `accessoryPicks` does today.
     - Templates never change from the app.
   - **Exercise history:** tap an exercise name to open a sheet with its past sessions (sets per date).
   - The active workout is saved on every edit and survives the app being killed.
3. **Rest timer:**
   - A reminder, not a rule. Checking a work or AMRAP set starts it. Warmups don't.
   - Default 2:00 for everything, matching the Strong habit. Any exercise can override it in code (e.g. 3:00 on main lifts).
   - Shown as an inline countdown bar under the set, and as a header pill when scrolled away.
   - Controls: ±15s and Skip.
   - When it ends: haptic, plus a local notification so the phone dings when locked.
4. **Finish:**
   - If some sets aren't checked: *Complete them / Discard them / Cancel*.
   - Then the program applies progression and shows a summary: each main lift's before → after weight with its outcome (progress / double / deload), duration and sets done.
   - Undo stays available on the latest session.
5. **History tab:** a list of workouts. Each opens to its full sets, editable and deletable.
6. **Minimized workout bar:** while a workout is active, the other tabs can be browsed and a bar at the bottom returns to it.

## Data model

Exercise catalog lives in code (`lib/exercises.ts`). GSLP lifts and accessory pools reference it by `exerciseId`. The old `exercises-data.ts` still feeds the Exercises tab until Phase 2 replaces that screen with the catalog-backed picker.

```ts
type TrackingType =
  | 'weightReps'      // barbell, dumbbell, cable, machine
  | 'addedWeightReps' // chin-up, dip: weight = added load, 0 = bodyweight
  | 'assistedReps'    // assisted dip: weight = assistance
  | 'reps'            // 90-90 situps, hanging leg raise
  | 'duration';       // plank (carries are weight × reps, matching the Strong data)

type Exercise = {
  id: string;            // stable slug, e.g. 'bench-press-barbell'
  name: string;
  tracking: TrackingType;
  archetypes?: string[]; // movement tags used by programs and the library
  restSec?: number;      // overrides the 2:00 default
  strongNames?: string[];// names this exercise had in Strong, for the importer
};
```

Logged workouts live in SQLite (`expo-sqlite`), normalized so later analysis is plain SQL:

```ts
type Workout = {
  id: string;
  name: string;
  startedAt: string;  // ISO
  finishedAt?: string;
  source:
    | { kind: 'program'; program: ProgramKey; template: string; sessionIndex: number }
    | { kind: 'empty' }
    | { kind: 'import'; from: 'strong' };
  notes?: string;
  exercises: WorkoutExercise[];
};

type WorkoutExercise = {
  id: string;
  exerciseId: string;
  position: number;
  slot?: string;           // program slot it filled: 'bench', 'accessory:verticalPull', …
  supersetGroup?: string;  // stored from day one; the grouping UI comes in Phase 4
  notes?: string;
  sets: WorkoutSet[];
};

type SetType = 'warmup' | 'work' | 'amrap'; // union can grow (drop, failure, cooldown)

type WorkoutSet = {
  id: string;
  position: number;
  type: SetType;
  weight?: number;
  reps?: number;
  durationSec?: number;
  target?: { weight?: number; reps?: number; label?: string }; // what the program prescribed, e.g. '5+'
  done: boolean;
  completedAt?: string; // gives rest/pace data for free
};
```

Tables: `workouts`, `workout_exercises`, `sets` (one row each, foreign keys, indexes on `exercise_id` and `started_at`). The active workout is the one row with no `finishedAt`.

Only working sets count toward volume, best set or PRs. Warmups are excluded.

**Program state** stays a small JSON blob per program in AsyncStorage (`@gslp_state`: weights, pull variant, accessory picks, progression log). Each progression log entry gains a `workoutId` that links it to the logged workout.

## Program interface

```ts
type ProgramModule<State> = {
  key: ProgramKey;
  templates(state: State): { key: string; label: string }[];
  nextTemplate(state: State): string;
  // Builds the planned workout: exercises, set types, targets and prefilled values.
  plan(state: State, template: string, ctx: { lastSetsFor(exerciseId: string): WorkoutSet[] }): Workout;
  // Reads the finished workout and returns the new state plus a summary to show.
  complete(state: State, workout: Workout): { state: State; summary: ProgressionSummary };
};
```

GSLP's `plan` uses its existing pure functions (`warmupSets`, `workSets`, `nextSession`). Its `complete` finds each main lift's `amrap` set and feeds its reps to the existing `evaluateLift`. 5/3/1 gets its own module when it's ported.

### GSLP templates (including superset partners)

The main lifts carry the fillers that go with them. Until the superset UI exists, each filler sits right after its partner, with a shared `supersetGroup`.

| | Workout A · Vertical | Workout B · Horizontal |
|---|---|---|
| Main + partner | OHP + Bent-leg calf raise (soleus) | Bench + Standing single-leg calf raise |
| | Chin-up / lat pulldown + 90-90 situps | Barbell row + 90-90 situps |
| | Squat (alone) | Deadlift (alone) |
| Accessories (circuit) | Horizontal push, horizontal pull, anti-extension, [hamstring] | Vertical push, vertical pull, anti-rotation |

## Strong import

- A pure parser in `lib/import/strong.ts` turns the CSV into `Workout`s, mapping exercise names through `strongNames`.
- Unmapped names get added to the catalog during Phase 1. Each name gets a tracking type, and the odd cases (assisted dips, carries, planks) get checked by hand.
- **Warmups:** the CSV doesn't mark them (one `W` in 1,712 sets), so imported sets are `work`. If a later need arises, warmups can be inferred from the GSLP pattern.
- **Getting the CSV onto the phone:** this repo is public, so the CSV is never committed or bundled. Instead, AirDrop it to Files, then pick it from a one-off import screen (`expo-document-picker`). The import is idempotent, keyed by start time, so it can be re-run.
- The local CSV has already been corrected by hand: the 2026-11-20 test workout was removed, and the missing chin-up AMRAP set (25 × 6) was added to 2026-11-19. That leaves 97 workouts. Fix data in the CSV, not in importer special cases.
- **Source of truth:** Strong is the record of what was lifted. Lifter's `@gslp_state` stays the source of truth for progression. Lifter's old AMRAP-only session logs don't become workouts, since Strong already has those sessions. During migration, check the current GSLP weights against what Strong's last A and B sessions imply.

## Phases

Each phase is its own branch and PR.

### Phase 1: Foundation, then the one native build
- `lib/exercises.ts` catalog with IDs and tracking types. Move the GSLP lifts and accessory pools onto catalog IDs.
- SQLite schema, migrations and a small repository module (`lib/db.ts`).
- `ProgramModule` interface. GSLP `plan` / `complete` built on the existing pure functions.
- Strong parser and import screen.
- Add `expo-sqlite`, `expo-notifications`, `expo-document-picker`. Bump `version` to 1.1.0, then `npm run release:ios:full`.
- **Done when:** the phone has the new build, Strong history is imported (97 workouts), and the GSLP plan for the next session matches today's Lifter numbers.
- **Built:**
  - `lib/exercises.ts`, `lib/workout.ts`, `lib/db.ts`, `lib/program-module.ts`, `lib/gslp-program.ts`, `lib/strong-import.ts`.
  - `app/import-strong.tsx`, linked from the GSLP Weights tab.
  - Verified in the simulator: the import is idempotent, and the plan and progression were checked against the real CSV.
- **Notes:**
  - GSLP's optional hamstring slot isn't planned by default; the workout screen will offer to add it.
  - The web build no longer bundles, because expo-sqlite needs wasm/COEP setup there. Not worth fixing for a phone-only app.

### Phase 2: Run a GSLP workout end to end (the switch-off-Strong milestone)
- Start tab (Next up, other template, empty workout).
- Workout screen: set table, prefill, Previous column, checkmarks, edit / add / delete sets, add / remove / swap exercises, notes, autosave and resume.
- Exercise history sheet.
- Finish flow with the GSLP progression summary and undo.
- **Done when:** a real gym session is logged in Lifter only.
- **Built:**
  - `app/workout/[id].tsx`, `components/workout/*`, `lib/workout-edit.ts`, `lib/workout-actions.ts`.
  - The GSLP Workouts tab is now the start screen. The old `app/gslp/session.tsx` and the `@gslp_draft` key are gone.
  - Undo on the latest GSLP session reopens its workout for editing.
- **Notes:**
  - Numeric fields clear on focus and keep the old value if left empty, so typing always replaces it.
  - Main lifts can't be swapped, only removed (GSLP then counts that lift as missed).
  - Imported Strong sessions don't flag warmups. The Previous column aligns working sets from the end, so the extra leading sets line up with today's W rows.
  - Notes are per workout (a field under the title). Per-exercise notes are in the data model but have no UI yet.

### Phase 3: Workout comfort
- Rest timer (inline bar, header pill, ±15s / Skip, notification when locked).
- Minimized workout bar.
- History tab with workout detail, edit and delete.
- **Built:**
  - `lib/session-store.ts` holds the active workout and the rest timer for the whole app.
  - `components/workout/rest-bar.tsx` and `active-workout-bar.tsx`.
  - `components/workout-history.tsx`, mounted as the GSLP History tab.
- **Notes:**
  - The rest timer is a sticky bar at the bottom of the workout screen, not Strong's inline bar plus header pill. It's simpler and always visible.
  - Checking a work or AMRAP set starts it; warmups don't. It lasts `restSecFor(exercise)` (default 2:00).
  - The timer survives an app relaunch (`@rest_timer`), and the local notification fires with the phone locked. Notification permission is requested on the first rest.
  - The minimized bar shows the workout name, elapsed time and any rest countdown, and sits above the tab bar.
  - Finished workouts have Edit (autosaves; GSLP weights don't change) and Delete. Deleting the latest GSLP session also undoes its progression.

### Phase 3.5: Visual polish
- The functional screens work but look rough. Do a dedicated design pass on the workout screen, start screen, history and summary: spacing, hierarchy, the set table, and the tone of the done/rest states.
- **Approved spec: `docs/ui-overhaul-proposal.md`** (decisions, tokens, per-screen specs). The visual reference is the artifact linked there; where they differ, the spec wins. 3.5a–3.5g are all built (2026-11-20); 3.5a+b were tried on the phone, the rest awaits one review.
- Sub-phases, each its own branch and OTA update, with no native build:
  - **3.5a** Foundation: tokens, fonts, primitives, dark `Appearance`.
  - **3.5b** Workout ledger: the grid stays and every cell is editable, plus a current set, warm-ups that collapse, and a plate line with a plates toggle.
  - **3.5c** Workout feedback: AMRAP ★/e1RM badge, exercise collapse, superset grouped card, rest bar with "Next".
  - **3.5d** IA: tabs Workout · History · Exercises · Settings (Settings absorbs Weights and program switching), cold start on Workout, hero and "Last session" card.
  - **3.5e** History (compact, week groups) and summary.
  - **3.5f** Minibar and restyled JS tab bar.
  - **3.5g** Picker, history sheet and catalog-backed Exercises tab.
- After 3.5b, try the ledger on the phone mid-workout (SF Pro vs all-Menlo is a one-line flag) before continuing.
- **Built (3.5a + 3.5b):**
  - Tokens `C`, `Type`, `Space`, `Radius` in `constants/theme.ts`, with `Colors.dark.*` as aliases. `USE_MENLO_TEXT` is the font flag. Dark `Appearance` is forced in `app/_layout.tsx`.
  - `components/ui/primitives.tsx` (Pill, Chip, Stat, ListRow, SectionHeader). Button and Card have the new variants.
  - Helpers: `splitExerciseName`, `formatLoad` (BW) in `lib/exercises.ts`; `workoutDisplayName` in `lib/workout-names.ts`; `setOrder` / `currentSet` / `setScheme` in `lib/workout-edit.ts`; plate formatting in `lib/plates.ts`.
  - Unused Expo template components (parallax-scroll-view, hello-wave, external-link, collapsible) were removed.
  - Plates mode uses 12.5pt text in the weight column so `45·10·2.5` fits.
- **Phone feedback on 3.5b (applied):** the one-line plate text was replaced by a plate diagram (one side of the bar, plates sized and labeled; `SHOW_PLATE_DIAGRAM` in `exercise-card.tsx` turns it off for a Strong-style name-only header). The exercise name no longer opens history (it's in ⋯). The ⋯ menus are a custom anchored popover (`components/ui/action-menu.tsx`). Completing a set bumps the check; rows have hairline separators.
- **Built (3.5c–g):**
  - Finished exercises collapse after 400ms with a success haptic and a brief glow; AMRAP badge `★ 9 reps · e1RM 208` (success haptic when the target is hit); superset group card with A1/A2 tags and round counter; rest bar with draining fill, −15/+15/Skip and a "Next" line.
  - Tabs: Workout · History · Exercises · Settings. Settings holds GSLP weights (last top set, sparkline and jump read from the workout log, so Strong imports count), the Program row, then the dev sections. `/gslp` redirects to the Workout tab; `/settings` still works.
  - Workout tab: hero card (cycle dots, lift weights with jump pills, "With …" line, Start), live card while in progress, one Last session card (⋯ → Undo & reopen).
  - History: compact cards grouped by week, best main-lift sets with ↑, amber `?` on implausible durations. Summary: date in the nav, ⋯ (Edit / Undo & reopen / Delete) + Done, stat tiles, "Next A" weights, one-line exercises. Edit mode has an amber banner.
  - Floating minibar with a rest ring and set count; restyled tab bar. Picker: For this slot / Recent / All, with last numbers. History sheet: top-set bar chart + sessions. Exercises tab: catalog list with pattern chips.
- **Not done:** the optional AMRAP `PR` marker; 5/3/1's `archetype/[name]` screen and `exercises-data.ts` stay for the 5/3/1 side.
- Scope is GSLP and the general app only. The 5/3/1 notes are parked at the bottom of the spec.

### Phase 4: Supersets
- Group exercises in the UI. Logging alternates between the grouped exercises, and the rest timer starts after the last exercise in the group.
- **Built (kept deliberately small):**
  - The grouping UI and the alternating current set already came with 3.5 (`setOrder` / `currentSet`, `superset-group.tsx`).
  - Rest rule (`restsAfter` in `lib/workout-edit.ts`): checking a superset member starts no rest when the next set is a later member of the same round, so you go straight to the partner; the round's last member rests. Warm-ups, leftover sets and plain exercises always rest.
  - Not doing: reordering rows by round, creating supersets in the app (templates live in code), separate superset rest lengths.

### Rest timer sounds (1.2.0, needs a native build)
- A tick at each full minute of rest (anchored to the start, so ±15s doesn't move them; none in the last 10s), then a ding-ding and a voice saying "Rest is over". Jarvis (default) and Elle are both bundled (`rest-over-jarvis.wav` / `rest-over-elle.wav`, generated once with Threepio's `/v1/tts`; nothing calls Threepio at runtime). Settings → Rest voice picks one (`@rest_voice`) and previews it; changing it mid-rest reschedules the notification.
- Standard local notifications only, like Strong: the sounds are bundled with the `expo-notifications` `sounds` option, and the same notifications play them locked or open (in the foreground: sound, no banner, a haptic at the end). The silent switch mutes them, which is fine. An `expo-audio` version that played through silent mode was tried and dropped as unneeded.
- Rest notifications carry `data.kind = 'rest'`; every reschedule cancels pending ones and dismisses delivered ones, also after a relaunch.
- The sounds themselves are placeholders until a pick from the previews (ticks T0–T6, end chimes E0–E6, made by a small synth script).
- Bundled sounds are a native change, so `version` is 1.2.0: run `npm run release:ios:full` on the Mac before any further OTA.

### Next: Live Activity on the lock screen (needs the Mac)
- While a workout runs: a Live Activity on the lock screen and Dynamic Island with the rest countdown, what's up next (exercise, set, weight × reps), and quick actions (e.g. ✓ the current set, +15s, Skip rest).
- The countdown can be drawn by iOS itself from `endsAt` (a timer text), so it ticks without the app running.
- Needs a widget extension written in Swift (ActivityKit / WidgetKit), added to the Expo project through a config plugin. Pick one when starting (e.g. `expo-apple-targets`, or a ready-made Live Activity module) and check it works with the personal team. Starting and updating the activity locally needs no push entitlement.
- Quick actions are App Intents (iOS 17+). Open questions: how a button's change gets to the app's state while the JS isn't running (an App Group store the app reads on resume, or an intent that runs in the app's process), and how up next stays right after a set is checked from the lock screen.
- Code can be written on chewy, but building, signing and installing the extension need Xcode on the Mac. Do it as its own native build; ideally it replaces the per-minute tick notifications cluttering the lock screen.

### Later
- Port 5/3/1+ onto `ProgramModule`.
- Analysis: charts, PRs and badges, e1RM, volume.
- Export.
- Per-set rest times.
- More set types.
- In-app custom exercises (until then, add them to the catalog in code).

## Navigation after 2.0

Tabs: **Workout** (start / active) · **History** · **Exercises** (library + history) · **Program** (current GSLP weights screen, pull variant, program switch). The 5/3/1 screens stay as they are until they're ported.
