// The analytics database: one SQLite file holding every workout ever lifted.
// Rows come from two places, told apart by `origin`:
//   'app'                         — synced from the phone (Lifter-logged workouts only)
//   'strong' | 'notes' | 'snapshot' — historical imports the server owns (see importers.ts)
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { EXERCISE_CATALOG } from '../../lib/exercises';
import type { Workout } from '../../lib/workout';

export const DB_PATH = process.env.LIFTER_DB ?? path.join(os.homedir(), 'srv/lifter-analytics/lifter.db');

export type Origin = 'app' | 'strong' | 'notes' | 'snapshot';
/** 'month' for snapshot rows that only know the month (startedAt is the 1st). */
export type DatePrecision = 'minute' | 'day' | 'month';

/** A workout as the server stores it: the app's shape plus where it came from. */
export type StoredWorkout = Workout & { origin: Origin; datePrecision: DatePrecision };
/** Imports may name exercises the catalog doesn't know; they keep their own name. */
export type ExerciseNames = Record<string, string>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY NOT NULL,
  origin TEXT NOT NULL,
  date_precision TEXT NOT NULL DEFAULT 'minute',
  name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  source_json TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS workouts_started ON workouts (started_at);
CREATE TABLE IF NOT EXISTS workout_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  slot TEXT,
  superset_group TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS we_workout ON workout_exercises (workout_id);
CREATE INDEX IF NOT EXISTS we_exercise ON workout_exercises (exercise_id);
CREATE TABLE IF NOT EXISTS sets (
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
CREATE INDEX IF NOT EXISTS sets_we ON sets (workout_exercise_id);
-- Every sync payload as received, newest kept, so a bad sync can be undone by hand.
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT NOT NULL,
  workout_count INTEGER NOT NULL,
  payload TEXT NOT NULL
);
`;

let db: Database.Database | undefined;

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
  }
  return db;
}

export function exerciseName(id: string, names?: ExerciseNames) {
  return EXERCISE_CATALOG[id]?.name ?? names?.[id] ?? id;
}

/** Insert or replace workouts (with their exercises and sets). Call inside a transaction for many. */
export function writeWorkouts(workouts: StoredWorkout[], names?: ExerciseNames) {
  const d = getDb();
  const del = d.prepare('DELETE FROM workouts WHERE id = ?');
  const insW = d.prepare(
    `INSERT INTO workouts (id, origin, date_precision, name, started_at, finished_at, source_json, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insE = d.prepare(
    `INSERT INTO workout_exercises (id, workout_id, position, exercise_id, exercise_name, slot, superset_group, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insS = d.prepare(
    `INSERT INTO sets (id, workout_exercise_id, position, type, weight, reps, duration_sec, target_json, done, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const w of workouts) {
    del.run(w.id);
    insW.run(w.id, w.origin, w.datePrecision, w.name, w.startedAt, w.finishedAt ?? null, JSON.stringify(w.source), w.notes ?? null);
    w.exercises.forEach((e, i) => {
      insE.run(e.id, w.id, i, e.exerciseId, exerciseName(e.exerciseId, names), e.slot ?? null, e.supersetGroup ?? null, e.notes ?? null);
      e.sets.forEach((s, j) => {
        insS.run(
          s.id, e.id, j, s.type, s.weight ?? null, s.reps ?? null, s.durationSec ?? null,
          s.target ? JSON.stringify(s.target) : null, s.done ? 1 : 0, s.completedAt ?? null,
        );
      });
    });
  }
}

export function deleteOrigin(origin: Origin) {
  return getDb().prepare('DELETE FROM workouts WHERE origin = ?').run(origin).changes;
}
