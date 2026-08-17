import { describe, expect, it } from 'vitest';
import type { QuestionEvaluation } from '@domain/evaluation/QuestionEvaluation';
import {
  projectMasteryEvents,
  type MasteryEvent,
} from '@domain/mastery/MasteryEvent';
import {
  calculateNotionMastery,
  recommendedDifficulty,
} from '@domain/mastery/MasteryPolicy';
import {
  createDailyPlan,
  createWeakPoints,
  type DayBoundary,
} from '@domain/mastery/ProgressPlanning';

const NOW = Date.parse('2026-08-10T12:00:00.000Z');
const boundary: DayBoundary = {
  startOfDay: () => Date.parse('2026-08-10T00:00:00.000Z'),
  endOfDay: () => Date.parse('2026-08-10T23:59:59.999Z'),
};

function evaluation(
  overrides: Partial<QuestionEvaluation> = {},
): QuestionEvaluation {
  return {
    id: 'e1',
    userId: 'u1',
    sessionId: 'free:s1',
    questionInstanceId: 'i1',
    questionId: 'q1',
    questionVersion: 1,
    questionSource: 'static',
    partId: 'p1',
    chapterId: 'c1',
    notionId: 'n1',
    questionType: 'course',
    difficulty: 'standard',
    hintUsed: false,
    timeExceeded: false,
    outcome: 'success',
    startedAt: '2026-08-09T10:00:00.000Z',
    completedAt: '2026-08-09T10:01:00.000Z',
    ...overrides,
  };
}

function event(
  index: number,
  overrides: Partial<MasteryEvent> = {},
): MasteryEvent {
  return {
    id: `m${index}`,
    userId: 'u1',
    notionId: 'n1',
    quizzId: null,
    questionId: `q${index}`,
    sessionId: `free:s${index}`,
    questionInstanceId: `i${index}`,
    questionVersion: 1,
    sessionMode: 'free',
    result: 'success',
    hintUsed: false,
    timeLimitExceeded: false,
    durationMs: 1000,
    occurredAt: new Date(NOW - (10 - index) * 86_400_000).toISOString(),
    ...overrides,
  };
}

describe('mastery projection and policy v1', () => {
  it('projects deterministically, derives duration, deduplicates and reports unknown modes', () => {
    const known = evaluation();
    const unknown = evaluation({ id: 'e2', sessionId: 'legacy' });
    const result = projectMasteryEvents([known, known, unknown]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      id: 'mastery:e1',
      sessionMode: 'free',
      durationMs: 60_000,
      result: 'success',
    });
    expect(result).toMatchObject({
      partial: true,
      unresolvedEvaluationIds: ['e2'],
    });
  });

  it('ignores skipped and distinguishes success, partial and failed', () => {
    const skipped = calculateNotionMastery(
      'n1',
      [event(1, { result: 'skipped' })],
      NOW,
    );
    expect(skipped.status).toBe('new');
    const success = calculateNotionMastery('n1', [event(1)], NOW);
    const partial = calculateNotionMastery(
      'n1',
      [event(1, { result: 'partial' })],
      NOW,
    );
    const failed = calculateNotionMastery(
      'n1',
      [event(1, { result: 'failed' })],
      NOW,
    );
    expect(success.masteryScore).toBe(100);
    expect(partial.masteryScore).toBe(68);
    expect(failed).toMatchObject({ masteryScore: 0, status: 'needs-review' });
  });

  it('applies recency, same-question/session weights, confidence and stability', () => {
    const events = [
      event(1, {
        questionId: 'same',
        sessionId: 'free:same',
        result: 'failed',
      }),
      event(2, { questionId: 'same', sessionId: 'free:same' }),
    ];
    const mastery = calculateNotionMastery('n1', events, NOW);
    expect(mastery.masteryScore).toBeGreaterThan(0);
    expect(mastery.masteryScore).toBeLessThan(100);
    expect(mastery.confidenceScore).toBeGreaterThan(0);
    expect(mastery.stabilityDays).toBeCloseTo(0.55);
    expect(mastery.nextReviewAt).toBe(
      new Date(
        Date.parse(events[1]!.occurredAt) + 0.55 * 86_400_000,
      ).toISOString(),
    );
  });

  it('uses only mastery and confidence for difficulty', () => {
    expect(recommendedDifficulty(54, 100)).toBe('fundamental');
    expect(recommendedDifficulty(90, 34)).toBe('fundamental');
    expect(recommendedDifficulty(80, 65)).toBe('trap');
    expect(recommendedDifficulty(70, 60)).toBe('standard');
  });
});

