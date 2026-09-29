import AsyncStorage from '@react-native-async-storage/async-storage';

export type ProgramKey = '531' | 'gslp';

export type Program = {
  key: ProgramKey;
  name: string;
  description: string;
  href: '/531' | '/gslp';
};

export const programs: Program[] = [
  {
    key: 'gslp',
    name: 'GSLP',
    description: 'Greyskull LP. Alternating A/B sessions, three days a week, weight added every session.',
    href: '/gslp',
  },
  {
    key: '531',
    name: '5/3/1',
    description: 'Modified 5/3/1. Four-week cycles driven by training maxes.',
    href: '/531',
  },
];

const ACTIVE_PROGRAM_KEY = '@active_program';

export function getProgram(key: ProgramKey) {
  return programs.find((program) => program.key === key)!;
}

export function isProgramKey(value: unknown): value is ProgramKey {
  return value === '531' || value === 'gslp';
}

export async function loadActiveProgram(): Promise<ProgramKey | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_PROGRAM_KEY);
    return isProgramKey(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function saveActiveProgram(key: ProgramKey) {
  await AsyncStorage.setItem(ACTIVE_PROGRAM_KEY, key);
}
