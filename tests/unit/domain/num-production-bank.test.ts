import { describe, expect, it } from 'vitest';
import bundle from '../../../src/data/question-banks/num-production-v1.json';
import officialProgram from '../../../src/data/program/official-program-v1.json';
import sourceTests from '../../fixtures/num-production-source-tests.json';
import { calculateNumAnswer } from '../../../scripts/num-bank-audit.mjs';
import { validateQuestionBankBundle } from '@domain/questions/QuestionBank';
import { evaluateSafeExpression } from '@domain/questions/SafeExpressionEvaluator';
import { validateParameterizedQuestion } from '@domain/questions/QuestionParameterValidation';
import { generateParameterAssignment } from '@domain/questions/ParameterizedQuestionGenerator';
import { instantiateQuestionVariant } from '@domain/questions/QuestionInstantiation';
import { mathAstToLatex } from '@features/questions/math/MathAstToLatex';
import { createProgramIndex, validateProgram } from '@domain/program/Program';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';

const checkedProgram = validateProgram(officialProgram);
if (!checkedProgram.ok) throw new Error('Programme officiel de test invalide.');
const programIndex = createProgramIndex(checkedProgram.value);
const questionRepository = new InMemoryQuestionRepository();
const imported = questionRepository.importAndReplace(bundle, programIndex);
if (imported.kind !== 'ready') throw new Error('Banque NUM de test invalide.');

