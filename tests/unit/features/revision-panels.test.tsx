import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgramIndex, validateProgram } from '@domain/program/Program';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';
import { initialFreeRevisionFilters } from '@features/session/RevisionExperienceProvider';
import type { RevisionExperienceState } from '@features/session/RevisionExperienceProvider';
import type * as RevisionExperienceModule from '@features/session/RevisionExperienceProvider';
import type { FreeRevisionFilters, SessionMode } from '@domain/session/Session';
import type { Quizz } from '@domain/questions/quizz/Quizz';

const parsed = validateProgram({
  schemaVersion: 1,
  parts: [
    { id: 'p1', label: 'Partie 1', order: 0 },
    { id: 'p2', label: 'Partie 2', order: 1 },
  ],
  chapters: [
    { id: 'c1', partId: 'p1', label: 'Chapitre', order: 0 },
    { id: 'c2', partId: 'p2', label: 'Chapitre', order: 0 },
  ],
  notions: [
    { id: 'n1', chapterId: 'c1', label: 'Notion', order: 0 },
    { id: 'n2', chapterId: 'c2', label: 'Notion', order: 0 },
  ],
});
if (!parsed.ok) throw new Error('fixture');
const programIndex = createProgramIndex(parsed.value);
let mode: SessionMode = 'free';
let state: RevisionExperienceState = { kind: 'no-bank', message: 'vide' };
let filters: FreeRevisionFilters = initialFreeRevisionFilters;
let quizzes: readonly Quizz[] = [];
const setMode = vi.fn((value: SessionMode) => {
  mode = value;
});
const setVisibleFilters = vi.fn(
  (value: FreeRevisionFilters, trigger?: HTMLElement) => {
    void trigger;
    filters = value;
  },
);

vi.mock('@app/providers/AuthProvider', () => ({
  useAuth: () => ({
    state: {
      status: 'authenticated',
      session: { user: { id: 'user-1', role: 'user' } },
    },
  }),
}));
vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    programIndex,
    questionRepository: new InMemoryQuestionRepository(),
    questionWorkspaceRepository: {
      load: () =>
        Promise.resolve({
          questions: [],
          quizzes,
          pendingOperationCount: 0,
          conflicts: [],
        }),
    },
  }),
}));
vi.mock('@features/session/RevisionExperienceProvider', async (original) => {
  const actual = await original<typeof RevisionExperienceModule>();
  return {
    ...actual,
    useRevisionExperience: () => ({
      mode,
      state,
      activeFilters: initialFreeRevisionFilters,
      visibleFilters: filters,
      setMode,
      setVisibleFilters,
      nextQuestion: vi.fn(),
      pendingChange: false,
      cancelChange: vi.fn(),
      confirmChange: vi.fn(),
    }),
  };
});

import { RevisionDrawerPanel } from '@features/session/RevisionDrawerPanel';

