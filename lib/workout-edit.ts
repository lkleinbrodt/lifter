// Pure, immutable edits to a Workout, used by the workout screen. No storage, no React.

import { type TrackingType, getExercise } from './exercises';
import { type Workout, type WorkoutExercise, type WorkoutSet, isWorkingSet, newId } from './workout';

type SetPatch = Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'durationSec' | 'done' | 'completedAt' | 'type'>>;

function mapExercise(workout: Workout, exerciseEntryId: string, fn: (exercise: WorkoutExercise) => WorkoutExercise): Workout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => (exercise.id === exerciseEntryId ? fn(exercise) : exercise)),
  };
}

export function updateSet(workout: Workout, exerciseEntryId: string, setId: string, patch: SetPatch): Workout {
  return mapExercise(workout, exerciseEntryId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
  }));
}

/** Adds a working set that copies the last set's values (Strong's "+ Add Set"). */
export function addSet(workout: Workout, exerciseEntryId: string): Workout {
  return mapExercise(workout, exerciseEntryId, (exercise) => {
    const last = exercise.sets.at(-1);
    const set: WorkoutSet = {
      id: newId(),
      type: 'work',
      weight: last?.weight,
      reps: last?.reps,
      durationSec: last?.durationSec,
      done: false,
    };
    return { ...exercise, sets: [...exercise.sets, set] };
  });
}

export function removeSet(workout: Workout, exerciseEntryId: string, setId: string): Workout {
  return mapExercise(workout, exerciseEntryId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.filter((set) => set.id !== setId),
  }));
}

export function removeExercise(workout: Workout, exerciseEntryId: string): Workout {
  return { ...workout, exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseEntryId) };
}

/** Swaps the exercise in an entry, keeping its slot and superset group; sets are replaced. */
export function replaceExercise(workout: Workout, exerciseEntryId: string, exerciseId: string, sets: WorkoutSet[]): Workout {
  return mapExercise(workout, exerciseEntryId, (exercise) => ({ ...exercise, exerciseId, sets }));
}

export function addExercise(workout: Workout, exerciseId: string, sets: WorkoutSet[], slot?: string): Workout {
  return { ...workout, exercises: [...workout.exercises, { id: newId(), exerciseId, slot, sets }] };
}

/** Today's starting sets for an exercise: repeat last session's working sets, or 3 empty ones. */
export function setsFromLast(last: WorkoutSet[], fallbackCount = 3): WorkoutSet[] {
  const working = last.filter(isWorkingSet);
  if (working.length === 0) {
    return Array.from({ length: fallbackCount }, () => ({ id: newId(), type: 'work' as const, done: false }));
  }
  return working.map((set) => ({
    id: newId(),
    type: 'work' as const,
    weight: set.weight,
    reps: set.reps,
    durationSec: set.durationSec,
    done: false,
  }));
}

/** Whether a set has the numbers its tracking type needs to count as logged. */
export function setHasValues(set: WorkoutSet, tracking: TrackingType) {
  switch (tracking) {
    case 'duration':
      return (set.durationSec ?? 0) > 0;
    case 'weightReps':
      return set.weight !== undefined && (set.reps ?? 0) > 0;
    default:
      return (set.reps ?? 0) > 0;
  }
}

export function hasDoneSets(exercise: WorkoutExercise) {
  return exercise.sets.some((set) => set.done);
}

/** Sets that hold values but weren't checked off. */
export function unfinishedSetCount(workout: Workout) {
  let count = 0;
  for (const exercise of workout.exercises) {
    const { tracking } = getExercise(exercise.exerciseId);
    count += exercise.sets.filter((set) => !set.done && setHasValues(set, tracking)).length;
  }
  return count;
}

/**
 * Closes out a workout: unfinished sets are completed or discarded, empty sets and
 * exercises left with no sets are dropped, and finishedAt is stamped.
 */
export function finalizeWorkout(workout: Workout, unfinished: 'complete' | 'discard', now = new Date()): Workout {
  const at = now.toISOString();
  const exercises = workout.exercises
    .map((exercise) => {
      const { tracking } = getExercise(exercise.exerciseId);
      const sets = exercise.sets
        .filter((set) => set.done || (unfinished === 'complete' && setHasValues(set, tracking)))
        .map((set) => (set.done ? set : { ...set, done: true, completedAt: at }));
      return { ...exercise, sets };
    })
    .filter((exercise) => exercise.sets.length > 0);
  return { ...workout, exercises, finishedAt: at };
}

export type WorkoutStats = { durationSec: number; sets: number; volume: number };

/** Done working sets and weight × reps volume (load-bearing tracking types only). */
export function workoutStats(workout: Workout, now = new Date()): WorkoutStats {
  const end = workout.finishedAt ? new Date(workout.finishedAt) : now;
  let sets = 0;
  let volume = 0;
  for (const exercise of workout.exercises) {
    const { tracking } = getExercise(exercise.exerciseId);
    for (const set of exercise.sets) {
      if (!set.done || !isWorkingSet(set)) continue;
      sets++;
      if (tracking === 'weightReps' || tracking === 'addedWeightReps') volume += (set.weight ?? 0) * (set.reps ?? 0);
    }
  }
  return { durationSec: Math.max(0, Math.round((end.getTime() - new Date(workout.startedAt).getTime()) / 1000)), sets, volume };
}

/** Labels the set column like Strong: W for warmups, 1, 2, 3… for working sets. */
export function setLabels(sets: WorkoutSet[]): string[] {
  let n = 0;
  return sets.map((set) => (set.type === 'warmup' ? 'W' : String(++n)));
}

/** The matching set from last session, by type and position within that type. */
export function previousSetFor(sets: WorkoutSet[], index: number, previous: WorkoutSet[]): WorkoutSet | undefined {
  const isWarm = (s: WorkoutSet) => s.type === 'warmup';
  let prevWarm = previous.filter(isWarm);
  let prevWork = previous.filter((s) => !isWarm(s));
  // Strong imports don't flag warmups. If today has warmups and last time had none,
  // the extra leading sets were the warmups: align working sets from the end.
  if (prevWarm.length === 0 && sets.some(isWarm)) {
    const split = Math.max(0, prevWork.length - sets.filter((s) => !isWarm(s)).length);
    prevWarm = prevWork.slice(0, split);
    prevWork = prevWork.slice(split);
  }
  const set = sets[index];
  const position = sets.slice(0, index).filter((s) => isWarm(s) === isWarm(set)).length;
  return (isWarm(set) ? prevWarm : prevWork)[position];
}

export function formatDuration(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Workout length for lists: "58m", "1h 8m". */
export function formatMinutes(totalSec: number) {
  const minutes = Math.round(totalSec / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}
