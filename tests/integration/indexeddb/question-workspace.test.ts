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
      description: '',
      visibility: 'private' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await repository.saveQuestionDraftWithPersonalTaxonomy(
      'account-a',
      {
        ...draft('account-a', 'taxonomy-q'),
        classification: {
          kind: 'personal',
          courseId: 'course-a',
          chapterId: null,
          notionId: null,
        },
      },
      { course, chapter: null, notion: null },
      {
        question: 'taxonomy-q-op',
        course: 'course-op',
        chapter: null,
        notion: null,
      },
    );
    expect((await repository.load('account-a')).courses).toEqual([course]);
    expect((await repository.load('account-b')).courses).toEqual([]);
  });

  it('expose seulement la dernière version tout en conservant l’historique physique', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    for (const version of [1, 2, 3]) {
      await repository.applyRemoteWorkspace('history-owner', {
        questions: [{ ...draft('history-owner', 'history-q'), version }],
        courses: [],
        chapters: [],
        notions: [],
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

  it('enregistre hiérarchie, question et outbox dans une transaction unique', async () => {
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
    };
    const chapter = {
      id: 'atomic-chapter',
      ownerId,
      courseId: course.id,
      title: 'Chapitre 1',
      createdAt: now,
      updatedAt: now,
    };
    const notion = {
      id: 'atomic-notion',
      ownerId,
      courseId: course.id,
      chapterId: chapter.id,
      title: 'Notion 1',
      createdAt: now,
      updatedAt: now,
    };
    const question = {
      ...draft(ownerId, 'atomic-q'),
      classification: {
        kind: 'personal' as const,
        courseId: course.id,
        chapterId: chapter.id,
        notionId: notion.id,
      },
    };
    await repository.saveQuestionDraftWithPersonalTaxonomy(
      ownerId,
      question,
      { course, chapter, notion },
      { question: 'op-q', course: 'op-c', chapter: 'op-ch', notion: 'op-n' },
    );
    const snapshot = await repository.load(ownerId);
    expect([
      snapshot.courses.length,
      snapshot.chapters.length,
      snapshot.notions.length,
      snapshot.questions.length,
    ]).toEqual([1, 1, 1, 1]);
    expect(
      (await repository.listOutbox(ownerId)).map((item) => item.entity),
    ).toEqual(['course', 'chapter', 'notion', 'question']);
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
          courses: [],
          chapters: [],
          notions: [],
          rejectedRows: [],
        }),
    };
    await syncQuestionWorkspace(ownerId, repository, gateway);
    await syncQuestionWorkspace(ownerId, repository, gateway);
    expect((await repository.load(ownerId)).conflicts).toHaveLength(1);
    expect(await repository.listOutbox(ownerId)).toHaveLength(1);
  });

  it('récupère la taxonomie GPT distante avec ses libellés sans fuite intercompte', async () => {
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
    };
    const remoteQuestion = {
      ...draft(ownerId, 'gpt-q'),
      classification: {
        kind: 'personal' as const,
        courseId: course.id,
        chapterId: null,
        notionId: null,
      },
    };
    await syncQuestionWorkspace(ownerId, repository, {
      push: () => Promise.resolve({ kind: 'accepted' as const }),
      pullRecent: () =>
        Promise.resolve({
          questions: [remoteQuestion],
          courses: [course],
          chapters: [],
          notions: [],
          rejectedRows: [],
        }),
    });
    const snapshot = await repository.load(ownerId);
    expect(snapshot.courses).toEqual([course]);
    expect(
      searchAndFilterQuestions({
        questions: snapshot.questions,
        search: 'Thermodynamique perso',
        filters: {},
        program: null,
        courses: snapshot.courses,
        chapters: snapshot.chapters,
        notions: snapshot.notions,
      }).map((item) => item.id),
    ).toEqual(['gpt-q']);
    expect((await repository.load('other-owner')).courses).toEqual([]);
  });

  it('synchronise une taxonomie manuelle offline dans l’ordre des dépendances', async () => {
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
    };
    const chapter = {
      id: 'offline-ch',
      ownerId,
      courseId: course.id,
      title: 'Chapitre',
      createdAt: now,
      updatedAt: now,
    };
    const notion = {
      id: 'offline-n',
      ownerId,
      courseId: course.id,
      chapterId: chapter.id,
      title: 'Notion',
      createdAt: now,
      updatedAt: now,
    };
    const offlineQuestion = {
      ...draft(ownerId, 'offline-q'),
      classification: {
        kind: 'personal' as const,
        courseId: course.id,
        chapterId: chapter.id,
        notionId: notion.id,
      },
    };
    await repository.saveQuestionDraftWithPersonalTaxonomy(
      ownerId,
      offlineQuestion,
      { course, chapter, notion },
      {
        question: 'offline-op-q',
        course: 'offline-op-c',
        chapter: 'offline-op-ch',
        notion: 'offline-op-n',
      },
    );
    const pushed: string[] = [];
    await syncQuestionWorkspace(ownerId, repository, {
      push: (operation) => {
        pushed.push(operation.entity);
        return Promise.resolve({ kind: 'accepted' as const });
      },
      pullRecent: () =>
        Promise.resolve({
          questions: [],
          courses: [],
          chapters: [],
          notions: [],
          rejectedRows: [],
        }),
    });
    expect(pushed).toEqual(['course', 'chapter', 'notion', 'question']);
    expect(await repository.listOutbox(ownerId)).toEqual([]);
  });

  it('refuse atomiquement une notion existante rattachée à un autre chapitre', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const ownerId = 'coherent-owner';
    const now = '2026-01-01T00:00:00.000Z';
    const course = {
      id: 'c',
      ownerId,
      title: 'Cours',
      description: '',
      visibility: 'private' as const,
      createdAt: now,
      updatedAt: now,
    };
    const chapterA = {
      id: 'a',
      ownerId,
      courseId: 'c',
      title: 'A',
      createdAt: now,
      updatedAt: now,
    };
    const notionA = {
      id: 'a1',
      ownerId,
      courseId: 'c',
      chapterId: 'a',
      title: 'A1',
      createdAt: now,
      updatedAt: now,
    };
    await repository.saveQuestionDraftWithPersonalTaxonomy(
      ownerId,
      {
        ...draft(ownerId, 'baseline'),
        classification: {
          kind: 'personal',
          courseId: 'c',
          chapterId: 'a',
          notionId: 'a1',
        },
      },
      { course, chapter: chapterA, notion: notionA },
      { question: 'q1', course: 'c1', chapter: 'a1-op', notion: 'n1' },
    );
    const chapterB = { ...chapterA, id: 'b', title: 'B' };
    await expect(
      repository.saveQuestionDraftWithPersonalTaxonomy(
        ownerId,
        {
          ...draft(ownerId, 'invalid'),
          classification: {
            kind: 'personal',
            courseId: 'c',
            chapterId: 'b',
            notionId: 'a1',
          },
        },
        { course: null, chapter: chapterB, notion: null },
        { question: 'q2', course: null, chapter: 'b-op', notion: null },
      ),
    ).rejects.toThrow('Taxonomie incohérente');
    expect(
      (await repository.load(ownerId)).questions.map((item) => item.id),
    ).toEqual(['baseline']);
  });

  it('crée un dossier (cours/chapitre/notion) indépendamment de toute question', async () => {
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
    };
    await repository.saveCourse(ownerId, course, 'op-course');
    const chapter = {
      id: 'chapter-folder',
      ownerId,
      courseId: 'course-folder',
      title: 'Chapitre',
      createdAt: now,
      updatedAt: now,
    };
    await repository.saveChapter(ownerId, chapter, 'op-chapter');
    const notion = {
      id: 'notion-folder',
      ownerId,
      courseId: 'course-folder',
      chapterId: 'chapter-folder',
      title: 'Notion',
      createdAt: now,
      updatedAt: now,
    };
    await repository.saveNotion(ownerId, notion, 'op-notion');
    const snapshot = await repository.load(ownerId);
    expect(snapshot.courses).toEqual([course]);
    expect(snapshot.chapters).toEqual([chapter]);
    expect(snapshot.notions).toEqual([notion]);
    expect(snapshot.pendingOperationCount).toBe(3);
    expect((await repository.load('other-owner')).courses).toEqual([]);
  });

  it('refuse un chapitre ou une notion rattachés à un cours inexistant ou étranger', async () => {
    const repository = new IndexedDbQuestionWorkspaceRepository();
    const ownerId = 'guard-owner';
    const now = '2026-01-01T00:00:00.000Z';
    await expect(
      repository.saveChapter(
        ownerId,
        {
          id: 'orphan-chapter',
          ownerId,
          courseId: 'missing-course',
          title: 'X',
          createdAt: now,
          updatedAt: now,
        },
        'op-orphan-chapter',
      ),
    ).rejects.toThrow('Taxonomie incohérente');
    const otherOwnerCourse = {
      id: 'foreign-course',
      ownerId: 'someone-else',
      title: 'Cours étranger',
      description: '',
      visibility: 'private' as const,
      createdAt: now,
      updatedAt: now,
    };
    await repository.saveCourse(
      'someone-else',
      otherOwnerCourse,
      'op-foreign-course',
    );
    await expect(
      repository.saveNotion(
        ownerId,
        {
          id: 'orphan-notion',
          ownerId,
          courseId: 'foreign-course',
          chapterId: null,
          title: 'Y',
          createdAt: now,
          updatedAt: now,
        },
        'op-orphan-notion',
      ),
    ).rejects.toThrow('Taxonomie incohérente');
  });
});
