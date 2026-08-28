import { describe, expect, it } from 'vitest';
import type { QuestionEvaluation } from '@domain/evaluation/QuestionEvaluation';
import {
  RECURRENCE_POLICY,
  computeQuestionRecurrenceWeights,
  computeQuestionStreak,
  recurrenceWeightForStreak,
} from '@domain/questions/QuestionRecurrence';

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

describe('computeQuestionStreak', () => {
  it('vaut 0 pour une séquence vide', () => {
    expect(computeQuestionStreak([])).toBe(0);
  });

  it('accumule les réussites propres consécutives', () => {
    expect(computeQuestionStreak(['success'])).toBe(1);
    expect(computeQuestionStreak(['success', 'success'])).toBe(2);
    expect(computeQuestionStreak(['success', 'success', 'success'])).toBe(3);
  });

  it('accumule les échecs consécutifs', () => {
    expect(computeQuestionStreak(['failed'])).toBe(-1);
    expect(computeQuestionStreak(['failed', 'failed'])).toBe(-2);
    expect(computeQuestionStreak(['failed', 'failed', 'failed'])).toBe(-3);
  });

  it('compte un "partial" comme une réussite à moitié vitesse', () => {
    expect(computeQuestionStreak(['partial'])).toBe(0.5);
    expect(computeQuestionStreak(['partial', 'partial'])).toBe(1);
  });

  it('repart à ±1 sur un changement de signe (série consécutive, pas cumul historique)', () => {
    expect(computeQuestionStreak(['success', 'failed'])).toBe(-1);
    expect(computeQuestionStreak(['success', 'success', 'failed'])).toBe(-1);
    expect(computeQuestionStreak(['failed', 'failed', 'success'])).toBe(1);
  });

  it('un "partial" applique le même reset qu\'une réussite propre', () => {
    expect(computeQuestionStreak(['failed', 'failed', 'partial'])).toBe(0.5);
  });

  it('ignore les résultats "skipped" (aucun effet sur la série)', () => {
    expect(computeQuestionStreak(['success', 'skipped', 'success'])).toBe(2);
  });
});

describe('recurrenceWeightForStreak', () => {
  it('renvoie le poids de base pour une série nulle', () => {
    expect(recurrenceWeightForStreak(0)).toBe(RECURRENCE_POLICY.baselineWeight);
  });

  it("décroît avec les réussites propres, jusqu'au plancher", () => {
    expect(recurrenceWeightForStreak(1)).toBeCloseTo(0.25);
    expect(recurrenceWeightForStreak(2)).toBeCloseTo(0.0625);
    expect(recurrenceWeightForStreak(3)).toBeCloseTo(
      RECURRENCE_POLICY.minWeight,
    );
    expect(recurrenceWeightForStreak(10)).toBeCloseTo(
      RECURRENCE_POLICY.minWeight,
    );
  });

  it('ne descend jamais à zéro, même très maîtrisée', () => {
    expect(recurrenceWeightForStreak(50)).toBeGreaterThan(0);
  });

  it("croît avec les échecs consécutifs, jusqu'au plafond", () => {
    expect(recurrenceWeightForStreak(-1)).toBeCloseTo(2.2);
    expect(recurrenceWeightForStreak(-2)).toBeCloseTo(4.84);
    expect(recurrenceWeightForStreak(-3)).toBeCloseTo(
      RECURRENCE_POLICY.maxWeight,
    );
    expect(recurrenceWeightForStreak(-10)).toBeCloseTo(
      RECURRENCE_POLICY.maxWeight,
    );
  });

  it("une réussite après un échec revient moins fort qu'un échec répété", () => {
    const afterOneFailure = recurrenceWeightForStreak(-1);
    const afterThreeFailuresInARow = recurrenceWeightForStreak(-3);
    expect(afterOneFailure).toBeLessThan(afterThreeFailuresInARow);
  });

  it('gère une série fractionnaire (issue d\'un "partial") sans erreur', () => {
    expect(recurrenceWeightForStreak(0.5)).toBeCloseTo(0.5);
  });
});

