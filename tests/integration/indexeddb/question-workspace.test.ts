import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbQuestionWorkspaceRepository } from '../../../src/infrastructure/questions/IndexedDbQuestionWorkspaceRepository';
import type { Question } from '../../../src/domain/questions/Question';

const draft = (userId: string, id: string): Question => ({
  id,
  version: 1,
  source: 'private',
  ownerId: userId,
  status: 'draft',
  validated: false,
  provenance: null,
  classification: {
    kind: 'personal',
    courseId: `${userId}-course`,
    chapterId: null,
    notionId: null,
  },
  type: 'course',
  difficulty: 'standard',
  parameterization: null,
  prompt: [{ kind: 'text', value: 'Question locale' }],
  hint: [],
  correction: [
    { id: 's', title: null, content: [{ kind: 'text', value: 'Correction' }] },
  ],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('IndexedDbQuestionWorkspaceRepository', () => {
  it('écrit question et outbox atomiquement, isolées par compte', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    await repository.saveQuestion(
      'account-a',
      draft('account-a', 'q-a'),
      'create',
      'op-a',
    );
    expect(await repository.load('account-a')).toEqual(
      expect.objectContaining({
        pendingOperationCount: 1,
        questions: [expect.objectContaining({ id: 'q-a' })],
      }),
    );
    expect((await repository.load('account-b')).questions).toEqual([]);
    await expect(
      repository.saveQuestion(
        'account-b',
        draft('account-a', 'hostile'),
        'create',
        'op-b',
      ),
    ).rejects.toThrow('Compte incohérent');
  });

  it('isole la taxonomie personnelle par ownerId', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const course = {
      id: 'course-a',
      ownerId: 'account-a',
      title: 'Cours personnel',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await repository.savePersonalCourse('account-a', course);
    expect((await repository.load('account-a')).courses).toEqual([course]);
    expect((await repository.load('account-b')).courses).toEqual([]);
  });

  it('consomme l’opération conflictuelle et prépare une seconde synchronisation saine', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const local = { ...draft('conflict-owner', 'conflict-q'), version: 2 };
    const remote = {
      ...local,
      version: 2,
      prompt: [{ kind: 'text' as const, value: 'Serveur' }],
    };
    await repository.saveQuestion('conflict-owner', local, 'update', 'old-op');
    await repository.recordConflict('conflict-owner', {
      id: 'conflict-id',
      userId: 'conflict-owner',
      entityId: local.id,
      operationId: 'old-op',
      local,
      remote,
      detectedAt: new Date().toISOString(),
    });
    await repository.resolveConflict('conflict-owner', 'conflict-id', 'local');
    const replacement = await repository.listOutbox('conflict-owner');
    expect(replacement).toHaveLength(1);
    expect(replacement[0]).toMatchObject({
      kind: 'update',
      baseVersion: 2,
      payload: { version: 3 },
    });
    await repository.completeOperation(
      'conflict-owner',
      replacement[0]!.operationId,
    );
    expect(await repository.listOutbox('conflict-owner')).toEqual([]);
  });
});
