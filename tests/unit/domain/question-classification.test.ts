import { describe, expect, it } from 'vitest';
import {
  isOfficialQuestion,
  isPersonalQuestion,
  migrateQuestionClassification,
  personalClassification,
  validateQuestion,
  type Question,
} from '../../../src/domain/questions/Question';

const legacy = {
  id: 'q',
  version: 1,
  source: 'static',
  ownerId: null,
  status: 'published',
  provenance: null,
  partId: 'p',
  chapterId: 'c',
  notionId: 'n',
  type: 'course',
  difficulty: 'standard',
  parameterization: null,
  prompt: [{ kind: 'text', value: 'Question' }],
  hint: [],
  correction: [
    { id: 's', title: null, content: [{ kind: 'text', value: 'Réponse' }] },
  ],
  tags: [],
  validated: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} satisfies Question;

describe('QuestionClassification', () => {
  it('migre idempotemment un snapshot officiel sans modifier son contenu', () => {
    const once = migrateQuestionClassification(legacy);
    expect(isOfficialQuestion(once)).toBe(true);
    expect(migrateQuestionClassification(once)).toBe(once);
    expect(once.prompt).toBe(legacy.prompt);
  });

  it('ne résout jamais une classification personnelle dans ProgramIndex', () => {
    const personal = {
      ...legacy,
      source: 'private' as const,
      ownerId: 'u',
      status: 'draft' as const,
      validated: false,
      classification: personalClassification('course'),
    };
    expect(isPersonalQuestion(personal)).toBe(true);
    expect(isOfficialQuestion(personal)).toBe(false);
    expect(validateQuestion(personal).ok).toBe(true);
  });
});
