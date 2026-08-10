import type { DailyPlanState, WeakPointsState } from '../session/Session';
import type { MasteryEvent } from './MasteryEvent';
import { calculateNotionMastery, type NotionMastery } from './MasteryPolicy';

export interface DayBoundary {
  startOfDay(now: number): number;
  endOfDay(now: number): number;
}

export interface LocalDayRange {
  readonly start: number;
  readonly endExclusive: number;
  readonly label: string;
}

export interface LocalDayCalendar {
  rangeForDaysAgo(now: number, daysAgo: number): LocalDayRange;
}

function localDateLabel(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const localDayCalendar: LocalDayCalendar = {
  rangeForDaysAgo(now, daysAgo) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - daysAgo);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      start: start.getTime(),
      endExclusive: end.getTime(),
      label: localDateLabel(start),
    };
  },
};

export const localDayBoundary: DayBoundary = {
  startOfDay(now) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  },
  endOfDay(now) {
    const date = new Date(now);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  },
};

export function createDailyPlan(
  events: readonly MasteryEvent[],
  userId: string,
  now: number,
  boundary: DayBoundary = localDayBoundary,
): DailyPlanState {
  try {
    const userEvents = deduplicate(events).filter(
      (event) => event.userId === userId,
    );
    const start = boundary.startOfDay(now);
    const end = boundary.endOfDay(now);
    const notionIds = new Set(userEvents.map((event) => event.notionId));
    const items = [...notionIds].flatMap((notionId) => {
      const beforeToday = userEvents.filter(
        (event) => Date.parse(event.occurredAt) < start,
      );
      const mastery = calculateNotionMastery(notionId, beforeToday, start);
      if (!mastery.nextReviewAt || Date.parse(mastery.nextReviewAt) > end)
        return [];
      const today = userEvents.filter(
        (event) =>
          event.notionId === notionId &&
          Date.parse(event.occurredAt) >= start &&
          Date.parse(event.occurredAt) <= end,
      );
      const plannedCount =
        mastery.status === 'needs-review' || mastery.masteryScore < 50
          ? 3
          : mastery.status === 'overdue' || mastery.masteryScore < 70
            ? 2
            : 1;
      return [
        {
          notionId,
          plannedCount,
          successCount: today.filter((event) => event.result === 'success')
            .length,
          partialCount: today.filter((event) => event.result === 'partial')
            .length,
          failedCount: today.filter((event) => event.result === 'failed')
            .length,
          reason:
            mastery.status === 'overdue'
              ? 'Révision arrivée à échéance.'
              : 'Consolidation recommandée.',
          recommendedDifficulty: mastery.recommendedDifficulty,
          dueAt: mastery.nextReviewAt,
        },
      ];
    });
    if (items.length === 0) return { kind: 'none-scheduled' };
    return items.every((item) => item.successCount >= item.plannedCount)
      ? { kind: 'completed', items }
      : { kind: 'ready', items };
  } catch {
    return {
      kind: 'unavailable',
      message: 'Les données du travail du jour sont inexploitables.',
    };
  }
}

export function createWeakPoints(
  events: readonly MasteryEvent[],
  userId: string,
  now: number,
): WeakPointsState {
  const userEvents = deduplicate(events).filter(
    (event) => event.userId === userId && event.result !== 'skipped',
  );
  const notionIds = new Set(userEvents.map((event) => event.notionId));
  if (userEvents.length < 8 || notionIds.size < 2) {
    return {
      kind: 'calibrating',
      evidence: {
        observedEvidence: userEvents.length,
        requiredEvidence: 8,
        coveredNotions: notionIds.size,
        requiredCoveredNotions: 2,
      },
      message:
        'L’application apprend encore ton niveau. Réponds à davantage de questions pour obtenir une sélection personnalisée.',
    };
  }
  const mastery = [...notionIds].map((notionId) =>
    calculateNotionMastery(notionId, userEvents, now),
  );
  mastery.sort(compareWeakness);
  return {
    kind: 'ready',
    items: mastery.slice(0, 5).map((item, index) => {
      const notionEvents = userEvents.filter(
        (event) => event.notionId === item.notionId,
      );
      return {
        notionId: item.notionId,
        priority: index + 1,
        recommendedDifficulty: item.recommendedDifficulty,
        rationale: rationale(item),
        masteryEstimate: item.masteryScore,
        lastActivityAt: item.lastReviewedAt,
        successCount: notionEvents.filter((event) => event.result === 'success')
          .length,
        partialCount: notionEvents.filter((event) => event.result === 'partial')
          .length,
        failedCount: notionEvents.filter((event) => event.result === 'failed')
          .length,
        recurringErrors: [],
      };
    }),
  };
}

function deduplicate(events: readonly MasteryEvent[]): MasteryEvent[] {
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

function compareWeakness(a: NotionMastery, b: NotionMastery): number {
  return (
    Number(b.lastResult === 'failed') - Number(a.lastResult === 'failed') ||
    Number(b.status === 'overdue') - Number(a.status === 'overdue') ||
    a.masteryScore - b.masteryScore ||
    a.confidenceScore - b.confidenceScore ||
    Date.parse(a.lastReviewedAt ?? '1970-01-01') -
      Date.parse(b.lastReviewedAt ?? '1970-01-01') ||
    a.notionId.localeCompare(b.notionId)
  );
}

function rationale(mastery: NotionMastery): string {
  const due =
    mastery.status === 'overdue' || mastery.status === 'needs-review'
      ? 'Révision prioritaire.'
      : 'Consolidation utile.';
  return `${due} Maîtrise ${mastery.masteryScore} %, confiance ${mastery.confidenceScore} %.`;
}
