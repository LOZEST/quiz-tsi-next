import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgramIndex, validateProgram } from '@domain/program/Program';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';
import { initialFreeRevisionFilters } from '@features/session/RevisionExperienceProvider';
import type { RevisionExperienceState } from '@features/session/RevisionExperienceProvider';
import type * as RevisionExperienceModule from '@features/session/RevisionExperienceProvider';
import type {
  DailyPlanItem,
  FreeRevisionFilters,
  SessionMode,
  WeakPointItem,
} from '@domain/session/Session';
import type { Quizz } from '@domain/questions/quizz/Quizz';
import type { SubscribedQuizzContent } from '@domain/quizz/QuizzMarketplaceGateway';
import type { RevisionSeriesSession } from '@domain/session/RevisionSeries';
import type { DailyActivation } from '@domain/repositories/RevisionStateRepositories';

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
let subscribedQuizzes: readonly SubscribedQuizzContent[] = [];
let activeSeries: RevisionSeriesSession | null = null;
let dailyActivations: readonly DailyActivation[] = [];
const setMode = vi.fn((value: SessionMode) => {
  mode = value;
});
const setVisibleFilters = vi.fn(
  (value: FreeRevisionFilters, trigger?: HTMLElement) => {
    void trigger;
    filters = value;
  },
);
const startDailyItem = vi.fn<
  (item: DailyPlanItem, unitLabel: string) => boolean
>(() => true);
const startConsolidationItem = vi.fn<
  (item: WeakPointItem, unitLabel: string) => boolean
