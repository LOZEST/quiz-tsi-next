import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgramIndex, validateProgram } from '@domain/program/Program';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';
import { initialFreeRevisionFilters } from '@features/session/RevisionExperienceProvider';
import type { RevisionExperienceState } from '@features/session/RevisionExperienceProvider';
import type * as RevisionExperienceModule from '@features/session/RevisionExperienceProvider';
import type { FreeRevisionFilters, SessionMode } from '@domain/session/Session';

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
const setMode = vi.fn((value: SessionMode) => {
  mode = value;
});
const setVisibleFilters = vi.fn((value: FreeRevisionFilters) => {
  filters = value;
});

vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    programIndex,
    questionRepository: new InMemoryQuestionRepository(),
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
    vi.clearAllMocks();
  });
  it('shows the exact four paths and ordered dependent filters', async () => {
    const user = userEvent.setup();
    const view = render(<RevisionDrawerPanel />);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(
      screen
        .getAllByRole('combobox')
        .map(
          (item) => item.parentElement?.textContent?.split(/Toutes|Tous/)[0],
        ),
    ).toEqual([
      'Partie',
      'Chapitre',
      'Notion',
      'Type de question',
      'Difficulté',
    ]);
    await user.selectOptions(screen.getByLabelText('Partie'), 'p1');
    expect(setVisibleFilters).toHaveBeenCalled();
    filters = setVisibleFilters.mock.calls.at(-1)?.[0] ?? filters;
    view.rerender(<RevisionDrawerPanel />);
    expect(
      screen.getByRole('option', { name: 'Partie 1 — Chapitre' }),
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

  it('configures chapter tests without a start action', async () => {
    mode = 'chapter-test';
    const user = userEvent.setup();
    render(<RevisionDrawerPanel />);
    await user.selectOptions(screen.getByLabelText('Chapitre'), 'c1');
    await user.click(screen.getByLabelText('40'));
    expect(
      screen.getByText(/assez de questions validées.*40 questions/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Commencer/ })).toBeNull();
  });
});
