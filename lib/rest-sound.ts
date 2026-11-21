// Which voice says "Rest is over". The clips were generated once with Threepio's /v1/tts and
// are bundled into the iOS app as notification sounds (expo-notifications `sounds` in app.json);
// nothing calls Threepio at runtime.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export const REST_VOICES = [
  { key: 'jarvis', label: 'Jarvis' },
  { key: 'elle', label: 'Elle' },
] as const;
export type RestVoice = (typeof REST_VOICES)[number]['key'];

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

/** File name of the end sound, as bundled into the iOS app. */
export function restOverSoundFile(which: RestVoice = voice) {
  return `rest-over-${which}.wav`;
}

/** Plays a voice's end sound now, as a one-second notification (no audio module in the app). */
export async function previewRestVoice(which: RestVoice = voice) {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Rest over', body: 'Preview', sound: restOverSoundFile(which), data: { kind: 'preview' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, repeats: false },
  });
  return true;
}
