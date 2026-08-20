import { describe, expect, it } from 'vitest';
import {
  canonicalizeImport,
  validateChatGptQuestionImport,
} from '../../../src/domain/questions/import/ChatGptQuestionImport';
import { importReportHttpStatus } from '../../../src/domain/questions/import/ChatGptImportHttp';

const entry = {
  clientEntryId: 'one',
  classification: {
    kind: 'personal',
    proposedCourseTitle: 'Automatique',
    proposedChapterTitle: null,
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
  it('retourne 422 lorsque le rapport ne contient aucun brouillon accepté', () => {
    expect(
      importReportHttpStatus({
        schemaVersion: 1,
        importId: 'quarantine-only',
        accepted: [],
        quarantined: [
          {
            index: 0,
            code: 'invalid',
            path: 'questions[0]',
            message: 'Invalide',
          },
        ],
        warnings: [],
        replayed: false,
      }),
    ).toBe(422);
    expect(
      importReportHttpStatus({
        schemaVersion: 1,
        importId: 'accepted',
        accepted: [0],
        quarantined: [],
        warnings: [],
        replayed: false,
      }),
    ).toBe(200);
  });
  it('accepte un cours personnel sans chapitre ni notion', () => {
    const result = validateChatGptQuestionImport(payload);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.questions).toHaveLength(1);
  });

  it('accepte une classification personnelle qui omet chapitre/notion plutôt que d’envoyer null', () => {
    const classificationWithoutOptionalKeys = {
      kind: entry.classification.kind,
      proposedCourseTitle: entry.classification.proposedCourseTitle,
      reason: entry.classification.reason,
      requiresUserConfirmation: entry.classification.requiresUserConfirmation,
    };
    const result = validateChatGptQuestionImport({
      ...payload,
      questions: [
        { ...entry, classification: classificationWithoutOptionalKeys },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.questions).toHaveLength(1);
  });

  it('quarantaine avec un message précis une classification personnelle contenant une clé officielle', () => {
    const result = validateChatGptQuestionImport({
      ...payload,
      questions: [
        {
          ...entry,
          classification: {
            ...entry.classification,
            chapterId: 'numbers-arithmetic',
          },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quarantined).toHaveLength(1);
      expect(result.quarantined[0]?.code).toBe('invalid-classification');
      expect(result.quarantined[0]?.message).toContain(
        'clé inconnue pour une classification personnelle',
      );
    }
  });

  it('quarantaine avec un message précis une classification personnelle sans reason', () => {
    const classificationWithoutReason = {
      kind: entry.classification.kind,
      proposedCourseTitle: entry.classification.proposedCourseTitle,
      proposedChapterTitle: entry.classification.proposedChapterTitle,
      requiresUserConfirmation: entry.classification.requiresUserConfirmation,
    };
    const result = validateChatGptQuestionImport({
      ...payload,
      questions: [{ ...entry, classification: classificationWithoutReason }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quarantined).toHaveLength(1);
      expect(result.quarantined[0]?.code).toBe('invalid-classification');
      expect(result.quarantined[0]?.message).toContain('reason manquant');
    }
  });

  it('accepte tous les segments fermés avec une classification personnelle', () => {
    const result = validateChatGptQuestionImport({
      ...payload,
      questions: [
        {
          ...entry,
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

  it('quarantaine une classification officielle : ce flux d’import ne produit plus que du personal', () => {
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
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quarantined).toHaveLength(1);
      expect(result.quarantined[0]?.code).toBe('invalid-classification');
      expect(result.quarantined[0]?.message).toContain(
        'kind doit être "personal"',
      );
    }
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
