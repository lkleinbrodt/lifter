// Rest timer sounds while Lifter is open: a tick each minute and "Rest is over" at the end.
// They play through expo-audio, which ignores the silent switch and mixes over music without
// pausing it. With the phone locked, the scheduled notifications play the same files
// (bundled via the expo-notifications `sounds` option in app.json).

import { AppState } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const SOURCES = {
  tick: require('@/assets/sounds/rest-tick.wav'),
  over: require('@/assets/sounds/rest-over.wav'),
};
const players: Partial<Record<keyof typeof SOURCES, AudioPlayer>> = {};
let modeSet = false;

function getPlayer(key: keyof typeof SOURCES) {
  if (!modeSet) {
    modeSet = true;
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
  }
  return (players[key] ??= createAudioPlayer(SOURCES[key]));
}

function play(key: keyof typeof SOURCES) {
  // Only in the foreground, so it never doubles a notification.
  if (AppState.currentState !== 'active') return;
  try {
    const player = getPlayer(key);
    void player.seekTo(0).then(() => player.play()).catch(() => undefined);
  } catch {
    // no audio: the timer itself still works
  }
}

/** Load the sounds ahead of time so the first one isn't late. */
export function preloadRestSounds() {
  try {
    getPlayer('tick');
    getPlayer('over');
  } catch {
    // ignore
  }
}

export function playRestTick() {
  play('tick');
}

export function playRestOver() {
  if (AppState.currentState === 'active') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  play('over');
}
