import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  IndexedDbChapterTestRepository,
  IndexedDbEvaluationRepository,
  IndexedDbQuestionAttemptRepository,
} from '@infrastructure/database/indexeddb/IndexedDbPr5Repositories';
import type { QuestionEvaluation } from '@domain/evaluation/QuestionEvaluation';
import { createChapterTestBlueprint } from '@domain/chapter-tests/ChapterTest';
import { productionQuestionRepository } from '@infrastructure/session/ProductionRevisionServices';

const evaluation = (id: string, userId: string): QuestionEvaluation => ({
  id,
  userId,
  sessionId: 'session',
  questionInstanceId: `instance-${id}`,
  questionId: 'q',
  questionVersion: 1,
  questionSource: 'static',
  partId: 'p',
  chapterId: 'c',
  notionId: 'n',
  questionType: 'calculation',
  difficulty: 'standard',
  hintUsed: false,
  timeExceeded: false,
  outcome: 'success',
  startedAt: '2026-08-09T00:00:00.000Z',
  completedAt: '2026-08-09T00:01:00.000Z',
});

describe('IndexedDbEvaluationRepository', () => {
  it('isole strictement les événements par utilisateur', async () => {
    const repository = new IndexedDbEvaluationRepository();
    const suffix = crypto.randomUUID();
    await repository.append(evaluation(`a-${suffix}`, 'user-a'), 'user-a');
    await repository.append(evaluation(`b-${suffix}`, 'user-b'), 'user-b');
    expect(
      (await repository.listByUser('user-a')).map((entry) => entry.userId),
    ).toEqual(['user-a']);
    expect(
      (await repository.listByUser('user-b')).map((entry) => entry.userId),
    ).toEqual(['user-b']);
  });
  it('refuse une écriture intercompte et un doublon append-only', async () => {
    const repository = new IndexedDbEvaluationRepository();
    const entry = evaluation(`immutable-${crypto.randomUUID()}`, 'owner');
    await expect(repository.append(entry, 'intruder')).rejects.toThrow(
      'Compte incohérent',
    );
    await repository.append(entry, 'owner');
    await expect(
      repository.append({ ...entry, outcome: 'failed' }, 'owner'),
    ).rejects.toThrow('existe déjà');
  });
  it('refuse une seconde évaluation logique avec un autre identifiant', async () => {
    const repository = new IndexedDbEvaluationRepository();
    const suffix = crypto.randomUUID();
    const first = evaluation(`first-${suffix}`, 'owner');
    const second = {
      ...evaluation(`second-${suffix}`, 'owner'),
      questionInstanceId: first.questionInstanceId,
      outcome: 'failed' as const,
    };
    await repository.append(first, 'owner');
    await expect(repository.append(second, 'owner')).rejects.toThrow();
    expect(
      (await repository.listByUser('owner')).filter(
        (entry) => entry.questionInstanceId === first.questionInstanceId,
      ),
    ).toEqual([first]);
  });
});

describe('IndexedDbQuestionAttemptRepository', () => {
  it('persiste et remplace les marqueurs transitoires de la même instance', async () => {
    const repository = new IndexedDbQuestionAttemptRepository();
    const suffix = crypto.randomUUID();
    const draft = {
      id: `attempt-${suffix}`,
      userId: `owner-${suffix}`,
      sessionId: `session-${suffix}`,
      questionInstanceId: `instance-${suffix}`,
      startedAt: '2026-08-09T00:00:00.000Z',
      hintUsed: true,
      correctionViewed: false,
      timeExceeded: false,
    };
    await repository.save(draft, draft.userId);
    await repository.save(
      { ...draft, correctionViewed: true, timeExceeded: true },
      draft.userId,
    );
    expect(
      await repository.get(draft.questionInstanceId, draft.userId),
    ).toEqual({ ...draft, correctionViewed: true, timeExceeded: true });
    expect(
      await repository.get(draft.questionInstanceId, 'intruder'),
    ).toBeNull();
  });
});

describe('IndexedDbChapterTestRepository', () => {
  it('reprend position et blueprint sans exposition intercompte', async () => {
    const repository = new IndexedDbChapterTestRepository();
    const suffix = crypto.randomUUID();
    const blueprint = createChapterTestBlueprint({
      id: `blueprint-${suffix}`,
      userId: `owner-${suffix}`,
      sessionId: `session-${suffix}`,
      chapterId: 'numbers-arithmetic',
      questionCount: 20,
      seed: 'resume-seed',
      createdAt: '2026-08-09T00:00:00.000Z',
      repository: productionQuestionRepository,
    });
    if (!blueprint) throw new Error('fixture');
    const session = {
      blueprint,
      currentIndex: 7,
      status: 'active' as const,
      updatedAt: '2026-08-09T00:01:00.000Z',
    };
    await repository.save(session, blueprint.userId);
    expect(await repository.getActive(blueprint.userId)).toEqual(session);
    expect(await repository.get(blueprint.sessionId, 'intruder')).toBeNull();
    await expect(repository.save(session, 'intruder')).rejects.toThrow(
      'Compte incohérent',
    );
  });
});
