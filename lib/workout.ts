// The workout log: what was actually lifted. Program-agnostic; programs plan into it
// and read progression out of it. Persistence lives in db.ts.

import type { ProgramKey } from './programs';

export type SetType = 'warmup' | 'work' | 'amrap'; // grow as needed (drop, failure, …)

export type SetTarget = { weight?: number; reps?: number; label?: string }; // label e.g. '5+'

export type WorkoutSet = {
  id: string;
  type: SetType;
  weight?: number;
  reps?: number;
  durationSec?: number;
  target?: SetTarget;
  done: boolean;
  completedAt?: string; // ISO
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  slot?: string; // program slot this fills, e.g. 'bench' or 'accessory:verticalPull'
  supersetGroup?: string;
  notes?: string;
  sets: WorkoutSet[];
};

export type WorkoutSource =
  | { kind: 'program'; program: ProgramKey; template: string; sessionIndex: number }
  | { kind: 'empty' }
  | { kind: 'import'; from: 'strong' };

export type Workout = {
  id: string;
  name: string;
  startedAt: string; // ISO
  finishedAt?: string; // unset = the active workout
  source: WorkoutSource;
  notes?: string;
  exercises: WorkoutExercise[];
};

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Warmups don't count toward volume, best set or PRs. */
export function isWorkingSet(set: WorkoutSet) {
  return set.type !== 'warmup';
}
