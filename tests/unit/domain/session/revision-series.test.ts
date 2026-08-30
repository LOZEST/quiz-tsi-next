import { describe, expect, it } from 'vitest';
import { createProgramIndex, validateProgram } from '@domain/program/Program';
import { validateQuestionBankBundle } from '@domain/questions/QuestionBank';
import type { Question } from '@domain/questions/Question';
import type { QuestionEvaluation } from '@domain/evaluation/QuestionEvaluation';
import type { FreeRevisionFilters } from '@domain/session/Session';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';
import { MergedQuestionRepository } from '@infrastructure/session/MergedQuestionRepository';
import {
  createBoundedRevisionBlueprint,
  createConsolidationBlueprint,
  selectConsolidationCandidates,
} from '@domain/session/RevisionSeries';

const programValue = {
  schemaVersion: 1,
  parts: [{ id: 'p1', label: 'Partie 1', order: 0 }],
  chapters: [{ id: 'c1', partId: 'p1', label: 'Chapitre 1', order: 0 }],
  notions: [{ id: 'n1', chapterId: 'c1', label: 'Notion 1', order: 0 }],
};
const programResult = validateProgram(programValue);
if (!programResult.ok) throw new Error('fixture programme invalide');
const program = createProgramIndex(programResult.value);

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
  tags: ['fixture'],
  validated: true,
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
  ...overrides,
});
const bundle = (questions: Question[]) => ({
  schemaVersion: 1,
  bundleId: 'fixture-bank',
  generatedAt: '2026-08-04T00:00:00.000Z',
  defaultProvenance: [
    { sourceLabel: 'Fixture', sourceReference: null, sourceLocator: 'tests' },
  ],
  questions: questions.map((entry) => ({ question: entry, provenance: null })),
});

function repositoryWith(questions: Question[]) {
  const validated = validateQuestionBankBundle(bundle(questions), program);
  if (!validated.ok) throw new Error('fixture bundle invalide');
  return new InMemoryQuestionRepository(validated.value);
}

function evaluationFor(
  questionId: string,
  outcome: QuestionEvaluation['outcome'],
  completedAt: string,
): QuestionEvaluation {
  return {
    id: `e-${questionId}-${completedAt}`,
    userId: 'u1',
    sessionId: 'free:u1',
    questionInstanceId: `${questionId}:instance`,
    questionId,
    questionVersion: 1,
    questionSource: 'static',
    partId: 'p1',
    chapterId: 'c1',
    notionId: 'n1',
    questionType: 'course',
    difficulty: 'standard',
    hintUsed: false,
    timeExceeded: false,
    outcome,
    startedAt: completedAt,
    completedAt,
  };
}

const notionFilters: FreeRevisionFilters = {
  part: { kind: 'all' },
  chapter: { kind: 'all' },
  notion: { kind: 'one', value: 'n1' },
  questionType: { kind: 'all' },
  difficulty: { kind: 'all' },
};

describe('createBoundedRevisionBlueprint', () => {
  const repository = repositoryWith(
    ['q1', 'q2', 'q3'].map((id) => question(id)),
  );
  const build = (questionCount: number, seed = 'seed-1') =>
    createBoundedRevisionBlueprint({
      id: 'b1',
      userId: 'u1',
      sessionId: 'daily:u1:1',
      kind: 'daily',
      unitLabel: 'Notion 1',
      filters: notionFilters,
      questionCount,
      seed,
      createdAt: '2026-08-10T00:00:00.000Z',
      repository,
    });

  it('builds exactly questionCount ordered instances scoped to the unit', () => {
    const blueprint = build(2);
    expect(blueprint?.orderedQuestionInstances).toHaveLength(2);
    expect(
      blueprint?.orderedQuestionInstances.every(
        (instance) => instance.frozenQuestion.notionId === 'n1',
      ),
    ).toBe(true);
    expect(Object.isFrozen(blueprint)).toBe(true);
  });

  it('caps at the available pool instead of failing when questionCount exceeds it', () => {
    expect(build(10)?.orderedQuestionInstances).toHaveLength(3);
  });

  it('is deterministic for the same seed', () => {
    expect(build(3, 'seed-x')?.orderedQuestionInstances).toEqual(
      build(3, 'seed-x')?.orderedQuestionInstances,
    );
  });

  it('returns null when nothing matches the filter', () => {
    const blueprint = createBoundedRevisionBlueprint({
      id: 'b2',
      userId: 'u1',
      sessionId: 'daily:u1:2',
      kind: 'daily',
      unitLabel: 'Notion inconnue',
      filters: { ...notionFilters, notion: { kind: 'one', value: 'missing' } },
      questionCount: 1,
      seed: 'seed-1',
      createdAt: '2026-08-10T00:00:00.000Z',
      repository,
    });
    expect(blueprint).toBeNull();
  });

  it('scopes the draw to a personal quizz via the chapter filter slot', () => {
    const staticRepository = repositoryWith([question('official')]);
    const merged = new MergedQuestionRepository(staticRepository);
    merged.setUserContributions(
      ['pq1', 'pq2'].map((id) =>
        question(id, {
          source: 'private',
          ownerId: 'owner-1',
          classification: {
            kind: 'personal',
            courseId: 'quizz-1',
            chapter: null,
          },
        }),
      ),
    );
    const quizzFilters: FreeRevisionFilters = {
      part: { kind: 'all' },
      chapter: { kind: 'one', value: 'quizz-1' },
      notion: { kind: 'all' },
      questionType: { kind: 'all' },
      difficulty: { kind: 'all' },
    };
    const blueprint = createBoundedRevisionBlueprint({
      id: 'b3',
      userId: 'u1',
      sessionId: 'daily:u1:3',
      kind: 'daily',
      unitLabel: 'Quizz perso',
      filters: quizzFilters,
      questionCount: 2,
      seed: 'seed-1',
      createdAt: '2026-08-10T00:00:00.000Z',
      repository: merged,
    });
    expect(blueprint?.orderedQuestionInstances).toHaveLength(2);
    expect(
      blueprint?.orderedQuestionInstances.every((instance) =>
        ['pq1', 'pq2'].includes(instance.questionId),
      ),
    ).toBe(true);
  });
});

