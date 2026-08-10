import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ChapterTestSession } from '@domain/chapter-tests/ChapterTest';
import type {
  QuestionAttemptDraft,
  QuestionEvaluation,
} from '@domain/evaluation/QuestionEvaluation';
import type { ChapterTestRepository } from '@domain/repositories/ChapterTestRepository';
import type { EvaluationRepository } from '@domain/repositories/EvaluationRepository';
import type { QuestionAttemptRepository } from '@domain/repositories/QuestionAttemptRepository';

const DATABASE_NAME = 'quiz-tsi-pr5-data';
const DATABASE_VERSION = 2;

interface StoredEvaluation {
  key: string;
  userId: string;
  sessionId: string;
  questionInstanceId: string;
  evaluation: QuestionEvaluation;
}
interface StoredQuestionAttempt {
  key: string;
  userId: string;
  draft: QuestionAttemptDraft;
}
interface StoredChapterTest {
  key: string;
  userId: string;
  status: ChapterTestSession['status'];
  session: ChapterTestSession;
}
interface Pr5Schema extends DBSchema {
  evaluations: {
    key: string;
    value: StoredEvaluation;
    indexes: {
      'by-user': string;
      'by-user-session': [string, string];
      'by-user-instance': [string, string];
    };
  };
  chapterTests: {
    key: string;
    value: StoredChapterTest;
    indexes: { 'by-user': string; 'by-user-status': [string, string] };
  };
  questionAttempts: {
    key: string;
    value: StoredQuestionAttempt;
    indexes: { 'by-user': string };
  };
}

let databasePromise: Promise<IDBPDatabase<Pr5Schema>> | null = null;
function database() {
  databasePromise ??= openDB<Pr5Schema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      const evaluations = db.objectStoreNames.contains('evaluations')
        ? transaction.objectStore('evaluations')
        : db.createObjectStore('evaluations', { keyPath: 'key' });
      if (!evaluations.indexNames.contains('by-user'))
        evaluations.createIndex('by-user', 'userId');
      if (!evaluations.indexNames.contains('by-user-session'))
        evaluations.createIndex('by-user-session', ['userId', 'sessionId']);
      if (!evaluations.indexNames.contains('by-user-instance'))
        evaluations.createIndex(
          'by-user-instance',
          ['userId', 'questionInstanceId'],
          { unique: true },
        );
      if (!db.objectStoreNames.contains('chapterTests')) {
        const tests = db.createObjectStore('chapterTests', { keyPath: 'key' });
        tests.createIndex('by-user', 'userId');
        tests.createIndex('by-user-status', ['userId', 'status']);
      }
      if (!db.objectStoreNames.contains('questionAttempts')) {
        const attempts = db.createObjectStore('questionAttempts', {
          keyPath: 'key',
        });
        attempts.createIndex('by-user', 'userId');
      }
    },
  });
  return databasePromise;
}

export class IndexedDbEvaluationRepository implements EvaluationRepository {
  async append(evaluation: QuestionEvaluation, userId: string): Promise<void> {
    if (evaluation.userId !== userId) throw new Error('Compte incohérent.');
    const db = await database();
    const key = `${userId}:${evaluation.id}`;
    if (await db.get('evaluations', key))
      throw new Error('Cette évaluation existe déjà.');
    const existingForUser = await db.getAllFromIndex(
      'evaluations',
      'by-user',
      userId,
    );
    if (
      existingForUser.some(
        (row) =>
          row.evaluation.questionInstanceId === evaluation.questionInstanceId,
      )
    )
      throw new Error('Cette question est déjà évaluée.');
    await db.add('evaluations', {
      key,
      userId,
      sessionId: evaluation.sessionId,
      questionInstanceId: evaluation.questionInstanceId,
      evaluation: structuredClone(evaluation),
    });
  }
  async listByUser(userId: string) {
    const rows = await (
      await database()
    ).getAllFromIndex('evaluations', 'by-user', userId);
    return rows.map((row) => row.evaluation);
  }
  async listBySession(sessionId: string, userId: string) {
    const rows = await (
      await database()
    ).getAllFromIndex('evaluations', 'by-user-session', [userId, sessionId]);
    return rows.map((row) => row.evaluation);
  }
}

export class IndexedDbQuestionAttemptRepository implements QuestionAttemptRepository {
  async save(draft: QuestionAttemptDraft, userId: string): Promise<void> {
    if (draft.userId !== userId) throw new Error('Compte incohérent.');
    await (
      await database()
    ).put('questionAttempts', {
      key: `${userId}:${draft.questionInstanceId}`,
      userId,
      draft: structuredClone(draft),
    });
  }

  async get(questionInstanceId: string, userId: string) {
    const row = await (
      await database()
    ).get('questionAttempts', `${userId}:${questionInstanceId}`);
    return row?.draft ?? null;
  }
}

export class IndexedDbChapterTestRepository implements ChapterTestRepository {
  async save(session: ChapterTestSession, userId: string): Promise<void> {
    if (session.blueprint.userId !== userId)
      throw new Error('Compte incohérent.');
    await (
      await database()
    ).put('chapterTests', {
      key: `${userId}:${session.blueprint.sessionId}`,
      userId,
      status: session.status,
      session: structuredClone(session),
    });
  }
  async getActive(userId: string) {
    const rows = await (
      await database()
    ).getAllFromIndex('chapterTests', 'by-user-status', [userId, 'active']);
    return rows.at(-1)?.session ?? null;
  }
  async get(sessionId: string, userId: string) {
    const row = await (
      await database()
    ).get('chapterTests', `${userId}:${sessionId}`);
    return row?.session ?? null;
  }
  async listByUser(userId: string, limit = 200) {
    const rows = await (
      await database()
    ).getAllFromIndex(
      'chapterTests',
      'by-user',
      userId,
      Math.max(0, Math.min(limit, 500)),
    );
    return rows.map((row) => row.session);
  }
}