>(() => true);
const exitSeries = vi.fn();
const activateDailyUnit = vi.fn(() => Promise.resolve());
const deactivateDailyUnit = vi.fn(() => Promise.resolve());
const listDailyActivations = vi.fn(() => Promise.resolve(dailyActivations));

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
    quizzMarketplaceGateway: {
      listSubscribedQuizzContent: () => Promise.resolve(subscribedQuizzes),
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
      activeSeries,
      startDailyItem,
      startConsolidationItem,
      exitSeries,
      activateDailyUnit,
      deactivateDailyUnit,
      listDailyActivations,
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
    subscribedQuizzes = [];
    activeSeries = null;
    dailyActivations = [];
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
  ])('renders daily states', async (daily, text) => {
    mode = 'daily';
    state = { kind: 'daily', state: daily };
    render(<RevisionDrawerPanel />);
    expect(await screen.findByText(text)).toBeInTheDocument();
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

  it('lists the user’s quizz as a chapter option in free mode after switching source, and in chapter-test, and disables Notion once selected', async () => {
    quizzes = [
      {
        id: 'quizz-1',
        ownerId: 'user-1',
        title: 'Mon quizz',
        description: '',
        visibility: 'private',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
      },
    ];
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    await user.click(await screen.findByRole('button', { name: 'Mes quizz' }));
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

  it('lists a marketplace-subscribed quizz (not owned) as a chapter option in free mode and chapter-test', async () => {
    subscribedQuizzes = [
      {
        listingId: 'listing-1',
        quizzId: 'quizz-owned-by-someone-else',
        ownerId: 'other-user',
        title: 'Quizz ajouté',
        description: '',
        certified: false,
        questions: [],
      },
    ];
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    await user.click(await screen.findByRole('button', { name: 'Mes quizz' }));
    expect(
      await screen.findByRole('option', { name: 'Quizz ajouté' }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText('Chapitre'),
      'quizz-owned-by-someone-else',
    );
    expect(setVisibleFilters).toHaveBeenCalled();
    filters = setVisibleFilters.mock.calls.at(-1)?.[0] ?? filters;
    expect(filters.chapter).toEqual({
      kind: 'one',
      value: 'quizz-owned-by-someone-else',
    });

    mode = 'chapter-test';
    const testView = render(<RevisionDrawerPanel />);
    expect(
      testView.getByRole('option', { name: 'Quizz ajouté' }),
    ).toBeInTheDocument();
  });

  it('lists a quizz only once when the user is both its owner and a subscriber to its own listing', async () => {
    quizzes = [
      {
        id: 'quizz-1',
        ownerId: 'user-1',
        title: 'Mon quizz',
        description: '',
        visibility: 'public',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
      },
    ];
    subscribedQuizzes = [
      {
        listingId: 'listing-1',
        quizzId: 'quizz-1',
        ownerId: 'user-1',
        title: 'Mon quizz',
        description: '',
        certified: false,
        questions: [],
      },
    ];
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    await user.click(await screen.findByRole('button', { name: 'Mes quizz' }));
    expect(
      await screen.findAllByRole('option', { name: 'Mon quizz' }),
    ).toHaveLength(1);
  });

  it('shows the source toggle only when the user has quizzes', () => {
    quizzes = [];
    render(<RevisionDrawerPanel />);
    expect(
      screen.queryByRole('group', { name: 'Source des questions' }),
    ).toBeNull();
  });

  it('resets the chapter/notion selection when switching source', async () => {
    quizzes = [
      {
        id: 'quizz-1',
        ownerId: 'user-1',
        title: 'Mon quizz',
        description: '',
        visibility: 'private',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
      },
    ];
    filters = {
      ...initialFreeRevisionFilters,
      chapter: { kind: 'one', value: 'c1' },
    };
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    await user.click(await screen.findByRole('button', { name: 'Mes quizz' }));
    expect(setVisibleFilters).toHaveBeenCalled();
    filters = setVisibleFilters.mock.calls.at(-1)?.[0] ?? filters;
    expect(filters.chapter).toEqual({ kind: 'all' });
    expect(filters.notion).toEqual({ kind: 'all' });
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
        deletedAt: null,
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

  it('renders a clickable bubble for a due daily item and launches its series on click', async () => {
    mode = 'daily';
    state = {
      kind: 'daily',
      state: {
        kind: 'ready',
        items: [
          {
            notionId: 'n1',
            plannedCount: 3,
            successCount: 1,
            partialCount: 0,
            failedCount: 0,
            reason: 'Révision arrivée à échéance.',
            recommendedDifficulty: 'standard',
            dueAt: null,
          },
        ],
      },
    };
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    const bubble = await screen.findByRole('button', { name: /Notion/ });
    expect(bubble).toHaveTextContent('2 à faire aujourd’hui');
    await user.click(bubble);
    expect(startDailyItem).toHaveBeenCalledTimes(1);
    expect(startDailyItem.mock.calls[0]?.[0]).toMatchObject({ notionId: 'n1' });
    expect(startDailyItem.mock.calls[0]?.[1]).toBe('Notion');
  });

  it('excludes an already-completed daily item from the bubble list', async () => {
    mode = 'daily';
    state = {
      kind: 'daily',
      state: {
        kind: 'ready',
        items: [
          {
            notionId: 'n1',
            plannedCount: 2,
            successCount: 2,
            partialCount: 0,
            failedCount: 0,
            reason: 'x',
            recommendedDifficulty: 'standard',
            dueAt: null,
          },
        ],
      },
    };
    render(<RevisionDrawerPanel />);
    await screen.findByRole('button', {
      name: 'Gérer mes révisions régulières',
    });
    expect(screen.queryByRole('button', { name: /Notion/ })).toBeNull();
  });

  it('renders a clickable bubble for a weak point and launches consolidation on click', async () => {
    mode = 'weak-points';
    state = {
      kind: 'weak-points',
      state: {
        kind: 'ready',
        items: [
          {
            notionId: 'n1',
            priority: 1,
            recommendedDifficulty: 'fundamental',
            rationale: 'x',
            masteryEstimate: 40,
            lastActivityAt: null,
            successCount: 1,
            partialCount: 1,
            failedCount: 2,
            recurringErrors: [],
          },
        ],
      },
    };
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    const bubble = screen.getByRole('button', { name: /Notion/ });
    expect(bubble).toHaveTextContent('Priorité 1');
    await user.click(bubble);
    expect(startConsolidationItem).toHaveBeenCalledTimes(1);
    expect(startConsolidationItem.mock.calls[0]?.[0]).toMatchObject({
      notionId: 'n1',
    });
    expect(startConsolidationItem.mock.calls[0]?.[1]).toBe('Notion');
  });

  it('activates a notion for daily rotation through the management form', async () => {
    mode = 'daily';
    state = { kind: 'daily', state: { kind: 'none-scheduled' } };
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Gérer mes révisions régulières',
      }),
    );
    await user.selectOptions(screen.getByLabelText('Chapitre'), 'c1');
    await user.selectOptions(screen.getByLabelText('Notion'), 'n1');
    await user.click(screen.getByRole('button', { name: 'Activer' }));
    expect(activateDailyUnit).toHaveBeenCalledWith('n1');
  });

  it('lists an activated unit and removes it via Retirer', async () => {
    mode = 'daily';
    state = { kind: 'daily', state: { kind: 'none-scheduled' } };
    dailyActivations = [
      { unitId: 'n1', activatedAt: '2026-08-09T00:00:00.000Z' },
    ];
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Gérer mes révisions régulières',
      }),
    );
    const remove = await screen.findByRole('button', { name: 'Retirer' });
    await user.click(remove);
    expect(deactivateDailyUnit).toHaveBeenCalledWith('n1');
  });

  it('shows series progress and exits back to the list', async () => {
    mode = 'daily';
    state = { kind: 'no-bank', message: 'vide' };
    activeSeries = {
      blueprint: {
        kind: 'daily',
        unitLabel: 'Notion 1',
        orderedQuestionInstances: [{}, {}, {}],
      },
      currentIndex: 1,
      status: 'active',
    } as unknown as RevisionSeriesSession;
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    expect(screen.getByText('Question 2 / 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitter la série' }));
    expect(exitSeries).toHaveBeenCalledTimes(1);
  });
});
