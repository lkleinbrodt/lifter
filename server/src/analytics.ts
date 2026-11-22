// Read-side analytics. The whole log is a few thousand sets, so every request loads it
// and computes in memory; add caching only if that ever gets slow.
import { EXERCISE_CATALOG, type MovementPattern, type TrackingType } from '../../lib/exercises';
import { BODYWEIGHT } from './config';
import { getDb, type DatePrecision, type Origin } from './db';

export type LSet = { type: string; weight: number | null; reps: number | null; durationSec: number | null; done: boolean };
export type LExercise = { id: string; exerciseId: string; name: string; notes: string | null; sets: LSet[] };
export type LWorkout = {
  id: string;
  name: string;
  origin: Origin;
  precision: DatePrecision;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
  exercises: LExercise[];
};

/** The lifts the dashboard leads with, in display order. */
export const MAIN_LIFTS = ['squat-barbell', 'bench-press-barbell', 'deadlift-barbell', 'overhead-press-barbell', 'bent-over-row-barbell', 'chin-up'];

// ---------- loading ----------

export function loadWorkouts(): LWorkout[] {
  const db = getDb();
  const ws = db.prepare('SELECT * FROM workouts WHERE finished_at IS NOT NULL OR origin != ? ORDER BY started_at').all('app') as any[];
  const es = db.prepare('SELECT * FROM workout_exercises ORDER BY workout_id, position').all() as any[];
  const ss = db.prepare('SELECT * FROM sets ORDER BY workout_exercise_id, position').all() as any[];
  const setsBy = new Map<string, LSet[]>();
  for (const s of ss) {
    const list = setsBy.get(s.workout_exercise_id) ?? [];
    list.push({ type: s.type, weight: s.weight, reps: s.reps, durationSec: s.duration_sec, done: !!s.done });
    setsBy.set(s.workout_exercise_id, list);
  }
  const imported = new Set(ws.filter((w) => w.origin !== 'app').map((w) => w.id));
  const exBy = new Map<string, LExercise[]>();
  for (const e of es) {
    const list = exBy.get(e.workout_id) ?? [];
    const sets = (setsBy.get(e.id) ?? []).filter((s) => s.done);
    if (imported.has(e.workout_id)) inferWarmups(sets);
    list.push({ id: e.id, exerciseId: e.exercise_id, name: e.exercise_name, notes: e.notes, sets });
    exBy.set(e.workout_id, list);
  }
  return ws.map((w) => ({
    id: w.id,
    name: w.name,
    origin: w.origin,
    precision: w.date_precision,
    startedAt: w.started_at,
    finishedAt: w.finished_at,
    notes: w.notes,
    exercises: (exBy.get(w.id) ?? []).filter((e) => e.sets.length),
  }));
}

/**
 * Strong (as Landon used it) and the notes never flagged warmups, so ramp-up sets would count
 * as working sets. When an imported entry has no warmup flags, sets under 75% of its heaviest
 * set are warmups (the rule from the 2026 analysis). Bodyweight sets (weight 0) stay working.
 */
function inferWarmups(sets: LSet[]) {
  if (sets.some((s) => s.type === 'warmup')) return;
  const top = Math.max(0, ...sets.map((s) => s.weight ?? 0));
  for (const s of sets) if (top > 0 && (s.weight ?? 0) > 0 && (s.weight ?? 0) < 0.75 * top) s.type = 'warmup';
}

// ---------- per-set math ----------

export function trackingOf(id: string): TrackingType {
  return EXERCISE_CATALOG[id]?.tracking ?? 'weightReps';
}

/** Catalog pattern, or a guess from the name for exercises only the old imports know. */
export function patternOf(id: string, name: string): MovementPattern {
  const known = EXERCISE_CATALOG[id]?.pattern;
  if (known) return known;
  const n = name.toLowerCase();
  if (/curl|tricep|pushdown/.test(n)) return 'Arms';
  if (/calf/.test(n)) return 'Calves';
  if (/lunge|squat|step/.test(n)) return 'Squat';
  if (/row/.test(n)) return 'Horizontal Pull';
  if (/bench|chest|dip|push/.test(n)) return 'Horizontal Push';
  if (/press/.test(n)) return 'Vertical Push';
  return 'Other';
}

