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

  it('exige la confirmation et canonicalise indépendamment de l’ordre des clés', () => {
    expect(
      validateChatGptQuestionImport({ ...payload, confirmedByUser: false }).ok,
    ).toBe(false);
    const result = validateChatGptQuestionImport(payload);
    if (!result.ok) throw new Error('fixture invalide');
    expect(canonicalizeImport(result.value)).toContain('"importId":"import-1"');
  });
});
