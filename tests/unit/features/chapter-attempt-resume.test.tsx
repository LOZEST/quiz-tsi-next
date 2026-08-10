import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  AppServicesProvider,
  type AppServices,
} from '@app/providers/AppServicesProvider';
import { WhiteboardProvider } from '@app/providers/WhiteboardProvider';
import {
  RevisionExperienceProvider,
  useRevisionExperience,
} from '@features/session/RevisionExperienceProvider';
import type { ChapterTestSession } from '@domain/chapter-tests/ChapterTest';
import type {
  QuestionAttemptDraft,
  QuestionEvaluation,
} from '@domain/evaluation/QuestionEvaluation';
import {
  productionProgramIndex,
  productionQuestionRepository,
} from '@infrastructure/session/ProductionRevisionServices';

function repositories() {
  let active: ChapterTestSession | null = null;
  const drafts = new Map<string, QuestionAttemptDraft>();
  const evaluations: QuestionEvaluation[] = [];
  return {
    chapterTestRepository: {
      save: vi.fn((session: ChapterTestSession) => {
        active = session;
        return Promise.resolve();
      }),
      getActive: vi.fn(() => Promise.resolve(active)),
      get: vi.fn((sessionId: string) =>
        Promise.resolve(
          active?.blueprint.sessionId === sessionId ? active : null,
        ),
      ),
    },
    questionAttemptRepository: {
      save: vi.fn((draft: QuestionAttemptDraft) => {
        drafts.set(draft.questionInstanceId, structuredClone(draft));
        return Promise.resolve();
      }),
      get: vi.fn((instanceId: string) =>
        Promise.resolve(drafts.get(instanceId) ?? null),
      ),
    },
    evaluationRepository: {
      append: vi.fn((entry: QuestionEvaluation) => {
        if (
          evaluations.some(
            (saved) =>
              saved.userId === entry.userId &&
              saved.questionInstanceId === entry.questionInstanceId,
          )
        )
          throw new Error('Cette question est déjà évaluée.');
        evaluations.push(structuredClone(entry));
        return Promise.resolve();
      }),
      listByUser: vi.fn((userId: string) =>
        Promise.resolve(evaluations.filter((entry) => entry.userId === userId)),
      ),
      listBySession: vi.fn((sessionId: string, userId: string) =>
        Promise.resolve(
          evaluations.filter(
            (entry) => entry.sessionId === sessionId && entry.userId === userId,
          ),
        ),
      ),
    },
    drafts,
    evaluations,
  };
}

function services(storage: ReturnType<typeof repositories>): AppServices {
  let seed = 0;
  return {
    authGateway: {
      getCurrentSession: vi.fn().mockResolvedValue(null),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
      subscribeToAuthChanges: vi.fn().mockReturnValue(() => undefined),
    },
    workspaceRepository: {
      open: vi.fn(),
      cacheValidatedProfile: vi.fn(),
      getCachedProfile: vi.fn().mockResolvedValue(null),
      close: vi.fn(),
      delete: vi.fn(),
      isGenerationActive: vi.fn().mockReturnValue(true),
    },
    programIndex: productionProgramIndex,
    questionRepository: productionQuestionRepository,
    revisionSeedSource: { nextSeed: () => `resume-seed-${++seed}` },
    clock: {
      now: () => Date.parse('2026-08-10T08:00:00.000Z'),
      setInterval: vi.fn(),
      clearInterval: vi.fn(),
    },
    chapterTestRepository: storage.chapterTestRepository,
    questionAttemptRepository: storage.questionAttemptRepository,
    evaluationRepository: storage.evaluationRepository,
  };
}

