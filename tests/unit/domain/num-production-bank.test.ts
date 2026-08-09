import { describe, expect, it } from 'vitest';
import bundle from '../../../src/data/question-banks/num-production-v1.json';
import { validateQuestionBankBundle } from '@domain/questions/QuestionBank';
import { evaluateSafeExpression } from '@domain/questions/SafeExpressionEvaluator';
import { validateParameterizedQuestion } from '@domain/questions/QuestionParameterValidation';
import {
  productionProgramIndex,
  productionQuestionRepository,
} from '@infrastructure/session/ProductionRevisionServices';

describe('banque NUM de production', () => {
  it('contient exactement les 60 questions validées et leur répartition', () => {
    expect(bundle.questions).toHaveLength(60);
    expect(
      new Set(bundle.questions.map(({ question }) => question.id)).size,
    ).toBe(60);
    expect(
      new Set(bundle.questions.map(({ question }) => question.notionId)),
    ).toEqual(new Set(['NUM-F01', 'NUM-F02', 'NUM-F03', 'NUM-F04']));
    expect(
      Object.fromEntries(
        ['fundamental', 'standard', 'trap'].map((difficulty) => [
          difficulty,
          bundle.questions.filter(
            ({ question }) => question.difficulty === difficulty,
          ).length,
        ]),
      ),
    ).toEqual({ fundamental: 20, standard: 20, trap: 20 });
  });

  it('est validée contre le vrai programme avant son chargement atomique', () => {
    const checked = validateQuestionBankBundle(bundle, productionProgramIndex);
    expect(checked.ok).toBe(true);
    expect(productionQuestionRepository.getBankMetadata()).toMatchObject({
      bundleId: 'quiz-tsi-official-num-v1',
      questionCount: 60,
    });
    expect(productionQuestionRepository.listPublished()).toHaveLength(60);
    expect(
      productionQuestionRepository.getLatestById('NUM-F02-P04'),
    ).toMatchObject({
      status: 'published',
      validated: true,
      parameterization: { validationVariantCount: 9 },
    });
  });

  it('conserve la provenance résolue de chaque question', () => {
    for (const question of productionQuestionRepository.listPublished()) {
      expect(question.provenance?.bundleId).toBe('quiz-tsi-official-num-v1');
      expect(question.provenance?.references.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('valide exhaustivement les neuf variantes source de NUM-F02-P04', () => {
    const question = productionQuestionRepository.getLatestById('NUM-F02-P04');
    const result = validateParameterizedQuestion(question, 'num-f02-p04-proof');
    expect(result.kind).toBe('ready');
    expect(
      new Set(result.variants.map(({ parameterValues }) => parameterValues.a)),
    ).toEqual(new Set([2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(result.statistics).toMatchObject({
      totalCombinations: 9,
      validCombinations: 9,
      searchCompleted: true,
      exhaustive: true,
    });
  });

  it('évalue le PGCD entier de façon sûre et déterministe', () => {
    const gcd = (left: number, right: number) =>
      evaluateSafeExpression(
        {
          kind: 'math-function',
          function: 'gcd',
          arguments: [
            { kind: 'literal', value: left },
            { kind: 'literal', value: right },
          ],
        },
        {},
      );
    expect(gcd(-18, 24)).toEqual({ ok: true, value: 6 });
    expect(gcd(0, 9)).toEqual({ ok: true, value: 9 });
    expect(gcd(0, 0)).toEqual({ ok: true, value: 0 });
  });
});
