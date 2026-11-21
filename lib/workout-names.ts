// Display names for workouts, derived from the template (or, for imports, from the main lifts).
// Display only: stored names don't change.

import { type GslpWorkoutKey, gslpLifts, gslpWorkouts } from './gslp';
import type { Workout } from './workout';

/** "A · Vertical + Squat", "B · Horizontal + Deadlift". */
export function gslpTemplateName(key: GslpWorkoutKey) {
  const config = gslpWorkouts[key];
  const lower = config.slots.map((slot) => (slot === 'pull' ? undefined : gslpLifts[slot])).find((lift) => lift?.region === 'lower');
  return `${key} · ${config.focus}${lower ? ` + ${lower.label}` : ''}`;
}

const A_LIFTS = new Set([gslpLifts.ohp.exerciseId, gslpLifts.squat.exerciseId]);
const B_LIFTS = new Set([gslpLifts.bench.exerciseId, gslpLifts.deadlift.exerciseId]);

/** Which GSLP template a workout is, if any: from its source, or by its main lifts (imports). */
export function gslpTemplateOf(workout: Workout): GslpWorkoutKey | undefined {
  const { source } = workout;
  if (source.kind === 'program') {
    return source.program === 'gslp' && (source.template === 'A' || source.template === 'B') ? source.template : undefined;
  }
  if (source.kind !== 'import') return undefined;
  const ids = workout.exercises.map((entry) => entry.exerciseId);
  const a = ids.some((id) => A_LIFTS.has(id));
  const b = ids.some((id) => B_LIFTS.has(id));
  return a === b ? undefined : a ? 'A' : 'B';
}

export function workoutDisplayName(workout: Workout) {
  const template = gslpTemplateOf(workout);
  return template ? gslpTemplateName(template) : workout.name;
}
