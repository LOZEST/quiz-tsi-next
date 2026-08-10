import { describe, expect, it } from 'vitest';
import { searchAndFilterQuestions } from '../../../src/domain/questions/QuestionBankSearch';
import type { Question } from '../../../src/domain/questions/Question';

const question = (id: string, overrides: Partial<Question> = {}): Question => ({
  id,
  version: 1,
  source: 'private',
  ownerId: 'u',
  status: 'draft',
  validated: false,
  provenance: null,
  classification: {
    kind: 'official',
    partId: 'p',
    chapterId: 'c',
    notionId: 'n',
  },
  type: 'course',
  difficulty: 'standard',
  parameterization: null,
  prompt: [
    {
      kind: 'text',
      value: id === 'accent' ? 'Équation différentielle' : 'Algèbre',
    },
  ],
  hint: [],
  correction: [
    { id: 's', title: null, content: [{ kind: 'text', value: 'Correction' }] },
  ],
  tags: ['cours'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('recherche et filtres de Banque', () => {
  const questions = [
    question('accent'),
    question('shared', {
      source: 'shared',
      status: 'published',
      validated: true,
    }),
    question('formula', { type: 'formula', difficulty: 'trap' }),
  ];
  it('normalise casse, espaces et accents, et une recherche vide ne restreint rien', () => {
    expect(
      searchAndFilterQuestions({
        questions,
        search: '  EQUATION  ',
        filters: {},
      }).map((item) => item.id),
    ).toEqual(['accent']);
    expect(
      searchAndFilterQuestions({ questions, search: '', filters: {} }),
    ).toHaveLength(3);
  });
  it('applique une intersection stricte sans relâcher les filtres', () => {
    expect(
      searchAndFilterQuestions({
        questions,
        search: '',
        filters: {
          source: 'private',
          type: 'formula',
          difficulty: 'trap',
          status: 'draft',
        },
      }).map((item) => item.id),
    ).toEqual(['formula']);
    expect(
      searchAndFilterQuestions({
        questions,
        search: 'absent',
        filters: { source: 'shared' },
      }),
    ).toEqual([]);
  });
});
