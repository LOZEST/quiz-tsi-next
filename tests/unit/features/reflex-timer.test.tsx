import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Clock } from '@domain/repositories/RevisionStateRepositories';
import { ReflexTimer } from '@features/session/ReflexTimer';

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

describe('ReflexTimer', () => {
  it('starts at 60, keeps its deadline on rerender and remains non blocking after zero', () => {
    const clock = new ControlledClock();
    const view = render(<ReflexTimer activationKey="q1" clock={clock} />);
    expect(screen.getByText('60 s restantes')).toBeInTheDocument();
    act(() => clock.advance(1_100));
    expect(screen.getByText('59 s restantes')).toBeInTheDocument();
    view.rerender(<ReflexTimer activationKey="q1" clock={clock} />);
    expect(screen.getByText('59 s restantes')).toBeInTheDocument();
    act(() => clock.advance(60_000));
    expect(
      screen.getByText('Temps dépassé — tu peux continuer.'),
    ).toBeInTheDocument();
  });
});
