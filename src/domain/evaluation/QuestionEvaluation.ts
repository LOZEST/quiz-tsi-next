import type {
  Difficulty,
  QuestionInstance,
  QuestionSource,
  QuestionType,
} from '../questions/Question';
import { deepFreezeOwned } from '../validation/SafeSnapshot';

export const EVALUATION_OUTCOMES = [
  'success',
  'partial',
  'failed',
  'skipped',
] as const;
export type EvaluationOutcome = (typeof EVALUATION_OUTCOMES)[number];

export interface QuestionAttemptState {
  readonly id: string;
  readonly userId: string;
  readonly instance: QuestionInstance;
  readonly startedAt: string;
  readonly hintUsed: boolean;
  readonly correctionViewed: boolean;
  readonly timeExceeded: boolean;
  readonly evaluation: QuestionEvaluation | null;
}

export type QuestionAttemptDraft = Readonly<{
  id: string;
  userId: string;
  sessionId: string;
  questionInstanceId: string;
  startedAt: string;
  hintUsed: boolean;
  correctionViewed: boolean;
  timeExceeded: boolean;
}>;

export interface QuestionEvaluation {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly questionInstanceId: string;
  readonly questionId: string;
  readonly questionVersion: number;
  readonly questionSource: QuestionSource;
  readonly partId: string;
  readonly chapterId: string;
  readonly notionId: string;
  readonly questionType: QuestionType;
  readonly difficulty: Difficulty | null;
  readonly hintUsed: boolean;
  readonly timeExceeded: boolean;
  readonly outcome: EvaluationOutcome;
  readonly startedAt: string;
  readonly completedAt: string;
}

export function createQuestionAttempt(input: {
  id: string;
  userId: string;
  instance: QuestionInstance;
  startedAt: string;
}): QuestionAttemptState {
  return deepFreezeOwned({
    ...input,
    hintUsed: false,
    correctionViewed: false,
    timeExceeded: false,
    evaluation: null,
  });
}

export function toQuestionAttemptDraft(
  attempt: QuestionAttemptState,
): QuestionAttemptDraft {
  return deepFreezeOwned({
    id: attempt.id,
    userId: attempt.userId,
    sessionId: attempt.instance.sessionId,
    questionInstanceId: attempt.instance.id,
    startedAt: attempt.startedAt,
    hintUsed: attempt.hintUsed,
    correctionViewed: attempt.correctionViewed,
    timeExceeded: attempt.timeExceeded,
  });
}

export function restoreQuestionAttempt(input: {
  draft: QuestionAttemptDraft;
  instance: QuestionInstance;
  evaluation: QuestionEvaluation | null;
}): QuestionAttemptState {
  return deepFreezeOwned({
    id: input.draft.id,
    userId: input.draft.userId,
    instance: input.instance,
    startedAt: input.draft.startedAt,
    hintUsed: input.draft.hintUsed || input.evaluation?.hintUsed === true,
    correctionViewed: input.draft.correctionViewed || input.evaluation !== null,
    timeExceeded:
      input.draft.timeExceeded || input.evaluation?.timeExceeded === true,
    evaluation: input.evaluation,
  });
}

export function markHintUsed(
  attempt: QuestionAttemptState,
): QuestionAttemptState {
  return attempt.hintUsed
    ? attempt
    : deepFreezeOwned({ ...attempt, hintUsed: true });
}

export function markCorrectionViewed(
  attempt: QuestionAttemptState,
): QuestionAttemptState {
  return attempt.correctionViewed
    ? attempt
    : deepFreezeOwned({ ...attempt, correctionViewed: true });
}

export function markTimeExceeded(
  attempt: QuestionAttemptState,
): QuestionAttemptState {
  return attempt.timeExceeded
    ? attempt
    : deepFreezeOwned({ ...attempt, timeExceeded: true });
}

export function completeQuestionAttempt(
  attempt: QuestionAttemptState,
  input: {
    id: string;
    action: 'success' | 'failed' | 'skipped';
    completedAt: string;
  },
): QuestionAttemptState {
  if (attempt.evaluation) return attempt;
  const question = attempt.instance.frozenQuestion;
  const outcome: EvaluationOutcome =
    input.action === 'success'
      ? attempt.hintUsed || attempt.timeExceeded
        ? 'partial'
        : 'success'
      : input.action;
  const evaluation: QuestionEvaluation = deepFreezeOwned({
    id: input.id,
    userId: attempt.userId,
    sessionId: attempt.instance.sessionId,
    questionInstanceId: attempt.instance.id,
    questionId: question.id,
    questionVersion: question.version,
    questionSource: question.source,
    partId: question.partId,
    chapterId: question.chapterId,
    notionId: question.notionId,
    questionType: question.type,
    difficulty: question.difficulty,
    hintUsed: attempt.hintUsed,
    timeExceeded: attempt.timeExceeded,
    outcome,
    startedAt: attempt.startedAt,
    completedAt: input.completedAt,
  });
  return deepFreezeOwned({ ...attempt, evaluation });
}
