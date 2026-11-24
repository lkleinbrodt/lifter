// Keeps the lock-screen Live Activity in step with the active workout and rest timer, and applies
// the actions from its buttons (✓ the set, +15s, Skip rest).
//
// The activity is native (targets/LifterWidget, modules/live-activity). Its buttons are App
// Intents that run in the app's process: they update the activity right away and queue the
// action, and this file applies the queue to the workout and rest timer: when notified, and on
// launch / resume in case the JS wasn't running.

import { AppState } from 'react-native';
import * as Live from '@/modules/live-activity';

import { adjustRest, getActiveWorkoutCached, getSession, setActiveWorkout, skipRest, startRest, subscribe, type RestTimer } from './session-store';
import { currentSet, filledForCheck, previousSetFor, restsAfter, setHasValues, type SetRef, updateSet } from './workout-edit';
import { getExercise, restSecFor } from './exercises';
import { calculatePlateMath } from './plates';
import type { Workout } from './workout';
import { describeSet } from '@/components/workout/next-up';
import { getActiveWorkout, saveWorkout } from './db';
import { lastSetsFor } from './workout-actions';
import { workoutDisplayName } from './workout-names';

// ---- What the activity shows ----

/** A set as the activity shows it, with the numbers a ✓ would log (target or own values). */
function liveSet(workout: Workout, ref: SetRef): Live.LiveNextSet | undefined {
  const entry = workout.exercises.find((item) => item.id === ref.entryId);
  const set = entry?.sets.find((item) => item.id === ref.setId);
  if (!entry || !set) return undefined;
  const { tracking } = getExercise(entry.exerciseId);
  const filled = filledForCheck(set, tracking);
  const shown = describeSet(updateSet(workout, entry.id, set.id, { weight: filled.weight, reps: filled.reps, durationSec: filled.durationSec }), ref);
  if (!shown) return undefined;
  const amrap = set.type === 'amrap';
  return {
    setId: set.id,
    name: shown.name,
    detail: amrap ? `${shown.set} · AMRAP` : shown.set,
    numbers: amrap && shown.numbers !== '—' ? `${shown.numbers}+` : shown.numbers,
    // AMRAP reps need typing in, and a set without numbers can't be logged blind.
    canCheck: !amrap && setHasValues(filled, tracking),
    plates: shown.plateWeight && shown.plateWeight > 0 ? calculatePlateMath(shown.plateWeight) : undefined,
  };
}

/** Epoch ms of the most recently checked set, if any. */
function lastDoneAt(workout: Workout): number | undefined {
  const times = workout.exercises.flatMap((entry) => entry.sets.map((set) => (set.done && set.completedAt ? Date.parse(set.completedAt) : NaN)));
  const latest = Math.max(...times.filter(Number.isFinite));
  return Number.isFinite(latest) ? latest : undefined;
}

function liveState(workout: Workout, rest: RestTimer | null): Live.LiveState {
  const sets = workout.exercises.flatMap((entry) => entry.sets);
  const state: Live.LiveState = {
    restEndsAt: rest?.endsAt,
    restStartedAt: rest ? rest.endsAt - rest.durationSec * 1000 : undefined,
    lastDoneAt: lastDoneAt(workout),
    afterCheckRestSec: 0,
    doneSets: sets.filter((set) => set.done).length,
    totalSets: sets.length,
  };
  const current = currentSet(workout);
  const next = current && liveSet(workout, current);
  if (!current || !next) return state;
  state.next = next;
  if (next.canCheck) {
    // What a ✓ from the lock screen leads to, so the activity can show it before the app catches up.
    const entry = workout.exercises.find((item) => item.id === current.entryId)!;
    const set = entry.sets.find((item) => item.id === current.setId)!;
    const filled = filledForCheck(set, getExercise(entry.exerciseId).tracking);
    const after = updateSet(workout, entry.id, set.id, { weight: filled.weight, reps: filled.reps, durationSec: filled.durationSec, done: true });
    const afterRef = currentSet(after);
    state.afterCheck = afterRef && liveSet(after, afterRef);
    state.afterCheckRestSec = restsAfter(after, entry.id) ? restSecFor(entry.exerciseId) : 0;
  }
  return state;
}

