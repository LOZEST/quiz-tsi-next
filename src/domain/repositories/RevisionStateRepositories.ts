import type { DailyPlanState, WeakPointsState } from '../session/Session';

export interface DailyPlanStateRepository {
  getState(userId?: string, signal?: AbortSignal): Promise<DailyPlanState>;
}

export interface WeakPointsStateRepository {
  getState(userId?: string, signal?: AbortSignal): Promise<WeakPointsState>;
}

export interface RevisionSeedSource {
  nextSeed(): string;
}

export interface Clock {
  now(this: void): number;
  setInterval(this: void, callback: () => void, milliseconds: number): unknown;
  clearInterval(this: void, handle: unknown): void;
}
