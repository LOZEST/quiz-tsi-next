import { describe, expect, it } from 'vitest';
import {
  canonicalizeImport,
  validateChatGptQuestionImport,
} from '../../../src/domain/questions/import/ChatGptQuestionImport';

const entry = {
  clientEntryId: 'one',
  classification: {
    kind: 'personal',
    proposedCourseTitle: 'Automatique',
    proposedChapterTitle: null,
    proposedNotionTitle: null,
    reason: 'Hors programme',
    requiresUserConfirmation: true,
  },
  type: 'course',
  difficulty: 'standard',
  parameterization: null,
  prompt: [{ kind: 'text', value: 'Définir un système.' }],
  hint: [],
  correction: [
    { title: null, content: [{ kind: 'text', value: 'Définition.' }] },
  ],
  tags: [],
  uncertainties: [],
};
const payload = {
  schemaVersion: 1,
  importId: 'import-1',
  analysisCoverage: 'text-only',
  confirmedByUser: true,
  document: { kind: 'pdf', title: 'Cours', pageCount: 2 },
  questions: [entry],
};

describe('ChatGptQuestionImportV1 depuis unknown', () => {
  it('accepte un cours personnel sans chapitre ni notion', () => {
    const result = validateChatGptQuestionImport(payload);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.questions).toHaveLength(1);
  });

  it('accepte une classification officielle et tous les segments fermés', () => {
    const result = validateChatGptQuestionImport({
      ...payload,
      questions: [
        {
          ...entry,
          classification: {
            kind: 'official',
            chapterId: 'numbers-arithmetic',
            notionId: 'NUM-F01',
            confidence: 'certain',
          },
          prompt: [
            { kind: 'text', value: 'Calculer' },
            { kind: 'inline-math', math: { syntaxVersion: 1, source: 'x+1' } },
            { kind: 'display-math', math: { syntaxVersion: 1, source: 'x=1' } },
            { kind: 'line-break' },
          ],
        },
      ],
    });
    expect(result.ok && result.acceptedIndices).toEqual([0]);
  });

  it.each(['ownerId', 'validated', 'source', 'status', 'partId'])(
    'refuse le champ autoritaire %s',
    (field) => {
      const result = validateChatGptQuestionImport({
        ...payload,
        questions: [
          { ...entry, [field]: field === 'validated' ? true : 'hostile' },
        ],
      });
      expect(result.ok && result.quarantined[0]?.code).toBe('forbidden-field');
    },
  );

  it('conserve les entrées valides et met une entrée hostile en quarantaine', () => {
    const result = validateChatGptQuestionImport({
      ...payload,
      questions: [
        entry,
        {
          ...entry,
          prompt: [{ kind: 'html', value: '<script>alert(1)</script>' }],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.questions).toHaveLength(1);
      expect(result.quarantined).toEqual([
        expect.objectContaining({ index: 1, code: 'invalid-content' }),
      ]);
    }
  });

  it('quarantaine un titre personnel trop long sans perdre une autre entrée', () => {
    const result = validateChatGptQuestionImport({
      ...payload,
      questions: [
        entry,
        {
          ...entry,
          classification: {
            ...entry.classification,
            proposedCourseTitle: 'x'.repeat(201),
          },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.acceptedIndices).toEqual([0]);
      expect(result.quarantined).toEqual([
        expect.objectContaining({ index: 1 }),
      ]);
    }
  });

  it('refuse les dépassements segment et variables', () => {
    const long = validateChatGptQuestionImport({
      ...payload,
      questions: [
        { ...entry, prompt: [{ kind: 'text', value: 'x'.repeat(20_001) }] },
      ],
    });
    expect(long.ok && long.quarantined[0]?.code).toBe('invalid-content');
    const parameterized = {
      ...entry,
      parameterization: {
        schemaVersion: 1,
        validationVariantCount: 1,
        constraints: [],
        variables: Array.from({ length: 33 }, (_, index) => ({
          id: `v${index}`,
          label: 'v',
          domain: { kind: 'choice', values: [1] },
        })),
      },
    };
    const variables = validateChatGptQuestionImport({
      ...payload,
      questions: [parameterized],
    });
    expect(variables.ok && variables.quarantined[0]?.code).toBe(
      'invalid-parameterization',
    );
  });

  it.each(['unknownField', '__proto__', 'constructor', 'prototype'])(
    'refuse la propriété inconnue ou dangereuse %s',
    (field) => {
      const hostile = JSON.parse(JSON.stringify(payload)) as Record<
        string,
        unknown
      >;
      const questions = hostile.questions as Record<string, unknown>[];
      Object.defineProperty(questions[0]!, field, {
        value: {},
        enumerable: true,
        configurable: true,
      });
      const result = validateChatGptQuestionImport(hostile);
      expect(result.ok && result.quarantined[0]?.code).toBe('unknown-field');
    },
  );

  it('exige la confirmation et canonicalise indépendamment de l’ordre des clés', () => {
    expect(
      validateChatGptQuestionImport({ ...payload, confirmedByUser: false }).ok,
    ).toBe(false);
    const result = validateChatGptQuestionImport(payload);
    if (!result.ok) throw new Error('fixture invalide');
    expect(canonicalizeImport(result.value)).toContain('"importId":"import-1"');
  });
});
