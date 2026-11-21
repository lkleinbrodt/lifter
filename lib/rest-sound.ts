// The chime when a rest timer ends while Lifter is open. Notification sounds are muted by
// the silent switch, so the in-app chime plays through expo-audio instead: it ignores the
// silent switch and mixes over music without pausing it. With the phone locked or the app
// in the background, the scheduled local notification still covers it.

import { AppState } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

let player: AudioPlayer | null = null;

function getPlayer() {
  if (!player) {
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
    player = createAudioPlayer(require('@/assets/sounds/rest-done.wav'));
  }
  return player;
}

/** Load the sound ahead of time so the first chime isn't late. */
export function preloadRestSound() {
  try {
    getPlayer();
  } catch {
    // no audio: the haptic and notification still work
  }
}

/** Chime + haptic. Only while the app is in the foreground, so it never doubles the notification. */
export function playRestDone() {
  if (AppState.currentState !== 'active') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  try {
    const p = getPlayer();
    void p.seekTo(0).then(() => p.play()).catch(() => undefined);
  } catch {
    // ignore: the timer itself still works
  }
}
