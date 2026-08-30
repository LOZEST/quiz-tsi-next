import type { EvaluationRepository } from '@domain/repositories/EvaluationRepository';
import type { ChapterTestRepository } from '@domain/repositories/ChapterTestRepository';
import type {
  Clock,
  DailyActivationRepository,
  DailyPlanStateRepository,
  WeakPointsStateRepository,
} from '@domain/repositories/RevisionStateRepositories';
import { projectMasteryEvents } from '@domain/mastery/MasteryEvent';
import {
  createDailyPlan,
  createWeakPoints,
} from '@domain/mastery/ProgressPlanning';

async function eventsFor(
  userId: string,
  evaluations: EvaluationRepository,
  chapterTests: ChapterTestRepository,
) {
  const source = await evaluations.listByUser(userId);
  const tests = chapterTests.listByUser
    ? await chapterTests.listByUser(userId, 200)
    : await Promise.all(
        [...new Set(source.map((item) => item.sessionId))].map((id) =>
          chapterTests.get(id, userId),
        ),
      );
  return projectMasteryEvents(
    source,
    new Set(tests.flatMap((test) => (test ? [test.blueprint.sessionId] : []))),
  );
}

export class ProjectedDailyPlanRepository implements DailyPlanStateRepository {
  constructor(
    private evaluations: EvaluationRepository,
    private chapterTests: ChapterTestRepository,
    private clock: Clock,
    private activations: DailyActivationRepository,
  ) {}
  async getState(userId?: string) {
    if (!userId)
      return {
        kind: 'unavailable' as const,
        message: 'Le compte actif est indisponible.',
      };
    const [projection, activations] = await Promise.all([
      eventsFor(userId, this.evaluations, this.chapterTests),
      this.activations.list(userId),
    ]);
    return createDailyPlan(
      projection.events,
      userId,
      this.clock.now(),
      new Set(activations.map((activation) => activation.unitId)),
    );
  }
}

export class ProjectedWeakPointsRepository implements WeakPointsStateRepository {
  constructor(
    private evaluations: EvaluationRepository,
    private chapterTests: ChapterTestRepository,
    private clock: Clock,
  ) {}
  async getState(userId?: string) {
    if (!userId)
      return {
        kind: 'unavailable' as const,
        message: 'Le compte actif est indisponible.',
      };
    const projection = await eventsFor(
      userId,
      this.evaluations,
      this.chapterTests,
    );
    return createWeakPoints(projection.events, userId, this.clock.now());
  }
}
