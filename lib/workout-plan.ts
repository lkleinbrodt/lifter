import type { LiftKey, Maxes } from './storage';

export type WorkoutSet = { percent: number; reps: string; amrap?: boolean };

export type WorkoutWeek = { week: number; label: string; sets: WorkoutSet[] };

const liftLabels: Record<LiftKey, string> = {
  squat: 'Squat',
  bench: 'Bench Press',
  deadlift: 'Deadlift',
};

export const lifts: { key: LiftKey; label: string }[] = [
  { key: 'squat', label: liftLabels.squat },
  { key: 'bench', label: liftLabels.bench },
  { key: 'deadlift', label: liftLabels.deadlift },
];

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

const validLift = (value: string | undefined): value is LiftKey =>
  value === 'squat' || value === 'bench' || value === 'deadlift';

export function getLiftLabel(key: LiftKey) {
  return liftLabels[key];
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

export function workoutId(week: number, lift: LiftKey) {
  return `${week}-${lift}`;
}

export function parseWorkoutId(id: string | undefined) {
  if (!id) return null;
  const [weekPart, liftPart] = id.split('-');
  const week = Number(weekPart);
  if (!Number.isInteger(week) || week < 1 || week > 4) return null;
  if (!validLift(liftPart)) return null;
  return { week, lift: liftPart as LiftKey };
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