describe('computeQuestionRecurrenceWeights', () => {
  it('associe à chaque question le poids de sa série la plus récente', () => {
    const weights = computeQuestionRecurrenceWeights([
      evaluation({
        id: 'e1',
        questionId: 'q1',
        outcome: 'success',
        completedAt: '2026-08-09T10:00:00.000Z',
      }),
      evaluation({
        id: 'e2',
        questionId: 'q1',
        outcome: 'success',
        completedAt: '2026-08-09T11:00:00.000Z',
      }),
    ]);
    expect(weights.get('q1')).toBeCloseTo(recurrenceWeightForStreak(2));
  });

  it('ne contamine pas les séries de deux questions distinctes entrelacées dans le temps', () => {
    const weights = computeQuestionRecurrenceWeights([
      evaluation({
        id: 'e1',
        questionId: 'q1',
        outcome: 'failed',
        completedAt: '2026-08-09T10:00:00.000Z',
      }),
      evaluation({
        id: 'e2',
        questionId: 'q2',
        outcome: 'success',
        completedAt: '2026-08-09T10:05:00.000Z',
      }),
      evaluation({
        id: 'e3',
        questionId: 'q1',
        outcome: 'failed',
        completedAt: '2026-08-09T10:10:00.000Z',
      }),
    ]);
    expect(weights.get('q1')).toBeCloseTo(recurrenceWeightForStreak(-2));
    expect(weights.get('q2')).toBeCloseTo(recurrenceWeightForStreak(1));
  });

  it("traite les évaluations dans l'ordre chronologique, quel que soit l'ordre reçu", () => {
    const inOrder = computeQuestionRecurrenceWeights([
      evaluation({
        id: 'e1',
        questionId: 'q1',
        outcome: 'success',
        completedAt: '2026-08-09T10:00:00.000Z',
      }),
      evaluation({
        id: 'e2',
        questionId: 'q1',
        outcome: 'failed',
        completedAt: '2026-08-09T11:00:00.000Z',
      }),
    ]);
    const scrambled = computeQuestionRecurrenceWeights([
      evaluation({
        id: 'e2',
        questionId: 'q1',
        outcome: 'failed',
        completedAt: '2026-08-09T11:00:00.000Z',
      }),
      evaluation({
        id: 'e1',
        questionId: 'q1',
        outcome: 'success',
        completedAt: '2026-08-09T10:00:00.000Z',
      }),
    ]);
    expect(scrambled.get('q1')).toBeCloseTo(inOrder.get('q1') as number);
    expect(inOrder.get('q1')).toBeCloseTo(recurrenceWeightForStreak(-1));
  });

  it('ignore les évaluations "skipped"', () => {
    const withSkip = computeQuestionRecurrenceWeights([
      evaluation({
        id: 'e1',
        questionId: 'q1',
        outcome: 'success',
        completedAt: '2026-08-09T10:00:00.000Z',
      }),
      evaluation({
        id: 'e2',
        questionId: 'q1',
        outcome: 'skipped',
        completedAt: '2026-08-09T10:30:00.000Z',
      }),
      evaluation({
        id: 'e3',
        questionId: 'q1',
        outcome: 'success',
        completedAt: '2026-08-09T11:00:00.000Z',
      }),
    ]);
    expect(withSkip.get('q1')).toBeCloseTo(recurrenceWeightForStreak(2));
  });

  it('ignore les évaluations avec une date illisible', () => {
    const weights = computeQuestionRecurrenceWeights([
      evaluation({
        id: 'e1',
        questionId: 'q1',
        outcome: 'failed',
        completedAt: 'not-a-date',
      }),
    ]);
    expect(weights.has('q1')).toBe(false);
  });

  it("n'inclut pas les questions jamais évaluées", () => {
    const weights = computeQuestionRecurrenceWeights([]);
    expect(weights.has('q1')).toBe(false);
  });
});
