import type {
  EvaluationOutcome,
  QuestionEvaluation,
} from '../evaluation/QuestionEvaluation';

export const RECURRENCE_POLICY = Object.freeze({
  baselineWeight: 1,
  successDecay: 0.25,
  failureBoost: 2.2,
  minWeight: 0.03,
  maxWeight: 8,
  partialSuccessFactor: 0.5,
});

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function nextStreak(streak: number, outcome: EvaluationOutcome): number {
  if (outcome === 'success') return streak < 0 ? 1 : streak + 1;
  if (outcome === 'partial')
    return streak < 0
      ? RECURRENCE_POLICY.partialSuccessFactor
      : streak + RECURRENCE_POLICY.partialSuccessFactor;
  if (outcome === 'failed') return streak > 0 ? -1 : streak - 1;
  return streak;
}

export function computeQuestionStreak(
  outcomes: readonly EvaluationOutcome[],
): number {
  return outcomes.reduce(nextStreak, 0);
}

export function recurrenceWeightForStreak(streak: number): number {
  if (streak === 0) return RECURRENCE_POLICY.baselineWeight;
  if (streak > 0)
    return clamp(
      RECURRENCE_POLICY.baselineWeight *
        RECURRENCE_POLICY.successDecay ** streak,
      RECURRENCE_POLICY.minWeight,
      RECURRENCE_POLICY.baselineWeight,
    );
  return clamp(
    RECURRENCE_POLICY.baselineWeight *
      RECURRENCE_POLICY.failureBoost ** -streak,
    RECURRENCE_POLICY.baselineWeight,
    RECURRENCE_POLICY.maxWeight,
  );
}

export function computeQuestionRecurrenceWeights(
  evaluations: readonly QuestionEvaluation[],
): ReadonlyMap<string, number> {
  const ordered = evaluations
    .filter(
      (evaluation) =>
        evaluation.outcome !== 'skipped' &&
        Number.isFinite(Date.parse(evaluation.completedAt)),
    )
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
  const streaks = new Map<string, number>();
  const weights = new Map<string, number>();
  for (const evaluation of ordered) {
    const streak = nextStreak(
      streaks.get(evaluation.questionId) ?? 0,
      evaluation.outcome,
    );
    streaks.set(evaluation.questionId, streak);
    weights.set(evaluation.questionId, recurrenceWeightForStreak(streak));
  }
  return weights;
}
