// Pure, immutable edits to a Workout, used by the workout screen. No storage, no React.

import { type TrackingType, formatLoad, getExercise } from './exercises';
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

/**
 * A set as checking it would log it: empty fields adopt the target, else last time's number
 * (weight 0 = bodyweight for added/assisted lifts). Check `setHasValues` on the result.
 */
export function filledForCheck(set: WorkoutSet, tracking: TrackingType, previous?: WorkoutSet): WorkoutSet {
  const hasWeight = tracking === 'weightReps' || tracking === 'addedWeightReps' || tracking === 'assistedReps';
  const isDuration = tracking === 'duration';
  const weightHint = set.target?.weight ?? previous?.weight;
  const repsHint = set.target?.reps ?? previous?.reps;
  return {
    ...set,
    weight: set.weight ?? (hasWeight ? (weightHint ?? (tracking === 'weightReps' ? undefined : 0)) : undefined),
    reps: set.reps ?? (isDuration ? undefined : repsHint),
    durationSec: set.durationSec ?? (isDuration ? previous?.durationSec : undefined),
  };
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

export type SetRef = { entryId: string; setId: string };

/**
 * The order sets are meant to be done in. Exercises go in workout order, except a superset
 * group: every member's warm-ups first, then work sets alternate by round (A1 set 1, A2 set 1,
 * A1 set 2, …), and when members have different set counts the leftovers come last.
 */
export function setOrder(workout: Workout): SetRef[] {
  const order: SetRef[] = [];
  const seenGroups = new Set<string>();
  for (const entry of workout.exercises) {
    if (!entry.supersetGroup) {
      for (const set of entry.sets) order.push({ entryId: entry.id, setId: set.id });
      continue;
    }
    if (seenGroups.has(entry.supersetGroup)) continue;
    seenGroups.add(entry.supersetGroup);
    const members = workout.exercises.filter((item) => item.supersetGroup === entry.supersetGroup);
    for (const member of members) {
      for (const set of member.sets) if (set.type === 'warmup') order.push({ entryId: member.id, setId: set.id });
    }
    const work = members.map((member) => member.sets.filter((set) => set.type !== 'warmup'));
    const rounds = Math.max(0, ...work.map((sets) => sets.length));
    for (let round = 0; round < rounds; round++) {
      members.forEach((member, index) => {
        const set = work[index][round];
        if (set) order.push({ entryId: member.id, setId: set.id });
      });
    }
  }
  return order;
}

/** The first unchecked set in workout order (see setOrder). Checking out of order is fine; this just recomputes. */
export function currentSet(workout: Workout): SetRef | undefined {
  const done = new Set(workout.exercises.flatMap((entry) => entry.sets.filter((set) => set.done).map((set) => set.id)));
  return setOrder(workout).find((ref) => !done.has(ref.setId));
}

/** "2×5, 1×5+": the working-set scheme, from targets (or values when there's no target). */
export function setScheme(sets: WorkoutSet[]): string {
  const groups: { label: string; count: number }[] = [];
  for (const set of sets) {
    if (set.type === 'warmup') continue;
    const reps = set.target?.reps ?? set.reps;
    if (reps === undefined) continue;
    const label = set.type === 'amrap' ? `${reps}+` : String(reps);
    const last = groups.at(-1);
    if (last?.label === label) last.count++;
    else groups.push({ label, count: 1 });
  }
  return groups.map((group) => `${group.count}×${group.label}`).join(', ');
}

/**
 * Work sets on one line, for a finished exercise: "160 × 5 · 5 · 9" when the load is the
 * same throughout, else "160×5 · 165×5"; "10 · 10 · 10" for reps; "45s · 45s" for holds.
 */
export function summarizeWorkSets(sets: WorkoutSet[], tracking: TrackingType): string {
  const work = sets.filter(isWorkingSet);
  const n = (value: number | undefined) => (value === undefined ? '–' : String(Number(value.toFixed(2))));
  if (tracking === 'duration') return work.map((set) => `${n(set.durationSec)}s`).join(' · ');
  if (tracking === 'reps') return work.map((set) => n(set.reps)).join(' · ');
  const loads = work.map((set) => formatLoad(set.weight, tracking) || '–');
  if (loads.length && loads.every((load) => load === loads[0])) {
    return `${loads[0]} × ${work.map((set) => n(set.reps)).join(' · ')}`;
  }
  return work.map((set, index) => `${loads[index]}×${n(set.reps)}`).join(' · ');
}

/** Estimated 1RM (Epley): weight × (1 + reps/30), rounded. Undefined without a load. */
export function estimated1RM(weight: number | undefined, reps: number | undefined) {
  if (!weight || !reps) return undefined;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * The AMRAP badge for a logged AMRAP set: reps, plus estimated 1RM when the total load is known
 * (not for added-load or bodyweight lifts). `hit` = met the target reps.
 */
export function amrapBadge(set: WorkoutSet, tracking: TrackingType): { reps: number; e1rm?: number; hit: boolean } | undefined {
  if (set.type !== 'amrap' || !set.done || !set.reps) return undefined;
  return {
    reps: set.reps,
    e1rm: tracking === 'weightReps' ? estimated1RM(set.weight, set.reps) : undefined,
    hit: set.reps >= (set.target?.reps ?? 0),
  };
}

export type ExerciseBlock = { key: string; entries: WorkoutExercise[]; letter?: string };

/**
 * Exercises as display blocks: a superset group becomes one block (all its members, at the
 * first member's position) lettered A, B, C…; everything else is a block of one.
 */
export function exerciseBlocks(exercises: WorkoutExercise[]): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = [];
  const seen = new Set<string>();
  let letters = 0;
  for (const entry of exercises) {
    const group = entry.supersetGroup;
    if (!group) {
      blocks.push({ key: entry.id, entries: [entry] });
      continue;
    }
    if (seen.has(group)) continue;
    seen.add(group);
    const members = exercises.filter((item) => item.supersetGroup === group);
    if (members.length < 2) blocks.push({ key: entry.id, entries: members });
    else blocks.push({ key: group, entries: members, letter: String.fromCharCode(65 + letters++) });
  }
  return blocks;
}

/** "A1" for the first member of superset A, else undefined. */
export function supersetTag(blocks: ExerciseBlock[], entryId: string) {
  for (const block of blocks) {
    const index = block.entries.findIndex((entry) => entry.id === entryId);
    if (index !== -1) return block.letter ? `${block.letter}${index + 1}` : undefined;
  }
  return undefined;
}

/**
 * Whether checking a set in `entryId` should start the rest timer, given the workout after the
 * check. In a superset you go straight from one member to the next, so rest starts only after
 * the round's last member: no rest when the next set is a later member of the same group.
 * Warm-ups, leftover sets and plain exercises always rest.
 */
export function restsAfter(workout: Workout, entryId: string): boolean {
  const entry = workout.exercises.find((item) => item.id === entryId);
  const next = currentSet(workout);
  if (!entry?.supersetGroup || !next || next.entryId === entryId) return true;
  const members = workout.exercises.filter((item) => item.supersetGroup === entry.supersetGroup);
  const from = members.findIndex((item) => item.id === entryId);
  const to = members.findIndex((item) => item.id === next.entryId);
  return !(to > from);
}
