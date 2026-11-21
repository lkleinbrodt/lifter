// Rest timer sounds while Lifter is open: a tick each minute and "Rest is over" at the end.
// They play through expo-audio, which ignores the silent switch and mixes over music without
// pausing it. With the phone locked, the scheduled notifications play the same files
// (bundled via the expo-notifications `sounds` option in app.json).
//
// The "Rest is over" clips were generated once with Threepio's /v1/tts and live in
// assets/sounds; nothing calls Threepio at runtime. Which voice plays is a setting.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export const REST_VOICES = [
  { key: 'jarvis', label: 'Jarvis' },
  { key: 'elle', label: 'Elle' },
] as const;
export type RestVoice = (typeof REST_VOICES)[number]['key'];

const SOURCES = {
  tick: require('@/assets/sounds/rest-tick.wav'),
  'over-jarvis': require('@/assets/sounds/rest-over-jarvis.wav'),
  'over-elle': require('@/assets/sounds/rest-over-elle.wav'),
};
type SoundKey = keyof typeof SOURCES;

// ---- Voice setting ----

const VOICE_KEY = '@rest_voice';
let voice: RestVoice = 'jarvis';

export async function loadRestVoice() {
  const saved = await AsyncStorage.getItem(VOICE_KEY).catch(() => null);
  if (REST_VOICES.some((v) => v.key === saved)) voice = saved as RestVoice;
  return voice;
}

export async function saveRestVoice(next: RestVoice) {
  voice = next;
  await AsyncStorage.setItem(VOICE_KEY, next).catch(() => undefined);
}

/** File name of the end sound for notifications (as bundled into the iOS app). */
export function restOverSoundFile() {
  return `rest-over-${voice}.wav`;
}

// ---- Playback ----

const players: Partial<Record<SoundKey, AudioPlayer>> = {};
let modeSet = false;

function getPlayer(key: SoundKey) {
  if (!modeSet) {
    modeSet = true;
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
  }
  return (players[key] ??= createAudioPlayer(SOURCES[key]));
}

function play(key: SoundKey) {
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
    getPlayer(`over-${voice}`);
  } catch {
    // ignore
  }
}

export function playRestTick() {
  play('tick');
}

export function playRestOver(which: RestVoice = voice) {
  if (AppState.currentState === 'active') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  play(`over-${which}`);
}
