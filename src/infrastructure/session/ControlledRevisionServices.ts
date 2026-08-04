import { createProgramIndex, validateProgram } from '@domain/program/Program';
import { validateQuestionBankBundle } from '@domain/questions/QuestionBank';
import type { Question } from '@domain/questions/Question';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';
import type {
  Clock,
  DailyPlanStateRepository,
  RevisionSeedSource,
  WeakPointsStateRepository,
} from '@domain/repositories/RevisionStateRepositories';
import type { RevisionTestServices } from './RevisionServicesComposition';

const programResult = validateProgram({
  schemaVersion: 1,
  parts: [
    { id: 'analysis', label: 'Analyse', order: 0 },
    { id: 'algebra', label: 'Algèbre', order: 1 },
  ],
  chapters: [
    { id: 'sequences', partId: 'analysis', label: 'Suites', order: 0 },
    { id: 'matrices', partId: 'algebra', label: 'Matrices', order: 0 },
  ],
  notions: [
    {
      id: 'geometric-sequences',
      chapterId: 'sequences',
      label: 'Suites géométriques',
      order: 0,
    },
    {
      id: 'matrix-products',
      chapterId: 'matrices',
      label: 'Produit matriciel',
      order: 0,
    },
  ],
});
if (!programResult.ok) throw new Error('Programme contrôlé invalide.');
export const controlledProgramIndex = createProgramIndex(programResult.value);

const makeQuestion = (
  id: string,
  type: Question['type'],
  notionId = 'geometric-sequences',
): Question => ({
  id,
  version: 1,
  source: 'static',
  ownerId: null,
  status: 'published',
  provenance: null,
  partId: notionId === 'matrix-products' ? 'algebra' : 'analysis',
  chapterId: notionId === 'matrix-products' ? 'matrices' : 'sequences',
  notionId,
  type,
  difficulty: type === 'reflex' ? null : 'standard',
  parameterization: null,
  prompt: [
    {
      kind: 'text',
      value:
        id === 'reflex-question'
          ? 'Donne la raison de la suite.'
          : `Question originale ${id}.`,
    },
  ],
  hint: [],
  correction: [],
  tags: ['browser-controlled'],
  validated: true,
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
});
const bundleResult = validateQuestionBankBundle(
  {
    schemaVersion: 1,
    bundleId: 'browser-controlled-bank',
    generatedAt: '2026-08-04T00:00:00.000Z',
    defaultProvenance: [
      {
        sourceLabel: 'Fixture originale Playwright',
        sourceReference: null,
        sourceLocator: 'ControlledRevisionServices',
      },
    ],
    questions: [
      makeQuestion('course-one', 'course'),
      makeQuestion('course-two', 'course'),
      makeQuestion('reflex-question', 'reflex'),
      makeQuestion('matrix-question', 'calculation', 'matrix-products'),
    ].map((question) => ({ question, provenance: null })),
  },
  controlledProgramIndex,
);
if (!bundleResult.ok) throw new Error('Banque contrôlée invalide.');
export const controlledQuestionRepository = new InMemoryQuestionRepository(
  bundleResult.value,
);

export class ControlledRevisionSeedSource implements RevisionSeedSource {
  #index = 0;
  nextSeed(): string {
    this.#index += 1;
    return `browser-seed-${this.#index}`;
  }
}
export class ControlledClock implements Clock {
  now = () => globalThis.__QTSI_TEST_NOW__ ?? Date.now();
  setInterval = (callback: () => void, milliseconds: number) =>
    globalThis.setInterval(callback, milliseconds);
  clearInterval = (handle: unknown) =>
    globalThis.clearInterval(handle as ReturnType<typeof setInterval>);
}
const query = () => new URL(globalThis.location.href).searchParams;
export class ControlledDailyRepository implements DailyPlanStateRepository {
  getState() {
    const kind = query().get('daily');
    if (kind === 'completed')
      return Promise.resolve({ kind: 'completed' as const, items: [] });
    if (kind === 'ready')
      return Promise.resolve({
        kind: 'ready' as const,
        items: [
          {
            notionId: 'geometric-sequences',
            plannedCount: 4,
            successCount: 2,
            partialCount: 1,
            failedCount: 1,
            reason: 'Plan contrôlé',
            recommendedDifficulty: 'standard' as const,
            dueAt: '2026-08-04T20:00:00.000Z',
          },
        ],
      });
    return Promise.resolve({ kind: 'none-scheduled' as const });
  }
}
export class ControlledWeakPointsRepository implements WeakPointsStateRepository {
  getState() {
    if (query().get('weak') === 'ready')
      return Promise.resolve({
        kind: 'ready' as const,
        items: [
          {
            notionId: 'matrix-products',
            priority: 1,
            recommendedDifficulty: 'standard' as const,
            rationale: 'Preuve contrôlée',
            masteryEstimate: 0.4,
            lastActivityAt: '2026-08-03T20:00:00.000Z',
            successCount: 1,
            partialCount: 1,
            failedCount: 2,
            recurringErrors: ['Ordre des facteurs'],
          },
        ],
      });
    return Promise.resolve({
      kind: 'calibrating' as const,
      evidence: {
        observedEvidence: 2,
        requiredEvidence: 5,
        coveredNotions: 1,
        requiredCoveredNotions: 2,
      },
      message: 'Calibration contrôlée',
    });
  }
}

declare global {
  var __QTSI_TEST_NOW__: number | undefined;
}

export function createRevisionTestServices(): RevisionTestServices {
  return {
    programIndex: controlledProgramIndex,
    questionRepository: controlledQuestionRepository,
    dailyPlanStateRepository: new ControlledDailyRepository(),
    weakPointsStateRepository: new ControlledWeakPointsRepository(),
    revisionSeedSource: new ControlledRevisionSeedSource(),
    clock: new ControlledClock(),
  };
}
