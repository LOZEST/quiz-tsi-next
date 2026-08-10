import { describe, expect, it } from 'vitest';
import type { MasteryEvent } from '@domain/mastery/MasteryEvent';
import type {
  LocalDayCalendar,
  LocalDayRange,
} from '@domain/mastery/ProgressPlanning';
import { createProgressSnapshot } from '@domain/progress/ProgressSnapshot';

function event(id: string, occurredAt: string): MasteryEvent {
  return {
    id,
    userId: 'u1',
    notionId: 'n1',
    questionId: `q-${id}`,
    sessionId: `free:${id}`,
    questionInstanceId: `i-${id}`,
    questionVersion: 1,
    sessionMode: 'free',
    result: 'success',
    hintUsed: false,
    timeLimitExceeded: false,
    durationMs: 1_000,
    occurredAt,
  };
}

function fixedOffsetCalendar(offsetMinutes: number): LocalDayCalendar {
  const offset = offsetMinutes * 60_000;
  return {
    rangeForDaysAgo(now, daysAgo) {
      const localNow = new Date(now + offset);
      const start =
        Date.UTC(
          localNow.getUTCFullYear(),
          localNow.getUTCMonth(),
          localNow.getUTCDate() - daysAgo,
        ) - offset;
      const label = new Date(start + offset).toISOString().slice(0, 10);
      return { start, endExclusive: start + 86_400_000, label };
    },
  };
}

function calendarSnapshot(
  events: readonly MasteryEvent[],
  now: number,
  calendar: LocalDayCalendar,
) {
  return createProgressSnapshot({
    events,
    userId: 'u1',
    now,
    programIndex: null,
    calendar,
  }).calendar;
}

describe('progress calendar local days', () => {
  it('counts UTC timestamps in their real UTC+02 local day', () => {
    const calendar = calendarSnapshot(
      [
        event('late', '2026-08-09T22:30:00.000Z'),
        event('early', '2026-08-09T21:30:00.000Z'),
      ],
      Date.parse('2026-08-10T12:00:00.000Z'),
      fixedOffsetCalendar(120),
    );
    expect(calendar).toHaveLength(28);
    expect(calendar.find((day) => day.date === '2026-08-10')?.count).toBe(1);
    expect(calendar.find((day) => day.date === '2026-08-09')?.count).toBe(1);
    expect(new Set(calendar.map((day) => day.date))).toHaveLength(28);
  });

  it('keeps 28 unique contiguous windows across a daylight-saving change', () => {
    const ranges: LocalDayRange[] = [];
    let start = Date.parse('2026-03-01T00:00:00.000Z');
    for (let day = 1; day <= 28; day += 1) {
      const duration = day === 15 ? 23 * 3_600_000 : 24 * 3_600_000;
      ranges.push({
        start,
        endExclusive: start + duration,
        label: `2026-03-${String(day).padStart(2, '0')}`,
      });
      start += duration;
    }
    const boundary: LocalDayCalendar = {
      rangeForDaysAgo: (_now, daysAgo) => ranges[27 - daysAgo]!,
    };
    const events = ranges.map((range, index) =>
      event(
        `dst-${index}`,
        new Date(
          range.start + (range.endExclusive - range.start) / 2,
        ).toISOString(),
      ),
    );
    const calendar = calendarSnapshot(events, ranges[27]!.start, boundary);
    expect(calendar).toHaveLength(28);
    expect(new Set(calendar.map((day) => day.date))).toHaveLength(28);
    expect(calendar.every((day) => day.count === 1)).toBe(true);
    expect(ranges[14]!.endExclusive - ranges[14]!.start).toBe(23 * 3_600_000);
  });
});
