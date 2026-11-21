// App-wide state for the workout in progress: which workout is active (for the minimized
// bar) and the rest timer. Screens read it with useSession(); writes go through the
// functions below. The rest timer is a reminder: a chime plays when it ends while the app is
// open, and a local notification dings when the phone is locked.

import * as Notifications from 'expo-notifications';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveWorkout } from './db';
import { playRestDone, preloadRestSound } from './rest-sound';
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

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

// ---- Active workout ----

export function setActiveWorkout(active: ActiveSummary | null) {
  set({ active });
  if (!active) void skipRest();
}

export async function refreshActiveWorkout() {
  const workout = await getActiveWorkout();
  set({ active: workout ? summarizeActive(workout) : null });
}

// ---- Rest timer ----

// This handler only runs while Lifter is in the foreground, where the in-app chime
// (lib/rest-sound.ts) and the rest bar already cover it, so the notification stays quiet.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let notificationId: string | null = null;
let permissionAsked = false;

async function ensurePermission() {
  if (permissionAsked) return;
  permissionAsked = true;
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && current.canAskAgain) await Notifications.requestPermissionsAsync();
}

async function cancelNotification() {
  if (notificationId) {
    const id = notificationId;
    notificationId = null;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }
}

async function scheduleFor(rest: RestTimer) {
  await cancelNotification();
  const seconds = Math.round((rest.endsAt - Date.now()) / 1000);
  if (seconds < 1) return;
  try {
    notificationId = await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: 'Time for the next set.', sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
    });
  } catch {
    notificationId = null; // permission denied: the in-app countdown still works
  }
}

// Clears the timer a moment after it ends, wherever the user is in the app.
const EXPIRED_GRACE_MS = 1500;
let expireTimer: ReturnType<typeof setTimeout> | null = null;
let chimeTimer: ReturnType<typeof setTimeout> | null = null;
// A chime that would land later than this (the JS thread was suspended in the background) is dropped.
const CHIME_LATE_MS = 2000;

function scheduleExpiry(rest: RestTimer | null) {
  if (expireTimer) clearTimeout(expireTimer);
  if (chimeTimer) clearTimeout(chimeTimer);
  expireTimer = null;
  chimeTimer = null;
  if (!rest) return;
  preloadRestSound();
  chimeTimer = setTimeout(() => {
    if (snapshot.rest?.endsAt === rest.endsAt && Date.now() - rest.endsAt < CHIME_LATE_MS) playRestDone();
  }, Math.max(0, rest.endsAt - Date.now()));
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
  void (rest ? scheduleFor(rest) : cancelNotification());
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

/** Restores a rest timer that was running when the app was killed. */
export async function restoreRest() {
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
