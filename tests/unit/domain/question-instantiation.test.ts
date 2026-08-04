import { describe, expect, it } from 'vitest';
import { instantiateQuestionVariant } from '../../../src/domain/questions/QuestionInstantiation';
import type { Question } from '../../../src/domain/questions/Question';

const source = (): Question => ({
  id: 'q',
  version: 1,
  source: 'static',
  ownerId: null,
  status: 'draft',
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
          minimum: 1,
          maximum: 10,
          step: 1,
          excludedValues: [],
        },
      },
      {
        id: 'a1',
        label: 'A1',
        domain: { kind: 'choice', values: ['<b>x</b>', true] },
      },
    ],
    constraints: [],
    validationVariantCount: 2,
  },
  prompt: [
    { kind: 'text', value: '@a et @a1' },
    { kind: 'inline-math', math: { syntaxVersion: 1, source: '@a+@a1' } },
  ],
  hint: [{ kind: 'text', value: '@a' }],
  correction: [
    {
      id: 's',
      title: 'Valeur @a1',
      content: [
        { kind: 'display-math', math: { syntaxVersion: 1, source: '@a' } },
      ],
    },
  ],
  tags: [],
  validated: false,
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
});

describe('instantiateQuestionVariant', () => {
  it('emploie les mêmes valeurs partout sans interpréter HTML', () => {
    const result = instantiateQuestionVariant(source(), {
      a: 2,
      a1: '<b>x</b>',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prompt[0]).toEqual({
        kind: 'text',
        value: '2 et <b>x</b>',
      });
      expect(result.value.hint[0]).toEqual({ kind: 'text', value: '2' });
      expect(result.value.correction[0]?.title).toBe('Valeur <b>x</b>');
    }
  });
  it('résout les paramètres mathématiques en littéraux contrôlés', () => {
    const result = instantiateQuestionVariant(source(), { a: 2, a1: true });
    if (!result.ok) throw new Error(result.message);
    const math = result.value.prompt[1];
    expect(math).toMatchObject({
      kind: 'inline-math',
      ast: {
        kind: 'binary',
        left: { kind: 'resolved-parameter', name: 'a', value: 2 },
        right: { kind: 'resolved-parameter', name: 'a1', value: true },
      },
    });
  });
  it('préserve les sources et produit une sortie profondément immuable', () => {
    const question = source();
    const before = structuredClone(question);
    const result = instantiateQuestionVariant(question, { a: 2, a1: true });
    expect(question).toEqual(before);
    expect(Object.isFrozen(question)).toBe(false);
    if (!result.ok) throw new Error(result.message);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.prompt)).toBe(true);
    expect(
      (question.prompt[1] as { math: { source: string } }).math.source,
    ).toBe('@a+@a1');
  });
  it('refuse une référence absente avec son chemin', () =>
    expect(instantiateQuestionVariant(source(), { a: 2 })).toMatchObject({
      ok: false,
      path: 'prompt.0.value',
    }));
});
