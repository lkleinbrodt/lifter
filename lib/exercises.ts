// Exercise catalog: the single list every logged set points at, by stable `id`.
// Add exercises here (not in the app). Never change an id once workouts reference it;
// rename via `name` instead. `strongNames` maps names from the Strong CSV export.

export type TrackingType =
  | 'weightReps' // barbell, dumbbell, cable, machine, carries (reps = trips)
  | 'addedWeightReps' // bodyweight lifts where weight is added load; 0 = bodyweight
  | 'assistedReps' // weight is machine assistance; 0 = unassisted
  | 'reps' // bodyweight, no load
  | 'duration'; // holds, in seconds

export type MovementPattern =
  | 'Horizontal Push'
  | 'Vertical Push'
  | 'Horizontal Pull'
  | 'Vertical Pull'
  | 'Squat'
  | 'Hinge'
  | 'Core'
  | 'Calves'
  | 'Arms'
  | 'Other';

export type Exercise = {
  id: string;
  name: string;
  tracking: TrackingType;
  pattern: MovementPattern;
  restSec?: number; // overrides DEFAULT_REST_SEC
  strongNames?: string[];
};

export const DEFAULT_REST_SEC = 120;

const ex = (
  id: string,
  name: string,
  tracking: TrackingType,
  pattern: MovementPattern,
  strongNames?: string[],
): Exercise => ({ id, name, tracking, pattern, ...(strongNames ? { strongNames } : {}) });

