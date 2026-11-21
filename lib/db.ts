// SQLite persistence for the workout log. Normalized (workouts → exercises → sets) so later
// analysis is plain SQL. Schema changes go in MIGRATIONS; never edit an applied one.

import * as SQLite from 'expo-sqlite';

import type { SetTarget, SetType, Workout, WorkoutExercise, WorkoutSet, WorkoutSource } from './workout';
import { workoutDisplayName } from './workout-names';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE workouts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    source_kind TEXT NOT NULL,
    source_json TEXT NOT NULL,
    notes TEXT
  );
  CREATE INDEX workouts_started_at ON workouts (started_at);

  CREATE TABLE workout_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    workout_id TEXT NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    exercise_id TEXT NOT NULL,
    slot TEXT,
    superset_group TEXT,
    notes TEXT
  );
  CREATE INDEX workout_exercises_workout ON workout_exercises (workout_id);
  CREATE INDEX workout_exercises_exercise ON workout_exercises (exercise_id);

  CREATE TABLE sets (
    id TEXT PRIMARY KEY NOT NULL,
    workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    type TEXT NOT NULL,
    weight REAL,
    reps REAL,
    duration_sec REAL,
    target_json TEXT,
    done INTEGER NOT NULL,
    completed_at TEXT
  );
  CREATE INDEX sets_workout_exercise ON sets (workout_exercise_id);
  `,
];

type Db = SQLite.SQLiteDatabase;

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  dbPromise ??= open();
  return dbPromise;
}

async function open() {
  const db = await SQLite.openDatabaseAsync('lifter.db');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const applied = row?.user_version ?? 0;
  for (let version = applied; version < MIGRATIONS.length; version++) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
  return db;
}

// ---- Writes ----

type Value = string | number | null;

// Exclusive transactions run on their own connection, where foreign_keys is off, so
// ON DELETE CASCADE can't be relied on. Delete children explicitly.
async function deleteChildren(txn: Db, workoutIds: string[]) {
  for (let i = 0; i < workoutIds.length; i += 999) {
    const chunk = workoutIds.slice(i, i + 999);
    const marks = chunk.map(() => '?').join(',');
    await txn.runAsync(
      `DELETE FROM sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id IN (${marks}))`,
      chunk,
    );
    await txn.runAsync(`DELETE FROM workout_exercises WHERE workout_id IN (${marks})`, chunk);
  }
}

// Each statement crosses the JS/native bridge, so rows go in as multi-row INSERTs.
// Chunks stay under SQLite's conservative 999-variable limit.
async function insertRows(txn: Db, table: string, columns: string[], rows: Value[][], verb = 'INSERT') {
  const perChunk = Math.floor(999 / columns.length);
  const placeholder = `(${columns.map(() => '?').join(', ')})`;
  for (let i = 0; i < rows.length; i += perChunk) {
    const chunk = rows.slice(i, i + perChunk);
    await txn.runAsync(
      `${verb} INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => placeholder).join(', ')}`,
      chunk.flat(),
    );
  }
}

async function writeWorkouts(txn: Db, workouts: Workout[]) {
  if (workouts.length === 0) return;
  await insertRows(
    txn,
    'workouts',
    ['id', 'name', 'started_at', 'finished_at', 'source_kind', 'source_json', 'notes'],
    workouts.map((w) => [w.id, w.name, w.startedAt, w.finishedAt ?? null, w.source.kind, JSON.stringify(w.source), w.notes ?? null]),
    'INSERT OR REPLACE',
  );

  // Children are rewritten wholesale; a workout is small and this keeps edits simple.
  await deleteChildren(txn, workouts.map((w) => w.id));

  const exerciseRows: Value[][] = [];
  const setRows: Value[][] = [];
  for (const workout of workouts) {
    for (const [position, exercise] of workout.exercises.entries()) {
      exerciseRows.push([
        exercise.id,
        workout.id,
        position,
        exercise.exerciseId,
        exercise.slot ?? null,
        exercise.supersetGroup ?? null,
        exercise.notes ?? null,
      ]);
      for (const [setPosition, set] of exercise.sets.entries()) {
        setRows.push([
          set.id,
          exercise.id,
          setPosition,
          set.type,
          set.weight ?? null,
          set.reps ?? null,
          set.durationSec ?? null,
          set.target ? JSON.stringify(set.target) : null,
          set.done ? 1 : 0,
          set.completedAt ?? null,
        ]);
      }
    }
  }
  await insertRows(
    txn,
    'workout_exercises',
    ['id', 'workout_id', 'position', 'exercise_id', 'slot', 'superset_group', 'notes'],
    exerciseRows,
  );
  await insertRows(
    txn,
    'sets',
    ['id', 'workout_exercise_id', 'position', 'type', 'weight', 'reps', 'duration_sec', 'target_json', 'done', 'completed_at'],
    setRows,
  );
}

// Every exclusive transaction opens its own connection, so two at once can collide
// (SQLITE_BUSY) and one write is lost. All writes go through this queue, one at a time.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(task: (db: Db) => Promise<T>): Promise<T> {
  const run = writeQueue.then(async () => task(await getDb()));
  writeQueue = run.catch(() => undefined);
  return run;
}

export async function saveWorkout(workout: Workout) {
  await saveWorkouts([workout]);
}

/** Writes workouts (and their exercises and sets) in one transaction, replacing any with the same id. */
export function saveWorkouts(workouts: Workout[]) {
  return enqueueWrite((db) => db.withExclusiveTransactionAsync((txn) => writeWorkouts(txn as unknown as Db, workouts)));
}

export function deleteWorkout(id: string) {
  return enqueueWrite((db) =>
    db.withExclusiveTransactionAsync(async (txn) => {
      await deleteChildren(txn as unknown as Db, [id]);
      await txn.runAsync('DELETE FROM workouts WHERE id = ?', id);
    }),
  );
}

// ---- Reads ----

type WorkoutRow = {
  id: string;
  name: string;
  started_at: string;
  finished_at: string | null;
  source_json: string;
  notes: string | null;
};
type ExerciseRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  slot: string | null;
  superset_group: string | null;
  notes: string | null;
};
type SetRow = {
  id: string;
  workout_exercise_id: string;
  type: SetType;
  weight: number | null;
  reps: number | null;
  duration_sec: number | null;
  target_json: string | null;
  done: number;
  completed_at: string | null;
};

const opt = <T>(value: T | null): T | undefined => (value === null ? undefined : value);

function toSet(row: SetRow): WorkoutSet {
  return {
    id: row.id,
    type: row.type,
    weight: opt(row.weight),
    reps: opt(row.reps),
    durationSec: opt(row.duration_sec),
    target: row.target_json ? (JSON.parse(row.target_json) as SetTarget) : undefined,
    done: row.done === 1,
    completedAt: opt(row.completed_at),
  };
}

async function hydrate(db: Db, rows: WorkoutRow[]): Promise<Workout[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const marks = ids.map(() => '?').join(',');
  const exerciseRows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM workout_exercises WHERE workout_id IN (${marks}) ORDER BY position`,
    ids,
  );
  const setRows = exerciseRows.length
    ? await db.getAllAsync<SetRow>(
        `SELECT s.* FROM sets s JOIN workout_exercises e ON e.id = s.workout_exercise_id
         WHERE e.workout_id IN (${marks}) ORDER BY s.position`,
        ids,
      )
    : [];

  const setsByExercise = new Map<string, WorkoutSet[]>();
  for (const row of setRows) {
    const list = setsByExercise.get(row.workout_exercise_id) ?? [];
    list.push(toSet(row));
    setsByExercise.set(row.workout_exercise_id, list);
  }
  const exercisesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const row of exerciseRows) {
    const list = exercisesByWorkout.get(row.workout_id) ?? [];
    list.push({
      id: row.id,
      exerciseId: row.exercise_id,
      slot: opt(row.slot),
      supersetGroup: opt(row.superset_group),
      notes: opt(row.notes),
      sets: setsByExercise.get(row.id) ?? [],
    });
    exercisesByWorkout.set(row.workout_id, list);
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startedAt: row.started_at,
    finishedAt: opt(row.finished_at),
    source: JSON.parse(row.source_json) as WorkoutSource,
    notes: opt(row.notes),
    exercises: exercisesByWorkout.get(row.id) ?? [],
  }));
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', id);
  return (await hydrate(db, rows))[0] ?? null;
}

