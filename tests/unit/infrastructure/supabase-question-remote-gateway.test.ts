import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  questionFromRemoteRow,
  SupabaseQuestionRemoteGateway,
} from '../../../src/infrastructure/questions/SupabaseQuestionRemoteGateway';
import type { QuestionWorkspaceOutboxOperation } from '../../../src/domain/repositories/QuestionWorkspaceRepository';

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

const statefulClient = (initial: Record<string, unknown[]> = {}) => {
  const tables = new Map(Object.entries(initial));
  const client = {
    from(table: string) {
      let id: string | null = null;
      const query = {
        select: () => query,
        eq: (_column: string, value: string) => {
          id = value;
          return query;
        },
        order: () => query,
        limit: () => query,
        maybeSingle() {
          const rows = (tables.get(table) ?? []).filter(
            (item) => !id || (item as { id: string }).id === id,
          );
          return Promise.resolve({
            data:
              rows.sort(
                (a, b) =>
                  Number((b as { version?: number }).version ?? 0) -
                  Number((a as { version?: number }).version ?? 0),
              )[0] ?? null,
            error: null,
          });
        },
        insert(value: unknown) {
          const rows = tables.get(table) ?? [];
          const duplicate = rows.some(
            (item) =>
              (item as { id: string; version?: number }).id ===
                (value as { id: string }).id &&
              (table !== 'questions' ||
                (item as { version: number }).version ===
                  (value as { version: number }).version),
          );
          if (duplicate) return Promise.resolve({ error: { code: '23505' } });
          rows.push(value);
          tables.set(table, rows);
          return Promise.resolve({ error: null });
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, tables };
};

const questionOperation = (
  payload = questionFromRemoteRow(row()),
  baseVersion: number | null = null,
): QuestionWorkspaceOutboxOperation => ({
  operationId: 'op',
  userId: 'owner',
  entity: 'question',
  entityId: payload.id,
  kind: baseVersion === null ? 'create' : 'update',
  baseVersion,
  payload,
  createdAt: payload.updatedAt,
});

describe('push distant idempotent', () => {
  it('accepte create puis retry après réponse perdue', async () => {
    const remote = statefulClient();
    const gateway = new SupabaseQuestionRemoteGateway(remote.client);
    const operation = questionOperation();
    expect(await gateway.push(operation)).toEqual({ kind: 'accepted' });
    expect(await gateway.push(operation)).toEqual({ kind: 'accepted' });
    expect(remote.tables.get('questions')).toHaveLength(1);
  });

  it('relit après une course 23505 et accepte le payload identique', async () => {
    let reads = 0;
    const payload = row();
    const client = {
      from() {
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          limit: () => query,
          maybeSingle: () =>
            Promise.resolve({
              data: reads++ === 0 ? null : payload,
              error: null,
            }),
          insert: () => Promise.resolve({ error: { code: '23505' } }),
        };
        return query;
      },
    } as unknown as SupabaseClient;
    const gateway = new SupabaseQuestionRemoteGateway(client);
    expect(
      await gateway.push(questionOperation(questionFromRemoteRow(payload))),
    ).toEqual({ kind: 'accepted' });
  });

  it('accepte update puis retry et signale un contenu différent', async () => {
    const v1 = row();
    const remote = statefulClient({ questions: [v1] });
    const gateway = new SupabaseQuestionRemoteGateway(remote.client);
    const v2 = questionFromRemoteRow({
      ...v1,
      version: 2,
      content: { ...v1.content, prompt: [{ kind: 'text', value: 'v2' }] },
    });
    const operation = questionOperation(v2, 1);
    expect(await gateway.push(operation)).toEqual({ kind: 'accepted' });
    expect(await gateway.push(operation)).toEqual({ kind: 'accepted' });
    const different = { ...v2, tags: ['different'] };
    expect(await gateway.push(questionOperation(different, 1))).toMatchObject({
      kind: 'conflict',
    });
  });

  it('distingue replay et conflit de taxonomie', async () => {
    const course = {
      id: 'c',
      ownerId: 'owner',
      title: 'Cours',
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    };
    const remote = statefulClient({
      personal_courses: [
        {
          id: 'c',
          owner_id: 'owner',
          title: 'Cours',
          created_at: course.createdAt,
          updated_at: course.updatedAt,
        },
      ],
    });
    const gateway = new SupabaseQuestionRemoteGateway(remote.client);
    const operation = {
      operationId: 'tax',
      userId: 'owner',
      entity: 'course',
      entityId: 'c',
      kind: 'create',
      payload: course,
      createdAt: course.createdAt,
    } as const;
    expect(await gateway.push(operation)).toEqual({ kind: 'accepted' });
    expect(
      await gateway.push({
        ...operation,
        payload: { ...course, title: 'Autre' },
      }),
    ).toEqual({ kind: 'taxonomy-conflict' });
  });
});
