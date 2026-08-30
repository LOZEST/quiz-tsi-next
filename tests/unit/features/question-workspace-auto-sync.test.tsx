import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clock } from '@domain/repositories/RevisionStateRepositories';

class ControlledClock implements Clock {
  time = 1_000;
  callback: (() => void) | null = null;
  now = () => this.time;
  setInterval = (callback: () => void) => {
    this.callback = callback;
    return 1;
  };
  clearInterval = () => {
    this.callback = null;
  };
  advance(milliseconds: number) {
    this.time += milliseconds;
    this.callback?.();
  }
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

let authStatus: 'authenticated' | 'anonymous' = 'authenticated';
let userId = 'user-1';
let clock: ControlledClock;
const syncQuestionWorkspaceForUser = vi.fn(() =>
  Promise.resolve({ ok: true as const }),
);

vi.mock('@app/providers/AuthProvider', () => ({
  useAuth: () => ({
    state:
      authStatus === 'authenticated'
        ? { status: 'authenticated', session: { user: { id: userId } } }
        : { status: 'anonymous' },
  }),
}));
vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({ syncQuestionWorkspaceForUser, clock }),
}));

import { useQuestionWorkspaceAutoSync } from '@features/questions/useQuestionWorkspaceAutoSync';

function Host() {
  useQuestionWorkspaceAutoSync();
  return null;
}

describe('useQuestionWorkspaceAutoSync', () => {
  beforeEach(() => {
    authStatus = 'authenticated';
    userId = 'user-1';
    clock = new ControlledClock();
    syncQuestionWorkspaceForUser.mockClear();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('syncs on the periodic timer while online', () => {
    render(<Host />);
    expect(syncQuestionWorkspaceForUser).not.toHaveBeenCalled();
    act(() => clock.advance(FIVE_MINUTES_MS));
    expect(syncQuestionWorkspaceForUser).toHaveBeenCalledWith('user-1');
  });

  it('does not sync on the timer while offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    render(<Host />);
    act(() => clock.advance(FIVE_MINUTES_MS));
    expect(syncQuestionWorkspaceForUser).not.toHaveBeenCalled();
  });

  it('syncs when the device comes back online', () => {
    render(<Host />);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(syncQuestionWorkspaceForUser).toHaveBeenCalledWith('user-1');
  });

  it('does nothing while signed out', () => {
    authStatus = 'anonymous';
    render(<Host />);
    act(() => clock.advance(FIVE_MINUTES_MS));
    expect(syncQuestionWorkspaceForUser).not.toHaveBeenCalled();
  });

  it('stops ticking and listening once unmounted', () => {
    const view = render(<Host />);
    view.unmount();
    act(() => clock.advance(FIVE_MINUTES_MS));
    expect(syncQuestionWorkspaceForUser).not.toHaveBeenCalled();
  });
});
