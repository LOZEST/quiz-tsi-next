import { describe, expect, it } from 'vitest';
import {
  analyzeQuestionParameterReferences,
  scanParameterReferences,
} from '../../../src/domain/questions/ParameterReferenceScanner';
import type { Question } from '../../../src/domain/questions/Question';

const question = (): Question => ({
  id: 'q',
  version: 1,
  source: 'static',
  ownerId: null,
  status: 'published',
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
          maximum: 9,
          step: 1,
          excludedValues: [],
        },
      },
      {
        id: 'coefficient_1',
        label: 'C',
        domain: { kind: 'choice', values: [true, false] },
      },
      {
        id: 'unused',
        label: '@not-scanned',
        domain: { kind: 'choice', values: ['x'] },
      },
    ],
    constraints: [],
    validationVariantCount: 10,
  },
  prompt: [
    { kind: 'text', value: '@a puis @coefficient_1' },
    { kind: 'inline-math', math: { syntaxVersion: 1, source: '@a+1' } },
  ],
  hint: [{ kind: 'text', value: '@a' }],
  correction: [
    {
      id: 's',
      title: '@coefficient_1',
      content: [
        { kind: 'display-math', math: { syntaxVersion: 1, source: '@a' } },
      ],
    },
  ],
  tags: ['@ignored'],
  validated: true,
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
});

describe('parameter references', () => {
  it('scanne la grammaire exacte avec positions et noms proches', () =>
    expect(
      scanParameterReferences('x @a @a1 @coefficient_1').references,
    ).toEqual([
      { name: 'a', start: 2, end: 4 },
      { name: 'a1', start: 5, end: 8 },
      { name: 'coefficient_1', start: 9, end: 23 },
    ]));
  it('refuse les noms réservés et les références mal formées', () => {
    expect(scanParameterReferences('@sqrt').diagnostics[0]?.code).toBe(
      'reserved-reference',
    );
    expect(
      scanParameterReferences('@1a @').diagnostics.map((entry) => entry.code),
    ).toEqual(['malformed-reference', 'malformed-reference']);
  });
  it('analyse tous les contenus, déduplique et ignore tags et labels', () => {
    const result = analyzeQuestionParameterReferences(question());
    expect(result.usedReferences).toEqual(['a', 'coefficient_1']);
    expect(result.unusedVariables).toEqual(['unused']);
    expect(result.diagnostics).toEqual([]);
  });
  it('compte une référence utilisée seulement en contrainte', () => {
    const base = question();
    const value: Question = {
      ...base,
      parameterization: {
        ...base.parameterization!,
        constraints: [
          {
            kind: 'comparison',
            operator: 'equal',
            left: { kind: 'variable', variableId: 'unused' },
            right: { kind: 'literal', value: 'x' },
          },
        ],
      },
    };
    expect(analyzeQuestionParameterReferences(value).unusedVariables).toEqual(
      [],
    );
  });
  it('retourne chemins précis pour texte et formule invalides', () => {
    const base = question();
    const value: Question = {
      ...base,
      hint: [{ kind: 'text', value: '@' }],
      correction: [
        {
          ...base.correction[0]!,
          content: [
            { kind: 'inline-math', math: { syntaxVersion: 1, source: '2x' } },
          ],
        },
      ],
    };
    expect(
      analyzeQuestionParameterReferences(value).diagnostics.map(
        (entry) => entry.path,
      ),
    ).toEqual(['hint.0.value', 'correction.0.content.0.math']);
  });
});