const list: Exercise[] = [
  // Horizontal push
  ex('bench-press-barbell', 'Bench Press (Barbell)', 'weightReps', 'Horizontal Push', ['Bench Press (Barbell)']),
  ex('bench-press-dumbbell', 'Bench Press (Dumbbell)', 'weightReps', 'Horizontal Push', ['Bench Press (Dumbbell)']),
  ex('incline-bench-press-barbell', 'Incline Bench Press (Barbell)', 'weightReps', 'Horizontal Push', ['Incline Bench Press (Barbell)']),
  ex('incline-bench-press-dumbbell', 'Incline Bench Press (Dumbbell)', 'weightReps', 'Horizontal Push', ['Incline Bench Press (Dumbbell)']),
  ex('incline-bench-press-dumbbell-single', 'Incline Bench Press (Dumbbell, One Arm)', 'weightReps', 'Horizontal Push', ['Incline Bench press dumbbell one arm']),
  ex('floor-press-dumbbell', 'Floor Press (Dumbbell)', 'weightReps', 'Horizontal Push'),
  ex('chest-press-machine', 'Chest Press (Machine)', 'weightReps', 'Horizontal Push'),
  ex('push-up', 'Push-Up', 'addedWeightReps', 'Horizontal Push', ['Push Up']),
  ex('chest-dip', 'Chest Dip', 'addedWeightReps', 'Horizontal Push', ['Chest Dip']),
  ex('chest-dip-assisted', 'Chest Dip (Assisted)', 'assistedReps', 'Horizontal Push', ['Chest Dip (Assisted)']),
  ex('cable-crossover', 'Cable Crossover', 'weightReps', 'Horizontal Push', ['Cable Crossover']),
  ex('pec-deck-machine', 'Pec Deck (Machine)', 'weightReps', 'Horizontal Push', ['Pec Deck (Machine)']),

  // Vertical push
  ex('overhead-press-barbell', 'Overhead Press (Barbell)', 'weightReps', 'Vertical Push', ['Overhead Press (Barbell)']),
  ex('seated-overhead-press-dumbbell', 'Seated Overhead Press (Dumbbell)', 'weightReps', 'Vertical Push', ['Seated Overhead Press (Dumbbell)']),
  ex('landmine-press', 'Landmine Press', 'weightReps', 'Vertical Push', ['Landmine Press']),
  ex('kettlebell-press', 'Kettlebell Press', 'weightReps', 'Vertical Push', ['Kettlebell press']),
  ex('lateral-raise-dumbbell', 'Lateral Raise (Dumbbell)', 'weightReps', 'Vertical Push', ['Lateral Raise (Dumbbell)']),
  ex('triceps-pushdown-cable', 'Triceps Pushdown (Cable)', 'weightReps', 'Vertical Push'),
  ex('overhead-triceps-extension-cable', 'Overhead Triceps Extension (Cable)', 'weightReps', 'Vertical Push'),

  // Horizontal pull
  ex('bent-over-row-barbell', 'Bent Over Row (Barbell)', 'weightReps', 'Horizontal Pull', ['Bent Over Row (Barbell)']),
  ex('pendlay-row-barbell', 'Pendlay Row (Barbell)', 'weightReps', 'Horizontal Pull', ['Pendlay Row (Barbell)']),
  ex('one-arm-row-dumbbell', 'Bent Over One Arm Row (Dumbbell)', 'weightReps', 'Horizontal Pull', ['Bent Over One Arm Row (Dumbbell)']),
  ex('chest-supported-row-dumbbell', 'Chest-Supported Row (Dumbbell)', 'weightReps', 'Horizontal Pull'),
  ex('gorilla-row', 'Gorilla Row', 'weightReps', 'Horizontal Pull', ['Gorilla rows']),
  ex('seated-row-cable', 'Seated Row (Cable)', 'weightReps', 'Horizontal Pull', ['Seated Row (Cable)']),
  ex('seated-row-cable-single', 'Seated Row (Cable, One Arm)', 'weightReps', 'Horizontal Pull', ['Seated row (cable one hand']),
  ex('iso-lateral-row-machine', 'Iso-Lateral Row (Machine)', 'weightReps', 'Horizontal Pull', ['Iso-Lateral Row (Machine)']),
  ex('face-pull-cable', 'Face Pull (Cable)', 'weightReps', 'Horizontal Pull', ['Face Pull (Cable)']),
  ex('band-pull-apart', 'Band Pull-Apart', 'reps', 'Horizontal Pull', ['Pull apart']),
  ex('incline-yta-raise', 'Incline YTA Raise', 'weightReps', 'Horizontal Pull', ['Incline YTA Raises']),
  ex('high-five', 'High Fives', 'weightReps', 'Horizontal Pull', ['High fives']),

  // Vertical pull
  ex('chin-up', 'Chin-Up', 'addedWeightReps', 'Vertical Pull', ['Chin Up']),
  ex('pull-up', 'Pull-Up', 'addedWeightReps', 'Vertical Pull', ['Pull Up']),
  ex('pull-up-rings', 'Pull-Up (Rings)', 'addedWeightReps', 'Vertical Pull', ['Pull up (rings)']),
  ex('chin-up-band-assisted', 'Chin-Up (Band-Assisted)', 'reps', 'Vertical Pull'),
  ex('lat-pulldown-cable', 'Lat Pulldown (Cable)', 'weightReps', 'Vertical Pull', ['Lat Pulldown (Cable)']),
  ex('lat-pulldown-cable-single', 'Lat Pulldown (Cable, One Arm)', 'weightReps', 'Vertical Pull', ['Lat pullfown cable single arm']),
  ex('straight-arm-pulldown-cable', 'Straight-Arm Pulldown (Cable)', 'weightReps', 'Vertical Pull'),
  ex('pullover-dumbbell', 'Pullover (Dumbbell)', 'weightReps', 'Vertical Pull', ['Pullover (Dumbbell)']),

  // Squat / single-leg
  ex('squat-barbell', 'Squat (Barbell)', 'weightReps', 'Squat', ['Squat (Barbell)']),
  ex('front-squat-barbell', 'Front Squat (Barbell)', 'weightReps', 'Squat', ['Front Squat (Barbell)']),
  ex('goblet-squat-kettlebell', 'Goblet Squat (Kettlebell)', 'weightReps', 'Squat', ['Goblet Squat (Kettlebell)']),
  ex('belt-squat', 'Belt Squat', 'weightReps', 'Squat', ['Belt squat']),
  ex('leg-press', 'Leg Press', 'weightReps', 'Squat', ['Leg Press']),
  ex('leg-press-single', 'Leg Press (One Leg)', 'weightReps', 'Squat', ['Leg press (one Leg)']),
  ex('seated-leg-press-machine', 'Seated Leg Press (Machine)', 'weightReps', 'Squat', ['Seated Leg Press (Machine)']),
  ex('atg-split-squat', 'ATG Split Squat', 'weightReps', 'Squat', ['ATG Split Squat']),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'weightReps', 'Squat', ['Bulgarian Split Squat']),
  ex('lunge-barbell', 'Lunge (Barbell)', 'weightReps', 'Squat', ['Lunge (Barbell)']),
  ex('cossack-squat', 'Cossack Squat', 'weightReps', 'Squat', ['Cossack Squat']),
  ex('poliquin-step-up', 'Poliquin Step-Up', 'weightReps', 'Squat', ['Poliquin Step up']),
  ex('box-step-up', 'Step-Up (Box)', 'weightReps', 'Squat', ['Step up (box)']),
  ex('leg-blaster', 'Leg Blaster', 'reps', 'Squat', ['Leg blaster']),

  // Hinge / hamstrings
  ex('deadlift-barbell', 'Deadlift (Barbell)', 'weightReps', 'Hinge', ['Deadlift (Barbell)']),
  ex('romanian-deadlift-barbell', 'Romanian Deadlift (Barbell)', 'weightReps', 'Hinge', ['Romanian Deadlift (Barbell)']),
  ex('romanian-deadlift-dumbbell', 'Romanian Deadlift (Dumbbell)', 'weightReps', 'Hinge', ['Romanian Deadlift (Dumbbell)']),
  ex('single-leg-rdl', 'Single-Leg RDL', 'weightReps', 'Hinge', ['Single leg RDL']),
  ex('seated-good-morning', 'Seated Good Morning', 'weightReps', 'Hinge', ['Seated Good Morning']),
  ex('kettlebell-swing', 'Kettlebell Swing', 'weightReps', 'Hinge', ['Kettlebell Swing']),
  ex('hip-thrust-machine', 'Hip Thrust (Machine)', 'weightReps', 'Hinge', ['Hip thrust (machine)']),
  ex('back-extension', 'Back Extension', 'addedWeightReps', 'Hinge', ['Back Extension']),
  ex('ql-extension', 'QL Extension', 'addedWeightReps', 'Hinge', ['QL Extension']),
  ex('seated-leg-curl-machine', 'Seated Leg Curl (Machine)', 'weightReps', 'Hinge', ['Seated Leg Curl (Machine)']),
  ex('lying-leg-curl-machine', 'Lying Leg Curl (Machine)', 'weightReps', 'Hinge', ['Lying Leg Curl (Machine)']),
  ex('nordic-curl-negative', 'Nordic Curl Negative', 'reps', 'Hinge'),
  ex('hip-airplane', 'Hip Airplane', 'reps', 'Hinge', ['Hip Airplane']),

  // Core
  ex('ninety-ninety-situp', '90-90 Sit-Up', 'reps', 'Core', ['90-90 situps']),
  ex('sit-up', 'Sit-Up', 'reps', 'Core', ['Sit Up']),
  ex('hanging-leg-raise', 'Hanging Leg Raise', 'reps', 'Core', ['Hanging Leg Raise']),
  ex('hanging-knee-raise', 'Hanging Knee Raise', 'reps', 'Core', ['Hanging Knee Raise']),
  ex('ab-wheel', 'Ab Wheel Rollout', 'reps', 'Core', ['Ab Wheel']),
  ex('dead-bug', 'Dead Bug', 'reps', 'Core'),
  ex('body-saw', 'Body Saw', 'reps', 'Core'),
  ex('plank', 'Plank', 'duration', 'Core', ['Plank']),
  ex('rkc-plank', 'RKC Plank', 'duration', 'Core', ['Rkc plank']),
  ex('long-lever-plank', 'Long-Lever Plank', 'duration', 'Core'),
  ex('side-plank', 'Side Plank', 'duration', 'Core', ['Side Plank']),
  ex('pallof-press-cable', 'Pallof Press (Cable)', 'weightReps', 'Core'),
  ex('suitcase-carry', 'Suitcase Carry', 'weightReps', 'Core', ['Suitcase carry']),
  ex('farmers-carry', "Farmer's Carry", 'weightReps', 'Core', ['Farmer’s Carry']),

  // Calves / shins
  ex('calf-raise-single-leg', 'Calf Raise (Standing, Single Leg, Straight)', 'addedWeightReps', 'Calves', ['Calf Raise (Standing Single Straight)']),
  ex('calf-raise-bent-knee', 'Calf Raise (Bent Knee, Soleus)', 'addedWeightReps', 'Calves', ['Bent leg calf Raise (soleus)']),
  ex('calf-raise-standing', 'Calf Raise (Standing, Bodyweight)', 'addedWeightReps', 'Calves', ['Standing Calf Raise (Bodyweight)']),
  ex('tib-raise', 'Tib Raise', 'reps', 'Calves', ['Tib Raise']),
  ex('ankle-dorsiflexion', 'Ankle Dorsiflexion', 'reps', 'Calves', ['Ankle dorsiflection ']),

  // Arms
  ex('bicep-curl-barbell', 'Bicep Curl (Barbell)', 'weightReps', 'Arms', ['Bicep Curl (Barbell)']),
  ex('concentration-curl-dumbbell', 'Concentration Curl (Dumbbell)', 'weightReps', 'Arms', ['Concentration Curl (Dumbbell)']),
];

