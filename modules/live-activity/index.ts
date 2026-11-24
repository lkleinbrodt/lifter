// JS face of the local LiveActivity module (ios/LiveActivityModule.swift). Optional: on web,
// Android, or a build without the module, every call is a no-op.

import { requireOptionalNativeModule } from 'expo';

type EventSubscription = { remove(): void };

type LiveActivityNative = {
  isSupported(): boolean;
  sync(json: string): Promise<void>;
  end(): Promise<void>;
  takePendingActions(): string[];
  addListener(event: 'onAction', listener: () => void): EventSubscription;
};

const native = requireOptionalNativeModule<LiveActivityNative>('LiveActivity');

export type LiveNextSet = {
  setId: string;
  name: string;
  detail: string;
  numbers: string;
  canCheck: boolean;
  /** Barbell sets only: plates per side, heaviest first ([] = empty bar). */
  plates?: number[];
};

/** Mirrors LifterActivityAttributes.ContentState. Dates are epoch ms. */
export type LiveState = {
  restEndsAt?: number;
  restStartedAt?: number;
  lastDoneAt?: number;
  next?: LiveNextSet;
  afterCheck?: LiveNextSet;
  afterCheckRestSec: number;
  doneSets: number;
  totalSets: number;
};

export type LiveAttributes = { workoutName: string; startedAt: number };

export type LiveAction = { type: 'check'; setId: string } | { type: 'addRest'; seconds: string } | { type: 'skipRest' };

export const liveActivityAvailable = !!native;

export function isSupported() {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

export async function sync(attributes: LiveAttributes, state: LiveState) {
  await native?.sync(JSON.stringify({ attributes, state }));
}

export async function end() {
  await native?.end();
}

export function takePendingActions(): LiveAction[] {
  if (!native) return [];
  return native.takePendingActions().flatMap((json) => {
    try {
      return [JSON.parse(json) as LiveAction];
    } catch {
      return [];
    }
  });
}

export function addActionListener(listener: () => void): EventSubscription | undefined {
  return native?.addListener('onAction', listener);
}
