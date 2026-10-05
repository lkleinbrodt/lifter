import { BAR_WEIGHT, roundTo } from './plates';

// Greyskull LP: two workouts alternating A/B/A, B/A/B, three non-consecutive days a week.
// Every lift is 2 straight sets + 1 AMRAP set and progresses independently.

export type GslpLiftKey = 'ohp' | 'chinup' | 'latPulldown' | 'squat' | 'bench' | 'row' | 'deadlift';
export type PullVariant = Extract<GslpLiftKey, 'chinup' | 'latPulldown'>;
export type GslpWorkoutKey = 'A' | 'B';

export type GslpLift = {
  key: GslpLiftKey;
  label: string;
  region: 'upper' | 'lower';
  equipment: 'barbell' | 'machine' | 'bodyweight';
  straightSets: number; // sets before the AMRAP set
  reps: number; // target reps per set, including the AMRAP minimum
  minWeight: number;
  notes: string[];
};

export const gslpLifts: Record<GslpLiftKey, GslpLift> = {
  ohp: {
    key: 'ohp',
    label: 'Overhead Press',
    region: 'upper',
    equipment: 'barbell',
    straightSets: 2,
    reps: 5,
    minWeight: BAR_WEIGHT,
    notes: [],
  },
  chinup: {
    key: 'chinup',
    label: 'Chin-Up',
    region: 'upper',
    equipment: 'bodyweight',
    straightSets: 2,
    reps: 5,
    minWeight: 0,
    notes: ['Weight is added load. 0 means bodyweight.'],
  },
  latPulldown: {
    key: 'latPulldown',
    label: 'Lat Pulldown',
    region: 'upper',
    equipment: 'machine',
    straightSets: 2,
    reps: 8,
    minWeight: 0,
    notes: ['Use this until you can do bodyweight chin-ups for reps, then switch the pull on the Weights tab.'],
  },
  squat: {
    key: 'squat',
    label: 'Squat',
    region: 'lower',
    equipment: 'barbell',
    straightSets: 2,
    reps: 5,
    minWeight: BAR_WEIGHT,
    notes: [],
  },
  bench: {
    key: 'bench',
    label: 'Bench Press',
    region: 'upper',
    equipment: 'barbell',
    straightSets: 2,
    reps: 5,
    minWeight: BAR_WEIGHT,
    notes: [],
  },
  row: {
    key: 'row',
    label: 'Barbell Row',
    region: 'upper',
    equipment: 'barbell',
    straightSets: 2,
    reps: 5,
    minWeight: BAR_WEIGHT,
    notes: [],
  },
  deadlift: {
    key: 'deadlift',
    label: 'Deadlift',
    region: 'lower',
    equipment: 'barbell',
    // Deliberately a single AMRAP set for now. Bump to 2 to run the r/Fitness 2×5, 1×5+ version.
    straightSets: 0,
    reps: 5,
    minWeight: 95, // proper bar height with 45s
    notes: ['Straps from day one.'],
  },
};

// Accessories: every day gets a push, a pull and a core slot (plus optional legs on A).
// Each slot takes the opposite orientation from the day's main lifts. Only the archetype
// is fixed; the exercise can be swapped freely session to session.

export type AccessoryArchetype =
  | 'horizontalPush'
  | 'horizontalPull'
  | 'verticalPush'
  | 'verticalPull'
  | 'antiExtension'
  | 'antiRotation'
  | 'hamstring';

export type Equipment = 'bodyweight' | 'band' | 'cable' | 'machine' | 'dumbbell' | 'barbell';

export type AccessoryExercise = {
  name: string;
  equipment: Equipment;
  timed?: boolean; // isometrics and carries are done for time
};

type AccessoryArchetypeConfig = {
  label: string;
  prescription: string;
  exercises: AccessoryExercise[]; // first is the default pick
};

