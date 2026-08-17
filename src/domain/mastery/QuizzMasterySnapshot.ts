import { calculateMasteryForKey, type NotionMastery } from './MasteryPolicy';
import type { MasteryEvent } from './MasteryEvent';

export interface QuizzMastery {
  readonly quizzId: string;
  readonly masteryScore: number;
  readonly confidenceScore: number;
  readonly evidenceCount: number;
  readonly stabilityDays: number;
  readonly lastReviewedAt: string | null;
  readonly nextReviewAt: string | null;
  readonly lastResult: NotionMastery['lastResult'];
  readonly status: NotionMastery['status'];
  readonly recommendedDifficulty: NotionMastery['recommendedDifficulty'];
  readonly totalWeight: number;
}

export function calculateQuizzMastery(
  quizzId: string,
  sourceEvents: readonly MasteryEvent[],
  now: number,
): QuizzMastery {
  const { notionId, ...mastery } = calculateMasteryForKey(
    quizzId,
    sourceEvents.filter((event) => event.quizzId === quizzId),
    now,
  );
  void notionId;
  return { quizzId, ...mastery };
}

export function aggregateQuizzMastery(
  quizzIds: readonly string[],
  events: readonly MasteryEvent[],
  now: number,
): readonly QuizzMastery[] {
  return quizzIds.map((quizzId) => calculateQuizzMastery(quizzId, events, now));
}
