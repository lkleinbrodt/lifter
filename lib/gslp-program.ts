// GSLP as a ProgramModule: plans A/B workouts into the log and progresses from the
// logged AMRAP sets. The rules themselves stay in gslp.ts.

import { getExercise } from './exercises';
import {
  type AccessorySlot,
  type GslpLift,
  type GslpLiftKey,
  type GslpState,
  type GslpWorkoutKey,
  type LiftResult,
  accessoryArchetypes,
  completeSession,
  describeOutcome,
  evaluateLift,
  formatLiftWeight,
  gslpLiftOrder,
  gslpLifts,
  gslpWorkouts,
  liftsForWorkout,
  nextSession,
  pickedAccessory,
  warmupSets,
  workSets,
} from './gslp';
import type { PlanContext, ProgramModule, ProgressionLine } from './program-module';
import { type Workout, type WorkoutExercise, type WorkoutSet, isWorkingSet, newId } from './workout';

const isTemplate = (value: string): value is GslpWorkoutKey => value === 'A' || value === 'B';

const accessorySlotKey = (slot: AccessorySlot) => `accessory:${slot.archetype}`;

function mainLiftExercise(lift: GslpLift, weight: number, supersetGroup?: string): WorkoutExercise {
  const warmups: WorkoutSet[] = warmupSets(lift, weight).map((set) => ({
    id: newId(),
    type: 'warmup',
    weight: set.weight,
    reps: Number(set.reps),
    target: { weight: set.weight, reps: Number(set.reps) },
    done: false,
  }));
  const work: WorkoutSet[] = workSets(lift, weight).map((set) => ({
    id: newId(),
    type: set.amrap ? 'amrap' : 'work',
    weight: set.weight,
    reps: lift.reps,
    target: { weight: set.weight, reps: lift.reps, label: set.reps },
    done: false,
  }));
  return { id: newId(), exerciseId: lift.exerciseId, slot: lift.key, supersetGroup, sets: [...warmups, ...work] };
}

