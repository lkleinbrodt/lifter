// Historical imports the server owns (the phone never syncs these):
//   strong   — Strong app CSV export, 2023-02 → 2026-11
//   notes    — hand-written dated sessions from 2023 (notes_2023.csv: date,exercise,weight,reps,note)
//   snapshot — old program sheets, month or day precision (notes_snapshots.csv: snapshot,exercise,weight,reps,note)
// Each import replaces its whole origin, so re-running is safe.
import { exerciseIdForStrongName, getExercise, EXERCISE_CATALOG } from '../../lib/exercises';
import { parseCsv } from '../../lib/strong-import';
import type { WorkoutExercise, WorkoutSet } from '../../lib/workout';
import type { ExerciseNames, Origin, StoredWorkout } from './db';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Catalog id for a name, or a stable `x-<slug>` id that keeps the original name. */
function resolveExercise(name: string, names: ExerciseNames) {
  const id = exerciseIdForStrongName(name) ?? `x-${slug(name)}`;
  if (!EXERCISE_CATALOG[id]) names[id] = name;
  return id;
}

function trackingOf(id: string) {
  return EXERCISE_CATALOG[id] ? getExercise(id).tracking : 'weightReps';
}

function makeSet(id: string, exerciseId: string, type: WorkoutSet['type'], weight: number, reps: number, seconds = 0): WorkoutSet {
  const set: WorkoutSet = { id, type, done: true };
  const tracking = trackingOf(exerciseId);
  if (tracking === 'duration') set.durationSec = seconds || undefined;
  else {
    set.reps = reps;
    if (tracking !== 'reps') set.weight = weight;
  }
  return set;
}

/** Consecutive rows of one exercise form one entry; a later repeat starts a new one. */
function pushSet(w: StoredWorkout, exerciseId: string, build: (id: string) => WorkoutSet, note?: string) {
  let entry: WorkoutExercise | undefined = w.exercises.at(-1);
  if (entry?.exerciseId !== exerciseId) {
    entry = { id: `${w.id}-${w.exercises.length}`, exerciseId, sets: [] };
    w.exercises.push(entry);
  }
  entry.sets.push(build(`${entry.id}-${entry.sets.length}`));
  if (note) entry.notes = entry.notes ? `${entry.notes}; ${note}` : note;
}

function minutes(duration: string) {
  const h = /(\d+)h/.exec(duration);
  const m = /(\d+)m/.exec(duration);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

const local = (s: string) => new Date(s.replace(' ', 'T')); // wall-clock, in process TZ (config.ts)

function rows(text: string) {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ''));
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

export type ImportResult = { origin: Origin; workouts: StoredWorkout[]; names: ExerciseNames; sets: number };

export function importStrong(text: string): ImportResult {
  const names: ExerciseNames = {};
  const byStart = new Map<string, StoredWorkout>();
  let sets = 0;
  for (const r of rows(text)) {
    const date = r['Date'];
    let w = byStart.get(date);
    if (!w) {
      const start = local(date);
      w = {
        id: `strong-${date.replace(/\D/g, '')}`, // same ids the app's own Strong import uses
        origin: 'strong',
        datePrecision: 'minute',
        name: r['Workout Name'],
        startedAt: start.toISOString(),
        finishedAt: new Date(start.getTime() + minutes(r['Duration']) * 60_000).toISOString(),
        source: { kind: 'import', from: 'strong' },
        exercises: [],
      };
      byStart.set(date, w);
    }
    const ex = resolveExercise(r['Exercise Name'], names);
    const type = r['Set Order'] === 'W' ? 'warmup' : 'work';
    pushSet(w, ex, (id) => makeSet(id, ex, type, Number(r['Weight']) || 0, Number(r['Reps']) || 0, Number(r['Seconds']) || 0));
    sets++;
  }
  return { origin: 'strong', workouts: [...byStart.values()], names, sets };
}

/** notes_2023.csv and notes_snapshots.csv share a shape; only the date column and precision differ. */
function importNotes(text: string, origin: 'notes' | 'snapshot'): ImportResult {
  const names: ExerciseNames = {};
  const byKey = new Map<string, StoredWorkout>();
  let sets = 0;
  for (const r of rows(text)) {
    const key = origin === 'notes' ? r['date'] : r['snapshot'];
    let w = byKey.get(key);
    if (!w) {
      const precision = key.length === 7 ? 'month' : 'day';
      const day = precision === 'month' ? `${key}-01` : key;
      w = {
        id: `${origin}-${key}`,
        origin,
        datePrecision: precision,
        name: origin === 'notes' ? 'From notes' : 'From old program sheets',
        startedAt: local(`${day} 12:00:00`).toISOString(),
        source: { kind: 'import', from: 'strong' }, // app type has no other import kind; origin says the truth
        exercises: [],
      };
      byKey.set(key, w);
    }
    const ex = resolveExercise(r['exercise'], names);
    // A snapshot lists bests, not a session's sets; mark failure ("F") sets in notes only.
    pushSet(w, ex, (id) => makeSet(id, ex, 'work', Number(r['weight']) || 0, Number(r['reps']) || 0), r['note'] || undefined);
    sets++;
  }
  return { origin, workouts: [...byKey.values()], names, sets };
}

export const importNotes2023 = (text: string) => importNotes(text, 'notes');
export const importSnapshots = (text: string) => importNotes(text, 'snapshot');