describe('daily plan and weak points', () => {
  it('returns none, ready and completed while only successes complete work', () => {
    expect(createDailyPlan([], 'u1', NOW, boundary).kind).toBe(
      'none-scheduled',
    );
    const oldFailure = event(1, {
      result: 'failed',
      occurredAt: '2026-08-01T10:00:00.000Z',
    });
    expect(createDailyPlan([oldFailure], 'u1', NOW, boundary).kind).toBe(
      'ready',
    );
    const partial = event(2, {
      result: 'partial',
      occurredAt: '2026-08-10T08:00:00.000Z',
    });
    const failed = event(3, {
      result: 'failed',
      occurredAt: '2026-08-10T09:00:00.000Z',
    });
    expect(
      createDailyPlan([oldFailure, partial, failed], 'u1', NOW, boundary).kind,
    ).toBe('ready');
    const successes = [4, 5, 6].map((index) =>
      event(index, { occurredAt: `2026-08-10T1${index - 4}:00:00.000Z` }),
    );
    expect(
      createDailyPlan([oldFailure, ...successes], 'u1', NOW, boundary).kind,
    ).toBe('completed');
  });

  it('keeps plan content stable during the day', () => {
    const old = event(1, {
      result: 'failed',
      occurredAt: '2026-08-01T10:00:00.000Z',
    });
    const today = event(2, {
      notionId: 'new-today',
      occurredAt: '2026-08-10T10:00:00.000Z',
    });
    const first = createDailyPlan([old], 'u1', NOW, boundary);
    const later = createDailyPlan(
      [old, today],
      'u1',
      NOW + 3_600_000,
      boundary,
    );
    expect(
      later.kind === 'ready' && later.items.map((item) => item.notionId),
    ).toEqual(
      first.kind === 'ready' ? first.items.map((item) => item.notionId) : [],
    );
  });

  it('calibrates before both thresholds then ranks deterministically, caps at five and invents no errors', () => {
    expect(createWeakPoints([event(1)], 'u1', NOW).kind).toBe('calibrating');
    expect(
      createWeakPoints(
        Array.from({ length: 8 }, (_, index) => event(index)),
        'u1',
        NOW,
      ).kind,
    ).toBe('calibrating');
    const enough = Array.from({ length: 12 }, (_, index) =>
      event(index, {
        notionId: `n${index % 6}`,
        result: index === 0 ? 'failed' : 'success',
      }),
    );
    const result = createWeakPoints(enough, 'u1', NOW);
    expect(result.kind).toBe('ready');
    if (result.kind === 'ready') {
      expect(result.items).toHaveLength(5);
      expect(result.items[0]?.notionId).toBe('n0');
      expect(
        result.items.every((item) => item.recurringErrors.length === 0),
      ).toBe(true);
    }
  });

  it('isolates users and duplicate ids', () => {
    const a = Array.from({ length: 8 }, (_, index) =>
      event(index, { notionId: `n${index % 2}` }),
    );
    const b = a.map((item, index) => ({
      ...item,
      id: `b${index}`,
      userId: 'u2',
      result: 'failed' as const,
    }));
    expect(createWeakPoints([...a, ...b, a[0]!], 'u1', NOW)).toEqual(
      createWeakPoints(a, 'u1', NOW),
    );
  });
});