export const EXERCISE_CATALOG: Readonly<Record<string, Exercise>> = Object.fromEntries(list.map((e) => [e.id, e]));

export const ALL_EXERCISES: readonly Exercise[] = list;

export function getExercise(id: string): Exercise {
  const exercise = EXERCISE_CATALOG[id];
  if (!exercise) throw new Error(`Unknown exercise id: ${id}`);
  return exercise;
}

export function restSecFor(id: string) {
  return EXERCISE_CATALOG[id]?.restSec ?? DEFAULT_REST_SEC;
}

const byStrongName = new Map(list.flatMap((e) => (e.strongNames ?? []).map((name) => [name, e.id] as const)));

export function exerciseIdForStrongName(name: string): string | undefined {
  return byStrongName.get(name);
}

// ---- Display helpers (stored names never change) ----

/**
 * Splits a catalog name for display: "Bench Press (Barbell)" → Bench Press / Barbell;
 * "Calf Raise (Standing, Single Leg, Straight)" → Calf Raise / Standing · single leg · straight.
 */
export function splitExerciseName(name: string): { title: string; detail?: string } {
  const match = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(name);
  if (!match) return { title: name };
  const parts = match[2]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => (index === 0 ? part : part.toLowerCase()));
  return { title: match[1], detail: parts.join(' · ') || undefined };
}

