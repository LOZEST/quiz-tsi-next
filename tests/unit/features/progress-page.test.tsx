import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productionProgramIndex } from '@infrastructure/session/ProductionRevisionServices';

const evaluations: unknown[] = [];
vi.mock('@app/providers/AuthProvider', () => ({
  useAuth: () => ({
    state: { status: 'authenticated', session: { user: { id: 'u1' } } },
  }),
}));
vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    evaluationRepository: { listByUser: () => Promise.resolve(evaluations) },
    chapterTestRepository: { listByUser: () => Promise.resolve([]) },
    programIndex: productionProgramIndex,
    clock: { now: () => Date.parse('2026-08-10T12:00:00.000Z') },
  }),
}));

import {
  ProgressContent,
  ProgressPage,
} from '@pages/ProgressPage/ProgressPage';
import type { ProgressSnapshot } from '@domain/progress/ProgressSnapshot';
import type { MasteryEvent } from '@domain/mastery/MasteryEvent';

const base = {
  id: 'e1',
  userId: 'u1',
  sessionId: 'free:s1',
  questionInstanceId: 'i1',
  questionId: 'q1',
  questionVersion: 1,
  questionSource: 'static',
  partId: 'numbers',
  chapterId: 'numbers-arithmetic',
  notionId: 'NUM-F01',
  questionType: 'course',
  difficulty: 'standard',
  hintUsed: false,
  timeExceeded: false,
  outcome: 'success',
  startedAt: '2026-08-09T10:00:00.000Z',
  completedAt: '2026-08-09T10:01:00.000Z',
};

