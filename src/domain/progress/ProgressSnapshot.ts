import type { ProgramIndex } from '../program/Program';
import type { MasteryEvent } from '../mastery/MasteryEvent';
import {
  calculateNotionMastery,
  MASTERY_POLICY,
  type NotionMastery,
} from '../mastery/MasteryPolicy';
import {
  createDailyPlan,
  createWeakPoints,
  localDayCalendar,
  type LocalDayCalendar,
} from '../mastery/ProgressPlanning';

export interface ProgressPartSnapshot {
  id: string;
  label: string;
  masteryScore: number | null;
  confidenceScore: number | null;
  notions: readonly ProgressNotionSnapshot[];
}
export interface ProgressNotionSnapshot extends NotionMastery {
  label: string;
  chapterLabel: string;
}
export interface ProgressWeekSnapshot {
  weekStart: string;
  accuracy: number | null;
  count: number;
}
export interface ProgressSnapshot {
  partial: boolean;
  globalMastery: number | null;
  globalConfidence: number | null;
  globalMasteryDelta: number | null;
  dueCount: number;
  lastSevenDaysActivity: number;
  streakDays: number;
  parts: readonly ProgressPartSnapshot[];
  calendar: readonly { date: string; count: number }[];
  weeklyAccuracy: readonly ProgressWeekSnapshot[];
  recent: readonly MasteryEvent[];
  dailyPlan: ReturnType<typeof createDailyPlan>;
  weakPoints: ReturnType<typeof createWeakPoints>;
}

function computeGlobalMastery(
  events: readonly MasteryEvent[],
  now: number,
): number | null {
  const notionIds = new Set(
    events
      .filter((event) => event.result !== 'skipped')
      .map((event) => event.notionId),
  );
  const observed = [...notionIds].map((id) =>
    calculateNotionMastery(id, events, now),
  );
  const confidenceTotal = observed.reduce(
    (sum, item) => sum + item.confidenceScore,
    0,
  );
  return confidenceTotal === 0
    ? null
    : Math.round(
        observed.reduce(
          (sum, item) => sum + item.masteryScore * item.confidenceScore,
          0,
        ) / confidenceTotal,
      );
}

function computeStreakDays(
  calendar: readonly { date: string; count: number }[],
): number {
  const days = [...calendar];
  let index = days.length - 1;
  if (index >= 0 && days[index]!.count === 0) index -= 1;
  let streak = 0;
  while (index >= 0 && days[index]!.count > 0) {
    streak += 1;
    index -= 1;
  }
  return streak;
}

function computeWeeklyAccuracy(
  events: readonly MasteryEvent[],
  now: number,
  calendarBoundary: LocalDayCalendar,
): ProgressWeekSnapshot[] {
  const weeks: ProgressWeekSnapshot[] = [];
  for (let week = 3; week >= 0; week -= 1) {
    const start = calendarBoundary.rangeForDaysAgo(now, week * 7 + 6);
    const end = calendarBoundary.rangeForDaysAgo(now, week * 7);
    const weekEvents = events.filter(
      (
        event,
      ): event is MasteryEvent & {
        result: 'success' | 'partial' | 'failed';
      } => {
        const occurredAt = Date.parse(event.occurredAt);
        return (
          occurredAt >= start.start &&
          occurredAt < end.endExclusive &&
          event.result !== 'skipped'
        );
      },
    );
    const totalValue = weekEvents.reduce(
      (sum, event) => sum + MASTERY_POLICY.resultValue[event.result],
      0,
    );
    weeks.push({
      weekStart: start.label,
      accuracy: weekEvents.length
        ? Math.round((totalValue / weekEvents.length) * 100)
        : null,
      count: weekEvents.length,
    });
  }
  return weeks;
}

export function createProgressSnapshot(input: {
  events: readonly MasteryEvent[];
  userId: string;
  now: number;
  programIndex: ProgramIndex | null;
  calendar?: LocalDayCalendar;
  partial?: boolean;
}): ProgressSnapshot {
  const events = [
    ...new Map(
      input.events
        .filter((event) => event.userId === input.userId)
        .map((event) => [event.id, event]),
    ).values(),
  ];
  const notionIds = new Set(
    events
      .filter((event) => event.result !== 'skipped')
      .map((event) => event.notionId),
  );
  const masteryByNotion = new Map(
    [...notionIds].map((id) => [
      id,
      calculateNotionMastery(id, events, input.now),
    ]),
  );
  const observed = [...masteryByNotion.values()];
  const confidenceTotal = observed.reduce(
    (sum, item) => sum + item.confidenceScore,
    0,
  );
  const globalMastery =
    confidenceTotal === 0
      ? null
      : Math.round(
          observed.reduce(
            (sum, item) => sum + item.masteryScore * item.confidenceScore,
            0,
          ) / confidenceTotal,
        );
  const globalConfidence =
    observed.length === 0
      ? null
      : Math.round(
          observed.reduce((sum, item) => sum + item.confidenceScore, 0) /
            observed.length,
        );
  const parts =
    input.programIndex?.getAllParts().map((part) => {
      const chapters = input.programIndex!.getChaptersForPart(part.id);
      const notions = chapters.flatMap((chapter) =>
        input
          .programIndex!.getNotionsForChapter(chapter.id)
          .flatMap((notion) => {
            const mastery = masteryByNotion.get(notion.id);
            return mastery
              ? [
                  {
                    ...mastery,
                    label: notion.label,
                    chapterLabel: chapter.label,
                  },
                ]
              : [];
          }),
      );
      const confidence = notions.reduce(
        (sum, notion) => sum + notion.confidenceScore,
        0,
      );
      return {
        id: part.id,
        label: part.label,
        notions,
        masteryScore: confidence
          ? Math.round(
              notions.reduce(
                (sum, notion) =>
                  sum + notion.masteryScore * notion.confidenceScore,
                0,
              ) / confidence,
            )
          : null,
        confidenceScore: notions.length
          ? Math.round(confidence / notions.length)
          : null,
      };
    }) ?? [];
  const calendarBoundary = input.calendar ?? localDayCalendar;
  const calendar = Array.from({ length: 28 }, (_, offset) => {
    const range = calendarBoundary.rangeForDaysAgo(input.now, 27 - offset);
    return {
      date: range.label,
      count: events.filter((event) => {
        const occurredAt = Date.parse(event.occurredAt);
        return occurredAt >= range.start && occurredAt < range.endExclusive;
      }).length,
    };
  });
  const oneWeekAgo = input.now - 7 * 86_400_000;
  const eventsOneWeekAgo = events.filter(
    (event) => Date.parse(event.occurredAt) <= oneWeekAgo,
  );
  const globalMasteryOneWeekAgo = computeGlobalMastery(
    eventsOneWeekAgo,
    oneWeekAgo,
  );
  return {
    partial: input.partial ?? false,
    globalMastery,
    globalConfidence,
    globalMasteryDelta:
      globalMastery === null || globalMasteryOneWeekAgo === null
        ? null
        : globalMastery - globalMasteryOneWeekAgo,
    dueCount: observed.filter(
      (item) => item.status === 'overdue' || item.status === 'needs-review',
    ).length,
    lastSevenDaysActivity: events.filter(
      (event) => Date.parse(event.occurredAt) >= oneWeekAgo,
    ).length,
    streakDays: computeStreakDays(calendar),
    parts,
    calendar,
    weeklyAccuracy: computeWeeklyAccuracy(events, input.now, calendarBoundary),
    recent: events
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 10),
    dailyPlan: createDailyPlan(events, input.userId, input.now),
    weakPoints: createWeakPoints(events, input.userId, input.now),
  };
}
