import type { LiftKey, Maxes } from './storage';

export type WorkoutSet = { percent: number; reps: string; amrap?: boolean };
export type WorkoutWeek = { week: number; label: string; sets: WorkoutSet[] };

export type WorkoutDayKey = LiftKey | 'weighted-pullups';

type WorkoutDay = {
  key: WorkoutDayKey;
  label: string;
  mainLiftLabel: string;
  accessoryArchetypes: string[];
  is531: boolean;
};

const workoutDayConfig: Record<WorkoutDayKey, WorkoutDay> = {
  squat: {
    key: 'squat',
    label: 'Squat',
    mainLiftLabel: 'Squat',
    accessoryArchetypes: ['Vertical Pull', 'Vertical Push', 'Core (Anti-extension)'],
    is531: true,
  },
  bench: {
    key: 'bench',
    label: 'Bench Press',
    mainLiftLabel: 'Bench Press',
    accessoryArchetypes: [
      'ATG Split Squat',
      'Horizontal Row',
      'Secondary Hinge (low-back friendly)',
    ],
    is531: true,
  },
  deadlift: {
    key: 'deadlift',
    label: 'Deadlift',
    mainLiftLabel: 'Deadlift',
    accessoryArchetypes: ['Horizontal Push', 'Vertical Press / Shoulder Rehab', 'Core (Anti-rotation)'],
    is531: true,
  },
  'weighted-pullups': {
    key: 'weighted-pullups',
    label: 'Weighted Pull-Ups',
    mainLiftLabel: 'Weighted Pull-Ups',
    accessoryArchetypes: ['Row (supported if needed)', 'Unilateral Lower', 'Core or Mobility'],
    is531: false,
  },
};

export const workoutDays: WorkoutDay[] = [
  workoutDayConfig.squat,
  workoutDayConfig.bench,
  workoutDayConfig.deadlift,
  workoutDayConfig['weighted-pullups'],
];

export const lifts: { key: LiftKey; label: string }[] = workoutDays
  .filter((day): day is WorkoutDay & { key: LiftKey } => day.is531)
  .map((day) => ({ key: day.key, label: day.label }));

export const workoutWeeks: WorkoutWeek[] = [
  {
    week: 1,
    label: '5/5/5',
    sets: [
      { percent: 0.65, reps: '5' },
      { percent: 0.75, reps: '5' },
      { percent: 0.85, reps: '5+', amrap: true },
    ],
  },
  {
    week: 2,
    label: '3/3/3',
    sets: [
      { percent: 0.7, reps: '3' },
      { percent: 0.8, reps: '3' },
      { percent: 0.9, reps: '3+', amrap: true },
    ],
  },
  {
    week: 3,
    label: '5/3/1',
    sets: [
      { percent: 0.75, reps: '5' },
      { percent: 0.85, reps: '3' },
      { percent: 0.95, reps: '1+', amrap: true },
    ],
  },
  {
    week: 4,
    label: 'Deload',
    sets: [
      { percent: 0.4, reps: '5' },
      { percent: 0.5, reps: '5' },
      { percent: 0.6, reps: '5' },
    ],
  },
];

const validWorkoutDay = (value: string | undefined): value is WorkoutDayKey =>
  value === 'squat' || value === 'bench' || value === 'deadlift' || value === 'weighted-pullups';

export function getLiftLabel(key: LiftKey) {
  return workoutDayConfig[key].label;
}

export function getWorkoutDayLabel(key: WorkoutDayKey) {
  return workoutDayConfig[key].label;
}

export function getWorkoutDay(key: WorkoutDayKey) {
  return workoutDayConfig[key];
}

export function is531WorkoutDay(key: WorkoutDayKey): key is LiftKey {
  return workoutDayConfig[key].is531;
}

export function roundToFive(weight: number) {
  return Math.round(weight / 5) * 5;
}

export function trainingMax(oneRepMax: number) {
  const base = Number.isFinite(oneRepMax) ? oneRepMax : 0;
  return base * 0.9;
}

export function calculateSetWeight(trainingMaxValue: number, percent: number) {
  const base = Number.isFinite(trainingMaxValue) ? trainingMaxValue : 0;
  return roundToFive(base * percent);
}

export function getWeekSets(week: number) {
  return workoutWeeks.find((item) => item.week === week)?.sets ?? [];
}

export function workoutId(week: number, day: WorkoutDayKey) {
  return `${week}-${day}`;
}

export function parseWorkoutId(id: string | undefined) {
  if (!id) return null;
  const [weekPart, ...dayParts] = id.split('-');
  const day = dayParts.join('-');
  const week = Number(weekPart);
  if (!Number.isInteger(week) || week < 1 || week > 4) return null;
  if (!validWorkoutDay(day)) return null;
  return { week, lift: day as WorkoutDayKey };
}

export function getTrainingMaxForLift(maxes: Maxes, lift: LiftKey) {
  return maxes[lift] ?? 0;
}

const defaultPlates = [45, 35, 25, 10, 5, 2.5];

export function calculatePlateMath(totalWeight: number, barWeight = 45, plates = defaultPlates) {
  const safeTotal = Number.isFinite(totalWeight) ? totalWeight : 0;
  const remaining = safeTotal - barWeight;
  if (remaining <= 0) {
    return [];
  }

  let perSide = remaining / 2;
  const selected: number[] = [];

  for (const plate of plates) {
    const count = Math.floor(perSide / plate + 1e-6);
    if (count > 0) {
      selected.push(...Array.from({ length: count }, () => plate));
      perSide = Number((perSide - count * plate).toFixed(2));
    }
  }

  return selected;
}
