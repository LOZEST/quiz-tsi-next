import { describe, expect, it } from 'vitest';
import { validateParameterizedQuestion } from '../../../src/domain/questions/QuestionParameterValidation';
import type { Question } from '../../../src/domain/questions/Question';

const question = (
  maximum = 9,
  status: Question['status'] = 'published',
): Question => ({
  id: 'q',
  version: 1,
  source: 'static',
  ownerId: null,
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
    validationVariantCount: status === 'published' ? 10 : 1,
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
  it('bloque lorsque neuf variantes seulement existent', () =>
    expect(validateParameterizedQuestion(question(8), 'validation').kind).toBe(
      'insufficient-distinct-variants',
    ));
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
});