/** The in-progress workout, if any (at most one has no finished_at). */
export async function getActiveWorkout(): Promise<Workout | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
  return (await hydrate(db, rows))[0] ?? null;
}

/** Finished workouts, newest first. */
export async function listWorkouts({ limit = 50, offset = 0 } = {}): Promise<Workout[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT ? OFFSET ?',
    limit,
    offset,
  );
  return hydrate(db, rows);
}

export async function countWorkouts(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workouts WHERE finished_at IS NOT NULL');
  return row?.n ?? 0;
}

/** Row counts and schema version, for the diagnostics page. */
export async function dbStats() {
  const db = await getDb();
  const one = async (sql: string) => (await db.getFirstAsync<{ n: number }>(sql))?.n ?? 0;
  return {
    workouts: await one('SELECT COUNT(*) AS n FROM workouts WHERE finished_at IS NOT NULL'),
    imported: await one("SELECT COUNT(*) AS n FROM workouts WHERE source_kind = 'import'"),
    sets: await one('SELECT COUNT(*) AS n FROM sets'),
    schemaVersion: (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0,
  };
}

export type ExerciseSession = {
  workoutId: string;
  workoutName: string;
  /** Template-based name for display, e.g. "B · Horizontal + Deadlift" (see workout-names.ts). */
  displayName: string;
  startedAt: string;
  sets: WorkoutSet[];
};

/** Display name from a workout row's source plus its exercise ids, without hydrating the workout. */
function displayNameFor(row: { name: string; started_at: string; source_json: string; exercise_ids: string | null }) {
  return workoutDisplayName({
    id: '',
    name: row.name,
    startedAt: row.started_at,
    source: JSON.parse(row.source_json),
    exercises: (row.exercise_ids ?? '').split(',').map((exerciseId) => ({ id: '', exerciseId, sets: [] })),
  });
}

/** Past sessions of one exercise, newest first. Feeds "Previous" (limit 1) and the history sheet. */
export async function exerciseHistory(
  exerciseId: string,
  { limit = 20, before }: { limit?: number; before?: string } = {},
): Promise<ExerciseSession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    we_id: string;
    workout_id: string;
    name: string;
    started_at: string;
    source_json: string;
    exercise_ids: string | null;
  }>(
    `SELECT e.id AS we_id, w.id AS workout_id, w.name, w.started_at, w.source_json,
       (SELECT group_concat(x.exercise_id) FROM workout_exercises x WHERE x.workout_id = w.id) AS exercise_ids
     FROM workout_exercises e JOIN workouts w ON w.id = e.workout_id
     WHERE e.exercise_id = ? AND w.finished_at IS NOT NULL AND (? IS NULL OR w.started_at < ?)
     ORDER BY w.started_at DESC, e.position LIMIT ?`,
    exerciseId,
    before ?? null,
    before ?? null,
    limit,
  );
  if (rows.length === 0) return [];
  const marks = rows.map(() => '?').join(',');
  const setRows = await db.getAllAsync<SetRow>(
    `SELECT * FROM sets WHERE workout_exercise_id IN (${marks}) ORDER BY position`,
    rows.map((row) => row.we_id),
  );
  return rows.map((row) => ({
    workoutId: row.workout_id,
    workoutName: row.name,
    displayName: displayNameFor(row),
    startedAt: row.started_at,
    sets: setRows.filter((set) => set.workout_exercise_id === row.we_id).map(toSet),
  }));
}