describe('ProgressPage', () => {
  beforeEach(() => {
    evaluations.splice(0);
  });
  it('shows calibration instead of a false zero with one primary and three secondary indicators', async () => {
    render(<ProgressPage />);
    expect(await screen.findByText('Calibration en cours')).toBeVisible();
    expect(screen.getAllByTestId('primary-indicator')).toHaveLength(1);
    expect(screen.getByTestId('secondary-indicators').children).toHaveLength(4);
    expect(screen.queryByTestId('notion-details')).toBeNull();
  });

  it('signals partial data and reveals notion detail only after voluntary actions', async () => {
    evaluations.push(base, {
      ...base,
      id: 'legacy',
      sessionId: 'legacy-session',
    });
    const user = userEvent.setup();
    render(<ProgressPage />);
    expect(
      await screen.findByText(/progression affichée est partielle/i),
    ).toBeVisible();
    expect(screen.queryByTestId('notion-details')).toBeNull();
    await user.click(
      screen.getByRole('button', {
        name: /Bases indispensables.*100 %/i,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: /Nombres et arithmétique/i }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('notion-details')).toBeVisible(),
    );
    expect(screen.getByText('En découverte')).toBeVisible();
    expect(screen.queryByText('discovery')).toBeNull();
    expect(screen.queryByText('Tests de chapitre liés')).toBeNull();
    expect(
      screen.queryByText('Disponibles dans l’historique des séances'),
    ).toBeNull();
  });

  const event = (
    result: MasteryEvent['result'],
    sessionMode: MasteryEvent['sessionMode'],
  ): MasteryEvent => ({
    id: `event-${result}-${sessionMode}`,
    userId: 'u1',
    notionId: 'NUM-F01',
    questionId: 'q1',
    sessionId: `${sessionMode}:session`,
    questionInstanceId: 'i1',
    questionVersion: 1,
    sessionMode,
    result,
    hintUsed: false,
    timeLimitExceeded: false,
    durationMs: 1_000,
    occurredAt: '2026-08-10T10:00:00.000Z',
  });

  const richSnapshot = (
    dailyPlan: ProgressSnapshot['dailyPlan'],
  ): ProgressSnapshot => ({
    partial: false,
    globalMastery: 72,
    globalConfidence: 81,
    globalMasteryDelta: 5,
    dueCount: 2,
    lastSevenDaysActivity: 6,
    streakDays: 3,
    weeklyAccuracy: [
      { weekStart: '2026-07-20', accuracy: 60, count: 4 },
      { weekStart: '2026-07-27', accuracy: 65, count: 5 },
      { weekStart: '2026-08-03', accuracy: null, count: 0 },
      { weekStart: '2026-08-10', accuracy: 80, count: 6 },
    ],
    parts: [
      {
        id: 'numbers',
        label: 'Nombres',
        masteryScore: 72,
        confidenceScore: 81,
        notions: [
          {
            notionId: 'NUM-F01',
            label: 'Calcul d’une expression',
            chapterLabel: 'Nombres et arithmétique',
            masteryScore: 72,
            confidenceScore: 81,
            status: 'solid',
            lastReviewedAt: null,
            nextReviewAt: null,
            evidenceCount: 9,
            recommendedDifficulty: 'standard',
            stabilityDays: 8,
            lastResult: 'success',
            totalWeight: 7,
          },
        ],
      },
      {
        id: 'empty',
        label: 'Partie sans données',
        masteryScore: null,
        confidenceScore: null,
        notions: [],
      },
    ],
    calendar: [
      { date: '2026-08-09', count: 0 },
      { date: '2026-08-10', count: 2 },
    ],
    recent: [
      event('success', 'free'),
      event('partial', 'daily'),
      event('failed', 'weak-points'),
      event('skipped', 'chapter-test'),
    ],
    dailyPlan,
    weakPoints: {
      kind: 'ready',
      items: [
        {
          notionId: 'NUM-F01',
          priority: 1,
          rationale: 'Plusieurs réponses sont à consolider.',
          recommendedDifficulty: 'standard',
          lastActivityAt: '2026-08-10T10:00:00.000Z',
          successCount: 2,
          partialCount: 1,
          failedCount: 3,
          recurringErrors: [],
          masteryEstimate: 42,
        },
      ],
    },
  });

  it('renders real mastery, activity, weak points and daily work branches', async () => {
    const user = userEvent.setup();
    render(
      <ProgressContent
        snapshot={richSnapshot({
          kind: 'ready',
          items: [
            {
              notionId: 'NUM-F01',
              plannedCount: 3,
              successCount: 1,
              partialCount: 1,
              failedCount: 1,
              reason: 'Consolidation recommandée.',
              recommendedDifficulty: 'standard',
              dueAt: null,
            },
          ],
        })}
        programIndex={productionProgramIndex}
      />,
    );
    expect(screen.getAllByText('72 %')).toHaveLength(2);
    expect(screen.getByText('81 %')).toBeVisible();
    expect(screen.getByText(/1\/3/)).toBeVisible();
    expect(screen.getByText(/Plusieurs réponses/)).toBeVisible();
    expect(screen.getByText('Réussi')).toBeVisible();
    expect(screen.getByText(/· Révision libre/)).toBeVisible();
    expect(screen.getByText('Partiel')).toBeVisible();
    expect(screen.getByText(/· Révision du jour/)).toBeVisible();
    expect(screen.getByText('Raté')).toBeVisible();
    expect(screen.getByText(/· Points faibles/)).toBeVisible();
    expect(screen.getByText('Passé')).toBeVisible();
    expect(screen.getByText(/· Test de chapitres/)).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: /Partie sans données/i }),
    );
    expect(screen.getAllByText('Pas encore de données')).toHaveLength(2);
    await user.click(
      screen.getByRole('button', { name: /Partie sans données/i }),
    );
    await user.click(screen.getByRole('button', { name: /Nombres.*72 %/i }));
    await user.click(
      screen.getByRole('button', { name: /Nombres et arithmétique/i }),
    );
    expect(screen.getByText('Solide')).toBeVisible();
    expect(screen.getAllByText('Pas encore disponible')).toHaveLength(2);
    await user.click(
      screen.getByRole('button', { name: /Nombres et arithmétique/i }),
    );
  });

  it.each([
    [
      { kind: 'completed', items: [] } as ProgressSnapshot['dailyPlan'],
      'Révision du jour terminée',
    ],
    [
      {
        kind: 'unavailable',
        message: 'Plan indisponible.',
      } as ProgressSnapshot['dailyPlan'],
      'Plan indisponible.',
    ],
  ])('renders the %s daily-plan state', (dailyPlan, expected) => {
    render(
      <ProgressContent
        snapshot={{
          ...richSnapshot(dailyPlan),
          recent: [],
          weakPoints: {
            kind: 'unavailable',
            message: 'Points faibles indisponibles.',
          },
        }}
        programIndex={null}
      />,
    );
    expect(screen.getByText(new RegExp(expected))).toBeVisible();
    expect(screen.getByText('Points faibles indisponibles.')).toBeVisible();
    expect(
      screen.getByText('Aucune activité terminée pour le moment.'),
    ).toBeVisible();
  });
});
