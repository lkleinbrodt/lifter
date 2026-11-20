// What a training program plugs into the tracker. Each program owns its templates and
// progression rules; the tracker only sees Workouts. Keep this small: grow it when a
// second program (5/3/1+) actually needs more.

import type { ProgramKey } from './programs';
import type { Workout, WorkoutSet } from './workout';

export type PlanContext = {
  /** Sets from the most recent finished session of an exercise (empty if never done). */
  lastSets(exerciseId: string): Promise<WorkoutSet[]>;
  now?: Date;
};

export type ProgressionLine = { label: string; before: string; after: string; note: string; tone: 'up' | 'down' | 'same' };

export type ProgramModule<State> = {
  key: ProgramKey;
  templates(state: State): { key: string; label: string }[];
  nextTemplate(state: State): string;
  /** The planned workout: exercises, set types, targets, values prefilled. Not yet saved. */
  plan(state: State, template: string, ctx: PlanContext): Promise<Workout>;
  /** Reads a finished workout and returns the program's new state plus what changed. */
  complete(state: State, workout: Workout): { state: State; summary: ProgressionLine[] };
};
