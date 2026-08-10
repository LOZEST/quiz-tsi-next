import { describe, expect, it } from 'vitest';
import { validateQuestionForReview } from '../../../src/domain/questions/QuestionAuthoringValidation';
import type { Question } from '../../../src/domain/questions/Question';

const value = (): Question => ({
  id: 'authoring',
  version: 1,
  source: 'private',
  ownerId: 'owner',
  status: 'draft',
  validated: false,
  provenance: null,
  classification: {
    kind: 'personal',
    courseId: 'course',
    chapterId: null,
    notionId: null,
  },
  type: 'calculation',
  difficulty: 'standard',
  tags: [],
  prompt: [{ kind: 'text', value: 'Calculer @n' }],
  hint: [],
  correction: [
    { id: 'step', title: null, content: [{ kind: 'text', value: '@n' }] },
  ],
  parameterization: {
    schemaVersion: 1,
    validationVariantCount: 1,
    variables: [
      {
        id: 'n',
        label: 'N',
        domain: {
          kind: 'integer',
          minimum: 1,
          maximum: 10,
          step: 1,
          excludedValues: [],
        },
      },
    ],
    constraints: [
      {
        kind: 'comparison',
        operator: 'greater-than',
        left: { kind: 'variable', variableId: 'n' },
        right: { kind: 'literal', value: 0 },
      },
    ],
  },
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
});

describe('validateQuestionForReview', () => {
  it('exige dix variantes réelles pour private paramétrée', () => {
    expect(validateQuestionForReview(value())).toEqual([]);
    const base = value();
    const insufficient: Question = {
      ...base,
      parameterization: {
        ...base.parameterization!,
        variables: [
          {
            ...base.parameterization!.variables[0]!,
            domain: {
              kind: 'integer',
              minimum: 1,
              maximum: 9,
              step: 1,
              excludedValues: [],
            },
          },
        ],
      },
    };
    expect(validateQuestionForReview(insufficient)[0]?.message).toMatch(
      /variante|distinct/i,
    );
  });
  it('refuse math invalide et correction vide sans fabriquer de texte', () => {
    const invalid: Question = {
      ...value(),
      prompt: [
        { kind: 'inline-math', math: { syntaxVersion: 1, source: 'x+' } },
      ],
    };
    expect(validateQuestionForReview(invalid)).not.toEqual([]);
    const empty: Question = {
      ...value(),
      correction: [
        { id: 'step', title: null, content: [{ kind: 'text', value: '' }] },
      ],
    };
    expect(validateQuestionForReview(empty)).toContainEqual(
      expect.objectContaining({ path: 'question.correction' }),
    );
  });
  it('valide aussi une question non paramétrée et relaie une classification invalide', () => {
    const plain: Question = {
      ...value(),
      parameterization: null,
      prompt: [{ kind: 'text', value: 'Question fixe' }],
      correction: [
        {
          id: 'step',
          title: null,
          content: [{ kind: 'text', value: 'Réponse' }],
        },
      ],
    };
    expect(validateQuestionForReview(plain)).toEqual([]);
    expect(
      validateQuestionForReview({
        ...plain,
        correction: [
          {
            id: 'math',
            title: null,
            content: [
              {
                kind: 'display-math',
                math: { syntaxVersion: 1, source: 'x=1' },
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
    expect(
      validateQuestionForReview({
        ...plain,
        classification: {
          kind: 'official',
          partId: '',
          chapterId: '',
          notionId: '',
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'question.classification' }),
      ]),
    );
  });
});
