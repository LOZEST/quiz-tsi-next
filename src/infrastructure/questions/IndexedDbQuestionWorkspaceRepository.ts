import { openDB, type DBSchema } from 'idb';
import type { Question } from '@domain/questions/Question';
import { latestQuestionVersions } from '@domain/questions/LatestQuestionVersions';
import { assertQuizzOwner } from '@domain/questions/quizz/Quizz';
import type { Quizz } from '@domain/questions/quizz/Quizz';
import type {
  QuestionMutationKind,
  QuestionOutboxOperation,
  QuestionSyncConflict,
  QuestionWorkspaceOutboxOperation,
  QuestionWorkspaceRepository,
} from '@domain/repositories/QuestionWorkspaceRepository';

interface OwnedQuestion {
  key: string;
  userId: string;
  question: Question;
}
interface OwnedQuizz {
  key: string;
  userId: string;
  value: Quizz;
}
interface OwnedOperation {
  key: string;
  userId: string;
  value: QuestionWorkspaceOutboxOperation;
}
interface OwnedConflict {
  key: string;
  userId: string;
  value: QuestionSyncConflict;
}

interface QuestionWorkspaceSchema extends DBSchema {
  questions: {
    key: string;
    value: OwnedQuestion;
    indexes: { 'by-user': string };
  };
  // Physical IndexedDB store name kept as 'courses' — renaming it would require
  // a version bump plus a copy migration, otherwise existing users' local data
  // would silently vanish. Only the TS-facing names above/below are renamed.
  courses: { key: string; value: OwnedQuizz; indexes: { 'by-user': string } };
  outbox: {
    key: string;
    value: OwnedOperation;
    indexes: { 'by-user': string };
  };
  conflicts: {
    key: string;
    value: OwnedConflict;
    indexes: { 'by-user': string };
  };
}

let workspaceDatabase: ReturnType<
  typeof openDB<QuestionWorkspaceSchema>
> | null = null;
const database = () =>
  (workspaceDatabase ??= openDB<QuestionWorkspaceSchema>(
    'quiz-tsi-question-workspace',
    2,
    {
      upgrade(db, oldVersion) {
        for (const name of [
          'questions',
          'courses',
          'outbox',
          'conflicts',
        ] as const) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'key' });
            store.createIndex('by-user', 'userId');
          }
        }
        // v2: personal quizzes dropped the chapter/notion hierarchy in favor of
        // a flat text tag on the question itself — no real user data existed in
        // these stores yet, so they're discarded outright rather than migrated.
        if (oldVersion < 2) {
          for (const name of ['chapters', 'notions']) {
            if (db.objectStoreNames.contains(name as never)) {
              db.deleteObjectStore(name as never);
            }
          }
        }
      },
    },
  ));

const key = (userId: string, id: string) => `${userId}:${id}`;
const owned = (question: Readonly<Question>, userId: string) =>
  question.source === 'static' || question.ownerId === userId;
const accessible = (question: Readonly<Question>, userId: string) =>
  question.source === 'static' ||
  question.source === 'shared' ||
  question.ownerId === userId;

export class IndexedDbQuestionWorkspaceRepository implements QuestionWorkspaceRepository {
  async load(userId: string) {
    if (!userId) throw new Error('Compte requis.');
    const db = await database();
    const [questions, quizzes, outbox, conflicts] = await Promise.all([
      db.getAllFromIndex('questions', 'by-user', userId),
      db.getAllFromIndex('courses', 'by-user', userId),
      db.getAllFromIndex('outbox', 'by-user', userId),
      db.getAllFromIndex('conflicts', 'by-user', userId),
    ]);
    return {
      questions: latestQuestionVersions(
        questions.map((row) => structuredClone(row.question)),
      ),
      quizzes: quizzes
        .map((row) => structuredClone(row.value))
        .filter((quizz) => !quizz.deletedAt),
      pendingOperationCount: outbox.length,
      conflicts: conflicts.map((row) => structuredClone(row.value)),
    };
  }

  async saveQuestion(
    userId: string,
    question: Readonly<Question>,
    kind: QuestionMutationKind,
    operationId: string,
  ): Promise<void> {
    if (!owned(question, userId) || !operationId)
      throw new Error('Compte incohérent.');
    if (question.source === 'static')
      throw new Error('Une question officielle est immuable.');
    const db = await database();
    const transaction = db.transaction(['questions', 'outbox'], 'readwrite');
    const questionKey = key(userId, `${question.id}:${question.version}`);
    const operation: QuestionOutboxOperation = {
      operationId,
      userId,
      entity: 'question',
      entityId: question.id,
      kind,
      baseVersion: kind === 'create' ? null : Math.max(1, question.version - 1),
      payload: structuredClone(question),
      createdAt: new Date().toISOString(),
    };
    await transaction.objectStore('questions').put({
      key: questionKey,
      userId,
      question: structuredClone(question),
    });
    await transaction
      .objectStore('outbox')
      .put({ key: key(userId, operationId), userId, value: operation });
    await transaction.done;
  }

