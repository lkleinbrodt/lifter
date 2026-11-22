import { type SetRef, currentSet, exerciseBlocks, setLabels, supersetTag } from '@/lib/workout-edit';
import { getExercise, isBarbellExercise, splitExerciseName } from '@/lib/exercises';

import type { Workout } from '@/lib/workout';
import { formatSet } from './set-row';

/** `plateWeight`: for barbell lifts, the load to put on the bar for this set. */
export type NextUp = { name: string; set: string; numbers: string; plateWeight?: number };

/** A set described for the rest bar, Workout tab and Live Activity: "A1 Bench Press · set 2 · 160 × 5". */
export function describeSet(workout: Workout, ref: SetRef): NextUp | undefined {
  const entry = workout.exercises.find((item) => item.id === ref.entryId);
  const index = entry ? entry.sets.findIndex((set) => set.id === ref.setId) : -1;
  if (!entry || index === -1) return undefined;
  const { tracking, name } = getExercise(entry.exerciseId);
  const label = setLabels(entry.sets)[index];
  return {
    name: [supersetTag(exerciseBlocks(workout.exercises), entry.id), splitExerciseName(name).title].filter(Boolean).join(' '),
    set: label === 'W' ? 'warm-up' : `set ${label}`,
    numbers: formatSet(entry.sets[index], tracking),
    plateWeight: isBarbellExercise(entry.exerciseId) ? (entry.sets[index].weight ?? entry.sets[index].target?.weight) : undefined,
  };
}

/** The current set, described (see describeSet). */
export function nextUpFor(workout: Workout): NextUp | undefined {
  const current = currentSet(workout);
  return current && describeSet(workout, current);
}