function Probe() {
  const experience = useRevisionExperience();
  const ready = experience.state.kind === 'ready' ? experience.state : null;
  return (
    <div>
      <output data-testid="instance">{ready?.instance.id ?? 'none'}</output>
      <output data-testid="attempt-id">{ready?.attempt.id ?? 'none'}</output>
      <output data-testid="hint">{String(ready?.attempt.hintUsed)}</output>
      <output data-testid="correction">
        {String(ready?.attempt.correctionViewed)}
      </output>
      <output data-testid="time">{String(ready?.attempt.timeExceeded)}</output>
      <output data-testid="evaluation">
        {ready?.attempt.evaluation?.id ?? 'none'}
      </output>
      <button onClick={() => experience.setMode('chapter-test')}>
        Mode test
      </button>
      <button
        onClick={() =>
          void experience.startChapterTest('numbers-arithmetic', 20)
        }
      >
        Démarrer
      </button>
      <button onClick={() => experience.openHint()}>Indice</button>
      <button onClick={() => experience.openCorrection()}>Correction</button>
      <button onClick={() => experience.markReflexExceeded()}>Temps</button>
      <button onClick={() => void experience.evaluate('success')}>
        Réussi
      </button>
      <button onClick={() => void experience.navigateChapterTest(1)}>
        Vers 2
      </button>
      <button onClick={() => void experience.navigateChapterTest(0)}>
        Vers 1
      </button>
    </div>
  );
}

function Harness({ appServices }: { appServices: AppServices }) {
  return (
    <AppServicesProvider services={appServices}>
      <WhiteboardProvider>
        <RevisionExperienceProvider userId="owner">
          <Probe />
        </RevisionExperienceProvider>
      </WhiteboardProvider>
    </AppServicesProvider>
  );
}

async function startTest(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByTestId('instance');
  await user.click(screen.getByText('Mode test'));
  await user.click(screen.getByText('Démarrer'));
  await waitFor(() =>
    expect(screen.getByTestId('instance')).not.toHaveTextContent('none'),
  );
}

describe('reprise des tentatives de ChapterTest', () => {
  it('conserve aide, correction et dépassement pendant la navigation puis applique partial', async () => {
    const storage = repositories();
    const user = userEvent.setup();
    render(<Harness appServices={services(storage)} />);
    await startTest(user);
    const firstInstance = screen.getByTestId('instance').textContent;
    await user.click(screen.getByText('Indice'));
    await user.click(screen.getByText('Correction'));
    await user.click(screen.getByText('Temps'));
    await user.click(screen.getByText('Vers 2'));
    await waitFor(() =>
      expect(screen.getByTestId('instance')).not.toHaveTextContent(
        firstInstance ?? '',
      ),
    );
    await user.click(screen.getByText('Vers 1'));
    await waitFor(() =>
      expect(screen.getByTestId('instance')).toHaveTextContent(
        firstInstance ?? '',
      ),
    );
    expect(screen.getByTestId('hint')).toHaveTextContent('true');
    expect(screen.getByTestId('correction')).toHaveTextContent('true');
    expect(screen.getByTestId('time')).toHaveTextContent('true');
    await user.click(screen.getByText('Réussi'));
    await waitFor(() => expect(storage.evaluations).toHaveLength(1));
    expect(storage.evaluations[0]?.outcome).toBe('partial');
  });

  it('restaure au reload la même tentative aidée puis la même évaluation', async () => {
    const storage = repositories();
    const appServices = services(storage);
    const user = userEvent.setup();
    const view = render(<Harness appServices={appServices} />);
    await startTest(user);
    const instanceId = screen.getByTestId('instance').textContent;
    const attemptId = screen.getByTestId('attempt-id').textContent;
    await user.click(screen.getByText('Indice'));
    await waitFor(() =>
      expect(storage.drafts.get(instanceId ?? '')?.hintUsed).toBe(true),
    );
    view.unmount();
    const resumed = render(<Harness appServices={appServices} />);
    await user.click(await screen.findByText('Mode test'));
    await waitFor(() =>
      expect(screen.getByTestId('instance')).toHaveTextContent(
        instanceId ?? '',
      ),
    );
    expect(screen.getByTestId('attempt-id')).toHaveTextContent(attemptId ?? '');
    expect(screen.getByTestId('hint')).toHaveTextContent('true');
    await user.click(screen.getByText('Réussi'));
    await waitFor(() => expect(storage.evaluations).toHaveLength(1));
    expect(storage.evaluations[0]?.outcome).toBe('partial');
    const evaluationId = storage.evaluations[0]?.id ?? '';
    resumed.unmount();
    render(<Harness appServices={appServices} />);
    await user.click(await screen.findByText('Mode test'));
    await waitFor(() =>
      expect(screen.getByTestId('evaluation')).toHaveTextContent(evaluationId),
    );
    await user.click(screen.getByText('Réussi'));
    expect(storage.evaluationRepository.append).toHaveBeenCalledTimes(1);
    expect(storage.evaluations).toHaveLength(1);
  });
});