describe('RevisionDrawerPanel', () => {
  beforeEach(() => {
    mode = 'free';
    state = { kind: 'no-bank', message: 'vide' };
    filters = initialFreeRevisionFilters;
    quizzes = [];
    vi.clearAllMocks();
  });
  it('shows the exact four paths and ordered dependent filters', async () => {
    const user = userEvent.setup();
    const view = render(<RevisionDrawerPanel />);
    const sessionType = screen.getByLabelText('Type de séance');
    expect(sessionType).toHaveValue('free');
    expect(screen.queryByRole('radio')).toBeNull();
    expect(
      screen
        .getAllByRole('combobox')
        .map(
          (item) => item.parentElement?.textContent?.split(/Toutes|Tous/)[0],
        ),
    ).toEqual([
      'Type de séanceRévision du jourConsolidation des points faiblesRévision libreTest de chapitres',
      'Partie',
      'Chapitre',
      'Notion',
      'Type de question',
      'Difficulté',
    ]);
    expect(screen.getByRole('group', { name: 'Partie 1' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Partie 2' })).toBeVisible();
    expect(screen.queryByText('Partie 1 — Chapitre')).toBeNull();
    await user.selectOptions(sessionType, 'daily');
    expect(setMode).toHaveBeenCalledWith('daily', sessionType);
    mode = 'free';
    await user.selectOptions(screen.getByLabelText('Partie'), 'p1');
    expect(setVisibleFilters).toHaveBeenCalled();
    filters = setVisibleFilters.mock.calls.at(-1)?.[0] ?? filters;
    view.rerender(<RevisionDrawerPanel />);
    expect(
      screen.getByRole('option', { name: 'Chapitre' }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText('Type de question'),
      'reflex',
    );
    filters = setVisibleFilters.mock.calls.at(-1)?.[0] ?? filters;
    view.rerender(<RevisionDrawerPanel />);
    expect(screen.queryByLabelText('Difficulté')).toBeNull();
    expect(filters.difficulty.kind).toBe('not-applicable');
    await user.selectOptions(screen.getByLabelText('Type de question'), '');
    filters = setVisibleFilters.mock.calls.at(-1)?.[0] ?? filters;
    expect(filters.difficulty.kind).toBe('all');
    expect(screen.queryByRole('button', { name: 'Appliquer' })).toBeNull();
    expect(setVisibleFilters).toHaveBeenCalledTimes(3);
    expect(setVisibleFilters.mock.calls[0]?.[1]).toBe(
      screen.getByLabelText('Partie'),
    );
  });

  it.each([
    [
      { kind: 'none-scheduled' } as const,
      'Aucune révision n’est prévue aujourd’hui. Tu es à jour.',
    ],
    [
      { kind: 'completed', items: [] } as const,
      'Révision du jour terminée. Toutes les notions prévues ont été révisées.',
    ],
    [
      { kind: 'unavailable', message: 'Indisponible.' } as const,
      'Indisponible.',
    ],
  ])('renders daily states', (daily, text) => {
    mode = 'daily';
    state = { kind: 'daily', state: daily };
    render(<RevisionDrawerPanel />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('renders determined and indeterminate weak point calibration', () => {
    mode = 'weak-points';
    state = {
      kind: 'weak-points',
      state: {
        kind: 'calibrating',
        message: 'x',
        evidence: {
          observedEvidence: 2,
          requiredEvidence: 5,
          coveredNotions: null,
          requiredCoveredNotions: null,
        },
      },
    };
    const view = render(<RevisionDrawerPanel />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '2');
    state = {
      kind: 'weak-points',
      state: { kind: 'calibrating', message: 'x', evidence: null },
    };
    view.rerender(<RevisionDrawerPanel />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('value');
  });

  it('configures chapter tests and guards the start action by stock', async () => {
    mode = 'chapter-test';
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    await user.selectOptions(screen.getByLabelText('Chapitre'), 'c1');
    await user.click(screen.getByLabelText('40'));
    expect(
      screen.getByText(/assez de questions validées.*40 questions/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Commencer/ })).toBeDisabled();
  });

  it('lists the user’s quizz as a chapter option in free mode and chapter-test, and disables Notion once selected', async () => {
    quizzes = [
      {
        id: 'quizz-1',
        ownerId: 'user-1',
        title: 'Mon quizz',
        description: '',
        visibility: 'private',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    expect(
      await screen.findByRole('option', { name: 'Mon quizz' }),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Chapitre'), 'quizz-1');
    expect(setVisibleFilters).toHaveBeenCalled();
    filters = setVisibleFilters.mock.calls.at(-1)?.[0] ?? filters;
    expect(filters.chapter).toEqual({ kind: 'one', value: 'quizz-1' });
    expect(filters.notion).toEqual({ kind: 'all' });

    mode = 'chapter-test';
    const testView = render(<RevisionDrawerPanel />);
    expect(
      testView.getByRole('option', { name: 'Mon quizz' }),
    ).toBeInTheDocument();
  });

  it('résout le libellé Daily/Weak via le titre du quizz quand la notion officielle est introuvable', async () => {
    quizzes = [
      {
        id: 'quizz-1',
        ownerId: 'user-1',
        title: 'Mon quizz',
        description: '',
        visibility: 'private',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    mode = 'daily';
    state = {
      kind: 'daily',
      state: {
        kind: 'ready',
        items: [
          {
            notionId: 'quizz-1',
            plannedCount: 2,
            successCount: 0,
            partialCount: 0,
            failedCount: 0,
            reason: 'Plan',
            recommendedDifficulty: 'standard',
            dueAt: null,
          },
        ],
      },
    };
    render(<RevisionDrawerPanel />);
    expect(await screen.findByText('Mon quizz')).toBeInTheDocument();
  });
});
