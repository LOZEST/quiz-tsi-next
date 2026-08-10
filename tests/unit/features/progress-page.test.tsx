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

import { ProgressPage } from '@pages/ProgressPage/ProgressPage';

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
    expect(screen.getByTestId('secondary-indicators').children).toHaveLength(3);
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
    await user.click(screen.getByRole('button', { name: /Nombres.*100 %/i }));
    await user.click(
      screen.getByRole('button', { name: /Nombres et arithmétique/i }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('notion-details')).toBeVisible(),
    );
  });
});