describe('banque NUM de production', () => {
  const question = (id: string) => {
    const result = questionRepository.getLatestById(id);
    expect(result, id).toBeDefined();
    if (!result) throw new Error(`Question absente : ${id}`);
    return result;
  };
  const instantiate = (id: string, parameters: Record<string, number>) => {
    const instantiated = instantiateQuestionVariant(question(id), parameters);
    expect(instantiated.ok, id).toBe(true);
    if (!instantiated.ok) throw new Error(instantiated.message);
    return instantiated.value;
  };
  const renderedMath = (id: string, parameters: Record<string, number>) =>
    instantiate(id, parameters).prompt.flatMap((segment) =>
      segment.kind === 'inline-math' ? [mathAstToLatex(segment.ast)] : [],
    );
  const negativeOperandValues = (raw: unknown): number[] => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
      return [];
    const node = raw as Record<string, unknown>;
    const output: number[] = [];
    if (['binary', 'power', 'unary'].includes(String(node.kind)))
      for (const child of Object.values(node))
        if (
          typeof child === 'object' &&
          child !== null &&
          !Array.isArray(child) &&
          (child as Record<string, unknown>).kind === 'resolved-parameter' &&
          typeof (child as Record<string, unknown>).value === 'number' &&
          ((child as Record<string, unknown>).value as number) < 0
        )
          output.push((child as Record<string, unknown>).value as number);
    for (const child of Object.values(node))
      output.push(...negativeOperandValues(child));
    return output;
  };

  it('instancie les 120 prompts officiels et recalcule leurs résultats', () => {
    expect(sourceTests).toHaveLength(120);
    let concordances = 0;
    for (const {
      calculId,
      test,
      parameters,
      sourceExpression,
      expected,
    } of sourceTests) {
      const instantiated = instantiate(calculId, parameters);
      const formulaSegments = instantiated.prompt.filter(
        (segment) => segment.kind === 'inline-math',
      );
      const formulas = formulaSegments.map((segment) =>
        segment.kind === 'inline-math' ? mathAstToLatex(segment.ast) : '',
      );
      expect(formulas.length, `${calculId} — test ${test}`).toBeGreaterThan(0);
      expect(formulas.join(' '), `${calculId} — test ${test}`).not.toContain(
        '@',
      );
      for (const segment of formulaSegments) {
        if (segment.kind !== 'inline-math') continue;
        const latex = mathAstToLatex(segment.ast);
        for (const value of negativeOperandValues(segment.ast))
          expect(latex, `${calculId} — test ${test}`).toContain(
            `\\left(${value}\\right)`,
          );
      }
      expect(
        calculateNumAnswer(calculId, parameters),
        `${calculId} — test ${test}`,
      ).toEqual(sourceExpression);
      expect(
        calculateNumAnswer(calculId, parameters),
        `${calculId} — test ${test}`,
      ).toEqual(expected);
      concordances += 1;
    }
    expect(concordances).toBe(120);
  });

  it('audite prompt, indice et correction sur les 120 vecteurs normatifs', () => {
    let inspected = 0;
    for (const { calculId, test, parameters } of sourceTests) {
      const instantiated = instantiate(calculId, parameters);
      const segments = [
        ...instantiated.prompt,
        ...instantiated.hint,
        ...instantiated.correction.flatMap((step) => step.content),
      ];
      expect(
        instantiated.hint.length,
        `${calculId} — test ${test}`,
      ).toBeGreaterThan(0);
      expect(
        instantiated.correction.length,
        `${calculId} — test ${test}`,
      ).toBeGreaterThan(0);
      const visible = segments
        .map((segment) =>
          segment.kind === 'text'
            ? segment.value
            : segment.kind === 'line-break'
              ? '\n'
              : mathAstToLatex(segment.ast),
        )
        .join(' ');
      expect(visible, `${calculId} — test ${test}`).not.toContain('@');
      expect(visible, `${calculId} — test ${test}`).not.toMatch(
        /\{\s*"(?:kind|source|syntaxVersion)"/,
      );
      for (const segment of segments)
        if (segment.kind === 'inline-math' || segment.kind === 'display-math')
          expect(() => mathAstToLatex(segment.ast)).not.toThrow();
      inspected += 1;
    }
    expect(inspected).toBe(120);
  });

  it('documente que les champs source expression et réponse sont identiques', () => {
    expect(sourceTests).toHaveLength(120);
    for (const { sourceExpression, expected } of sourceTests)
      expect(sourceExpression).toEqual(expected);
  });

  it('encode explicitement chaque famille de produit implicite', () => {
    const sources = (id: string) => {
      const entry = bundle.questions.find(
        ({ question: item }) => item.id === id,
      );
      expect(entry).toBeDefined();
      return (entry?.question.prompt ?? []).flatMap((segment) =>
        segment.kind === 'inline-math' && segment.math
          ? [segment.math.source]
          : [],
      );
    };
    expect(sources('NUM-F01-F02')).toContain('Q=(@a*@b)/@b');
    expect(sources('NUM-F02-F02')).toContain('E=(2*@a+1)+(2*@b+1)');
    expect(sources('NUM-F02-N01')).toContain('E=@d*(@a-@b)+@k*@d');
    expect(sources('NUM-F02-N05')).toContain('N=@d*@q+@r');
    expect(sources('NUM-F02-P04')).toContain('N=(6*@a-1)*(6*@a+1)');
    expect(sources('NUM-F04-N04')).toContain('@m*@n');
    expect(sources('NUM-F04-F02')).toContain('@b*@x*@y!=0');
    expect(sources('NUM-F01-N03')).toContain(
      'E=sqrt((@p^2)*@r)-sqrt((@q^2)*@r)',
    );
  });

  it('préserve la multiplication et les facteurs négatifs de NUM-F01-F02', () => {
    const formulas = renderedMath('NUM-F01-F02', { a: 12, b: -5 });
    expect(formulas.join(' ')).toContain(
      '\\frac{\\left(12\\times \\left(-5\\right)\\right)}{\\left(-5\\right)}',
    );
    expect(formulas.join(' ')).not.toContain('12-5');
  });

  it('rend sans concaténation 2a, 6a, kd, dq et mn', () => {
    expect(renderedMath('NUM-F02-F02', { a: 3, b: 7 }).join(' ')).toContain(
      '2\\times 3+1',
    );
    expect(renderedMath('NUM-F02-P04', { a: 3 }).join(' ')).toContain(
      '\\left(6\\times 3-1\\right)',
    );
    expect(
      renderedMath('NUM-F02-N01', { a: 7, b: 2, k: -1, d: 3 }).join(' '),
    ).toContain('\\left(-1\\right)\\times 3');
    expect(
      renderedMath('NUM-F02-N05', { d: 7, q: -4, r: 2 }).join(' '),
    ).toContain('7\\times \\left(-4\\right)+2');
    expect(
      renderedMath('NUM-F04-N04', { x: 4, p: 1, q: 1, m: 2, n: 2 }).join(' '),
    ).toContain('2\\times 2');
  });
  it('contient exactement les 60 questions validées et leur répartition', () => {
    expect(bundle.questions).toHaveLength(60);
    expect(
      new Set(bundle.questions.map(({ question }) => question.id)).size,
    ).toBe(60);
    expect(
      new Set(
        bundle.questions.map(
          ({ question }) => question.classification.notionId,
        ),
      ),
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

  it('ne montre aucun langage interne dans les 60 énoncés élèves', () => {
    for (const { question: item } of bundle.questions) {
      const prompt = item.prompt
        .map((segment) =>
          segment.kind === 'text'
            ? segment.value
            : (segment.math?.source ?? ''),
        )
        .join(' ');
      expect(prompt, item.id).not.toMatch(/JSON|générat(?:eur|ion)/i);
      expect(prompt, item.id).not.toContain('@résultat');
      expect(prompt, item.id).not.toContain('carré@s');
    }
  });

  it('est validée contre le vrai programme avant son chargement atomique', () => {
    const checked = validateQuestionBankBundle(bundle, programIndex);
    expect(checked.ok).toBe(true);
    expect(questionRepository.getBankMetadata()).toMatchObject({
      bundleId: 'quiz-tsi-official-num-v1',
      questionCount: 60,
    });
    expect(questionRepository.listPublished()).toHaveLength(60);
    expect(questionRepository.getLatestById('NUM-F02-P04')).toMatchObject({
      status: 'published',
      validated: true,
      parameterization: { validationVariantCount: 9 },
    });
  });

  it('conserve la provenance résolue de chaque question', () => {
    for (const question of questionRepository.listPublished()) {
      expect(question.provenance?.bundleId).toBe('quiz-tsi-official-num-v1');
      expect(question.provenance?.references.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('instancie trois seeds de chacune des 60 questions et inspecte le prompt', () => {
    let promptsInspected = 0;
    for (const question of questionRepository.listPublished()) {
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
                : mathAstToLatex(segment.ast),
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
    const question = questionRepository.getLatestById('NUM-F02-P04');
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
