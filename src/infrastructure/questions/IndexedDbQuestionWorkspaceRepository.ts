import { openDB, type DBSchema } from 'idb';
import {
  questionClassification,
  type Question,
} from '@domain/questions/Question';
import { latestQuestionVersions } from '@domain/questions/LatestQuestionVersions';
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
  QuestionWorkspaceOutboxOperation,
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
const accessible = (question: Readonly<Question>, userId: string) =>
  question.source === 'static' ||
  question.source === 'shared' ||
  question.ownerId === userId;

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
      questions: latestQuestionVersions(
        questions.map((row) => structuredClone(row.question)),
      ),
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

  async saveQuestionDraftWithPersonalTaxonomy(
    userId: string,
    question: Readonly<Question>,
    taxonomy: {
      course: PersonalCourse | null;
      chapter: PersonalChapter | null;
      notion: PersonalNotion | null;
    },
    operationIds: {
      question: string;
      course: string | null;
      chapter: string | null;
      notion: string | null;
    },
  ) {
    if (!owned(question, userId) || question.source === 'static')
      throw new Error('Compte incohérent.');
    for (const value of [taxonomy.course, taxonomy.chapter, taxonomy.notion]) {
      if (value) assertPersonalTaxonomyOwner(value, userId);
    }
    const classification = questionClassification(question);
    if (!classification || classification.kind !== 'personal')
      throw new Error('Taxonomie personnelle requise.');
    if (
      taxonomy.chapter &&
      taxonomy.chapter.courseId !== classification.courseId
    )
      throw new Error('Taxonomie incohérente.');
    if (
      taxonomy.notion &&
      (taxonomy.notion.courseId !== classification.courseId ||
        taxonomy.notion.chapterId !== classification.chapterId)
    )
      throw new Error('Taxonomie incohérente.');
    const db = await database();
    const transaction = db.transaction(
      ['courses', 'chapters', 'notions', 'questions', 'outbox'],
      'readwrite',
    );
    const course =
      taxonomy.course ??
      (
        await transaction
          .objectStore('courses')
          .get(key(userId, classification.courseId))
      )?.value;
    const chapter = classification.chapterId
      ? (taxonomy.chapter ??
        (
          await transaction
            .objectStore('chapters')
            .get(key(userId, classification.chapterId))
        )?.value)
      : null;
    const notion = classification.notionId
      ? (taxonomy.notion ??
        (
          await transaction
            .objectStore('notions')
            .get(key(userId, classification.notionId))
        )?.value)
      : null;
    if (
      !course ||
      course.ownerId !== userId ||
      course.id !== classification.courseId ||
      (classification.chapterId &&
        (!chapter ||
          chapter.ownerId !== userId ||
          chapter.courseId !== course.id)) ||
      (classification.notionId &&
        (!notion ||
          notion.ownerId !== userId ||
          notion.courseId !== course.id ||
          notion.chapterId !== classification.chapterId))
    ) {
      throw new Error('Taxonomie incohérente.');
    }
    const createdAt = new Date().toISOString();
    const taxonomyEntries = [
      ['course', 'courses', taxonomy.course, operationIds.course],
      ['chapter', 'chapters', taxonomy.chapter, operationIds.chapter],
      ['notion', 'notions', taxonomy.notion, operationIds.notion],
    ] as const;
    for (const [entity, storeName, value, operationId] of taxonomyEntries) {
      if (!value || !operationId) continue;
      await transaction.objectStore(storeName).put({
        key: key(userId, value.id),
        userId,
        value: structuredClone(value),
      } as OwnedCourse | OwnedChapter | OwnedNotion);
      const operation = {
        operationId,
        userId,
        entity,
        entityId: value.id,
        kind: 'create' as const,
        payload: structuredClone(value),
        createdAt,
      } as QuestionWorkspaceOutboxOperation;
      await transaction.objectStore('outbox').put({
        key: key(userId, operationId),
        userId,
        value: operation,
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

  async saveCourse(
    userId: string,
    course: Readonly<PersonalCourse>,
    operationId: string,
    kind: 'create' | 'update' = 'create',
  ) {
    assertPersonalTaxonomyOwner(course, userId);
    if (!operationId) throw new Error('Compte incohérent.');
    const db = await database();
    const transaction = db.transaction(['courses', 'outbox'], 'readwrite');
    await transaction.objectStore('courses').put({
      key: key(userId, course.id),
      userId,
      value: structuredClone(course),
    });
    const operation: QuestionWorkspaceOutboxOperation = {
      operationId,
      userId,
      entity: 'course',
      entityId: course.id,
      kind,
      payload: structuredClone(course),
      createdAt: new Date().toISOString(),
    };
    await transaction
      .objectStore('outbox')
      .put({ key: key(userId, operationId), userId, value: operation });
    await transaction.done;
  }

  async saveChapter(
    userId: string,
    chapter: Readonly<PersonalChapter>,
    operationId: string,
  ) {
    assertPersonalTaxonomyOwner(chapter, userId);
    if (!operationId) throw new Error('Compte incohérent.');
    const db = await database();
    const transaction = db.transaction(
      ['courses', 'chapters', 'outbox'],
      'readwrite',
    );
    const course = (
      await transaction
        .objectStore('courses')
        .get(key(userId, chapter.courseId))
    )?.value;
    if (!course || course.ownerId !== userId)
      throw new Error('Taxonomie incohérente.');
    await transaction.objectStore('chapters').put({
      key: key(userId, chapter.id),
      userId,
      value: structuredClone(chapter),
    });
    const operation: QuestionWorkspaceOutboxOperation = {
      operationId,
      userId,
      entity: 'chapter',
      entityId: chapter.id,
      kind: 'create',
      payload: structuredClone(chapter),
      createdAt: new Date().toISOString(),
    };
    await transaction
      .objectStore('outbox')
      .put({ key: key(userId, operationId), userId, value: operation });
    await transaction.done;
  }

  async saveNotion(
    userId: string,
    notion: Readonly<PersonalNotion>,
    operationId: string,
  ) {
    assertPersonalTaxonomyOwner(notion, userId);
    if (!operationId) throw new Error('Compte incohérent.');
    const db = await database();
    const transaction = db.transaction(
      ['courses', 'chapters', 'notions', 'outbox'],
      'readwrite',
    );
    const course = (
      await transaction.objectStore('courses').get(key(userId, notion.courseId))
    )?.value;
    if (!course || course.ownerId !== userId)
      throw new Error('Taxonomie incohérente.');
    if (notion.chapterId) {
      const chapter = (
        await transaction
          .objectStore('chapters')
          .get(key(userId, notion.chapterId))
      )?.value;
      if (
        !chapter ||
        chapter.ownerId !== userId ||
        chapter.courseId !== notion.courseId
      )
        throw new Error('Taxonomie incohérente.');
    }
    await transaction.objectStore('notions').put({
      key: key(userId, notion.id),
      userId,
      value: structuredClone(notion),
    });
    const operation: QuestionWorkspaceOutboxOperation = {
      operationId,
      userId,
      entity: 'notion',
      entityId: notion.id,
      kind: 'create',
      payload: structuredClone(notion),
      createdAt: new Date().toISOString(),
    };
    await transaction
      .objectStore('outbox')
      .put({ key: key(userId, operationId), userId, value: operation });
    await transaction.done;
  }

  async deleteCourse(userId: string, courseId: string, operationId: string) {
    if (!operationId) throw new Error('Compte incohérent.');
    const db = await database();
    const transaction = db.transaction(
      ['courses', 'questions', 'outbox'],
      'readwrite',
    );
    const courseRow = await transaction
      .objectStore('courses')
      .get(key(userId, courseId));
    if (!courseRow || courseRow.userId !== userId)
      throw new Error('Quizz introuvable.');
    const now = new Date().toISOString();
    const questionRows = await transaction
      .objectStore('questions')
      .index('by-user')
      .getAll(userId);
    const latest = latestQuestionVersions(
      questionRows.map((row) => row.question),
    );
    for (const question of latest) {
      const classification = questionClassification(question);
      if (
        classification?.kind !== 'personal' ||
        classification.courseId !== courseId ||
        question.status === 'archived'
      )
        continue;
      const archived: Question = {
        ...question,
        version: question.version + 1,
        status: 'archived',
        updatedAt: now,
      };
      await transaction.objectStore('questions').put({
        key: key(userId, `${archived.id}:${archived.version}`),
        userId,
        question: structuredClone(archived),
      });
      const archiveOperationId = crypto.randomUUID();
      const archiveOperation: QuestionOutboxOperation = {
        operationId: archiveOperationId,
        userId,
        entity: 'question',
        entityId: archived.id,
        kind: 'archive',
        baseVersion: question.version,
        payload: structuredClone(archived),
        createdAt: now,
      };
      await transaction.objectStore('outbox').put({
        key: key(userId, archiveOperationId),
        userId,
        value: archiveOperation,
      });
    }
    await transaction.objectStore('courses').delete(key(userId, courseId));
    const deleteOperation: QuestionWorkspaceOutboxOperation = {
      operationId,
      userId,
      entity: 'course',
      entityId: courseId,
      kind: 'delete',
      payload: structuredClone(courseRow.value),
      createdAt: now,
    };
    await transaction
      .objectStore('outbox')
      .put({ key: key(userId, operationId), userId, value: deleteOperation });
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
      courses: readonly PersonalCourse[];
      chapters: readonly PersonalChapter[];
      notions: readonly PersonalNotion[];
    },
  ) {
    const db = await database();
    const transaction = db.transaction(
      ['courses', 'chapters', 'notions', 'questions'],
      'readwrite',
    );
    for (const [storeName, values] of [
      ['courses', changes.courses],
      ['chapters', changes.chapters],
      ['notions', changes.notions],
    ] as const) {
      for (const value of values) {
        assertPersonalTaxonomyOwner(value, userId);
        await transaction.objectStore(storeName).put({
          key: key(userId, value.id),
          userId,
          value: structuredClone(value),
        } as OwnedCourse | OwnedChapter | OwnedNotion);
      }
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