/** The latest finished session of every exercise that has one: for "Recent" and last-numbers columns. */
export async function latestSessions(): Promise<Record<string, { startedAt: string; sets: WorkoutSet[] }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ we_id: string; exercise_id: string; started_at: string }>(
    `SELECT e.id AS we_id, e.exercise_id, w.started_at
     FROM workout_exercises e JOIN workouts w ON w.id = e.workout_id
     WHERE w.finished_at IS NOT NULL
     ORDER BY w.started_at DESC, e.position`,
  );
  const latest = new Map<string, { weId: string; startedAt: string }>();
  for (const row of rows) if (!latest.has(row.exercise_id)) latest.set(row.exercise_id, { weId: row.we_id, startedAt: row.started_at });
  if (latest.size === 0) return {};
  const ids = [...latest.values()].map((item) => item.weId);
  const setRows = await db.getAllAsync<SetRow>(
    `SELECT * FROM sets WHERE workout_exercise_id IN (${ids.map(() => '?').join(',')}) ORDER BY position`,
    ids,
  );
  return Object.fromEntries(
    [...latest].map(([exerciseId, item]) => [
      exerciseId,
      { startedAt: item.startedAt, sets: setRows.filter((set) => set.workout_exercise_id === item.weId).map(toSet) },
    ]),
  );
}
