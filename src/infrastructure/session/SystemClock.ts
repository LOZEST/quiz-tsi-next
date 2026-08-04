import type { Clock } from '@domain/repositories/RevisionStateRepositories';

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
  setInterval(callback: () => void, milliseconds: number): unknown {
    return globalThis.setInterval(callback, milliseconds);
  }
  clearInterval(handle: unknown): void {
    globalThis.clearInterval(handle as ReturnType<typeof setInterval>);
  }
}
