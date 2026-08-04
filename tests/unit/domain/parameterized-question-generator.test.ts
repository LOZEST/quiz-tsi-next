import { describe, expect, it } from 'vitest';
import {
  generateParameterVariants,
  MAX_EXHAUSTIVE_COMBINATIONS,
} from '../../../src/domain/questions/ParameterizedQuestionGenerator';
import type { ParameterizedQuestionSpec } from '../../../src/domain/questions/Question';
const spec = (maximum = 9): ParameterizedQuestionSpec => ({
  schemaVersion: 1,
  variables: [
    {
      id: 'a',
      label: 'a',
      domain: {
        kind: 'integer',
        minimum: 0,
        maximum,
        step: 1,
        excludedValues: [],
      },
    },
  ],
  constraints: [
    {
      kind: 'comparison',
      operator: 'greater-than-or-equal',
      left: { kind: 'variable', variableId: 'a' },
      right: { kind: 'literal', value: 0 },
    },
  ],
  validationVariantCount: 10,
});

describe('generateParameterVariants', () => {
  it('reproduit valeurs, ordre et statistiques avec la même seed', () => {
    const a = generateParameterVariants(spec(), 'seed', 10);
    const b = generateParameterVariants(spec(), 'seed', 10);
    expect(a).toEqual(b);
    expect(a.kind).toBe('ready');
  });
  it('produit dix affectations distinctes', () => {
    const result = generateParameterVariants(spec(), 'seed', 10);
    expect(result.kind).toBe('ready');
    if (result.kind === 'ready')
      expect(
        new Set(result.variants.map((entry) => JSON.stringify(entry))).size,
      ).toBe(10);
  });
  it('distingue capacité exhaustive et exploration réellement terminée', () => {
    const early = generateParameterVariants(spec(), 'seed', 1);
    expect(early.statistics).toMatchObject({
      searchMode: 'exhaustive-capable',
      searchCompleted: false,
      exhaustive: false,
      examinedCombinations: 1,
      validCombinations: 1,
    });
    const completed = generateParameterVariants(spec(), 'seed', 10);
    expect(completed.statistics).toMatchObject({
      searchMode: 'exhaustive-capable',
      searchCompleted: true,
      exhaustive: true,
      examinedCombinations: 10,
      validCombinations: 10,
    });
  });
  it('distingue impossible et insuffisant après exploration exhaustive', () => {
    const base = spec(2);
    const impossible: ParameterizedQuestionSpec = {
      ...base,
      constraints: [
        {
          kind: 'comparison',
          operator: 'less-than',
          left: { kind: 'variable', variableId: 'a' },
          right: { kind: 'literal', value: 0 },
        },
      ],
    };
    expect(generateParameterVariants(impossible, 's', 1).kind).toBe(
      'impossible',
    );
    expect(generateParameterVariants(spec(8), 's', 10).kind).toBe(
      'insufficient-distinct-variants',
    );
  });
  it('ne conclut pas impossible au-delà de la limite exhaustive', () => {
    const large: ParameterizedQuestionSpec = {
      schemaVersion: 1,
      variables: [
        {
          id: 'a',
          label: 'a',
          domain: {
            kind: 'integer',
            minimum: 0,
            maximum: 999,
            step: 1,
            excludedValues: [],
          },
        },
        {
          id: 'b',
          label: 'b',
          domain: {
            kind: 'integer',
            minimum: 0,
            maximum: 999,
            step: 1,
            excludedValues: [],
          },
        },
      ],
      constraints: [{ kind: 'literal', value: false }],
      validationVariantCount: 10,
    };
    expect(1_000_000).toBeGreaterThan(MAX_EXHAUSTIVE_COMBINATIONS);
    expect(generateParameterVariants(large, 's', 10).kind).toBe(
      'search-limit-exceeded',
    );
  });
  it('contrôle les demandes et frontières hostiles', () => {
    expect(generateParameterVariants(spec(), 's', 1001).kind).toBe(
      'invalid-question',
    );
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('secret');
        },
      },
    );
    expect(() => generateParameterVariants(hostile, 's', 1)).not.toThrow();
  });
  it.each([
    { ...spec(), schemaVersion: 2 },
    { ...spec(), validationVariantCount: -1 },
    { ...spec(), variables: [{ ...spec().variables[0], id: ' a' }] },
    { ...spec(), variables: [{ id: 'a', label: '', domain: {} }] },
    { ...spec(), constraints: [{ kind: 'binary', operator: 'future' }] },
  ])('refuse un spec structurellement invalide', (value) =>
    expect(generateParameterVariants(value, 's', 1).kind).toBe(
      'invalid-question',
    ),
  );
});
