import type { Difficulty } from '../questions/Question';
import type { MasteryEvent } from './MasteryEvent';

export const MASTERY_POLICY = Object.freeze({
  name: 'quiz-tsi-mastery-v1',
  resultValue: { success: 1, partial: 0.68, failed: 0 },
  recencyHalfLifeDays: 90,
  sameQuestionFactor: 0.58,
  sameSessionFactor: 0.8,
  initialStabilityDays: { success: 4, partial: 1.25, failed: 0.25 },
  stabilityMultiplier: { success: 2.2, partial: 1.2, failed: 0.35 },
  minimumStabilityDays: 0.08,
  maximumStabilityDays: 180,
});

export type MasteryStatus =
  | 'new'
  | 'needs-review'
  | 'overdue'
  | 'discovery'
  | 'fragile'
  | 'solid'
  | 'progressing';

export interface NotionMastery {
  readonly notionId: string;
  readonly masteryScore: number;
  readonly confidenceScore: number;
  readonly evidenceCount: number;
  readonly stabilityDays: number;
  readonly lastReviewedAt: string | null;
  readonly nextReviewAt: string | null;
  readonly lastResult: MasteryEvent['result'] | null;
  readonly status: MasteryStatus;
  readonly recommendedDifficulty: Difficulty;
  readonly totalWeight: number;
}

const DAY_MS = 86_400_000;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function recommendedDifficulty(
  masteryScore: number,
  confidenceScore: number,
): Difficulty {
  if (masteryScore < 55 || confidenceScore < 35) return 'fundamental';
  if (masteryScore >= 80 && confidenceScore >= 65) return 'trap';
  return 'standard';
}

export function calculateNotionMastery(
  notionId: string,
  sourceEvents: readonly MasteryEvent[],
  now: number,
): NotionMastery {
  return calculateMasteryForKey(
    notionId,
    sourceEvents.filter((event) => event.notionId === notionId),
    now,
  );
}

export function calculateMasteryForKey(
  key: string,
  sourceEvents: readonly MasteryEvent[],
  now: number,
): NotionMastery {
  const events = sourceEvents
    .filter(
      (
        event,
      ): event is MasteryEvent & { result: 'success' | 'partial' | 'failed' } =>
        event.result !== 'skipped',
    )
    .filter((event) => Number.isFinite(Date.parse(event.occurredAt)))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  if (events.length === 0) {
    return {
      notionId: key,
      masteryScore: 0,
      confidenceScore: 0,
      evidenceCount: 0,
      stabilityDays: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      lastResult: null,
      status: 'new',
      recommendedDifficulty: 'fundamental',
      totalWeight: 0,
    };
  }
  const questionCounts = new Map<string, number>();
  const sessionCounts = new Map<string, number>();
  const activeDays = new Set<string>();
  const sessionModes = new Set<string>();
  let weightedValue = 0;
  let totalWeight = 0;
  let stabilityDays = 0;
  for (const event of events) {
    const occurredAt = Date.parse(event.occurredAt);
    const ageDays = Math.max(0, (now - occurredAt) / DAY_MS);
    const previousQuestionCount = questionCounts.get(event.questionId) ?? 0;
    const previousSessionCount = sessionCounts.get(event.sessionId) ?? 0;
    const weight =
      0.5 ** (ageDays / MASTERY_POLICY.recencyHalfLifeDays) *
      MASTERY_POLICY.sameQuestionFactor ** previousQuestionCount *
      MASTERY_POLICY.sameSessionFactor ** previousSessionCount;
    weightedValue += MASTERY_POLICY.resultValue[event.result] * weight;
    totalWeight += weight;
    questionCounts.set(event.questionId, previousQuestionCount + 1);
    sessionCounts.set(event.sessionId, previousSessionCount + 1);
    activeDays.add(event.occurredAt.slice(0, 10));
    sessionModes.add(event.sessionMode);
    const result = event.result;
    stabilityDays =
      stabilityDays === 0
        ? MASTERY_POLICY.initialStabilityDays[result]
        : clamp(
            stabilityDays * MASTERY_POLICY.stabilityMultiplier[result],
            MASTERY_POLICY.minimumStabilityDays,
            MASTERY_POLICY.maximumStabilityDays,
          );
  }
  const masteryScore = Math.round(
    clamp((weightedValue / totalWeight) * 100, 0, 100),
  );
  const confidenceScore = Math.round(
    clamp(
      12 * Math.log2(1 + totalWeight) +
        8 * questionCounts.size +
        6 * activeDays.size +
        4 * sessionModes.size,
      0,
      100,
    ),
  );
  const last = events.at(-1)!;
  const lastReviewedAt = last.occurredAt;
  const nextReviewAt = new Date(
    Date.parse(lastReviewedAt) + stabilityDays * DAY_MS,
  ).toISOString();
  const status: MasteryStatus =
    last.result === 'failed'
      ? 'needs-review'
      : Date.parse(nextReviewAt) <= now
        ? 'overdue'
        : events.length < 2
          ? 'discovery'
          : masteryScore < 50
            ? 'fragile'
            : masteryScore >= 75 && confidenceScore >= 60
              ? 'solid'
              : 'progressing';
  return {
    notionId: key,
    masteryScore,
    confidenceScore,
    evidenceCount: events.length,
    stabilityDays,
    lastReviewedAt,
    nextReviewAt,
    lastResult: last.result,
    status,
    recommendedDifficulty: recommendedDifficulty(masteryScore, confidenceScore),
    totalWeight,
  };
}
