import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbQuestionWorkspaceRepository } from '../../../src/infrastructure/questions/IndexedDbQuestionWorkspaceRepository';
import type { Question } from '../../../src/domain/questions/Question';
import { syncQuestionWorkspace } from '../../../src/features/questions/syncQuestionWorkspace';
import { searchAndFilterQuestions } from '../../../src/domain/questions/QuestionBankSearch';

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
    chapter: null,
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

  it('isole le quizz personnel par ownerId', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const course = {
      id: 'course-a',
      ownerId: 'account-a',
      title: 'Cours personnel',
      description: '',
      visibility: 'private' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    };
    await repository.saveQuestionWithQuizz(
      'account-a',
      {
        ...draft('account-a', 'taxonomy-q'),
        classification: {
          kind: 'personal',
          courseId: 'course-a',
          chapter: null,
        },
      },
      course,
      {
        question: 'taxonomy-q-op',
        quizz: 'course-op',
      },
    );
    expect((await repository.load('account-a')).quizzes).toEqual([course]);
    expect((await repository.load('account-b')).quizzes).toEqual([]);
  });

  it('expose seulement la dernière version tout en conservant l’historique physique', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    for (const version of [1, 2, 3]) {
      await repository.applyRemoteWorkspace('history-owner', {
        questions: [{ ...draft('history-owner', 'history-q'), version }],
        quizzes: [],
      });
    }
    expect((await repository.load('history-owner')).questions).toEqual([
      expect.objectContaining({ id: 'history-q', version: 3 }),
    ]);
    const request = indexedDB.open('quiz-tsi-question-workspace');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Ouverture IndexedDB impossible.'));
    });
    const keysRequest = db
      .transaction('questions', 'readonly')
      .objectStore('questions')
      .getAllKeys();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      keysRequest.onsuccess = () => resolve(keysRequest.result);
      keysRequest.onerror = () =>
        reject(keysRequest.error ?? new Error('Lecture IndexedDB impossible.'));
    });
    expect(
      keys.filter(
        (value) =>
          typeof value === 'string' &&
          value.startsWith('history-owner:history-q:'),
      ),
    ).toHaveLength(3);
    db.close();
  });

  it('enregistre quizz, question et outbox dans une transaction unique', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const ownerId = 'atomic-owner';
    const now = '2026-01-01T00:00:00.000Z';
    const course = {
      id: 'atomic-course',
      ownerId,
      title: 'Cours perso',
      description: '',
      visibility: 'private' as const,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const question = {
      ...draft(ownerId, 'atomic-q'),
      classification: {
        kind: 'personal' as const,
        courseId: course.id,
        chapter: 'Chapitre 1',
      },
    };
    await repository.saveQuestionWithQuizz(ownerId, question, course, {
      question: 'op-q',
      quizz: 'op-c',
    });
    const snapshot = await repository.load(ownerId);
    expect([snapshot.quizzes.length, snapshot.questions.length]).toEqual([
      1, 1,
    ]);
    expect(
      (await repository.listOutbox(ownerId)).map((item) => item.entity),
    ).toEqual(['quizz', 'question']);
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

  it('ne duplique pas un conflit pour la même opération non résolue', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const local = draft('dedupe-owner', 'dedupe-q');
    const conflict = {
      id: 'conflict-first',
      userId: 'dedupe-owner',
      entityId: local.id,
      operationId: 'same-operation',
      local,
      remote: { ...local, version: 2 },
      detectedAt: '2026-01-01T00:00:00.000Z',
    };
    await repository.recordConflict('dedupe-owner', conflict);
    await repository.recordConflict('dedupe-owner', {
      ...conflict,
      id: 'conflict-second',
    });
    expect((await repository.load('dedupe-owner')).conflicts).toHaveLength(1);
  });

  it('deux synchronisations conflictuelles avant résolution exposent un seul conflit', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const ownerId = 'sync-conflict-owner';
    const local = { ...draft(ownerId, 'sync-conflict-q'), version: 2 };
    const remote = { ...local, version: 3 };
    await repository.saveQuestion(
      ownerId,
      local,
      'update',
      'blocked-operation',
    );
    const gateway = {
      push: () => Promise.resolve({ kind: 'conflict' as const, remote }),
      pullRecent: () =>
        Promise.resolve({
          questions: [],
          quizzes: [],
          rejectedRows: [],
        }),
    };
    await syncQuestionWorkspace(ownerId, repository, gateway);
    await syncQuestionWorkspace(ownerId, repository, gateway);
    expect((await repository.load(ownerId)).conflicts).toHaveLength(1);
    expect(await repository.listOutbox(ownerId)).toHaveLength(1);
  });

  it('signale une row distante invalide sans lever, et laisse les autres opérations se synchroniser', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const ownerId = 'invalid-row-owner';
    const broken = draft(ownerId, 'broken-q');
    const healthy = draft(ownerId, 'healthy-q');
    await repository.saveQuestion(ownerId, broken, 'create', 'op-broken');
    await repository.saveQuestion(ownerId, healthy, 'create', 'op-healthy');
    const gateway = {
      push: (operation: { entityId: string }) =>
        operation.entityId === broken.id
          ? Promise.resolve({
              kind: 'remote-row-invalid' as const,
              message: 'Question broken-q : contenu distant invalide.',
            })
          : Promise.resolve({ kind: 'accepted' as const }),
      pullRecent: () =>
        Promise.resolve({ questions: [], quizzes: [], rejectedRows: [] }),
    };
    const result = await syncQuestionWorkspace(ownerId, repository, gateway);
    expect(result.rejectedRemoteRows).toHaveLength(1);
    expect(result.rejectedRemoteRows[0]?.message).toContain('broken-q');
    const remaining = await repository.listOutbox(ownerId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.entityId).toBe(broken.id);
  });

  it('récupère le quizz distant avec ses libellés sans fuite intercompte', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const ownerId = 'gpt-owner';
    const now = '2026-01-01T00:00:00.000Z';
    const course = {
      id: 'thermo-course',
      ownerId,
      title: 'Thermodynamique perso',
      description: '',
      visibility: 'private' as const,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const remoteQuestion = {
      ...draft(ownerId, 'gpt-q'),
      classification: {
        kind: 'personal' as const,
        courseId: course.id,
        chapter: null,
      },
    };
    await syncQuestionWorkspace(ownerId, repository, {
      push: () => Promise.resolve({ kind: 'accepted' as const }),
      pullRecent: () =>
        Promise.resolve({
          questions: [remoteQuestion],
          quizzes: [course],
          rejectedRows: [],
        }),
    });
    const snapshot = await repository.load(ownerId);
    expect(snapshot.quizzes).toEqual([course]);
    expect(
      searchAndFilterQuestions({
        questions: snapshot.questions,
        search: 'Thermodynamique perso',
        filters: {},
        program: null,
        quizzes: snapshot.quizzes,
      }).map((item) => item.id),
    ).toEqual(['gpt-q']);
    expect((await repository.load('other-owner')).quizzes).toEqual([]);
  });

  it('synchronise un quizz manuel offline dans l’ordre des dépendances', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const ownerId = 'offline-owner';
    const now = '2026-01-01T00:00:00.000Z';
    const course = {
      id: 'offline-c',
      ownerId,
      title: 'Offline',
      description: '',
      visibility: 'private' as const,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const offlineQuestion = {
      ...draft(ownerId, 'offline-q'),
      classification: {
        kind: 'personal' as const,
        courseId: course.id,
        chapter: 'Chapitre',
      },
    };
    await repository.saveQuestionWithQuizz(ownerId, offlineQuestion, course, {
      question: 'offline-op-q',
      quizz: 'offline-op-c',
    });
    const pushed: string[] = [];
    await syncQuestionWorkspace(ownerId, repository, {
      push: (operation) => {
        pushed.push(operation.entity);
        return Promise.resolve({ kind: 'accepted' as const });
      },
      pullRecent: () =>
        Promise.resolve({
          questions: [],
          quizzes: [],
          rejectedRows: [],
        }),
    });
    expect(pushed).toEqual(['quizz', 'question']);
    expect(await repository.listOutbox(ownerId)).toEqual([]);
  });

  it('crée un quizz indépendamment de toute question', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const ownerId = 'folder-owner';
    const now = '2026-01-01T00:00:00.000Z';
    const course = {
      id: 'course-folder',
      ownerId,
      title: 'Cours',
      description: '',
      visibility: 'private' as const,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await repository.saveQuizz(ownerId, course, 'op-course');
    const snapshot = await repository.load(ownerId);
    expect(snapshot.quizzes).toEqual([course]);
    expect(snapshot.pendingOperationCount).toBe(1);
    expect((await repository.load('other-owner')).quizzes).toEqual([]);
  });
});
