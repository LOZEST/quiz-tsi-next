import { useEffect } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  AppServicesProvider,
  type AppServices,
} from '@app/providers/AppServicesProvider';
import {
  WhiteboardProvider,
  useWhiteboard,
} from '@app/providers/WhiteboardProvider';
import {
  RevisionExperienceProvider,
  useRevisionExperience,
} from '@features/session/RevisionExperienceProvider';
import { createProgramIndex, validateProgram } from '@domain/program/Program';
import { validateQuestionBankBundle } from '@domain/questions/QuestionBank';
import type { Question } from '@domain/questions/Question';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';
import type { DailyPlanState } from '@domain/session/Session';
import type { QuestionRepository } from '@domain/repositories/QuestionRepository';

const checkedProgram = validateProgram({
  schemaVersion: 1,
  parts: [{ id: 'p1', label: 'Partie 1', order: 0 }],
  chapters: [{ id: 'c1', partId: 'p1', label: 'Chapitre 1', order: 0 }],
  notions: [{ id: 'n1', chapterId: 'c1', label: 'Notion 1', order: 0 }],
});
if (!checkedProgram.ok) throw new Error('Programme de test invalide.');
const programIndex = createProgramIndex(checkedProgram.value);
const question = (id: string, overrides: Partial<Question> = {}): Question => ({
  id,
  version: 1,
  source: 'static',
  ownerId: null,
  status: 'published',
  provenance: null,
  partId: 'p1',
  chapterId: 'c1',
  notionId: 'n1',
  type: 'course',
  difficulty: 'standard',
  parameterization: null,
  prompt: [{ kind: 'text', value: `Question ${id}` }],
  hint: [],
  correction: [
    { id: 's1', title: null, content: [{ kind: 'text', value: 'Correction' }] },
  ],
  tags: ['test'],
  validated: true,
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
  ...overrides,
});
const parameterized = question('param', {
  parameterization: {
    schemaVersion: 1,
    variables: [
      {
        id: 'x',
        label: 'x',
        domain: { kind: 'choice', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      },
    ],
    constraints: [],
    validationVariantCount: 10,
  },
  prompt: [{ kind: 'text', value: 'Valeur @x' }],
});
const impossibleQuestion = question('impossible', {
  type: 'calculation',
  parameterization: {
    schemaVersion: 1,
    variables: [
      { id: 'x', label: 'x', domain: { kind: 'choice', values: [1] } },
    ],
    constraints: [{ kind: 'literal', value: false }],
    validationVariantCount: 10,
  },
});
class PreparationFailureRepository implements QuestionRepository {
  calls = 0;
  replaceBankAtomically() {}
  getBankMetadata() {
    return {
      bundleId: 'failure',
      schemaVersion: 1,
      generatedAt: '2026-08-04T00:00:00.000Z',
      questionCount: 2,
    };
  }
  listPublished() {
    this.calls += 1;
    return this.calls === 1
      ? [question('q1')]
      : [question('q1'), impossibleQuestion];
  }
  getByIdAndVersion(id: string) {
    return id === 'q1' ? question('q1') : impossibleQuestion;
  }
  getLatestById(id: string) {
    return this.getByIdAndVersion(id);
  }
  query() {
    return this.listPublished();
  }
}
function repository(questions: Question[]) {
  const validated = validateQuestionBankBundle(
    {
      schemaVersion: 1,
      bundleId: 'provider-tests',
      generatedAt: '2026-08-04T00:00:00.000Z',
      defaultProvenance: [
        {
          sourceLabel: 'Fixture originale de test',
          sourceReference: null,
          sourceLocator: 'provider-tests',
        },
      ],
      questions: questions.map((entry) => ({
        question: entry,
        provenance: null,
      })),
    },
    programIndex,
  );
  if (!validated.ok) throw new Error('Banque de test invalide.');
  return new InMemoryQuestionRepository(validated.value);
}
const baseServices = (
  questions: Question[],
  extras: Partial<AppServices> = {},
): AppServices => ({
  authGateway: {
    getCurrentSession: vi.fn().mockResolvedValue(null),
    signInWithPassword: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    subscribeToAuthChanges: vi.fn().mockReturnValue(() => undefined),
  },
  workspaceRepository: {
    open: vi.fn(),
    cacheValidatedProfile: vi.fn().mockResolvedValue(undefined),
    getCachedProfile: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    isGenerationActive: vi.fn().mockReturnValue(true),
  },
  programIndex,
  questionRepository: repository(questions),
  revisionSeedSource: { nextSeed: vi.fn().mockReturnValue('seed-fixed') },
  ...extras,
});

function DraftBinding({ draft, clear }: { draft: boolean; clear: () => void }) {
  const { bindDraft } = useWhiteboard();
  useEffect(() => {
    bindDraft({ hasDraft: () => draft, clear });
    return () => bindDraft(null);
  }, [bindDraft, clear, draft]);
  return null;
}
function Probe() {
  const value = useRevisionExperience();
  return (
    <div>
      <output data-testid="kind">{value.state.kind}</output>
      <output data-testid="question">
        {value.state.kind === 'ready' ? value.state.question.id : 'none'}
      </output>
      <output data-testid="notice">{value.notice}</output>
      <output data-testid="state-message">
        {'message' in value.state ? value.state.message : ''}
      </output>
      <output data-testid="pending">{String(value.pendingChange)}</output>
      <output data-testid="visible-question-type">
        {value.visibleFilters.questionType.kind === 'one'
          ? value.visibleFilters.questionType.value
          : 'all'}
      </output>
      <output data-testid="seed">
        {value.state.kind === 'ready' ? value.state.prepared.seed : 'none'}
      </output>
      <output data-testid="reflex-deadline">
        {value.state.kind === 'ready'
          ? String(value.state.reflexDeadline)
          : 'none'}
      </output>
      <button onClick={(event) => value.nextQuestion(event.currentTarget)}>
        Suivante
      </button>
      <button
        onClick={() =>
          value.setVisibleFilters({
            ...value.visibleFilters,
            questionType: { kind: 'one', value: 'calculation' },
            difficulty: { kind: 'all' },
          })
        }
      >
        Choisir Calcul
      </button>
      <button onClick={() => value.cancelChange()}>Annuler</button>
      <button onClick={() => value.confirmChange()}>Confirmer</button>
      <button onClick={(event) => value.setMode('daily', event.currentTarget)}>
        Daily
      </button>
      <button onClick={(event) => value.setMode('free', event.currentTarget)}>
        Libre
      </button>
    </div>
  );
}
function Harness({
  services,
  draft = false,
  clear = vi.fn(),
}: {
  services: AppServices;
  draft?: boolean;
  clear?: () => void;
}) {
  return (
    <AppServicesProvider services={services}>
      <WhiteboardProvider>
        <DraftBinding draft={draft} clear={clear} />
        <RevisionExperienceProvider userId="test-user">
          <Probe />
        </RevisionExperienceProvider>
      </WhiteboardProvider>
    </AppServicesProvider>
  );
}

describe('RevisionExperienceProvider integration', () => {
  it.each([
    ['absent', null],
    ['present', programIndex],
  ] as const)(
    'prioritizes no-bank when the program is %s',
    async (_label, selectedProgram) => {
      const empty = baseServices([], { programIndex: selectedProgram });
      empty.questionRepository = new InMemoryQuestionRepository();
      render(<Harness services={empty} />);
      await waitFor(() =>
        expect(screen.getByTestId('kind')).toHaveTextContent('no-bank'),
      );
      expect(screen.getByTestId('question')).toHaveTextContent('none');
      expect(screen.getByTestId('notice')).toHaveTextContent('');
    },
  );

  it('returns no-program only when a bank exists and removes stale questions', async () => {
    const readyServices = baseServices([question('q1')]);
    const view = render(<Harness services={readyServices} />);
    await screen.findByText('q1');
    view.rerender(
      <Harness services={{ ...readyServices, programIndex: null }} />,
    );
    await userEvent.click(screen.getByText('Choisir Calcul'));
    await waitFor(() =>
      expect(screen.getByTestId('kind')).toHaveTextContent('no-program'),
    );
    expect(screen.getByTestId('question')).toHaveTextContent('none');
  });

  it('removes a stale question when its repository no longer has a bank', async () => {
    const readyServices = baseServices([question('q1')]);
    const view = render(<Harness services={readyServices} />);
    await screen.findByText('q1');
    view.rerender(
      <Harness
        services={{
          ...readyServices,
          questionRepository: new InMemoryQuestionRepository(),
        }}
      />,
    );
    await userEvent.click(screen.getByText('Choisir Calcul'));
    await waitFor(() =>
      expect(screen.getByTestId('kind')).toHaveTextContent('no-bank'),
    );
    expect(screen.getByTestId('question')).toHaveTextContent('none');
  });

  it('uses the real NUM production composition without controlled fixtures', async () => {
    render(
      <AppServicesProvider>
        <WhiteboardProvider>
          <RevisionExperienceProvider userId="test-user">
            <Probe />
          </RevisionExperienceProvider>
        </WhiteboardProvider>
      </AppServicesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('kind')).toHaveTextContent('ready'),
    );
    expect(screen.getByTestId('question')).toHaveTextContent(/^NUM-/);
    expect(screen.getByTestId('state-message')).toBeEmptyDOMElement();
  });
  it('loads an initial static question with active filters', async () => {
    render(<Harness services={baseServices([question('q1')])} />);
    expect(await screen.findByText('q1')).toBeInTheDocument();
    expect(screen.getByTestId('kind')).toHaveTextContent('ready');
  });

  it('prepares a parameterized question deterministically', async () => {
    render(<Harness services={baseServices([parameterized])} />);
    expect(await screen.findByText('param')).toBeInTheDocument();
  });

  it('creates a reflex deadline on activation and replaces it for a new seed', async () => {
    let now = 1_000;
    const clock = {
      now: vi.fn(() => now),
      setInterval: vi.fn(),
      clearInterval: vi.fn(),
    };
    const seeds = ['seed-one', 'seed-two'];
    const services = baseServices(
      [
        question('r1', { type: 'reflex', difficulty: null }),
        question('r2', { type: 'reflex', difficulty: null }),
      ],
      {
        clock,
        revisionSeedSource: {
          nextSeed: vi.fn(() => seeds.shift() ?? 'seed-extra'),
        },
      },
    );
    render(<Harness services={services} />);
    await waitFor(() =>
      expect(screen.getByTestId('reflex-deadline')).toHaveTextContent('61000'),
    );
    expect(screen.getByTestId('seed')).toHaveTextContent('seed-one');
    now = 6_000;
    await userEvent.click(screen.getByText('Suivante'));
    await waitFor(() =>
      expect(screen.getByTestId('reflex-deadline')).toHaveTextContent('66000'),
    );
    expect(screen.getByTestId('seed')).toHaveTextContent('seed-two');
  });

  it('does not create a timer deadline for a non-reflex question', async () => {
    render(<Harness services={baseServices([question('q1')])} />);
    await screen.findByText('q1');
    expect(screen.getByTestId('reflex-deadline')).toHaveTextContent('null');
  });

  it('keeps question and draft when next has no compatible candidate', async () => {
    const clear = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness services={baseServices([question('q1')])} draft clear={clear} />,
    );
    await screen.findByText('q1');
    const trigger = screen.getByText('Suivante');
    await user.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('question')).toHaveTextContent('q1');
    expect(screen.getByTestId('notice')).toHaveTextContent(
      'Aucune autre question compatible n’est disponible.',
    );
    expect(clear).not.toHaveBeenCalled();
    expect(screen.getByTestId('pending')).toHaveTextContent('false');
  });

  it('keeps the active question when candidate preparation fails', async () => {
    const services = baseServices([question('q1')]);
    services.questionRepository = new PreparationFailureRepository();
    const user = userEvent.setup();
    render(<Harness services={services} />);
    await screen.findByText('q1');
    await user.click(screen.getByText('Choisir Calcul'));
    expect(screen.getByTestId('question')).toHaveTextContent('q1');
    expect(screen.getByTestId('notice')).toHaveTextContent(
      'Impossible de préparer une variante valide de cette question.',
    );
  });

  it('changes a drafted question immediately without a dialog', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        services={baseServices([question('q1'), question('q2')])}
        draft
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('kind')).toHaveTextContent('ready'),
    );
    const initial = screen.getByTestId('question').textContent;
    await user.click(screen.getByText('Suivante'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('question').textContent).not.toBe(initial);
    expect(screen.getByTestId('pending')).toHaveTextContent('false');
  });

  it('applies free-filter changes without a draft confirmation', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        services={baseServices([question('q1'), question('q2')])}
        draft
      />,
    );
    await screen.findByText('q1');
    await user.click(screen.getByText('Choisir Calcul'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('visible-question-type')).toHaveTextContent(
      'calculation',
    );
  });

  it('never opens the obsolete change-question dialog', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        services={baseServices([question('q1'), question('q2')])}
        draft
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('kind')).toHaveTextContent('ready'),
    );
    await user.click(screen.getByText('Suivante'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('atomically clears only after a replacement candidate is ready', async () => {
    const clear = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        services={baseServices([question('q1'), question('q2')])}
        draft
        clear={clear}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('kind')).toHaveTextContent('ready'),
    );
    const initial = screen.getByTestId('question').textContent;
    await user.click(screen.getByText('Suivante'));
    expect(clear).toHaveBeenCalledOnce();
    expect(screen.getByTestId('question').textContent).not.toBe(initial);
  });

  it('changes mode with a draft immediately and removes the old question', async () => {
    const clear = vi.fn();
    const user = userEvent.setup();
    const daily = {
      getState: vi
        .fn()
        .mockResolvedValue({ kind: 'none-scheduled' } satisfies DailyPlanState),
    };
    render(
      <Harness
        services={baseServices([question('q1')], {
          dailyPlanStateRepository: daily,
        })}
        draft
        clear={clear}
      />,
    );
    await screen.findByText('q1');
    await user.click(screen.getByText('Daily'));
    expect(screen.getByTestId('pending')).toHaveTextContent('false');
    await waitFor(() =>
      expect(screen.getByTestId('kind')).toHaveTextContent('daily'),
    );
    expect(screen.getByTestId('question')).toHaveTextContent('none');
    expect(clear).toHaveBeenCalledOnce();
  });

  it('ignores an obsolete Daily response after returning to free', async () => {
    let resolveDaily!: (value: DailyPlanState) => void;
    const daily = {
      getState: vi.fn(
        () =>
          new Promise<DailyPlanState>((resolve) => {
            resolveDaily = resolve;
          }),
      ),
    };
    const user = userEvent.setup();
    render(
      <Harness
        services={baseServices([question('q1')], {
          dailyPlanStateRepository: daily,
        })}
      />,
    );
    await screen.findByText('q1');
    await user.click(screen.getByText('Daily'));
    await user.click(screen.getByText('Libre'));
    act(() => resolveDaily({ kind: 'completed', items: [] }));
    await waitFor(() =>
      expect(screen.getByTestId('kind')).toHaveTextContent('ready'),
    );
  });

  it('does not apply repository responses after unmount', async () => {
    const view = render(<Harness services={baseServices([question('q1')])} />);
    await screen.findByText('q1');
    expect(() => view.unmount()).not.toThrow();
  });
});
