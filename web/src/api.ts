// Types mirror server/src/analytics.ts responses. Keep in step by hand; it's one consumer.
import { useEffect, useState } from 'react';

export type Origin = 'app' | 'strong' | 'notes' | 'snapshot';
export type Precision = 'minute' | 'day' | 'month';
export type Brief = { date: string; e1rm: number; weight: number; reps: number; workoutId: string; origin: Origin };
export type LiftPoint = { date: string; e1rm: number; weight: number; reps: number; topWeight: number; origin: Origin; precision: Precision; workoutId: string };
export type Week = { week: string; workouts: number; sets: number; tonnage: number; byPattern: Record<string, number> };
export type WorkoutRow = {
  id: string;
  name: string;
  origin: Origin;
  precision: Precision;
  date: string;
  startedAt: string;
  durationMin: number;
  workingSets: number;
  tonnage: number;
  exercises: { exerciseId: string; name: string; sets: number; top?: { weight: number | null; reps: number | null; durationSec: number | null } }[];
};
export type Summary = {
  bodyweight: number;
  totals: { workouts: number; workingSets: number; tonnage: number; hours: number; exercises: number; first: string; last: string; firstEver: string };
  thisWeek: { workouts: number; sets: number };
  last4wPerWeek: number;
  origins: Record<Origin, number>;
  weeks: Week[];
  days: { date: string; workouts: number; sets: number; names: string[] }[];
  mainLifts: { id: string; name: string; tracking: Tracking; best?: Brief; best90?: Brief; last?: Brief; points: LiftPoint[] }[];
  recentPRs: (Brief & { exerciseId: string; name: string; tracking: Tracking; count: number })[];
  recent: WorkoutRow[];
};
export type LSet = { type: string; weight: number | null; reps: number | null; durationSec: number | null; done: boolean; e1rm?: number };
export type Tracking = 'weightReps' | 'addedWeightReps' | 'assistedReps' | 'reps' | 'duration';
export type ExerciseRow = {
  id: string;
  name: string;
  pattern: string;
  tracking: Tracking;
  sessions: number;
  workingSets: number;
  first: string;
  last: string;
  best?: Brief;
};
export type ExerciseDetail = {
  id: string;
  name: string;
  pattern: string;
  tracking: Tracking;
  bodyweight: number;
  best?: Brief;
  repMaxes: { reps: number; load?: number; weight?: number; actualReps?: number; date?: string; workoutId?: string }[];
  sessions: (LiftPoint & { workingSets: number; tonnage: number; sets: LSet[]; pr: boolean })[];
};
export type WorkoutDetail = Omit<WorkoutRow, 'exercises'> & {
  notes: string | null;
  finishedAt: string | null;
  exercises: { id: string; exerciseId: string; name: string; notes: string | null; tracking: Tracking; priorBest: number; sets: LSet[] }[];
};

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data?: T; error?: string; path?: string }>({});
  useEffect(() => {
    if (!path) return;
    let live = true;
    fetch(`/api${path}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${await r.text()}`))))
      .then((data) => live && setState({ data, path }))
      .catch((e) => live && setState({ error: String(e.message ?? e), path }));
    return () => {
      live = false;
    };
  }, [path]);
  // Stale data from a previous path reads as loading.
  return state.path === path ? state : {};
}

// ---------- formatting ----------

export const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtW = (w: number | null | undefined) => (w == null ? '' : Number.isInteger(w * 4) ? String(w) : w.toFixed(1));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const parseDay = (d: string) => new Date(`${d}T12:00:00`);
export function fmtDate(d: string, precision: Precision = 'day', withYear = true) {
  const [y, m, day] = d.split('-').map(Number);
  if (precision === 'month') return `${MONTHS[m - 1]} ${y}`;
  return withYear ? `${MONTHS[m - 1]} ${day}, ${y}` : `${MONTHS[m - 1]} ${day}`;
}
export function ago(d: string) {
  const days = Math.round((Date.now() - parseDay(d).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  if (days < 730) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

/** "225 × 5", "BW × 8", "+25 × 5", "−40 × 8", "45s". */
export function fmtSet(s: { weight?: number | null; reps?: number | null; durationSec?: number | null }, tracking: Tracking = 'weightReps') {
  if (tracking === 'duration') return `${s.durationSec ?? 0}s`;
  if (tracking === 'reps') return `${s.reps ?? 0} reps`;
  const w = s.weight ?? 0;
  const load =
    tracking === 'addedWeightReps' ? (w ? `+${fmtW(w)}` : 'BW') : tracking === 'assistedReps' ? (w ? `−${fmtW(w)}` : 'BW') : fmtW(w);
  return `${load} × ${s.reps ?? 0}`;
}

/** Clock time where the lifting happened (the server buckets days in Pacific too). */
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

/** "Squat (Barbell)" → "Squat": the barbell is the default, so the dashboard drops it. */
export const shortName = (name: string) => name.replace(/ \(Barbell\)$/, '');

export const ORIGIN_LABEL: Record<Origin, string> = { app: 'Lifter', strong: 'Strong', notes: 'Notes', snapshot: 'Old sheets' };