export const isWorking = (s: LSet) => s.type !== 'warmup';

/** Load moved on a set: bar weight, or bodyweight ± added/assisted for bodyweight lifts. */
export function loadOf(exerciseId: string, s: LSet): number {
  const w = s.weight ?? 0;
  switch (trackingOf(exerciseId)) {
    case 'weightReps': return w;
    case 'addedWeightReps': return BODYWEIGHT + w;
    case 'assistedReps': return BODYWEIGHT - w;
    default: return 0;
  }
}

/** Epley estimated 1RM on working sets of 1–12 reps; 0 when not estimable. */
export function e1rm(exerciseId: string, s: LSet): number {
  const reps = s.reps ?? 0;
  const load = loadOf(exerciseId, s);
  if (!isWorking(s) || reps < 1 || reps > 12 || load <= 0) return 0;
  return reps === 1 ? load : load * (1 + reps / 30);
}

/** Tonnage counts external load only (barbell/dumbbell/machine), working sets. */
export const tonnage = (exerciseId: string, s: LSet) =>
  isWorking(s) && trackingOf(exerciseId) === 'weightReps' ? (s.weight ?? 0) * (s.reps ?? 0) : 0;

const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------- dates (process TZ is Pacific, see config.ts) ----------

const pad = (n: number) => String(n).padStart(2, '0');
export const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** Monday of the week containing `day` (YYYY-MM-DD). */
export function weekOf(day: string) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(d.toISOString());
}
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDay(d.toISOString());
};
const daysAgo = (n: number) => addDays(localDay(new Date().toISOString()), -n);

const durationMin = (w: LWorkout) =>
  w.finishedAt ? Math.round((Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 60_000) : 0;

// ---------- exercise sessions ----------

export type SessionPoint = {
  workoutId: string;
  date: string;
  precision: DatePrecision;
  origin: Origin;
  e1rm: number;
  weight: number; // of the best-e1RM set
  reps: number;
  topWeight: number; // heaviest working set
  workingSets: number;
  tonnage: number;
  sets: LSet[];
};

/** One point per workout that included the exercise (repeat entries merged). */
export function exerciseSessions(workouts: LWorkout[], exerciseId: string): SessionPoint[] {
  const out: SessionPoint[] = [];
  for (const w of workouts) {
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets);
    if (!sets.length) continue;
    let best: LSet | undefined;
    let bestE = 0;
    for (const s of sets) {
      const e = e1rm(exerciseId, s);
      if (e > bestE) [bestE, best] = [e, s];
    }
    const working = sets.filter(isWorking);
    out.push({
      workoutId: w.id,
      date: localDay(w.startedAt),
      precision: w.precision,
      origin: w.origin,
      e1rm: r1(bestE),
      weight: best?.weight ?? 0,
      reps: best?.reps ?? 0,
      topWeight: Math.max(0, ...working.map((s) => s.weight ?? 0)),
      workingSets: working.length,
      tonnage: Math.round(sets.reduce((t, s) => t + tonnage(exerciseId, s), 0)),
      sets,
    });
  }
  return out;
}

const pickBest = (pts: SessionPoint[]) => pts.reduce<SessionPoint | undefined>((b, p) => (p.e1rm > (b?.e1rm ?? 0) ? p : b), undefined);
const brief = (p?: SessionPoint) => p && { date: p.date, e1rm: p.e1rm, weight: p.weight, reps: p.reps, workoutId: p.workoutId, origin: p.origin };

/** Sessions that set a new all-time e1RM for their exercise. */
function prsOf(points: SessionPoint[]) {
  let best = 0;
  const prs: SessionPoint[] = [];
  for (const p of points) {
    if (p.e1rm > best) {
      if (best > 0) prs.push(p);
      best = p.e1rm;
    }
  }
  return prs;
}

// ---------- endpoints ----------