// ---- Sync ----

const SYNC_DELAY_MS = 150; // coalesce bursts (a check sets the workout, then the rest timer)
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncQueue: Promise<void> = Promise.resolve();
let lastSent = '';

function scheduleSync() {
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncQueue = syncQueue.then(runSync).catch((error) => console.warn('Live Activity sync failed', error));
  }, SYNC_DELAY_MS);
}

async function runSync() {
  const workout = getActiveWorkoutCached();
  if (!workout || workout.finishedAt) {
    if (lastSent !== 'end') {
      lastSent = 'end';
      await Live.end();
    }
    return;
  }
  const attributes: Live.LiveAttributes = { workoutName: workoutDisplayName(workout), startedAt: new Date(workout.startedAt).getTime() };
  const state = liveState(workout, getSession().rest);
  const payload = JSON.stringify({ attributes, state });
  if (payload === lastSent) return;
  lastSent = payload;
  await Live.sync(attributes, state);
}

// ---- Button actions ----

type WorkoutEditor = (fn: (workout: Workout) => Workout) => void;
let editor: { workoutId: string; apply: WorkoutEditor } | null = null;

/**
 * The open workout screen routes lock-screen edits through its own `apply`, so its state and
 * pending save don't overwrite them. Returns the unregister function.
 */
export function registerWorkoutEditor(workoutId: string, apply: WorkoutEditor) {
  const entry = { workoutId, apply };
  editor = entry;
  return () => {
    if (editor === entry) editor = null;
  };
}

/** Checks a set like tapping its ✓ in the app: fills empty fields, logs it, starts the rest. */
async function checkSet(setId: string) {
  const workout = getActiveWorkoutCached() ?? (await getActiveWorkout());
  const entry = workout?.exercises.find((item) => item.sets.some((set) => set.id === setId));
  if (!workout || workout.finishedAt || !entry) return;
  const index = entry.sets.findIndex((set) => set.id === setId);
  const set = entry.sets[index];
  if (set.done) return;
  const { tracking } = getExercise(entry.exerciseId);
  const previous = previousSetFor(entry.sets, index, await lastSetsFor(entry.exerciseId, workout.startedAt));
  const filled = filledForCheck(set, tracking, previous);
  if (!setHasValues(filled, tracking)) return;
  const patch = { weight: filled.weight, reps: filled.reps, durationSec: filled.durationSec, done: true, completedAt: new Date().toISOString() };

  if (editor?.workoutId === workout.id) {
    editor.apply((current) => updateSet(current, entry.id, setId, patch));
  } else {
    const next = updateSet(workout, entry.id, setId, patch);
    await saveWorkout(next);
    setActiveWorkout(next);
  }
  const after = getActiveWorkoutCached();
  if (after && restsAfter(after, entry.id)) await startRest(restSecFor(entry.exerciseId));
}

let applying: Promise<void> = Promise.resolve();

/** Applies the queued button actions, oldest first, one batch at a time. */
function applyPendingActions() {
  applying = applying
    .then(async () => {
      for (const action of Live.takePendingActions()) {
        if (action.type === 'check') await checkSet(action.setId);
        else if (action.type === 'addRest') adjustRest(Number(action.seconds) || 15);
        else if (action.type === 'skipRest') await skipRest();
      }
    })
    .catch((error) => console.warn('Live Activity action failed', error));
  return applying;
}

// ---- Wiring ----

let started = false;

/** Call once at startup, after the active workout and rest timer are restored. */
export function startLiveActivity() {
  if (started || !Live.liveActivityAvailable) return;
  started = true;
  subscribe(scheduleSync);
  Live.addActionListener(() => void applyPendingActions());
  AppState.addEventListener('change', (status) => {
    if (status !== 'active') return;
    void applyPendingActions();
    scheduleSync();
  });
  void applyPendingActions();
  scheduleSync();
}
