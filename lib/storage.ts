import AsyncStorage from '@react-native-async-storage/async-storage';

export type LiftKey = 'squat' | 'bench' | 'deadlift';

export type Maxes = Record<LiftKey, number> & { weightedPullupWeight: number };

const MAXES_KEY = '@user_maxes';
const COMPLETED_KEY = '@completed_workouts';

export const defaultMaxes: Maxes = {
  squat: 0,
  bench: 0,
  deadlift: 0,
  weightedPullupWeight: 0,
};

const liftKeys: LiftKey[] = ['squat', 'bench', 'deadlift'];

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeMaxes(value: unknown): Maxes {
  const result: Maxes = { ...defaultMaxes };
  if (typeof value !== 'object' || value === null) {
    return result;
  }

  for (const key of liftKeys) {
    // @ts-expect-error dynamic lookup
    result[key] = toNumber(value[key]);
  }
  result.weightedPullupWeight = toNumber((value as Record<string, unknown>).weightedPullupWeight);

  return result;
}

export async function loadMaxes(): Promise<Maxes> {
  try {
    const raw = await AsyncStorage.getItem(MAXES_KEY);
    if (!raw) return defaultMaxes;
    return normalizeMaxes(JSON.parse(raw));
  } catch {
    return defaultMaxes;
  }
}

export async function saveMaxes(maxes: Maxes) {
  await AsyncStorage.setItem(MAXES_KEY, JSON.stringify(normalizeMaxes(maxes)));
}

export async function loadCompleted(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_KEY);
    if (!raw) return [];
    const parsed = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    return parsed.filter((item: unknown): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export async function saveCompleted(ids: string[]) {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string')));
  await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(unique));
}

export async function clearCompleted() {
  await AsyncStorage.removeItem(COMPLETED_KEY);
}
