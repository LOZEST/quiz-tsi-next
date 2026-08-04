import { describe, expect, it } from 'vitest';
import {
  buildCanonicalVariableDomain,
  MAX_MATERIALIZED_DOMAIN_SIZE,
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
