// Parses a Strong app CSV export into Workouts. Pure: no storage, no React.
// Fix bad data in the CSV itself, not with special cases here.

import { exerciseIdForStrongName, getExercise } from './exercises';
import type { Workout, WorkoutExercise, WorkoutSet } from './workout';

const HEADER = ['Date', 'Workout Name', 'Duration', 'Exercise Name', 'Set Order', 'Weight', 'Reps', 'Distance', 'Seconds', 'RPE'];

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** "1h 2m" / "44m" / "2m" → seconds. */
function parseDuration(value: string) {
  const hours = Number(/(\d+)h/.exec(value)?.[1] ?? 0);
  const minutes = Number(/(\d+)m/.exec(value)?.[1] ?? 0);
  return (hours * 60 + minutes) * 60;
}

/** Strong writes local time with no zone ("2026-11-19 17:39:32"); read it as device-local. */
function parseLocalDate(value: string) {
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) throw new Error(`Bad date: ${value}`);
  return date;
}

export type StrongImport = { workouts: Workout[]; unmappedExercises: string[]; setCount: number };

export function parseStrongCsv(text: string): StrongImport {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''));
  if (!header || HEADER.some((name, i) => header[i] !== name)) {
    throw new Error(`Not a Strong export. Expected columns: ${HEADER.join(', ')}`);
  }

  const unmapped = new Set<string>();
  const byStart = new Map<string, Workout>();
  let setCount = 0;

  for (const cells of rows) {
    const [date, workoutName, duration, exerciseName, setOrder, weight, reps, , seconds] = cells;
    const exerciseId = exerciseIdForStrongName(exerciseName);
    if (!exerciseId) {
      unmapped.add(exerciseName);
      continue;
    }

    let workout = byStart.get(date);
    if (!workout) {
      const start = parseLocalDate(date);
      workout = {
        id: `strong-${date.replace(/\D/g, '')}`, // stable, so re-importing replaces instead of duplicating
        name: workoutName,
        startedAt: start.toISOString(),
        finishedAt: new Date(start.getTime() + parseDuration(duration) * 1000).toISOString(),
        source: { kind: 'import', from: 'strong' },
        exercises: [],
      };
      byStart.set(date, workout);
    }

    // Consecutive rows of the same exercise form one entry; a later repeat starts a new one.
    let entry: WorkoutExercise | undefined = workout.exercises.at(-1);
    if (entry?.exerciseId !== exerciseId) {
      entry = { id: `${workout.id}-${workout.exercises.length}`, exerciseId, sets: [] };
      workout.exercises.push(entry);
    }

    const { tracking } = getExercise(exerciseId);
    const set: WorkoutSet = {
      id: `${entry.id}-${entry.sets.length}`,
      type: setOrder === 'W' ? 'warmup' : 'work',
      done: true,
    };
    if (tracking === 'duration') {
      set.durationSec = Number(seconds) || undefined;
    } else {
      set.reps = Number(reps);
      if (tracking !== 'reps') set.weight = Number(weight);
    }
    entry.sets.push(set);
    setCount++;
  }

  return {
    workouts: [...byStart.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    unmappedExercises: [...unmapped].sort(),
    setCount,
  };
}