const STANDARD_PRESCRIPTION = '2–3 × 10–15';
const TIMED_PRESCRIPTION = '2–3 × 30–45s';
export const ACCESSORY_NOTE = 'Stop 2–3 reps shy of failure. Swap exercises within a slot freely.';

export const accessoryArchetypes: Record<AccessoryArchetype, AccessoryArchetypeConfig> = {
  horizontalPush: {
    label: 'Horizontal Push',
    prescription: STANDARD_PRESCRIPTION,
    exercises: [
      { name: 'Push-Ups on Handles', equipment: 'bodyweight' },
      { name: 'Assisted Dips', equipment: 'machine' },
      { name: 'DB Floor Press', equipment: 'dumbbell' },
      { name: 'Machine Chest Press', equipment: 'machine' },
    ],
  },
  horizontalPull: {
    label: 'Horizontal Pull',
    prescription: STANDARD_PRESCRIPTION,
    exercises: [
      { name: 'Face Pulls', equipment: 'cable' },
      { name: 'Chest-Supported Row', equipment: 'dumbbell' },
      { name: 'Band Pull-Aparts', equipment: 'band' },
      { name: 'Cable Row', equipment: 'cable' },
    ],
  },
  verticalPush: {
    // Side delts and triceps. The real overhead press is already a main lift on A.
    label: 'Vertical Push',
    prescription: STANDARD_PRESCRIPTION,
    exercises: [
      { name: 'Lateral Raises', equipment: 'dumbbell' },
      { name: 'Rope Pushdowns', equipment: 'cable' },
      { name: 'Overhead Triceps Extension', equipment: 'cable' },
    ],
  },
  verticalPull: {
    label: 'Vertical Pull',
    prescription: STANDARD_PRESCRIPTION,
    exercises: [
      { name: 'Lat Pulldown', equipment: 'cable' },
      { name: 'Straight-Arm Pulldown', equipment: 'cable' },
      { name: 'Band-Assisted Chin-Ups', equipment: 'band' },
    ],
  },
  antiExtension: {
    label: 'Core · Anti-Extension',
    prescription: STANDARD_PRESCRIPTION,
    exercises: [
      { name: 'Hanging Leg Raises', equipment: 'bodyweight' },
      { name: 'Long-Lever Planks', equipment: 'bodyweight', timed: true },
      { name: 'Dead Bugs', equipment: 'bodyweight' },
      { name: 'Body Saws', equipment: 'bodyweight' },
    ],
  },
  antiRotation: {
    label: 'Core · Anti-Rotation',
    prescription: STANDARD_PRESCRIPTION,
    exercises: [
      { name: 'Pallof Press', equipment: 'cable' },
      { name: 'Suitcase Carries', equipment: 'dumbbell', timed: true },
      { name: 'Side Planks', equipment: 'bodyweight', timed: true },
    ],
  },
  hamstring: {
    label: 'Legs · Hamstring',
    prescription: '2 × 10',
    exercises: [
      { name: 'Lying Leg Curl', equipment: 'machine' },
      { name: 'Seated Leg Curl', equipment: 'machine' },
      { name: 'Nordic Negatives', equipment: 'bodyweight' },
      { name: 'RDLs', equipment: 'barbell' },
    ],
  },
};

export type AccessorySlot = {
  archetype: AccessoryArchetype;
  optional?: boolean;
};

type GslpSlot = GslpLiftKey | 'pull';

export type GslpWorkout = {
  key: GslpWorkoutKey;
  label: string;
  focus: string;
  slots: GslpSlot[];
  accessories: AccessorySlot[];
};

export const gslpWorkouts: Record<GslpWorkoutKey, GslpWorkout> = {
  A: {
    key: 'A',
    label: 'Workout A',
    focus: 'Vertical',
    slots: ['ohp', 'pull', 'squat'],
    accessories: [
      { archetype: 'horizontalPush' },
      { archetype: 'horizontalPull' },
      { archetype: 'antiExtension' },
      { archetype: 'hamstring', optional: true },
    ],
  },
  B: {
    key: 'B',
    label: 'Workout B',
    focus: 'Horizontal',
    slots: ['bench', 'row', 'deadlift'],
    accessories: [{ archetype: 'verticalPush' }, { archetype: 'verticalPull' }, { archetype: 'antiRotation' }],
  },
};

