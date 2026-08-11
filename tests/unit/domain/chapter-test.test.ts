import { describe, expect, it } from 'vitest';
import { questionClassification } from '@domain/questions/Question';
import {
  createChapterTestBlueprint,
  finishChapterTest,
  moveChapterTest,
} from '@domain/chapter-tests/ChapterTest';
import { productionQuestionRepository } from '@infrastructure/session/ProductionRevisionServices';

describe('ChapterTestBlueprint', () => {
  const create = (count: 20 | 40) =>
    createChapterTestBlueprint({
      id: `b${count}`,
      userId: 'u',
      sessionId: `s${count}`,
      chapterId: 'numbers-arithmetic',
      questionCount: count,
      seed: 'chapter-seed',
      createdAt: '2026-08-09T00:00:00.000Z',
      repository: productionQuestionRepository,
    });
  it.each([20, 40] as const)(
    'fige exactement %i instances réelles et distinctes',
    (count) => {
      const blueprint = create(count);
      expect(blueprint?.orderedQuestionInstances).toHaveLength(count);
      expect(
        new Set(
          blueprint?.orderedQuestionInstances.map((entry) => entry.questionId),
        ).size,
      ).toBe(count);
      expect(
        blueprint?.orderedQuestionInstances.every(
          (entry) =>
            questionClassification(entry.frozenQuestion)?.chapterId ===
            'numbers-arithmetic',
        ),
      ).toBe(true);
      expect(Object.isFrozen(blueprint)).toBe(true);
    },
  );
  it('reproduit ordre, versions, seeds et paramètres', () => {
    expect(create(20)?.orderedQuestionInstances).toEqual(
      create(20)?.orderedQuestionInstances,
    );
  });
  it('borne la navigation et distingue soumission et abandon', () => {
    const blueprint = create(20);
    if (!blueprint) throw new Error('fixture');
    const session = {
      blueprint,
      currentIndex: 0,
      status: 'active' as const,
      updatedAt: blueprint.createdAt,
    };
    expect(
      moveChapterTest(session, 1, '2026-08-09T00:01:00.000Z').currentIndex,
    ).toBe(1);
    expect(moveChapterTest(session, 20, '2026-08-09T00:01:00.000Z')).toBe(
      session,
    );
    expect(
      finishChapterTest(session, 'submitted', '2026-08-09T00:01:00.000Z')
        .status,
    ).toBe('submitted');
    expect(
      finishChapterTest(session, 'abandoned', '2026-08-09T00:01:00.000Z')
        .status,
    ).toBe('abandoned');
  });
});
