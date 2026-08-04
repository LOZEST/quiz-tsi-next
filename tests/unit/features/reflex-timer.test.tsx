import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Clock } from '@domain/repositories/RevisionStateRepositories';
import { ReflexTimer } from '@features/session/ReflexTimer';
import { QuestionCard } from '@features/questions/QuestionCard';
import { AppServicesProvider } from '@app/providers/AppServicesProvider';
import type { Question } from '@domain/questions/Question';
import type { PreparedQuestion } from '@domain/questions/PreparedQuestion';
import userEvent from '@testing-library/user-event';

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
    const view = render(
      <ReflexTimer activationKey="q1" clock={clock} deadline={61_000} />,
    );
    expect(screen.getByText('60 s restantes')).toBeInTheDocument();
    act(() => clock.advance(1_100));
    expect(screen.getByText('59 s restantes')).toBeInTheDocument();
    view.rerender(
      <ReflexTimer activationKey="q1" clock={clock} deadline={61_000} />,
    );
    expect(screen.getByText('59 s restantes')).toBeInTheDocument();
    act(() => clock.advance(60_000));
    expect(
      screen.getByText('Temps dépassé — tu peux continuer.'),
    ).toBeInTheDocument();
  });

  it('keeps the same deadline while the card is reduced, reopened or rerendered', async () => {
    const clock = new ControlledClock();
    const reflexQuestion = {
      id: 'reflex',
      version: 1,
      source: 'static',
      ownerId: null,
      status: 'published',
      provenance: null,
      partId: 'p',
      chapterId: 'c',
      notionId: 'n',
      type: 'reflex',
      difficulty: null,
      parameterization: null,
      prompt: [{ kind: 'text', value: 'Question réflexe' }],
      hint: [],
      correction: [],
      tags: [],
      validated: true,
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
    } satisfies Question;
    const prepared = (seed: string): PreparedQuestion => ({
      questionId: 'reflex',
      questionVersion: 1,
      seed,
      parameterValues: {},
      content: {
        questionId: 'reflex',
        questionVersion: 1,
        parameterValues: {},
        prompt: [{ kind: 'text', value: 'Question réflexe' }],
        hint: [],
        correction: [],
      },
    });
    const services = {
      authGateway: {
        getCurrentSession: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        subscribeToAuthChanges: vi.fn(),
      },
      workspaceRepository: {
        open: vi.fn(),
        cacheValidatedProfile: vi.fn(),
        getCachedProfile: vi.fn(),
        close: vi.fn(),
        delete: vi.fn(),
        isGenerationActive: vi.fn(),
      },
      clock,
    };
    const user = userEvent.setup();
    const view = render(
      <AppServicesProvider services={services}>
        <QuestionCard
          prepared={prepared('seed-1')}
          question={reflexQuestion}
          reflexDeadline={61_000}
          onNext={vi.fn()}
        />
      </AppServicesProvider>,
    );
    act(() => clock.advance(5_100));
    expect(screen.getByText('55 s restantes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réduire' }));
    act(() => clock.advance(5_000));
    await user.click(
      screen.getByRole('button', { name: 'Afficher la question' }),
    );
    expect(screen.getByText('50 s restantes')).toBeInTheDocument();
    view.rerender(
      <AppServicesProvider services={services}>
        <QuestionCard
          prepared={prepared('seed-1')}
          question={reflexQuestion}
          reflexDeadline={61_000}
          onNext={vi.fn()}
        />
      </AppServicesProvider>,
    );
    expect(screen.getByText('50 s restantes')).toBeInTheDocument();
    view.rerender(
      <AppServicesProvider services={services}>
        <QuestionCard
          prepared={prepared('seed-2')}
          question={reflexQuestion}
          reflexDeadline={clock.now() + 60_000}
          onNext={vi.fn()}
        />
      </AppServicesProvider>,
    );
    expect(screen.getByText('60 s restantes')).toBeInTheDocument();
  });
});
