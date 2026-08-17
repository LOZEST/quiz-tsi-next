import type {
  Clock,
  DailyPlanStateRepository,
  RevisionSeedSource,
  WeakPointsStateRepository,
} from '@domain/repositories/RevisionStateRepositories';
import type { RevisionTestServices } from './RevisionServicesComposition';
import {
  mergedQuestionRepository,
  productionProgramIndex,
} from './ProductionRevisionServices';

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
            notionId: 'NUM-F01',
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
            notionId: 'NUM-F02',
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
    programIndex: productionProgramIndex,
    questionRepository: mergedQuestionRepository,
    dailyPlanStateRepository: new ControlledDailyRepository(),
    weakPointsStateRepository: new ControlledWeakPointsRepository(),
    revisionSeedSource: new ControlledRevisionSeedSource(),
    clock: new ControlledClock(),
  };
}
