import { describe, expect, it } from 'vitest';
import { evaluateSafeExpression } from '@domain/questions/SafeExpressionEvaluator';
import {
  parseRelations,
  supportedRelationOperators,
} from '../../../scripts/full-bank/parse-relations.mjs';
import {
  compileContent,
  insertImplicitMultiplication,
  translateLatexToGrammar,
} from '../../../scripts/full-bank/content-compiler.mjs';
import {
  parseParameterSpecification,
  SUPPORTED_SCHEMA_VERSIONS,
} from '../../../scripts/full-bank/parse-parameters.mjs';

const relation = (value: object) =>
  parseRelations({ schema_version: '1.1', relations: [value] }, 'TEST')[0];

describe('pipeline générique de banque complète', () => {
  it.each(['1.1', '2.1', '3.0', '4.0', '5.0'])(
    'détecte explicitement le schéma historique %s',
    (schemaVersion) => {
      const parsed = parseParameterSpecification({
        Calcul_ID: `TEST-${schemaVersion}`,
        Type_base: 'PRINCIPAL',
        Parametres_JSON: JSON.stringify({
          schema_version: schemaVersion,
          parameters: {
            n: {
              type: 'integer',
              min: -3,
              max: 3,
              step: 1,
              exclude: [0],
              parity: 'odd',
            },
          },
          relations:
            schemaVersion === '1.1' ? [] : { mode: 'all_combinations' },
        }),
      });
      expect(parsed.sourceSchemaVersion).toBe(schemaVersion);
      expect(parsed.parameterization?.variables[0]?.domain).toEqual({
        kind: 'integer',
        minimum: -3,
        maximum: 3,
        step: 1,
        excludedValues: [-2, 0, 2],
      });
    },
  );

  it('convertit les enums number, string et angle en choix sans exécuter les données', () => {
    const parsed = parseParameterSpecification({
      Calcul_ID: 'AUTO6-TEST',
      Type_base: 'AUTOMATISME',
      Parametres_JSON: JSON.stringify({
        numberValue: { type: 'number', enum: [1, 2.5] },
        stringValue: { type: 'string', enum: ['a', 'b'] },
        angleValue: { type: 'angle', enum: ['π/6', 'π/4'] },
      }),
    });
    expect(parsed.sourceSchemaVersion).toBe('AUTOMATISME');
    expect(
      parsed.parameterization?.variables.map(({ domain }) => domain),
    ).toEqual([
      { kind: 'choice', values: [1, 2.5] },
      { kind: 'choice', values: ['a', 'b'] },
      { kind: 'choice', values: ['π/6', 'π/4'] },
    ]);
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([
      '1.1',
      '2.1',
      '3.0',
      '4.0',
      '5.0',
      'AUTOMATISME',
    ]);
  });

  it.each([
    ['!=', { op: '!=', left: 'a', right: 'b' }, { a: 1, b: 2 }],
    ['=', { op: '=', left: 'a', right: 'b' }, { a: 2, b: 2 }],
    ['<', { op: '<', left: 'a', right: 'b' }, { a: 1, b: 2 }],
    ['<=', { op: '<=', left: 'a', right: 'b' }, { a: 2, b: 2 }],
    ['>', { op: '>', left: 'a', right: 'b' }, { a: 2, b: 1 }],
    ['>=', { op: '>=', left: 'a', right: 'b' }, { a: 2, b: 2 }],
    [
      'and',
      {
        op: 'and',
        args: [
          { op: '>', left: 'a', right: 0 },
          { op: '<', left: 'a', right: 2 },
        ],
      },
      { a: 1 },
    ],
    [
      'or',
      {
        op: 'or',
        args: [
          { op: '=', left: 'a', right: 1 },
          { op: '=', left: 'a', right: 2 },
        ],
      },
      { a: 2 },
    ],
    ['parity', { op: 'parity', left: 'a', right: 'odd' }, { a: 3 }],
    ['coprime', { op: 'coprime', left: 'a', right: 'b' }, { a: 8, b: 15 }],
    [
      'coprime_all',
      { op: 'coprime_all', items: ['a', 'b', 'c'] },
      { a: 6, b: 10, c: 15 },
    ],
    ['distinct', { op: 'distinct', items: ['a', 'b'] }, { a: 1, b: 2 }],
    [
      'all_distinct',
      { op: 'all_distinct', items: ['a', 'b', 'c'] },
      { a: 1, b: 2, c: 3 },
    ],
    [
      'not_all_zero',
      { op: 'not_all_zero', expressions: ['a', 'b'] },
      { a: 0, b: 1 },
    ],
    [
      'not_all_equal',
      {
        op: 'not_all_equal',
        pairs: [
          ['a', 'b'],
          ['b', 'c'],
        ],
      },
      { a: 1, b: 1, c: 2 },
    ],
    [
      'cross_not_equal',
      {
        op: 'cross_not_equal',
        left_num: 'a',
        left_den: 'b',
        right_num: 'c',
        right_den: 'd',
      },
      { a: 1, b: 2, c: 2, d: 3 },
    ],
    [
      'scaled_not_equal',
      {
        op: 'scaled_not_equal',
        left_multiplier: 2,
        left: 'a',
        right_multiplier: 3,
        right: 'b',
      },
      { a: 2, b: 1 },
    ],
    [
      'discriminant_equal',
      { op: 'discriminant_equal', a: 'a', b: 'b', c: 'c', value: 0 },
      { a: 1, b: 2, c: 1 },
    ],
    [
      'discriminant_less_than',
      { op: 'discriminant_less_than', a: 'a', b: 'b', c: 'c', value: 0 },
      { a: 1, b: 0, c: 1 },
    ],
    [
      'expression_not_zero',
      { op: 'expression_not_zero', expression: 'a-b' },
      { a: 2, b: 1 },
    ],
    [
      'if',
      {
        op: 'if',
        condition: { op: '>', left: 'a', right: 0 },
        then: { op: '>', left: 'b', right: 0 },
      },
      { a: -1, b: -1 },
    ],
  ])('convertit et évalue l’opérateur %s', (_name, source, values) => {
    const ast = relation(source);
    expect(ast).toBeDefined();
    expect(evaluateSafeExpression(ast, values)).toEqual({
      ok: true,
      value: true,
    });
  });

  it.each([
    ['+', { '+': [1, 2] }, 3],
    ['-', { '-': [3, 2] }, 1],
    ['*', { '*': [3, 2] }, 6],
    ['/', { '/': [6, 2] }, 3],
    ['pow', { pow: [3, 2] }, 9],
    ['abs', { abs: -3 }, 3],
    ['cos', { cos: 0 }, 1],
    ['gcd', { gcd: [18, 24] }, 6],
    ['binomial', { binomial: [5, 2] }, 10],
    ['is_integer', { is_integer: 3 }, true],
    ['min', { min: [3, 2] }, 2],
    ['max', { max: [3, 2] }, 3],
  ])('convertit l’opérateur objet %s', (_name, expression, expected) => {
    const [ast] = parseRelations(
      {
        schema_version: '3.0',
        relations: { and: [{ '=': [expression, expected] }] },
      },
      'TEST',
    );
    expect(evaluateSafeExpression(ast, {})).toEqual({
      ok: true,
      value: true,
    });
  });

  it('traite explicitement les deux modes de tuples', () => {
    expect(
      parseRelations(
        {
          schema_version: '3.0',
          relations: { mode: 'all_combinations' },
        },
        'TEST',
      ),
    ).toEqual([]);
    const [allowed] = parseRelations(
      {
        schema_version: '3.0',
        relations: {
          mode: 'allowed_tuples',
          variables: ['a', 'b'],
          tuples: [[1, 2]],
        },
      },
      'TEST',
    );
    expect(evaluateSafeExpression(allowed, { a: 1, b: 2 })).toEqual({
      ok: true,
      value: true,
    });
  });

  it('déclare exhaustivement les opérateurs source pris en charge', () => {
    expect(supportedRelationOperators).toEqual(
      expect.arrayContaining([
        '!=',
        '=',
        '==',
        '<',
        '<=',
        '>',
        '>=',
        'and',
        'or',
        'parity',
        'coprime',
        'coprime_all',
        'distinct',
        'all_distinct',
        'not_all_zero',
        'not_all_equal',
        'cross_not_equal',
        'scaled_not_equal',
        'discriminant_equal',
        'discriminant_less_than',
        'expression_not_zero',
        'if',
        '+',
        '-',
        '*',
        '/',
        'pow',
        'abs',
        'cos',
        'gcd',
        'binomial',
        'is_integer',
        'min',
        'max',
        'allowed_tuples',
        'all_combinations',
      ]),
    );
  });

  it('ne remplace que les accolades d’un paramètre déclaré', () => {
    const compiled = compileContent('Calculer {a}+\\frac{1}{2}.', ['a']);
    expect(compiled.segments).toEqual([
      { kind: 'text', value: 'Calculer @a+\\frac{1}{2}.' },
    ]);
  });

  describe('translateLatexToGrammar', () => {
    it.each([
      ['\\dfrac{k}{a x+b}', '(k)/(a x+b)'],
      ['\\frac{1}{2}', '(1)/(2)'],
      ['\\sqrt{x^{k}}', 'sqrt(x^k)'],
      ['2\\cdot x', '2* x'],
      ['x\\ne0', 'x≠0'],
      ['x\\ge a', 'x≥ a'],
      ['x\\le b', 'x≤ b'],
      ['x\\in\\mathbb{R}', 'x∈ℝ'],
      ['\\ln|ax+b|', 'ln(abs(ax+b))'],
      ['|x-2|', 'abs(x-2)'],
      ['\\left(x+1\\right)', '(x+1)'],
      ['\\alpha+\\beta', 'α+β'],
    ])('translates %s to %s', (source, expected) => {
      expect(translateLatexToGrammar(source)).toBe(expected);
    });
  });

  describe('insertImplicitMultiplication', () => {
    it.each([
      ['ax+b', 'a*x+b'],
      ['3x', '3*x'],
      ['2(x+1)', '2*(x+1)'],
      ['(x+1)(x-1)', '(x+1)*(x-1)'],
      ['2sqrt(x)', '2*sqrt(x)'],
      ['12', '12'],
    ])('normalizes %s to %s', (source, expected) => {
      expect(insertImplicitMultiplication(source)).toBe(expected);
    });

    it('does not treat a function-application letter as multiplication', () => {
      expect(insertImplicitMultiplication('f(x)')).toBe('f(x)');
    });

    it('never loops on a literal space in the input', () => {
      expect(insertImplicitMultiplication('2* a(x+1)')).toBe('2* a(x+1)');
    });
  });

  it('compiles a real DUNOD-style LaTeX fraction into real math', () => {
    const compiled = compileContent('Résoudre \\(a x+b\\ne0\\).', ['a', 'b']);
    expect(compiled.structured).toBe(1);
    expect(compiled.segments).toContainEqual({
      kind: 'inline-math',
      math: { syntaxVersion: 1, source: '@a* x+@b≠0' },
    });
  });

  it('keeps an unsupported f(x)= definition as a safe text fallback instead of guessing', () => {
    const compiled = compileContent('\\(f(x)=\\dfrac{k}{a x+b}\\)', [
      'a',
      'b',
      'k',
    ]);
    expect(compiled.fallback).toBe(1);
    expect(compiled.segments).toEqual([
      { kind: 'text', value: '\\(f(x)=\\dfrac@k*{@a x+@b}\\)' },
    ]);
  });
});
