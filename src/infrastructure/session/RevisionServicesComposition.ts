import type { ProgramIndex } from '@domain/program/Program';
import type { QuestionRepository } from '@domain/repositories/QuestionRepository';
import type {
  Clock,
  DailyPlanStateRepository,
  RevisionSeedSource,
  WeakPointsStateRepository,
} from '@domain/repositories/RevisionStateRepositories';

export interface RevisionTestServices {
  programIndex?: ProgramIndex | null;
  questionRepository?: QuestionRepository;
  dailyPlanStateRepository?: DailyPlanStateRepository;
  weakPointsStateRepository?: WeakPointsStateRepository;
  revisionSeedSource?: RevisionSeedSource;
  clock?: Clock;
}

export function createRevisionTestServices(): RevisionTestServices {
  return {};
}