export function isBarbellExercise(id: string) {
  return splitExerciseName(EXERCISE_CATALOG[id]?.name ?? '').detail === 'Barbell';
}

const trimNumber = (value: number) => (Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))));

/** A set's load for display: added load of 0 is "BW", assistance shows as "−20". */
export function formatLoad(weight: number | undefined, tracking: TrackingType): string {
  if (weight === undefined) return '';
  if (tracking === 'addedWeightReps') return weight === 0 ? 'BW' : `+${trimNumber(weight)}`;
  if (tracking === 'assistedReps') return weight === 0 ? 'BW' : `−${trimNumber(weight)}`;
  return trimNumber(weight);
}

const EQUIPMENT = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Kettlebell', 'Rings'];

/** Equipment for display: from the name's detail ("Bench Press (Barbell)"), else bodyweight for unloaded lifts. */
export function exerciseEquipment(id: string): string | undefined {
  const exercise = EXERCISE_CATALOG[id];
  if (!exercise) return undefined;
  const detail = splitExerciseName(exercise.name).detail ?? '';
  const named = EQUIPMENT.find((item) => detail.toLowerCase().startsWith(item.toLowerCase()) || exercise.name.includes(item));
  if (named) return named;
  return exercise.tracking === 'weightReps' ? undefined : 'Bodyweight';
}

/** The line under an exercise name: its name detail, plus equipment when the detail doesn't already say it. */
export function exerciseMeta(id: string) {
  const exercise = EXERCISE_CATALOG[id];
  if (!exercise) return '';
  const detail = splitExerciseName(exercise.name).detail;
  const equipment = exerciseEquipment(id);
  if (detail && equipment && detail.toLowerCase().includes(equipment.toLowerCase())) return detail;
  return [detail, equipment].filter(Boolean).join(' · ');
}
