// App-wide state for the workout in progress: which workout is active (for the minimized
// bar) and the rest timer. Screens read it with useSession(); writes go through the
// functions below. The rest timer is a reminder: it ticks each minute and says "Rest is over"
// at the end, as local notifications with bundled sounds, locked or not.

import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveWorkout } from './db';
import { formatDuration } from './workout-edit';
import { loadRestVoice, restOverSoundFile } from './rest-sound';
import type { Workout } from './workout';
import { workoutDisplayName } from './workout-names';
import { useSyncExternalStore } from 'react';

export type ActiveSummary = { id: string; name: string; startedAt: string; doneSets: number; totalSets: number };

/** What the minibar and Workout tab need from the active workout. */
export function summarizeActive(workout: Workout): ActiveSummary {
  const sets = workout.exercises.flatMap((entry) => entry.sets);
  return {
    id: workout.id,
    name: workoutDisplayName(workout),
    startedAt: workout.startedAt,
    doneSets: sets.filter((set) => set.done).length,
    totalSets: sets.length,
  };
}
export type RestTimer = { endsAt: number; durationSec: number };

type Snapshot = { active: ActiveSummary | null; rest: RestTimer | null };

const REST_KEY = '@rest_timer';

let snapshot: Snapshot = { active: null, rest: null };
const listeners = new Set<() => void>();

function set(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current snapshot, outside React. */
export function getSession() {
  return snapshot;
}

export function useSession() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

// ---- Active workout ----

// The full active workout, for things that need more than the summary (the Live Activity).
// Not part of the snapshot: screens re-render from `active`.
let activeWorkout: Workout | null = null;

export function getActiveWorkoutCached() {
  return activeWorkout;
}

export function setActiveWorkout(workout: Workout | null) {
  activeWorkout = workout;
  set({ active: workout ? summarizeActive(workout) : null });
  if (!workout) void skipRest();
}

export async function refreshActiveWorkout() {
  const workout = await getActiveWorkout();
  activeWorkout = workout;
  set({ active: workout ? summarizeActive(workout) : null });
}

// ---- Rest timer ----

// This handler only runs while Lifter is in the foreground: rest notifications play their
// sound but show no banner (the rest bar is on screen), and the end of rest buzzes.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    if (notification.request.content.data?.end) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: true, shouldSetBadge: false };
  },
});

let permissionAsked = false;

async function ensurePermission() {
  if (permissionAsked) return;
  permissionAsked = true;
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && current.canAskAgain) await Notifications.requestPermissionsAsync();
}

// Seconds of rest between ticks, and no tick this close to the end (the "rest over" sound is next).
const TICK_EVERY_SEC = 60;
const TICK_END_GAP_MS = 10_000;
// Bundled as rest-tick-1.wav … rest-tick-5.wav; minute 6+ reuses the 5-ping file.
const MAX_PINGS = 5;

/** Times (ms) of the minute ticks: each full minute since the rest started, anchored to the start so ±15s doesn't move them. */
function tickTimes(rest: RestTimer) {
  const start = rest.endsAt - rest.durationSec * 1000;
  const times: number[] = [];
  for (let at = start + TICK_EVERY_SEC * 1000; at < rest.endsAt - TICK_END_GAP_MS; at += TICK_EVERY_SEC * 1000) times.push(at);
  return times;
}

// Rest notifications carry data.kind = 'rest', so they can be found again after a relaunch.
const isRest = (request: Notifications.NotificationRequest) => request.content.data?.kind === 'rest';

async function cancelNotifications() {
  const [scheduled, presented] = await Promise.all([
    Notifications.getAllScheduledNotificationsAsync().catch(() => []),
    Notifications.getPresentedNotificationsAsync().catch(() => []),
  ]);
  await Promise.all([
    ...scheduled.filter(isRest).map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier).catch(() => undefined)),
    ...presented
      .filter((n) => isRest(n.request))
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier).catch(() => undefined)),
  ]);
}

