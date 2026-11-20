import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  type AccessoryPicks,
  type GslpLiftKey,
  type GslpLiftLog,
  type GslpSessionLog,
  type GslpState,
  type GslpWorkoutKey,
  accessoryArchetypes,
  defaultGslpState,
  gslpLiftOrder,
} from './gslp';

const STATE_KEY = '@gslp_state';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isLiftKey = (value: unknown): value is GslpLiftKey =>
  gslpLiftOrder.includes(value as GslpLiftKey);

const isWorkoutKey = (value: unknown): value is GslpWorkoutKey => value === 'A' || value === 'B';

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeState(value: unknown): GslpState {
  if (!isRecord(value)) return defaultGslpState;
  const weights = { ...defaultGslpState.weights };
  if (isRecord(value.weights)) {
    for (const key of gslpLiftOrder) {
      weights[key] = toNumber(value.weights[key]);
    }
  }
  const pullVariant = value.pullVariant === 'chinup' ? 'chinup' : 'latPulldown';
  const accessoryPicks: AccessoryPicks = {};
  if (isRecord(value.accessoryPicks)) {
    for (const [archetype, config] of Object.entries(accessoryArchetypes)) {
      const pick = value.accessoryPicks[archetype];
      if (config.exercises.some((exercise) => exercise.name === pick)) {
        accessoryPicks[archetype as keyof AccessoryPicks] = pick as string;
      }
    }
  }
  const history = Array.isArray(value.history)
    ? value.history.filter(
        (item: unknown): item is GslpSessionLog =>
          isRecord(item) &&
          typeof item.id === 'string' &&
          typeof item.date === 'string' &&
          isWorkoutKey(item.workout) &&
          Array.isArray(item.lifts) &&
          item.lifts.every((log: unknown) => isRecord(log) && isLiftKey((log as GslpLiftLog).lift)),
      )
    : [];
  return { weights, pullVariant, accessoryPicks, history };
}

export async function loadGslpState(): Promise<GslpState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return defaultGslpState;
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultGslpState;
  }
}

export async function saveGslpState(state: GslpState) {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}
