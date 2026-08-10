import { openDB, type DBSchema } from 'idb';
import type { Question } from '@domain/questions/Question';
import { assertPersonalTaxonomyOwner } from '@domain/questions/personal-taxonomy/PersonalTaxonomy';
import type {
  PersonalChapter,
  PersonalCourse,
  PersonalNotion,
} from '@domain/questions/personal-taxonomy/PersonalTaxonomy';
import type {
  QuestionMutationKind,
  QuestionOutboxOperation,
  QuestionSyncConflict,
  QuestionWorkspaceRepository,
} from '@domain/repositories/QuestionWorkspaceRepository';

interface OwnedQuestion {
  key: string;
  userId: string;
  question: Question;
}
interface OwnedCourse {
  key: string;
  userId: string;
  value: PersonalCourse;
}
interface OwnedChapter {
  key: string;
  userId: string;
  value: PersonalChapter;
}
interface OwnedNotion {
  key: string;
  userId: string;
  value: PersonalNotion;
}
interface OwnedOperation {
  key: string;
  userId: string;
  value: QuestionOutboxOperation;
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
  courses: { key: string; value: OwnedCourse; indexes: { 'by-user': string } };
  chapters: {
    key: string;
    value: OwnedChapter;
    indexes: { 'by-user': string };
  };
  notions: { key: string; value: OwnedNotion; indexes: { 'by-user': string } };
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
    1,
    {
      upgrade(db) {
        for (const name of [
          'questions',
          'courses',
          'chapters',
          'notions',
          'outbox',
          'conflicts',
        ] as const) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'key' });
            store.createIndex('by-user', 'userId');
          }
        }
      },
    },
  ));

const key = (userId: string, id: string) => `${userId}:${id}`;
const owned = (question: Readonly<Question>, userId: string) =>
  question.source === 'static' || question.ownerId === userId;

export class IndexedDbQuestionWorkspaceRepository implements QuestionWorkspaceRepository {
  async load(userId: string) {
    if (!userId) throw new Error('Compte requis.');
    const db = await database();
    const [questions, courses, chapters, notions, outbox, conflicts] =
      await Promise.all([
        db.getAllFromIndex('questions', 'by-user', userId),
        db.getAllFromIndex('courses', 'by-user', userId),
        db.getAllFromIndex('chapters', 'by-user', userId),
        db.getAllFromIndex('notions', 'by-user', userId),
        db.getAllFromIndex('outbox', 'by-user', userId),
        db.getAllFromIndex('conflicts', 'by-user', userId),
      ]);
    return {
      questions: questions.map((row) => structuredClone(row.question)),
      courses: courses.map((row) => structuredClone(row.value)),
      chapters: chapters.map((row) => structuredClone(row.value)),
      notions: notions.map((row) => structuredClone(row.value)),
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

  async savePersonalCourse(userId: string, value: PersonalCourse) {
    assertPersonalTaxonomyOwner(value, userId);
    await (
      await database()
    ).put('courses', {
      key: key(userId, value.id),
      userId,
      value: structuredClone(value),
    });
  }
  async savePersonalChapter(userId: string, value: PersonalChapter) {
    assertPersonalTaxonomyOwner(value, userId);
    await (
      await database()
    ).put('chapters', {
      key: key(userId, value.id),
      userId,
      value: structuredClone(value),
    });
  }
  async savePersonalNotion(userId: string, value: PersonalNotion) {
    assertPersonalTaxonomyOwner(value, userId);
    await (
      await database()
    ).put('notions', {
      key: key(userId, value.id),
      userId,
      value: structuredClone(value),
    });
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
    const selected =
      choice === 'remote' ? conflictRow.value.remote : conflictRow.value.local;
    const resolved =
      choice === 'duplicate'
        ? {
            ...selected,
            id: crypto.randomUUID(),
            version: 1,
            source: 'private' as const,
            ownerId: userId,
            status: 'draft' as const,
            validated: false,
          }
        : selected;
    const transaction = db.transaction(['questions', 'conflicts'], 'readwrite');
    await transaction.objectStore('questions').put({
      key: key(userId, `${resolved.id}:${resolved.version}`),
      userId,
      question: structuredClone(resolved),
    });
    await transaction.objectStore('conflicts').delete(key(userId, conflictId));
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
  async applyRemoteQuestions(
    userId: string,
    questions: readonly Readonly<Question>[],
  ) {
    const db = await database();
    const transaction = db.transaction('questions', 'readwrite');
    for (const question of questions) {
      if (!owned(question, userId)) throw new Error('Compte incohérent.');
      await transaction.store.put({
        key: key(userId, `${question.id}:${question.version}`),
        userId,
        question: structuredClone(question),
      });
    }
    await transaction.done;
  }
  async recordConflict(userId: string, conflict: QuestionSyncConflict) {
    if (conflict.userId !== userId) throw new Error('Compte incohérent.');
    await (
      await database()
    ).put('conflicts', {
      key: key(userId, conflict.id),
      userId,
      value: structuredClone(conflict),
    });
  }
}