async function scheduleAt(at: number, content: Notifications.NotificationContentInput, end = false) {
  const seconds = Math.round((at - Date.now()) / 1000);
  if (seconds < 1) return;
  await Notifications.scheduleNotificationAsync({
    content: { ...content, data: { kind: 'rest', end } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
  });
}

// Glass pings at each full minute (one ping per minute elapsed, up to MAX_PINGS) and "Rest is over" at the end, as standard local notifications with sounds
// bundled into the app (the expo-notifications `sounds` plugin option). Locked or open, the same
// notifications make the sound; like any notification, they're muted by the silent switch.
async function scheduleNotifications(rest: RestTimer | null) {
  await cancelNotifications();
  if (!rest) return;
  try {
    for (const [i, at] of tickTimes(rest).entries()) {
      const pings = Math.min(i + 1, MAX_PINGS);
      const left = formatDuration(Math.round((rest.endsAt - at) / 1000));
      const elapsed = formatDuration(Math.round((at - (rest.endsAt - rest.durationSec * 1000)) / 1000));
      await scheduleAt(at, { title: `Rest ${elapsed}`, body: `${left} left`, sound: `rest-tick-${pings}.wav` });
    }
    await scheduleAt(rest.endsAt, { title: 'Rest over', body: 'Time for the next set.', sound: restOverSoundFile() }, true);
  } catch {
    // permission denied: the in-app countdown and sounds still work
  }
}

// Notification calls are async; run them one at a time so quick ±15 taps can't leave duplicates.
let notificationQueue: Promise<void> = Promise.resolve();
function queueNotifications(rest: RestTimer | null) {
  notificationQueue = notificationQueue.then(() => scheduleNotifications(rest)).catch(() => undefined);
}

// Clears the timer a moment after it ends, wherever the user is in the app.
const EXPIRED_GRACE_MS = 1500;
let expireTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleExpiry(rest: RestTimer | null) {
  if (expireTimer) clearTimeout(expireTimer);
  expireTimer = null;
  if (!rest) return;
  expireTimer = setTimeout(() => {
    if (snapshot.rest?.endsAt === rest.endsAt) applyRest(null);
  }, Math.max(0, rest.endsAt - Date.now()) + EXPIRED_GRACE_MS);
}

function applyRest(rest: RestTimer | null) {
  set({ rest });
  scheduleExpiry(rest);
  void (rest ? AsyncStorage.setItem(REST_KEY, JSON.stringify(rest)) : AsyncStorage.removeItem(REST_KEY)).catch(
    () => undefined,
  );
  queueNotifications(rest);
}

export async function startRest(durationSec: number) {
  if (durationSec <= 0) return;
  await ensurePermission();
  applyRest({ endsAt: Date.now() + durationSec * 1000, durationSec });
}

export function adjustRest(deltaSec: number) {
  const rest = snapshot.rest;
  if (!rest) return;
  const endsAt = rest.endsAt + deltaSec * 1000;
  if (endsAt <= Date.now()) {
    applyRest(null);
    return;
  }
  applyRest({ endsAt, durationSec: Math.max(1, rest.durationSec + deltaSec) });
}

export async function skipRest() {
  applyRest(null);
}

/** Re-schedules the running rest's notifications, e.g. after the voice setting changes. */
export function refreshRestNotifications() {
  queueNotifications(snapshot.rest);
}

/** Restores a rest timer that was running when the app was killed. */
export async function restoreRest() {
  await loadRestVoice();
  try {
    const raw = await AsyncStorage.getItem(REST_KEY);
    const rest = raw ? (JSON.parse(raw) as RestTimer) : null;
    if (rest && rest.endsAt > Date.now()) {
      set({ rest });
      scheduleExpiry(rest);
    }
    else if (rest) await AsyncStorage.removeItem(REST_KEY);
  } catch {
    // ignore: a lost rest timer is harmless
  }
}

/** Seconds left on the rest timer at `now`, or null when none is running. */
export function restRemaining(rest: RestTimer | null, now: number) {
  if (!rest) return null;
  return Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
}