export function summary() {
  const all = loadWorkouts();
  // Snapshots record bests from old program sheets, not sessions: they count for lift bests only.
  const sessions = all.filter((w) => w.origin !== 'snapshot');
  const cutoff90 = daysAgo(90);

  let sets = 0;
  let ton = 0;
  let minutes = 0;
  const exerciseIds = new Set<string>();
  const byWeek = new Map<string, { workouts: number; sets: number; tonnage: number; byPattern: Record<string, number> }>();
  const byDay = new Map<string, { workouts: number; sets: number; names: string[] }>();

  for (const w of sessions) {
    const day = localDay(w.startedAt);
    const wk = byWeek.get(weekOf(day)) ?? { workouts: 0, sets: 0, tonnage: 0, byPattern: {} };
    const dd = byDay.get(day) ?? { workouts: 0, sets: 0, names: [] };
    wk.workouts++;
    dd.workouts++;
    dd.names.push(w.name);
    const m = durationMin(w);
    if (m >= 10 && m <= 180) minutes += m;
    for (const e of w.exercises) {
      exerciseIds.add(e.exerciseId);
      const pattern = patternOf(e.exerciseId, e.name);
      for (const s of e.sets) {
        if (!isWorking(s)) continue;
        const t = tonnage(e.exerciseId, s);
        sets++;
        ton += t;
        wk.sets++;
        wk.tonnage += t;
        dd.sets++;
        wk.byPattern[pattern] = (wk.byPattern[pattern] ?? 0) + 1;
      }
    }
    byWeek.set(weekOf(day), wk);
    byDay.set(day, dd);
  }

  // Continuous week series from the first Strong-era session to this week.
  const weeks: { week: string; workouts: number; sets: number; tonnage: number; byPattern: Record<string, number> }[] = [];
  if (sessions.length) {
    const end = weekOf(localDay(new Date().toISOString()));
    for (let wk = weekOf(localDay(sessions[0].startedAt)); wk <= end; wk = addDays(wk, 7)) {
      const v = byWeek.get(wk);
      weeks.push({ week: wk, workouts: v?.workouts ?? 0, sets: v?.sets ?? 0, tonnage: Math.round(v?.tonnage ?? 0), byPattern: v?.byPattern ?? {} });
    }
  }

  const mainLifts = MAIN_LIFTS.map((id) => {
    const pts = exerciseSessions(all, id).filter((p) => p.e1rm > 0);
    return {
      id,
      name: EXERCISE_CATALOG[id]?.name ?? id,
      best: brief(pickBest(pts)),
      best90: brief(pickBest(pts.filter((p) => p.date >= cutoff90))),
      last: brief(pts.at(-1)),
      points: pts.map((p) => ({ date: p.date, e1rm: p.e1rm, weight: p.weight, reps: p.reps, topWeight: p.topWeight, origin: p.origin, precision: p.precision, workoutId: p.workoutId })),
    };
  });

  const recentPRs = [...exerciseIds]
    .flatMap((id) => {
      const name = sessions.flatMap((w) => w.exercises).find((e) => e.exerciseId === id)?.name ?? id;
      // One row per exercise: its latest PR, plus how many it set in the window.
      const prs = prsOf(exerciseSessions(all, id)).filter((p) => p.date >= cutoff90);
      return prs.length ? [{ exerciseId: id, name, count: prs.length, ...brief(prs.at(-1))! }] : [];
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const thisWeek = weeks.at(-1);
  const last4 = weeks.slice(-5, -1);
  const origins: Record<string, number> = {};
  for (const w of all) origins[w.origin] = (origins[w.origin] ?? 0) + 1;

  return {
    bodyweight: BODYWEIGHT,
    totals: {
      workouts: sessions.length,
      workingSets: sets,
      tonnage: Math.round(ton),
      hours: Math.round(minutes / 60),
      exercises: exerciseIds.size,
      first: sessions[0] && localDay(sessions[0].startedAt),
      last: sessions.at(-1) && localDay(sessions.at(-1)!.startedAt),
      firstEver: all[0] && localDay(all[0].startedAt),
    },
    thisWeek: { workouts: thisWeek?.workouts ?? 0, sets: thisWeek?.sets ?? 0 },
    last4wPerWeek: last4.length ? r1(last4.reduce((t, w) => t + w.workouts, 0) / last4.length) : 0,
    origins,
    weeks,
    days: [...byDay].map(([date, v]) => ({ date, ...v })),
    mainLifts,
    recentPRs,
    recent: sessions.slice(-8).reverse().map(workoutRow),
  };
}

function workoutRow(w: LWorkout) {
  let sets = 0;
  let ton = 0;
  const exercises = w.exercises.map((e) => {
    const working = e.sets.filter(isWorking);
    sets += working.length;
    ton += working.reduce((t, s) => t + tonnage(e.exerciseId, s), 0);
    let top: LSet | undefined;
    for (const s of working) if (!top || e1rm(e.exerciseId, s) > e1rm(e.exerciseId, top)) top = s;
    return { exerciseId: e.exerciseId, name: e.name, sets: working.length, top: top && { weight: top.weight, reps: top.reps, durationSec: top.durationSec } };
  });
  return {
    id: w.id,
    name: w.name,
    origin: w.origin,
    precision: w.precision,
    date: localDay(w.startedAt),
    startedAt: w.startedAt,
    durationMin: durationMin(w),
    workingSets: sets,
    tonnage: Math.round(ton),
    exercises,
  };
}

export function listWorkouts(limit = 50, offset = 0) {
  const all = loadWorkouts().reverse();
  return { total: all.length, workouts: all.slice(offset, offset + limit).map(workoutRow) };
}

export function workoutDetail(id: string) {
  const all = loadWorkouts();
  const w = all.find((x) => x.id === id);
  if (!w) return null;
  // Flag sets that were an all-time e1RM best at the time.
  const prior = all.filter((x) => x.startedAt < w.startedAt);
  const exercises = w.exercises.map((e) => {
    const before = Math.max(0, ...exerciseSessions(prior, e.exerciseId).map((p) => p.e1rm));
    return {
      ...e,
      tracking: trackingOf(e.exerciseId),
      sets: e.sets.map((s) => ({ ...s, e1rm: r1(e1rm(e.exerciseId, s)) })),
      priorBest: before,
    };
  });
  return { ...workoutRow(w), notes: w.notes, finishedAt: w.finishedAt, exercises };
}

export function listExercises() {
  const all = loadWorkouts();
  const ids = new Map<string, string>();
  for (const w of all) for (const e of w.exercises) ids.set(e.exerciseId, e.name);
  return [...ids]
    .map(([id, name]) => {
      const pts = exerciseSessions(all, id);
      const best = pickBest(pts);
      return {
        id,
        name,
        pattern: patternOf(id, name),
        tracking: trackingOf(id),
        sessions: pts.length,
        workingSets: pts.reduce((t, p) => t + p.workingSets, 0),
        first: pts[0].date,
        last: pts.at(-1)!.date,
        best: brief(best),
      };
    })
    .sort((a, b) => b.last.localeCompare(a.last) || b.sessions - a.sessions);
}

export function exerciseDetail(id: string) {
  const all = loadWorkouts();
  const sessions = exerciseSessions(all, id);
  if (!sessions.length) return null;
  const name = all.flatMap((w) => w.exercises).find((e) => e.exerciseId === id)!.name;
  // Rep maxes: heaviest load done for at least N reps, N = 1..12.
  const repMaxes = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    let best: { load: number; weight: number; actualReps: number; date: string; workoutId: string } | undefined;
    for (const p of sessions)
      for (const s of p.sets) {
        const load = loadOf(id, s);
        if (isWorking(s) && (s.reps ?? 0) >= n && load > (best?.load ?? 0))
          best = { load, weight: s.weight ?? 0, actualReps: s.reps ?? 0, date: p.date, workoutId: p.workoutId };
      }
    return { reps: n, ...best };
  });
  const prIds = new Set(prsOf(sessions).map((p) => p.workoutId));
  return {
    id,
    name,
    pattern: patternOf(id, name),
    tracking: trackingOf(id),
    bodyweight: BODYWEIGHT,
    best: brief(pickBest(sessions)),
    repMaxes,
    sessions: sessions.map((p) => ({ ...p, pr: prIds.has(p.workoutId) })).reverse(),
  };
}
