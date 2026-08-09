import { describe, expect, it } from 'vitest';
import bundle from '../../../src/data/question-banks/num-production-v1.json';
import sourceTests from '../../fixtures/num-production-source-tests.json';
import { calculateNumAnswer } from '../../../scripts/num-bank-audit.mjs';
import { validateQuestionBankBundle } from '@domain/questions/QuestionBank';
import { evaluateSafeExpression } from '@domain/questions/SafeExpressionEvaluator';
import { validateParameterizedQuestion } from '@domain/questions/QuestionParameterValidation';
import { generateParameterAssignment } from '@domain/questions/ParameterizedQuestionGenerator';
import { instantiateQuestionVariant } from '@domain/questions/QuestionInstantiation';
import {
  productionProgramIndex,
  productionQuestionRepository,
} from '@infrastructure/session/ProductionRevisionServices';

describe('banque NUM de production', () => {
  it('recalcule indépendamment les 120 résultats normatifs du classeur', () => {
    expect(sourceTests).toHaveLength(120);
    let concordances = 0;
    for (const { calculId, test, parameters, expected } of sourceTests) {
      expect(
        calculateNumAnswer(calculId, parameters),
        `${calculId} — test ${test}`,
      ).toEqual(expected);
      concordances += 1;
    }
    expect(concordances).toBe(120);
  });

  it('référence les paramètres concaténés sans toucher au verbe français « a »', () => {
    const source = (id: string) => {
      const entry = bundle.questions.find(({ question }) => question.id === id);
      expect(entry).toBeDefined();
      return [
        ...(entry?.question.prompt ?? []),
        ...(entry?.question.correction.flatMap(({ content }) => content) ?? []),
      ]
        .map((segment) => ('value' in segment ? segment.value : ''))
        .join(' ');
    };
    expect(source('NUM-F01-F02')).toContain('(@a@b)/@b');
    expect(source('NUM-F01-F03')).toContain('a une écriture');
    expect(source('NUM-F01-F03')).not.toContain('@a une écriture');
    expect(source('NUM-F01-F04')).toContain('√(@a²)');
    expect(source('NUM-F02-F02')).toContain('2@a+1');
    expect(source('NUM-F02-N01')).toContain('@k@d');
    expect(source('NUM-F02-N02')).toContain('2^@a*3^@b*5^@c');
    expect(source('NUM-F02-P03')).toContain('@x² mod @p');
    expect(source('NUM-F02-P04')).toContain('(6@a−1)(6@a+1)');
    expect(source('NUM-F03-N03')).toContain('2@t+1');
    expect(source('NUM-F04-N04')).toContain('@m@n');
  });
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

  it('instancie trois seeds de chacune des 60 questions et inspecte le prompt', () => {
    let promptsInspected = 0;
    for (const question of productionQuestionRepository.listPublished()) {
      for (const seed of ['audit-a', 'audit-b', 'audit-c']) {
        const generated = generateParameterAssignment(
          question.parameterization,
          `${question.id}:${seed}`,
        );
        expect(generated.kind, `${question.id}:${seed}`).toBe('ready');
        if (generated.kind !== 'ready') continue;
        const instantiated = instantiateQuestionVariant(
          question,
          generated.variants[0],
        );
        expect(instantiated.ok, `${question.id}:${seed}`).toBe(true);
        if (!instantiated.ok) continue;
        const visiblePrompt = instantiated.value.prompt
          .map((segment) =>
            segment.kind === 'text'
              ? segment.value
              : segment.kind === 'line-break'
                ? '\n'
                : segment.mathSource.source,
          )
          .join(' ');
        expect(visiblePrompt.trim(), `${question.id}:${seed}`).not.toBe('');
        expect(visiblePrompt, `${question.id}:${seed}`).not.toContain('@');
        promptsInspected += 1;
      }
    }
    expect(promptsInspected).toBe(180);
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
