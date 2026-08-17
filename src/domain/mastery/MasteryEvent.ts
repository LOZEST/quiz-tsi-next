import type { QuestionEvaluation } from '../evaluation/QuestionEvaluation';

export type SessionMode = 'daily' | 'weak-points' | 'free' | 'chapter-test';

export interface MasteryEvent {
  readonly id: string;
  readonly userId: string;
  /** For a personal/quizz event, this is the quizz's `courseId` (Phase 7:
   * a quizz is flat, so it has no notion of its own — its id fills this
   * "revision unit" slot instead). */
  readonly notionId: string;
  readonly classificationKind: 'official' | 'personal';
  readonly questionId: string;
  readonly sessionId: string;
  readonly questionInstanceId: string;
  readonly questionVersion: number;
  readonly sessionMode: SessionMode;
  readonly result: QuestionEvaluation['outcome'];
  readonly hintUsed: boolean;
  readonly timeLimitExceeded: boolean;
  readonly durationMs: number | null;
  readonly occurredAt: string;
}

export interface MasteryProjectionResult {
  readonly events: readonly MasteryEvent[];
  readonly partial: boolean;
  readonly unresolvedEvaluationIds: readonly string[];
}

function sessionModeFor(
  sessionId: string,
  chapterTestSessionIds: ReadonlySet<string>,
): SessionMode | null {
  if (sessionId.startsWith('free:')) return 'free';
  if (sessionId.startsWith('daily:')) return 'daily';
  if (sessionId.startsWith('weak-points:')) return 'weak-points';
  if (chapterTestSessionIds.has(sessionId)) return 'chapter-test';
  return null;
}

function duration(evaluation: QuestionEvaluation): number | null {
  const started = Date.parse(evaluation.startedAt);
  const completed = Date.parse(evaluation.completedAt);
  return Number.isFinite(started) &&
    Number.isFinite(completed) &&
    completed >= started
    ? completed - started
    : null;
}

export function projectMasteryEvents(
  evaluations: readonly QuestionEvaluation[],
  chapterTestSessionIds: ReadonlySet<string> = new Set(),
): MasteryProjectionResult {
  const events: MasteryEvent[] = [];
  const unresolvedEvaluationIds: string[] = [];
  const seen = new Set<string>();
  for (const evaluation of evaluations) {
    if (seen.has(evaluation.id)) continue;
    seen.add(evaluation.id);
    const sessionMode = sessionModeFor(
      evaluation.sessionId,
      chapterTestSessionIds,
    );
    const classification = evaluation.classification;
    const isPersonal = classification?.kind === 'personal';
    const unitId = isPersonal ? classification.courseId : evaluation.notionId;
    if (!sessionMode || !unitId) {
      unresolvedEvaluationIds.push(evaluation.id);
      continue;
    }
    events.push({
      id: `mastery:${evaluation.id}`,
      userId: evaluation.userId,
      notionId: unitId,
      classificationKind: isPersonal ? 'personal' : 'official',
      questionId: evaluation.questionId,
      sessionId: evaluation.sessionId,
      questionInstanceId: evaluation.questionInstanceId,
      questionVersion: evaluation.questionVersion,
      sessionMode,
      result: evaluation.outcome,
      hintUsed: evaluation.hintUsed,
      timeLimitExceeded: evaluation.timeExceeded,
      durationMs: duration(evaluation),
      occurredAt: evaluation.completedAt,
    });
  }
  return {
    events,
    partial: unresolvedEvaluationIds.length > 0,
    unresolvedEvaluationIds,
  };
}
