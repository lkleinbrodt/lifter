// What a finished workout achieved, for the summary's celebration: personal records against
// the log, and where the workout sits in the run of workouts (number, this week, week streak).
// Pure functions; the summary feeds them rows from db.ts.

import { type TrackingType, getExercise } from './exercises';
import { type Workout, type WorkoutSet, isWorkingSet } from './workout';
import { estimated1RM } from './workout-edit';

export type PersonalRecord = {
  entryId: string;
  exerciseId: string;
  set: WorkoutSet; // today's best set
  previous: WorkoutSet; // the best set before today
  /** Today's and the old e1RM, when the lift has a known total load. */
  e1rm?: { now: number; was: number };
};

/**
 * How good a set is, comparable across sessions of one exercise. Loaded lifts rank by e1RM;
 * added-load lifts by load, then reps; assisted lifts by less assistance, then reps.
 */
export function setScore(set: WorkoutSet, tracking: TrackingType): number | undefined {
  if (!set.done || !isWorkingSet(set)) return undefined;
  const reps = set.reps ?? 0;
  const weight = set.weight ?? 0;
  switch (tracking) {
    case 'weightReps':
      if (!reps) return undefined;
      // Unloaded sets (BW calf raises) rank by reps, below any loaded set.
      return weight > 0 ? (estimated1RM(weight, reps) ?? 0) : reps / 1000;
    case 'addedWeightReps':
      return reps ? weight * 1000 + reps : undefined;
    case 'assistedReps':
      return reps ? -weight * 1000 + reps : undefined;
    case 'reps':
      return reps || undefined;
    case 'duration':
      return set.durationSec || undefined;
  }
}

function bestSet(sets: WorkoutSet[], tracking: TrackingType) {
  let best: { set: WorkoutSet; score: number } | undefined;
  for (const set of sets) {
    const score = setScore(set, tracking);
    if (score !== undefined && (!best || score > best.score)) best = { set, score };
  }
  return best;
}

/**
 * Exercises whose best set today beats every earlier session. The first time an exercise is
 * logged isn't a record. `history` maps exerciseId → sets from earlier finished workouts.
 * Main lifts (`mainSlots`) come first.
 */
export function personalRecords(
  workout: Workout,
  history: Record<string, WorkoutSet[]>,
  mainSlots: ReadonlySet<string> = new Set(),
): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  const seen = new Set<string>();
  for (const entry of workout.exercises) {
    if (seen.has(entry.exerciseId)) continue;
    seen.add(entry.exerciseId);
    const { tracking } = getExercise(entry.exerciseId);
    const today = bestSet(
      workout.exercises.filter((other) => other.exerciseId === entry.exerciseId).flatMap((other) => other.sets),
      tracking,
    );
    const before = bestSet(history[entry.exerciseId] ?? [], tracking);
    if (!today || !before || today.score <= before.score) continue;
    const e1rmNow = tracking === 'weightReps' ? estimated1RM(today.set.weight, today.set.reps) : undefined;
    const e1rmWas = tracking === 'weightReps' ? estimated1RM(before.set.weight, before.set.reps) : undefined;
    records.push({
      entryId: entry.id,
      exerciseId: entry.exerciseId,
      set: today.set,
      previous: before.set,
      e1rm: e1rmNow && e1rmWas ? { now: e1rmNow, was: e1rmWas } : undefined,
    });
  }
  const rank = (record: PersonalRecord) =>
    mainSlots.has(workout.exercises.find((entry) => entry.id === record.entryId)?.slot ?? '') ? 0 : 1;
  return records.sort((a, b) => rank(a) - rank(b));
}

/** Monday 00:00 local of the week `date` falls in. */
export function weekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export type WorkoutStreak = {
  number: number; // this is workout N in the log
  thisWeek: number; // Nth workout of its week
  weeks: number; // consecutive weeks with a workout, ending with this one's week
};

/** Where a workout sits among all finished workouts (`startTimes`: ISO started_at of each). */
export function workoutStreak(workout: Workout, startTimes: string[]): WorkoutStreak {
  const at = new Date(workout.startedAt).getTime();
  const upTo = startTimes.map((iso) => new Date(iso).getTime()).filter((time) => time <= at);
  if (!upTo.includes(at)) upTo.push(at); // count this one even before it's saved
  const week = weekStart(new Date(at)).getTime();
  const weeks = new Set(upTo.map((time) => weekStart(new Date(time)).getTime()));
  let streak = 0;
  for (let cursor = new Date(week); weeks.has(cursor.getTime()); cursor.setDate(cursor.getDate() - 7)) streak++;
  return {
    number: upTo.length,
    thisWeek: upTo.filter((time) => time >= week).length,
    weeks: streak,
  };
}

/** 1st, 2nd, 3rd, 4th… */
export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}
