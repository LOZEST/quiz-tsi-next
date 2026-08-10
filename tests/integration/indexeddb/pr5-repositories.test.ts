import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  IndexedDbChapterTestRepository,
  IndexedDbEvaluationRepository,
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