describe('selectConsolidationCandidates', () => {
  const pool = ['q1', 'q2', 'q3', 'q4'].map((id) => question(id));

  it('keeps a question whose latest evaluation failed', () => {
    const evaluations = [
      evaluationFor('q1', 'failed', '2026-08-09T10:00:00.000Z'),
    ];
    expect(
      selectConsolidationCandidates(pool, evaluations).map((q) => q.id),
    ).toEqual(['q1']);
  });

  it('keeps a question whose latest evaluation is partial', () => {
    const evaluations = [
      evaluationFor('q1', 'partial', '2026-08-09T10:00:00.000Z'),
    ];
    expect(
      selectConsolidationCandidates(pool, evaluations).map((q) => q.id),
    ).toEqual(['q1']);
  });

  it('excludes a question whose latest evaluation succeeded', () => {
    const evaluations = [
      evaluationFor('q1', 'failed', '2026-08-08T10:00:00.000Z'),
      evaluationFor('q1', 'success', '2026-08-09T10:00:00.000Z'),
    ];
    expect(selectConsolidationCandidates(pool, evaluations)).toEqual([]);
  });

  it('excludes a never-attempted question', () => {
    expect(selectConsolidationCandidates(pool, [])).toEqual([]);
  });

  it('ignores a trailing skipped evaluation and falls back to the prior outcome', () => {
    const evaluations = [
      evaluationFor('q1', 'failed', '2026-08-08T10:00:00.000Z'),
      evaluationFor('q1', 'skipped', '2026-08-09T10:00:00.000Z'),
    ];
    expect(
      selectConsolidationCandidates(pool, evaluations).map((q) => q.id),
    ).toEqual(['q1']);
  });
});

describe('createConsolidationBlueprint', () => {
  const repository = repositoryWith(
    ['q1', 'q2', 'q3'].map((id) => question(id)),
  );
  const base = {
    id: 'c1',
    userId: 'u1',
    sessionId: 'weak-points:u1:1',
    unitLabel: 'Notion 1',
    filters: notionFilters,
    maxCount: 20,
    seed: 'seed-1',
    createdAt: '2026-08-10T00:00:00.000Z',
    repository,
  };

  it('only includes questions individually marked failed or partial', () => {
    const evaluations = [
      evaluationFor('q1', 'failed', '2026-08-09T10:00:00.000Z'),
      evaluationFor('q2', 'success', '2026-08-09T10:00:00.000Z'),
    ];
    const blueprint = createConsolidationBlueprint({ ...base, evaluations });
    expect(blueprint?.orderedQuestionInstances).toHaveLength(1);
    expect(blueprint?.orderedQuestionInstances[0]?.questionId).toBe('q1');
    expect(blueprint?.kind).toBe('weak-points');
  });

  it('caps the series at maxCount', () => {
    const evaluations = ['q1', 'q2', 'q3'].map((id) =>
      evaluationFor(id, 'failed', '2026-08-09T10:00:00.000Z'),
    );
    const blueprint = createConsolidationBlueprint({
      ...base,
      evaluations,
      maxCount: 2,
    });
    expect(blueprint?.orderedQuestionInstances).toHaveLength(2);
  });

  it('falls back to the full unit pool when nothing is individually failed/partial yet', () => {
    const blueprint = createConsolidationBlueprint({
      ...base,
      evaluations: [],
    });
    expect(blueprint?.orderedQuestionInstances.length).toBeGreaterThan(0);
    expect(blueprint?.orderedQuestionInstances.length).toBeLessThanOrEqual(3);
  });

  it('returns null when the unit has no published question at all', () => {
    const blueprint = createConsolidationBlueprint({
      ...base,
      filters: { ...notionFilters, notion: { kind: 'one', value: 'missing' } },
      evaluations: [],
    });
    expect(blueprint).toBeNull();
  });
});