/** Repeats last session's working sets as today's starting point (accessories, partners). */
function repeatLast(exerciseId: string, last: WorkoutSet[], fallbackSets = 3): WorkoutSet[] {
  const working = last.filter(isWorkingSet);
  if (working.length === 0) {
    return Array.from({ length: fallbackSets }, () => ({ id: newId(), type: 'work' as const, done: false }));
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

async function plan(state: GslpState, template: string, ctx: PlanContext): Promise<Workout> {
  if (!isTemplate(template)) throw new Error(`Unknown GSLP template: ${template}`);
  const config = gslpWorkouts[template];
  const sessionIndex = state.history.length;
  const exercises: WorkoutExercise[] = [];

  for (const slot of config.slots) {
    const lift = gslpLifts[slot === 'pull' ? state.pullVariant : slot];
    const partnerId = config.partners[slot];
    const group = partnerId ? newId() : undefined;
    exercises.push(mainLiftExercise(lift, state.weights[lift.key], group));
    if (partnerId) {
      getExercise(partnerId); // fail loudly on a typo'd id
      exercises.push({
        id: newId(),
        exerciseId: partnerId,
        slot: `partner:${lift.key}`,
        supersetGroup: group,
        sets: repeatLast(partnerId, await ctx.lastSets(partnerId)),
      });
    }
  }

  // Optional slots (hamstrings on A) are left for the workout screen to add.
  for (const slot of config.accessories.filter((item) => !item.optional)) {
    const { exerciseId } = pickedAccessory(state.accessoryPicks, slot.archetype);
    exercises.push({
      id: newId(),
      exerciseId,
      slot: accessorySlotKey(slot),
      sets: repeatLast(exerciseId, await ctx.lastSets(exerciseId)),
    });
  }

  return {
    id: newId(),
    name: `GSLP ${config.label.replace('Workout ', '')} · ${config.focus}`,
    startedAt: (ctx.now ?? new Date()).toISOString(),
    source: { kind: 'program', program: 'gslp', template, sessionIndex },
    exercises,
  };
}

/** The set GSLP progresses from: the AMRAP set, else the last working set (imports have no AMRAP flag). */
function progressionSet(exercise: WorkoutExercise | undefined): WorkoutSet | undefined {
  if (!exercise) return undefined;
  const working = exercise.sets.filter((set) => isWorkingSet(set) && set.done);
  return working.find((set) => set.type === 'amrap') ?? working.at(-1);
}

function complete(state: GslpState, workout: Workout) {
  if (workout.source.kind !== 'program' || !isTemplate(workout.source.template)) {
    throw new Error('Not a GSLP workout');
  }
  const template = workout.source.template;
  const results: Partial<Record<GslpLiftKey, LiftResult>> = {};
  for (const lift of liftsForWorkout(template, state.pullVariant)) {
    const exercise = workout.exercises.find((item) => item.slot === lift.key);
    // A removed lift or undone AMRAP has no reps, which GSLP treats as a missed session.
    results[lift.key] = { amrapReps: progressionSet(exercise)?.reps ?? null };
  }

  const next = completeSession(state, template, results, new Date(workout.startedAt));
  const log = next.history.at(-1)!;
  log.workoutId = workout.id;

  // Remember today's accessory picks (only exercises from the archetype's pool).
  const accessoryPicks = { ...next.accessoryPicks };
  for (const slot of gslpWorkouts[template].accessories) {
    const exercise = workout.exercises.find((item) => item.slot === accessorySlotKey(slot));
    const pooled = accessoryArchetypes[slot.archetype].exercises.find((item) => item.exerciseId === exercise?.exerciseId);
    if (pooled) accessoryPicks[slot.archetype] = pooled.name;
  }

  const summary: ProgressionLine[] = log.lifts.map((entry) => {
    const lift = gslpLifts[entry.lift];
    return {
      label: lift.label,
      before: formatLiftWeight(lift, entry.weight),
      after: formatLiftWeight(lift, entry.nextWeight),
      note: `${entry.amrapReps ?? '–'} reps · ${describeOutcome(entry.outcome, entry.weight, entry.nextWeight)}`,
      tone: entry.nextWeight > entry.weight ? 'up' : entry.nextWeight < entry.weight ? 'down' : 'same',
    };
  });

  return { state: { ...next, accessoryPicks }, summary };
}

export const gslpProgram: ProgramModule<GslpState> = {
  key: 'gslp',
  templates: () =>
    (['A', 'B'] as const).map((key) => ({ key, label: `${gslpWorkouts[key].label} · ${gslpWorkouts[key].focus}` })),
  nextTemplate: (state) => nextSession(state).workout,
  plan,
  complete,
};

// ---- Migration check: what Strong history implies vs. Lifter's stored state ----

export type ImpliedLift = { lift: GslpLiftKey; date: string; weight: number; reps: number; nextWeight: number };

/** For each GSLP lift, the next weight GSLP's rules give from its latest logged session. */
export function impliedGslpWeights(workouts: Workout[]): { lifts: ImpliedLift[]; nextTemplate?: GslpWorkoutKey } {
  const newestFirst = [...workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const lifts: ImpliedLift[] = [];
  for (const key of gslpLiftOrder) {
    const lift = gslpLifts[key];
    for (const workout of newestFirst) {
      const set = progressionSet(workout.exercises.find((item) => item.exerciseId === lift.exerciseId));
      if (set?.weight === undefined || set.reps === undefined) continue;
      const { nextWeight } = evaluateLift(lift, set.weight, { amrapReps: set.reps });
      lifts.push({ lift: key, date: workout.startedAt, weight: set.weight, reps: set.reps, nextWeight });
      break;
    }
  }
  // A has squats, B has deadlifts; the next session is the other one.
  const last = newestFirst.find((workout) =>
    workout.exercises.some((item) => item.exerciseId === gslpLifts.squat.exerciseId || item.exerciseId === gslpLifts.deadlift.exerciseId),
  );
  const lastWasA = last?.exercises.some((item) => item.exerciseId === gslpLifts.squat.exerciseId);
  return { lifts, nextTemplate: last ? (lastWasA ? 'B' : 'A') : undefined };
}
