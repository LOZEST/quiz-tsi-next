import { describe, expect, it } from 'vitest';
import {
  buildCanonicalVariableDomain,
  MAX_MATERIALIZED_DOMAIN_SIZE,
  MAX_SAFE_SCALED_INTEGER,
} from '../../../src/domain/questions/VariableDomain';

describe('buildCanonicalVariableDomain', () => {
  it('construit le domaine entier canonique avec exclusions', () =>
    expect(
      buildCanonicalVariableDomain({
        id: 'a',
        label: 'a',
        domain: {
          kind: 'integer',
          minimum: -3,
          maximum: 5,
          step: 2,
          excludedValues: [1, 1],
        },
      }),
    ).toEqual({ ok: true, values: [-3, -1, 3, 5] }));
  it('conserve une borne maximale non alignée', () =>
    expect(
      buildCanonicalVariableDomain({
        domain: {
          kind: 'integer',
          minimum: 0,
          maximum: 6,
          step: 4,
          excludedValues: [],
        },
      }),
    ).toEqual({ ok: true, values: [0, 4] }));
  it('signale domaine entier vide et limite', () => {
    expect(
      buildCanonicalVariableDomain({
        domain: {
          kind: 'integer',
          minimum: 1,
          maximum: 1,
          step: 1,
          excludedValues: [1],
        },
      }),
    ).toMatchObject({ ok: false, code: 'empty-domain' });
    expect(
      buildCanonicalVariableDomain({
        domain: {
          kind: 'integer',
          minimum: 0,
          maximum: MAX_MATERIALIZED_DOMAIN_SIZE,
          step: 1,
          excludedValues: [],
        },
      }),
    ).toMatchObject({ ok: false, code: 'domain-limit-exceeded' });
  });
  it('quantifie la grille décimale sans dérive et normalise zéro', () =>
    expect(
      buildCanonicalVariableDomain({
        domain: {
          kind: 'decimal',
          minimum: -0.01,
          maximum: 0.2,
          decimals: 1,
          excludedValues: [0.1],
        },
      }),
    ).toEqual({ ok: true, values: [0, 0.2] }));
  it.each([
    [0.14, 0.14, [0.14]],
    [0.07, 0.07, [0.07]],
    [0.14, 0.16, [0.14, 0.15, 0.16]],
    [-0.14, -0.12, [-0.14, -0.13, -0.12]],
  ] as const)(
    'quantifie exactement [%s ; %s]',
    (minimum, maximum, expected) => {
      const variable = {
        domain: {
          kind: 'decimal',
          minimum,
          maximum,
          decimals: 2,
          excludedValues: [],
        },
      };
      expect(buildCanonicalVariableDomain(variable)).toEqual({
        ok: true,
        values: expected,
      });
      expect(buildCanonicalVariableDomain(variable)).toEqual(
        buildCanonicalVariableDomain(variable),
      );
    },
  );
  it('quantifie exactement les exclusions et normalise -0', () => {
    const result = buildCanonicalVariableDomain({
      domain: {
        kind: 'decimal',
        minimum: -0,
        maximum: 0.14,
        decimals: 2,
        excludedValues: [0.14],
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values).not.toContain(0.14);
      expect(result.values[0]).toBe(0);
      expect(Object.is(result.values[0], -0)).toBe(false);
    }
  });
  it('refuse un entier mis à l’échelle hors plage sûre', () =>
    expect(
      buildCanonicalVariableDomain({
        domain: {
          kind: 'decimal',
          minimum: MAX_SAFE_SCALED_INTEGER,
          maximum: MAX_SAFE_SCALED_INTEGER,
          decimals: 1,
          excludedValues: [],
        },
      }),
    ).toMatchObject({ ok: false, code: 'domain-limit-exceeded' }));
  it('signale une grille décimale trop grande', () =>
    expect(
      buildCanonicalVariableDomain({
        domain: {
          kind: 'decimal',
          minimum: 0,
          maximum: 1001,
          decimals: 1,
          excludedValues: [],
        },
      }),
    ).toMatchObject({ ok: false, code: 'domain-limit-exceeded' }));
  it('déduplique strictement les choix sans modifier la source', () => {
    const values = [1, '1', true, 1] as const;
    const result = buildCanonicalVariableDomain({
      domain: { kind: 'choice', values },
    });
    expect(result).toEqual({ ok: true, values: [1, '1', true] });
    expect(values).toEqual([1, '1', true, 1]);
  });
  it('absorbe les frontières hostiles', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('secret');
        },
      },
    );
    expect(() => buildCanonicalVariableDomain(hostile)).not.toThrow();
    expect(buildCanonicalVariableDomain(hostile)).toMatchObject({ ok: false });
  });
});
