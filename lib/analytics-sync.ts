// Pushes the workout log to the analytics server on chewy (server/, tailnet-only).
// Each sync sends every finished workout logged in Lifter (never the Strong imports: the
// server imports Strong history itself) and the server replaces its copy, so edits and
// deletes carry over. Fails quietly when Tailscale is off; the next sync catches up.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { listWorkouts } from './db';

export const ANALYTICS_URL = 'https://chewy.tail77f3eb.ts.net:8449';
const KEY = '@analytics_sync';
const TIMEOUT_MS = 10_000;
/** Workouts to coalesce: finishing then immediately deleting shouldn't send twice. */
const DEBOUNCE_MS = 1500;

export type SyncStatus = { at: string; ok: boolean; message: string };

let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<SyncStatus> | undefined;

export async function lastSyncStatus(): Promise<SyncStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SyncStatus) : null;
  } catch {
    return null;
  }
}

/** Fire-and-forget sync after a short debounce. Call after any change to finished workouts. */
export function syncSoon() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void syncNow();
  }, DEBOUNCE_MS);
}

/** Sync now; resolves with the status (also saved for Settings). `force` allows large deletes. */
export function syncNow({ force = false } = {}): Promise<SyncStatus> {
  if (inFlight) return inFlight;
  inFlight = run(force).finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

async function run(force: boolean): Promise<SyncStatus> {
  let status: SyncStatus;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const workouts = (await listWorkouts({ limit: 100_000 })).filter((w) => w.source.kind !== 'import');
    const res = await fetch(`${ANALYTICS_URL}/api/sync${force ? '?force=1' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workouts }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    status = res.ok
      ? { at: new Date().toISOString(), ok: true, message: `Synced ${body.received ?? workouts.length} workouts` }
      : { at: new Date().toISOString(), ok: false, message: body.error ?? `HTTP ${res.status}` };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    status = { at: new Date().toISOString(), ok: false, message: aborted ? 'Timed out (is Tailscale on?)' : String(error) };
  } finally {
    clearTimeout(timeout);
  }
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(status));
  } catch {}
  return status;
}
