// Workout lifecycle against storage: start, finish (with program progression), undo, discard.
// Screens call these; the rules live in the pure modules they use.

import { syncSoon } from './analytics-sync';
import { deleteWorkout, exerciseHistory, getActiveWorkout, getWorkout, saveWorkout } from './db';
import { gslpProgram } from './gslp-program';
import { type GslpLiftKey, gslpLiftOrder, gslpLifts, undoLastSession } from './gslp';
import { loadGslpState, saveGslpState } from './gslp-storage';
import type { ProgressionLine } from './program-module';
import { type Workout, type WorkoutSet, isWorkingSet, newId } from './workout';
import { finalizeWorkout } from './workout-edit';
import { setActiveWorkout, summarizeActive } from './session-store';

const summaryOf = summarizeActive;

/** Sets from the latest finished session of an exercise (before `before`, if given). */
export async function lastSetsFor(exerciseId: string, before?: string): Promise<WorkoutSet[]> {
  const [last] = await exerciseHistory(exerciseId, { limit: 1, before });
  return last?.sets ?? [];
}

export async function startGslpWorkout(template?: string): Promise<Workout> {
  const state = await loadGslpState();
  const workout = await gslpProgram.plan(state, template ?? gslpProgram.nextTemplate(state), {
    lastSets: (id) => lastSetsFor(id),
  });
  await saveWorkout(workout);
  setActiveWorkout(summaryOf(workout));
  return workout;
}

export async function startEmptyWorkout(): Promise<Workout> {
  const workout: Workout = {
    id: newId(),
    name: 'Workout',
    startedAt: new Date().toISOString(),
    source: { kind: 'empty' },
    exercises: [],
  };
  await saveWorkout(workout);
  setActiveWorkout(summaryOf(workout));
  return workout;
}

export { getActiveWorkout };

/** Finalizes the workout, applies program progression, and saves both. */
export async function finishWorkout(
  workout: Workout,
  unfinished: 'complete' | 'discard',
): Promise<{ workout: Workout; summary?: ProgressionLine[] }> {
  const finished = finalizeWorkout(workout, unfinished);
  let summary: ProgressionLine[] | undefined;
  if (finished.source.kind === 'program' && finished.source.program === 'gslp') {
    const result = gslpProgram.complete(await loadGslpState(), finished);
    await saveGslpState(result.state);
    summary = result.summary;
  }
  await saveWorkout(finished);
  setActiveWorkout(null);
  syncSoon();
  return { workout: finished, summary };
}

/**
 * Undoes a finished GSLP workout's progression and reopens it as the active workout.
 * Only the latest GSLP session can be undone.
 */
export async function reopenGslpWorkout(workoutId: string): Promise<Workout | null> {
  const state = await loadGslpState();
  if (state.history.at(-1)?.workoutId !== workoutId) return null;
  const active = await getActiveWorkout();
  if (active && active.id !== workoutId) return null; // only one workout in progress at a time
  await saveGslpState(undoLastSession(state));
  const workout = await getWorkout(workoutId);
  if (!workout) return null;
  const reopened = { ...workout, finishedAt: undefined };
  await saveWorkout(reopened);
  setActiveWorkout(summaryOf(reopened));
  syncSoon();
  return reopened;
}

export async function discardWorkout(workoutId: string) {
  await deleteWorkout(workoutId);
  setActiveWorkout(null);
}

/**
 * Deletes a finished workout from the log. If it's the latest GSLP session, its
 * progression is undone too; older sessions keep their progression history.
 */
export async function deleteFinishedWorkout(workoutId: string): Promise<{ undidProgression: boolean }> {
  const state = await loadGslpState();
  const undid = state.history.at(-1)?.workoutId === workoutId;
  if (undid) await saveGslpState(undoLastSession(state));
  await deleteWorkout(workoutId);
  syncSoon();
  return { undidProgression: undid };
}

export type TopSet = { weight: number; reps?: number };

/**
 * Each GSLP lift's top set per session (the AMRAP set, else the last working set), oldest
 * first, from the workout log (Strong imports included). Feeds "last" lines, sparklines and jumps.
 */
export async function gslpLiftHistory(limit = 8): Promise<Partial<Record<GslpLiftKey, TopSet[]>>> {
  const rows = await Promise.all(
    gslpLiftOrder.map(async (key) => {
      const history = await exerciseHistory(gslpLifts[key].exerciseId, { limit });
      const tops = history
        .map((session) => {
          const working = session.sets.filter((set) => isWorkingSet(set) && set.weight !== undefined);
          return working.find((set) => set.type === 'amrap') ?? working.at(-1);
        })
        .filter((set) => set !== undefined)
        .map((set) => ({ weight: set.weight ?? 0, reps: set.reps }))
        .reverse();
      return [key, tops] as const;
    }),
  );
  return Object.fromEntries(rows);
}
