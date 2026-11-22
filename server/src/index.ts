// Lifter analytics: JSON API + the built web dashboard (web/dist), one process.
// Tailnet-only (tailscale serve → 127.0.0.1), single user, so no auth.
import './config';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Workout } from '../../lib/workout';
import { exerciseDetail, exerciseSessions, listExercises, listWorkouts, loadWorkouts, summary, workoutDetail } from './analytics';
import { HOST, PORT } from './config';
import { DB_PATH, getDb, writeWorkouts, type StoredWorkout } from './db';

const app = new Hono();
const WEB_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
/** A sync that would drop more than this many server-side app workouts is refused without ?force=1. */
const MAX_SYNC_DELETES = 2;
const SYNC_LOG_KEEP = 50;

app.use('/api/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

app.get('/api/health', (c) => {
  const db = getDb();
  const counts = db.prepare('SELECT origin, COUNT(*) n FROM workouts GROUP BY origin').all();
  const lastSync = db.prepare('SELECT received_at, workout_count FROM sync_log ORDER BY id DESC LIMIT 1').get();
  return c.json({ ok: true, db: DB_PATH, counts, lastSync: lastSync ?? null });
});

app.get('/api/summary', (c) => c.json(summary()));
app.get('/api/workouts', (c) => c.json(listWorkouts(Number(c.req.query('limit') ?? 50), Number(c.req.query('offset') ?? 0))));
app.get('/api/workouts/:id', (c) => {
  const w = workoutDetail(c.req.param('id'));
  return w ? c.json(w) : c.json({ error: 'not found' }, 404);
});
app.get('/api/exercises', (c) => c.json(listExercises()));
app.get('/api/exercises/:id', (c) => {
  const e = exerciseDetail(c.req.param('id'));
  return e ? c.json(e) : c.json({ error: 'not found' }, 404);
});
app.get('/api/compare', (c) => {
  // ?ids=a,b,c → e1RM series per exercise, for overlay charts
  const ids = (c.req.query('ids') ?? '').split(',').filter(Boolean).slice(0, 8);
  const all = loadWorkouts();
  return c.json(ids.map((id) => ({ id, points: exerciseSessions(all, id).filter((p) => p.e1rm > 0).map((p) => ({ date: p.date, e1rm: p.e1rm, origin: p.origin })) })));
});

/**
 * The phone sends every finished workout it logged itself (never its Strong imports) on each sync.
 * The server replaces its whole 'app' origin with that list, so edits and deletes on the phone
 * carry over without a change log.
 */
app.post('/api/sync', async (c) => {
  const body = await c.req.json<{ workouts?: Workout[] }>().catch(() => ({}) as { workouts?: Workout[] });
  if (!Array.isArray(body.workouts)) return c.json({ error: 'expected { workouts: Workout[] }' }, 400);
  const incoming = body.workouts.filter((w) => w?.id && w.startedAt && w.finishedAt && w.source?.kind !== 'import' && Array.isArray(w.exercises));
  const db = getDb();
  const existing = (db.prepare("SELECT id FROM workouts WHERE origin = 'app'").all() as { id: string }[]).map((r) => r.id);
  const keep = new Set(incoming.map((w) => w.id));
  const dropped = existing.filter((id) => !keep.has(id));
  if (dropped.length > MAX_SYNC_DELETES && c.req.query('force') !== '1') {
    return c.json({ error: `sync would delete ${dropped.length} workouts on the server; refusing (pass ?force=1)`, dropped }, 409);
  }
  db.transaction(() => {
    db.prepare("DELETE FROM workouts WHERE origin = 'app'").run();
    writeWorkouts(incoming.map((w): StoredWorkout => ({ ...w, origin: 'app', datePrecision: 'minute' })));
    db.prepare('INSERT INTO sync_log (received_at, workout_count, payload) VALUES (?, ?, ?)').run(new Date().toISOString(), incoming.length, JSON.stringify(body));
    db.prepare('DELETE FROM sync_log WHERE id NOT IN (SELECT id FROM sync_log ORDER BY id DESC LIMIT ?)').run(SYNC_LOG_KEEP);
  })();
  return c.json({ ok: true, received: incoming.length, deleted: dropped.length, skipped: body.workouts.length - incoming.length });
});

// The SPA: static assets, then index.html for client-side routes.
app.use('/*', serveStatic({ root: path.relative(process.cwd(), WEB_DIST) }));
app.get('*', serveStatic({ path: path.relative(process.cwd(), path.join(WEB_DIST, 'index.html')) }));

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, () => {
  getDb();
  console.log(`lifter analytics on http://${HOST}:${PORT} (db ${DB_PATH})`);
});