  async saveQuestionWithQuizz(
    userId: string,
    question: Readonly<Question>,
    quizz: Readonly<Quizz> | null,
    operationIds: {
      question: string;
      quizz: string | null;
    },
  ) {
    if (!owned(question, userId) || question.source === 'static')
      throw new Error('Compte incohérent.');
    if (quizz) assertQuizzOwner(quizz, userId);
    const db = await database();
    const transaction = db.transaction(
      ['courses', 'questions', 'outbox'],
      'readwrite',
    );
    const createdAt = new Date().toISOString();
    if (quizz && operationIds.quizz) {
      await transaction.objectStore('courses').put({
        key: key(userId, quizz.id),
        userId,
        value: structuredClone(quizz),
      });
      const quizzOperation: QuestionWorkspaceOutboxOperation = {
        operationId: operationIds.quizz,
        userId,
        entity: 'quizz',
        entityId: quizz.id,
        kind: 'create',
        payload: structuredClone(quizz),
        createdAt,
      };
      await transaction.objectStore('outbox').put({
        key: key(userId, operationIds.quizz),
        userId,
        value: quizzOperation,
      });
    }
    const questionOperation: QuestionOutboxOperation = {
      operationId: operationIds.question,
      userId,
      entity: 'question',
      entityId: question.id,
      kind: question.version === 1 ? 'create' : 'update',
      baseVersion: question.version === 1 ? null : question.version - 1,
      payload: structuredClone(question),
      createdAt,
    };
    await transaction.objectStore('questions').put({
      key: key(userId, `${question.id}:${question.version}`),
      userId,
      question: structuredClone(question),
    });
    await transaction.objectStore('outbox').put({
      key: key(userId, operationIds.question),
      userId,
      value: questionOperation,
    });
    await transaction.done;
  }

  async saveQuizz(
    userId: string,
    quizz: Readonly<Quizz>,
    operationId: string,
    kind: 'create' | 'update' = 'create',
  ) {
    assertQuizzOwner(quizz, userId);
    if (!operationId) throw new Error('Compte incohérent.');
    const db = await database();
    const transaction = db.transaction(['courses', 'outbox'], 'readwrite');
    await transaction.objectStore('courses').put({
      key: key(userId, quizz.id),
      userId,
      value: structuredClone(quizz),
    });
    const operation: QuestionWorkspaceOutboxOperation = {
      operationId,
      userId,
      entity: 'quizz',
      entityId: quizz.id,
      kind,
      payload: structuredClone(quizz),
      createdAt: new Date().toISOString(),
    };
    await transaction
      .objectStore('outbox')
      .put({ key: key(userId, operationId), userId, value: operation });
    await transaction.done;
  }

  async resolveConflict(
    userId: string,
    conflictId: string,
    choice: 'local' | 'remote' | 'duplicate',
  ) {
    const db = await database();
    const conflictRow = await db.get('conflicts', key(userId, conflictId));
    if (!conflictRow || conflictRow.userId !== userId)
      throw new Error('Conflit introuvable.');
    const { local, remote, operationId } = conflictRow.value;
    const resolved =
      choice === 'duplicate'
        ? {
            ...local,
            id: crypto.randomUUID(),
            version: 1,
            source: 'private' as const,
            ownerId: userId,
            status: 'draft' as const,
            validated: false,
          }
        : choice === 'remote'
          ? remote
          : { ...local, version: remote.version + 1 };
    const transaction = db.transaction(
      ['questions', 'conflicts', 'outbox'],
      'readwrite',
    );
    await transaction.objectStore('outbox').delete(key(userId, operationId));
    await transaction.objectStore('questions').put({
      key: key(userId, `${resolved.id}:${resolved.version}`),
      userId,
      question: structuredClone(resolved),
    });
    await transaction.objectStore('conflicts').delete(key(userId, conflictId));
    if (choice !== 'remote') {
      const nextOperationId = crypto.randomUUID();
      const operation: QuestionOutboxOperation = {
        operationId: nextOperationId,
        userId,
        entity: 'question',
        entityId: resolved.id,
        kind: choice === 'duplicate' ? 'create' : 'update',
        baseVersion: choice === 'duplicate' ? null : remote.version,
        payload: structuredClone(resolved),
        createdAt: new Date().toISOString(),
      };
      await transaction.objectStore('outbox').put({
        key: key(userId, nextOperationId),
        userId,
        value: operation,
      });
    }
    await transaction.done;
  }
  async listOutbox(userId: string) {
    const rows = await (
      await database()
    ).getAllFromIndex('outbox', 'by-user', userId);
    return rows
      .map((row) => structuredClone(row.value))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async completeOperation(userId: string, operationId: string) {
    await (await database()).delete('outbox', key(userId, operationId));
  }
  async applyRemoteWorkspace(
    userId: string,
    changes: {
      questions: readonly Readonly<Question>[];
      quizzes: readonly Quizz[];
    },
  ) {
    const db = await database();
    const transaction = db.transaction(['courses', 'questions'], 'readwrite');
    for (const value of changes.quizzes) {
      assertQuizzOwner(value, userId);
      await transaction.objectStore('courses').put({
        key: key(userId, value.id),
        userId,
        value: structuredClone(value),
      });
    }
    for (const question of changes.questions) {
      if (!accessible(question, userId)) throw new Error('Compte incohérent.');
      await transaction.objectStore('questions').put({
        key: key(userId, `${question.id}:${question.version}`),
        userId,
        question: structuredClone(question),
      });
    }
    await transaction.done;
  }
  async recordConflict(userId: string, conflict: QuestionSyncConflict) {
    if (conflict.userId !== userId) throw new Error('Compte incohérent.');
    const db = await database();
    const transaction = db.transaction('conflicts', 'readwrite');
    const existing = await transaction.store.index('by-user').getAll(userId);
    if (
      existing.some((row) => row.value.operationId === conflict.operationId)
    ) {
      await transaction.done;
      return;
    }
    await transaction.store.put({
      key: key(userId, conflict.id),
      userId,
      value: structuredClone(conflict),
    });
    await transaction.done;
  }
}