export function accessoryPrescription(archetype: AccessoryArchetype, exercise: AccessoryExercise) {
  return exercise.timed ? TIMED_PRESCRIPTION : accessoryArchetypes[archetype].prescription;
}

export function pickedAccessory(picks: AccessoryPicks, archetype: AccessoryArchetype) {
  const { exercises } = accessoryArchetypes[archetype];
  return exercises.find((exercise) => exercise.name === picks[archetype]) ?? exercises[0];
}

export const GSLP_REST_NOTE = 'Rest 2–3 min between sets, 3–5 min between exercises.';
export const GSLP_AMRAP_NOTE = 'Stop AMRAPs at RPE 8–9, with 1–2 reps left.';

// Weight gained per successful session; doubled when the AMRAP hits DOUBLE_JUMP_REPS.
const JUMP: Record<GslpLift['region'], number> = { upper: 2.5, lower: 5 };
export const DOUBLE_JUMP_REPS = 10;
const DELOAD_FACTOR = 0.9;

export function liftsForWorkout(workout: GslpWorkoutKey, pullVariant: PullVariant): GslpLift[] {
  return gslpWorkouts[workout].slots.map((slot) => gslpLifts[slot === 'pull' ? pullVariant : slot]);
}

export function nextWorkoutKey(lastWorkout: GslpWorkoutKey | undefined): GslpWorkoutKey {
  return lastWorkout === 'A' ? 'B' : 'A';
}

// Session index is 0-based across the whole run: weeks are 3 sessions, and the
// A/B/A, B/A/B pattern repeats every 6.
export function sessionPosition(index: number) {
  return { week: Math.floor(index / 3) + 1, day: (index % 3) + 1 };
}

export function jumpFor(lift: GslpLift) {
  return JUMP[lift.region];
}

export type GslpSet = { weight: number; reps: string; amrap?: boolean };

export function workSets(lift: GslpLift, weight: number): GslpSet[] {
  return [
    ...Array.from({ length: lift.straightSets }, () => ({ weight, reps: String(lift.reps) })),
    { weight, reps: `${lift.reps}+`, amrap: true },
  ];
}

const warmupScheme = [
  { percent: 0.55, reps: 4 },
  { percent: 0.7, reps: 3 },
  { percent: 0.85, reps: 2 },
];

export function warmupSets(lift: GslpLift, workWeight: number): GslpSet[] {
  if (lift.equipment === 'bodyweight' || workWeight <= 0) return [];
  const floor = lift.equipment === 'barbell' ? BAR_WEIGHT : 0;
  return warmupScheme
    .map(({ percent, reps }) => ({
      weight: Math.max(floor, roundTo(workWeight * percent, 5)),
      reps: String(reps),
    }))
    .filter((set) => set.weight < workWeight);
}

export type LiftResult = {
  amrapReps: number | null;
};

export type Outcome = 'progress' | 'double' | 'deload';

export function isResultComplete(result: LiftResult | undefined) {
  return result?.amrapReps != null;
}

export function evaluateLift(lift: GslpLift, weight: number, result: LiftResult) {
  const jump = jumpFor(lift);
  let outcome: Outcome;
  let nextWeight: number;
  if ((result.amrapReps ?? 0) < lift.reps) {
    outcome = 'deload';
    nextWeight = Math.max(lift.minWeight, roundTo(weight * DELOAD_FACTOR, jump));
  } else if ((result.amrapReps ?? 0) >= DOUBLE_JUMP_REPS) {
    outcome = 'double';
    nextWeight = weight + jump * 2;
  } else {
    outcome = 'progress';
    nextWeight = weight + jump;
  }
  return { outcome, nextWeight };
}

