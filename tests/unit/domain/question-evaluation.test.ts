import { describe, expect, it } from 'vitest';
import {
  completeQuestionAttempt,
  createQuestionAttempt,
  markCorrectionViewed,
  markHintUsed,
  markTimeExceeded,
} from '@domain/evaluation/QuestionEvaluation';
import {
  createQuestionInstance,
  type Question,
} from '@domain/questions/Question';

const question = (source: Question['source'] = 'static'): Question => ({
  id: 'q',
  version: 1,
  source,
  ownerId: source === 'static' ? null : 'author',
  status: 'published',
  provenance: null,
  partId: 'p',
  chapterId: 'c',
  notionId: 'n',
  type: 'calculation',
  difficulty: 'standard',
  parameterization: null,
  prompt: [{ kind: 'text', value: 'Question' }],
  hint: [{ kind: 'text', value: 'Indice' }],
  correction: [
    { id: 's', title: null, content: [{ kind: 'text', value: 'Correction' }] },
  ],
  tags: [],
  validated: true,
  createdAt: '2026-08-09T00:00:00.000Z',
  updatedAt: '2026-08-09T00:00:00.000Z',
});
const attempt = (source: Question['source'] = 'static') => {
  const instance = createQuestionInstance({
    id: 'i',
    questionId: 'q',
    questionVersion: 1,
    sessionId: 's',
    ordinal: 0,
    frozenQuestion: question(source),
    parameterValues: {},
    seed: 'seed',
    createdAt: '2026-08-09T00:00:00.000Z',
  });
  if (!instance.ok) throw new Error('fixture');
  return createQuestionAttempt({
    id: 'a',
    userId: 'u',
    instance: instance.value,
    startedAt: '2026-08-09T00:00:00.000Z',
  });
};

describe('cycle append-only d’évaluation', () => {
  it('dérive success, partial, failed et skipped sans bouton partial', () => {
    expect(
      completeQuestionAttempt(attempt(), {
        id: 'e1',
        action: 'success',
        completedAt: '2026-08-09T00:01:00.000Z',
      }).evaluation?.outcome,
    ).toBe('success');
    expect(
      completeQuestionAttempt(markHintUsed(attempt()), {
        id: 'e2',
        action: 'success',
        completedAt: '2026-08-09T00:01:00.000Z',
      }).evaluation,
    ).toMatchObject({ outcome: 'partial', hintUsed: true });
    expect(
      completeQuestionAttempt(markTimeExceeded(attempt()), {
        id: 'e3',
        action: 'success',
        completedAt: '2026-08-09T00:01:00.000Z',
      }).evaluation,
    ).toMatchObject({ outcome: 'partial', timeExceeded: true });
    expect(
      completeQuestionAttempt(attempt(), {
        id: 'e4',
        action: 'failed',
        completedAt: '2026-08-09T00:01:00.000Z',
      }).evaluation?.outcome,
    ).toBe('failed');
    expect(
      completeQuestionAttempt(attempt(), {
        id: 'e5',
        action: 'skipped',
        completedAt: '2026-08-09T00:01:00.000Z',
      }).evaluation?.outcome,
    ).toBe('skipped');
  });
  it('rend aide, correction et dépassement monotones et interdit une seconde complétion', () => {
    const helped = markHintUsed(markHintUsed(attempt()));
    expect(helped.hintUsed).toBe(true);
    expect(
      markCorrectionViewed(markCorrectionViewed(helped)).correctionViewed,
    ).toBe(true);
    expect(markTimeExceeded(markTimeExceeded(helped)).timeExceeded).toBe(true);
    const completed = completeQuestionAttempt(helped, {
      id: 'e',
      action: 'success',
      completedAt: '2026-08-09T00:01:00.000Z',
    });
    expect(
      completeQuestionAttempt(completed, {
        id: 'other',
        action: 'failed',
        completedAt: '2026-08-09T00:02:00.000Z',
      }),
    ).toBe(completed);
  });
  it.each(['private', 'shared'] as const)('conserve la source %s', (source) => {
    expect(
      completeQuestionAttempt(attempt(source), {
        id: 'e',
        action: 'failed',
        completedAt: '2026-08-09T00:01:00.000Z',
      }).evaluation?.questionSource,
    ).toBe(source);
  });
});
