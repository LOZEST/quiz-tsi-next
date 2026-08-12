import { describe, expect, it } from 'vitest';
import { validateParameterizedQuestion } from '../../../src/domain/questions/QuestionParameterValidation';
import type { Question } from '../../../src/domain/questions/Question';

const question = (
  maximum = 9,
  status: Question['status'] = 'published',
  source: Question['source'] = 'static',
  validationVariantCount = status === 'published' ? 10 : 1,
): Question => ({
  id: 'q',
  version: 1,
  source,
  ownerId: source === 'static' ? null : 'owner-1',
  status,
  provenance: null,
  partId: 'p',
  chapterId: 'c',
  notionId: 'n',
  type: 'calculation',
  difficulty: 'standard',
  parameterization: {
    schemaVersion: 1,
    variables: [
      {
        id: 'a',
        label: 'A',
        domain: {
          kind: 'integer',
          minimum: 0,
          maximum,
          step: 1,
          excludedValues: [],
        },
      },
    ],
    constraints: [],
    validationVariantCount,
  },
  prompt: [{ kind: 'text', value: '@a' }],
  hint: [],
  correction: [
    { id: 's', title: null, content: [{ kind: 'text', value: '@a' }] },
  ],
  tags: [],
  validated: status === 'published',
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
});

describe('validateParameterizedQuestion', () => {
  it('valide réellement dix variantes publiées', () => {
    const result = validateParameterizedQuestion(question(), 'validation');
    expect(result.kind).toBe('ready');
    expect(result.variants).toHaveLength(10);
    expect(
      new Set(
        result.variants.map((entry) => JSON.stringify(entry.parameterValues)),
      ).size,
    ).toBe(10);
  });
  it('accepte neuf variantes officielles uniquement après preuve exhaustive', () => {
    const result = validateParameterizedQuestion(
      question(8, 'published', 'static', 9),
      'validation',
    );
    expect(result.kind).toBe('ready');
    expect(
      new Set(result.variants.map(({ parameterValues }) => parameterValues.a)),
    ).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]));
    expect(result.statistics).toMatchObject({
      validCombinations: 9,
      exhaustive: true,
      searchCompleted: true,
    });
  });
  it('conserve la preuve exhaustive lorsque seules deux combinaisons éparses sont valides', () => {
    const base = question();
    const value: Question = {
      ...base,
      parameterization: {
        schemaVersion: 1,
        variables: [
          { id: 'a', label: 'a', domain: { kind: 'choice', values: [1, 5] } },
          { id: 'b', label: 'b', domain: { kind: 'choice', values: [5, 1] } },
          { id: 'p', label: 'p', domain: { kind: 'choice', values: [-1, 1] } },
        ],
        constraints: [
          {
            kind: 'logical',
            operator: 'or',
            operands: [
              {
                kind: 'logical',
                operator: 'and',
                operands: [
                  {
                    kind: 'comparison',
                    operator: 'equal',
                    left: { kind: 'variable', variableId: 'a' },
                    right: { kind: 'literal', value: 1 },
                  },
                  {
                    kind: 'comparison',
                    operator: 'equal',
                    left: { kind: 'variable', variableId: 'b' },
                    right: { kind: 'literal', value: 5 },
                  },
                  {
                    kind: 'comparison',
                    operator: 'equal',
                    left: { kind: 'variable', variableId: 'p' },
                    right: { kind: 'literal', value: -1 },
                  },
                ],
              },
              {
                kind: 'logical',
                operator: 'and',
                operands: [
                  {
                    kind: 'comparison',
                    operator: 'equal',
                    left: { kind: 'variable', variableId: 'a' },
                    right: { kind: 'literal', value: 5 },
                  },
                  {
                    kind: 'comparison',
                    operator: 'equal',
                    left: { kind: 'variable', variableId: 'b' },
                    right: { kind: 'literal', value: 1 },
                  },
                  {
                    kind: 'comparison',
                    operator: 'equal',
                    left: { kind: 'variable', variableId: 'p' },
                    right: { kind: 'literal', value: 1 },
                  },
                ],
              },
            ],
          },
        ],
        validationVariantCount: 2,
      },
      prompt: [{ kind: 'text', value: '@a @b @p' }],
    };
    const result = validateParameterizedQuestion(value, 'sparse-proof');
    expect(result.kind).toBe('ready');
    expect(result.variants).toHaveLength(2);
    expect(result.statistics).toMatchObject({
      totalCombinations: 8,
      validCombinations: 2,
      searchCompleted: true,
      exhaustive: true,
    });
  });
  it('refuse un compteur officiel de neuf lorsque vingt variantes existent', () =>
    expect(
      validateParameterizedQuestion(
        question(19, 'published', 'static', 9),
        'validation',
      ).kind,
    ).toBe('invalid-question'));
  it.each(['private', 'shared'] as const)(
    'refuse neuf variantes pour une question %s publiée',
    (source) =>
      expect(
        validateParameterizedQuestion(
          question(8, 'published', source, 9),
          'validation',
        ).kind,
      ).toBe('invalid-question'),
  );
  it('traite un brouillon selon son compteur déclaré', () =>
    expect(
      validateParameterizedQuestion(question(0, 'draft'), 'validation').kind,
    ).toBe('ready'));
  it('accepte une question statique avec paramètres vides', () => {
    const base = question();
    const value: Question = {
      ...base,
      parameterization: null,
      prompt: [{ kind: 'text', value: 'Statique' }],
      correction: [
        {
          ...base.correction[0]!,
          content: [{ kind: 'text', value: 'Réponse' }],
        },
      ],
    };
    const result = validateParameterizedQuestion(value, 'validation');
    expect(result.kind).toBe('ready');
    expect(result.variants[0]?.parameterValues).toEqual({});
  });
  it('bloque une référence inconnue et avertit une variable inutilisée', () => {
    const value: Question = {
      ...question(),
      prompt: [{ kind: 'text', value: '@unknown' }],
    };
    const invalid = validateParameterizedQuestion(value, 'validation');
    expect(invalid.kind).toBe('invalid-reference');
    const unusedBase = question();
    const unused: Question = {
      ...unusedBase,
      prompt: [{ kind: 'text', value: 'sans variable' }],
      correction: [
        {
          ...unusedBase.correction[0]!,
          content: [{ kind: 'text', value: 'sans variable' }],
        },
      ],
    };
    expect(
      validateParameterizedQuestion(unused, 'validation').warnings[0]?.message,
    ).toContain('inutilisée');
  });
  it('fige profondément un résultat paramétré sans geler la source', () => {
    const base = question();
    const value: Question = {
      ...base,
      parameterization: {
        ...base.parameterization!,
        variables: [
          ...base.parameterization!.variables,
          {
            id: 'unused',
            label: 'Unused',
            domain: { kind: 'choice', values: [true] },
          },
        ],
      },
    };
    const result = validateParameterizedQuestion(value, 'validation');
    expect(result.kind).toBe('ready');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.errors)).toBe(true);
    expect(Object.isFrozen(result.warnings)).toBe(true);
    expect(Object.isFrozen(result.warnings[0])).toBe(true);
    expect(Object.isFrozen(result.variants)).toBe(true);
    expect(Object.isFrozen(result.variants[0])).toBe(true);
    expect(Object.isFrozen(result.variants[0]?.parameterValues)).toBe(true);
    expect(Object.isFrozen(result.variants[0]?.content)).toBe(true);
    expect(Object.isFrozen(result.usedReferences)).toBe(true);
    expect(Object.isFrozen(result.unusedVariables)).toBe(true);
    expect(Object.isFrozen(result.statistics)).toBe(true);
    expect(Object.isFrozen(value)).toBe(false);
  });
  it('fige profondément un résultat statique', () => {
    const base = question();
    const value: Question = {
      ...base,
      parameterization: null,
      prompt: [{ kind: 'text', value: 'Statique' }],
      correction: [
        {
          ...base.correction[0]!,
          content: [{ kind: 'text', value: 'Réponse' }],
        },
      ],
    };
    const result = validateParameterizedQuestion(value, 'validation');
    expect(result.kind).toBe('ready');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.variants)).toBe(true);
    expect(Object.isFrozen(result.variants[0])).toBe(true);
    expect(Object.isFrozen(result.variants[0]?.parameterValues)).toBe(true);
    expect(Object.isFrozen(result.variants[0]?.content)).toBe(true);
    expect(Object.isFrozen(result.warnings)).toBe(true);
    expect(Object.isFrozen(result.statistics)).toBe(true);
    expect(Object.isFrozen(value)).toBe(false);
  });
});
