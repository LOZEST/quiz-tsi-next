import { describe, expect, it } from 'vitest';
import { questionFromRemoteRow } from '../../../src/infrastructure/questions/SupabaseQuestionRemoteGateway';

const row = () => ({
  id: 'q',
  version: 1,
  owner_id: 'owner',
  source: 'private',
  status: 'draft',
  validated: false,
  classification: {
    kind: 'personal',
    courseId: 'c',
    chapterId: null,
    notionId: null,
  },
  type: 'course',
  difficulty: 'standard',
  content: {
    prompt: [{ kind: 'text', value: 'Q' }],
    hint: [],
    correction: [
      { id: 's', title: null, content: [{ kind: 'text', value: 'C' }] },
    ],
  },
  parameterization: null,
  tags: [],
  provenance: null,
  created_at: '2026-08-10T00:00:00.000Z',
  updated_at: '2026-08-10T00:00:00.000Z',
});

describe('questionFromRemoteRow', () => {
  it('normalise puis valide une row distante', () =>
    expect(questionFromRemoteRow(row())).toMatchObject({
      id: 'q',
      source: 'private',
    }));
  it('rejette une row hostile ou structurellement invalide', () => {
    expect(() => questionFromRemoteRow({ ...row(), source: 'static' })).toThrow(
      'Question distante invalide',
    );
    expect(() => questionFromRemoteRow({ content: null })).toThrow(
      'Question distante invalide',
    );
  });
});