export function describeOutcome(outcome: Outcome, weight: number, nextWeight: number) {
  const delta = nextWeight - weight;
  switch (outcome) {
    case 'progress':
      return `+${formatNumber(delta)}`;
    case 'double':
      return `+${formatNumber(delta)} (${DOUBLE_JUMP_REPS}+ reps)`;
    case 'deload':
      return delta === 0 ? 'Deload (at minimum)' : `${formatNumber(delta)} (deload)`;
  }
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatScheme(lift: GslpLift) {
  return `${lift.straightSets > 0 ? `${lift.straightSets}×${lift.reps}, ` : ''}1×${lift.reps}+`;
}

export function formatLiftWeight(lift: GslpLift, weight: number) {
  if (lift.equipment === 'bodyweight') {
    return weight > 0 ? `BW + ${formatNumber(weight)} lbs` : 'Bodyweight';
  }
  return `${formatNumber(weight)} lbs`;
}

// ---- Persistent state & transitions (pure; persistence lives in gslp-storage.ts) ----

export type GslpWeights = Record<GslpLiftKey, number>;

export type GslpLiftLog = {
  lift: GslpLiftKey;
  weight: number;
  amrapReps: number | null;
  outcome: Outcome;
  nextWeight: number;
};

export type GslpSessionLog = {
  id: string;
  date: string; // ISO timestamp
  workout: GslpWorkoutKey;
  lifts: GslpLiftLog[];
};

// Last exercise chosen per accessory archetype; becomes the default next time.
export type AccessoryPicks = Partial<Record<AccessoryArchetype, string>>;

export type GslpState = {
  weights: GslpWeights;
  pullVariant: PullVariant;
  accessoryPicks: AccessoryPicks;
  history: GslpSessionLog[]; // oldest first
};

export const gslpLiftOrder: GslpLiftKey[] = ['ohp', 'chinup', 'latPulldown', 'squat', 'bench', 'row', 'deadlift'];

export const defaultGslpState: GslpState = {
  weights: { ohp: 0, chinup: 0, latPulldown: 0, squat: 0, bench: 0, row: 0, deadlift: 0 },
  pullVariant: 'latPulldown',
  accessoryPicks: {},
  history: [],
};

export function nextSession(state: GslpState) {
  const workout = nextWorkoutKey(state.history.at(-1)?.workout);
  return {
    workout,
    index: state.history.length,
    lifts: liftsForWorkout(workout, state.pullVariant),
  };
}

// Chin-ups legitimately start at 0 (bodyweight); everything else needs a starting weight.
export function isWeightSet(lift: GslpLift, weights: GslpWeights) {
  return lift.equipment === 'bodyweight' || weights[lift.key] > 0;
}

export function completeSession(
  state: GslpState,
  workout: GslpWorkoutKey,
  results: Partial<Record<GslpLiftKey, LiftResult>>,
  date = new Date(),
): GslpState {
  const weights = { ...state.weights };
  const lifts = liftsForWorkout(workout, state.pullVariant).map((lift): GslpLiftLog => {
    const result = results[lift.key] ?? { amrapReps: null };
    const weight = state.weights[lift.key];
    const { outcome, nextWeight } = evaluateLift(lift, weight, result);
    weights[lift.key] = nextWeight;
    return { lift: lift.key, weight, amrapReps: result.amrapReps, outcome, nextWeight };
  });
  const session: GslpSessionLog = { id: date.toISOString(), date: date.toISOString(), workout, lifts };
  return { ...state, weights, history: [...state.history, session] };
}

// Removes the latest session and restores the weights it started from.
export function undoLastSession(state: GslpState): GslpState {
  const last = state.history.at(-1);
  if (!last) return state;
  const weights = { ...state.weights };
  for (const log of last.lifts) {
    weights[log.lift] = log.weight;
  }
  return { ...state, weights, history: state.history.slice(0, -1) };
}
