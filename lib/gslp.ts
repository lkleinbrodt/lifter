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
    notes: [
      'Weight is added load. 0 means bodyweight.',
      'The program calls for a supinated grip. Switch to neutral-grip handles if it bothers your wrist.',
    ],
  },
  latPulldown: {
    key: 'latPulldown',
    label: 'Lat Pulldown',
    region: 'upper',
    equipment: 'machine',
    straightSets: 2,
    reps: 8,
    minWeight: 0,
    notes: [
      'Use this until you can do bodyweight chin-ups for reps, then switch the pull on the Weights tab.',
      'Use neutral-grip handles if a supinated grip bothers your wrist.',
    ],
  },
  squat: {
    key: 'squat',
    label: 'Squat',
    region: 'lower',
    equipment: 'barbell',
    straightSets: 2,
    reps: 5,
    minWeight: BAR_WEIGHT,
    notes: ['High bar with a wider grip, or a safety squat bar if the gym has one.'],
  },
  bench: {
    key: 'bench',
    label: 'Bench Press',
    region: 'upper',
    equipment: 'barbell',
    straightSets: 2,
    reps: 5,
    minWeight: BAR_WEIGHT,
    notes: [
      'Wrist wraps, knuckles stacked.',
      'Pause an inch off the chest if the bottom is where it pinches.',
    ],
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

export type GslpAccessory = {
  name: string;
  prescription: string;
  note?: string;
  archetype?: string; // exercise-library tag for swapping in alternatives
};

type GslpSlot = GslpLiftKey | 'pull';

export type GslpWorkout = {
  key: GslpWorkoutKey;
  label: string;
  focus: string;
  slots: GslpSlot[];
  accessories: GslpAccessory[];
};

export const gslpWorkouts: Record<GslpWorkoutKey, GslpWorkout> = {
  A: {
    key: 'A',
    label: 'Workout A',
    focus: 'Vertical',
    slots: ['ohp', 'pull', 'squat'],
    accessories: [
      { name: 'Face Pulls', prescription: '2 × 15–20', archetype: 'Upper-Back / Rear Delt / Scapular Stability' },
      { name: 'Hanging Leg Raises', prescription: '2 × 10–15', archetype: 'Core (Anti-extension)' },
      { name: 'Dead Hangs', prescription: '2 × 30–45s' },
    ],
  },
  B: {
    key: 'B',
    label: 'Workout B',
    focus: 'Horizontal',
    slots: ['bench', 'row', 'deadlift'],
    accessories: [
      {
        name: 'Assisted Dips',
        prescription: '2 × 10',
        note: 'Top half only. This is a tolerance test.',
        archetype: 'Horizontal Push',
      },
      { name: 'ATG Split Squats', prescription: '2 × 10/leg', archetype: 'Unilateral' },
      { name: 'Pallof Press', prescription: '2 × 10/side', archetype: 'Core (Anti-rotation)' },
    ],
  },
};

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
  painStop: boolean; // stopped for pain (e.g. wrist) rather than the weight
};

export type Outcome = 'progress' | 'double' | 'deload' | 'repeat';

export function isResultComplete(result: LiftResult | undefined) {
  return !!result && (result.painStop || result.amrapReps !== null);
}

export function evaluateLift(lift: GslpLift, weight: number, result: LiftResult) {
  const jump = jumpFor(lift);
  let outcome: Outcome;
  let nextWeight: number;
  if (result.painStop) {
    // Pain-driven misses aren't strength misses: repeat instead of deloading.
    outcome = 'repeat';
    nextWeight = weight;
  } else if ((result.amrapReps ?? 0) < lift.reps) {
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
    case 'repeat':
      return 'Repeat (pain stop)';
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
  painStop: boolean;
  outcome: Outcome;
  nextWeight: number;
};

export type GslpSessionLog = {
  id: string;
  date: string; // ISO timestamp
  workout: GslpWorkoutKey;
  lifts: GslpLiftLog[];
};

export type GslpState = {
  weights: GslpWeights;
  pullVariant: PullVariant;
  history: GslpSessionLog[]; // oldest first
};

export const gslpLiftOrder: GslpLiftKey[] = ['ohp', 'chinup', 'latPulldown', 'squat', 'bench', 'row', 'deadlift'];

export const defaultGslpState: GslpState = {
  weights: { ohp: 0, chinup: 0, latPulldown: 0, squat: 0, bench: 0, row: 0, deadlift: 0 },
  pullVariant: 'latPulldown',
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
    const result = results[lift.key] ?? { amrapReps: null, painStop: false };
    const weight = state.weights[lift.key];
    const { outcome, nextWeight } = evaluateLift(lift, weight, result);
    weights[lift.key] = nextWeight;
    return { lift: lift.key, weight, amrapReps: result.amrapReps, painStop: result.painStop, outcome, nextWeight };
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
