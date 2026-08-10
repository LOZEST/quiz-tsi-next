import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  questionFromRemoteRow,
  SupabaseQuestionRemoteGateway,
} from '../../../src/infrastructure/questions/SupabaseQuestionRemoteGateway';

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

const clientWith = (responses: Record<string, unknown>) =>
  ({
    from(table: string) {
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        then(resolve: (value: unknown) => void) {
          resolve({ data: responses[table] ?? [], error: null });
        },
      };
      return query;
    },
  }) as unknown as SupabaseClient;

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

  it('retient la dernière version par id et rejette une row sans bloquer les valides', async () => {
    const gateway = new SupabaseQuestionRemoteGateway(
      clientWith({
        latest_accessible_questions: [
          { ...row(), version: 1, source: 'shared', owner_id: 'shared-owner' },
          { ...row(), version: 3, source: 'shared', owner_id: 'shared-owner' },
          { ...row(), version: 2, source: 'shared', owner_id: 'shared-owner' },
          {
            ...row(),
            id: 'hostile',
            source: 'shared',
            owner_id: 'hostile-owner',
            content: { prompt: [{ kind: 'html', value: '<script />' }] },
          },
          { ...row(), id: 'q2', owner_id: 'owner' },
        ],
        personal_courses: [
          {
            id: 'c',
            owner_id: 'owner',
            title: 'Thermodynamique perso',
            created_at: '2026-08-10T00:00:00.000Z',
            updated_at: '2026-08-10T00:00:00.000Z',
          },
          {
            id: 'foreign',
            owner_id: 'other',
            title: 'Secret B',
            created_at: '2026-08-10T00:00:00.000Z',
            updated_at: '2026-08-10T00:00:00.000Z',
          },
        ],
      }),
    );
    const pulled = await gateway.pullRecent('owner', 100);
    expect(pulled.questions.map(({ id, version }) => [id, version])).toEqual([
      ['q', 3],
      ['q2', 1],
    ]);
    expect(pulled.rejectedRows).toHaveLength(1);
    expect(pulled.rejectedRows[0]?.index).toBe(3);
    expect(pulled.rejectedRows[0]?.message).toContain('invalide');
    expect(pulled.courses.map((course) => course.title)).toEqual([
      'Thermodynamique perso',
    ]);
  });
});
