import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ChapterTestSession } from '@domain/chapter-tests/ChapterTest';
import type { QuestionEvaluation } from '@domain/evaluation/QuestionEvaluation';
import type { ChapterTestRepository } from '@domain/repositories/ChapterTestRepository';
import type { EvaluationRepository } from '@domain/repositories/EvaluationRepository';

const DATABASE_NAME = 'quiz-tsi-pr5-data';
const DATABASE_VERSION = 1;

interface StoredEvaluation {
  key: string;
  userId: string;
  sessionId: string;
  evaluation: QuestionEvaluation;
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
    indexes: { 'by-user': string; 'by-user-session': [string, string] };
  };
  chapterTests: {
    key: string;
    value: StoredChapterTest;
    indexes: { 'by-user': string; 'by-user-status': [string, string] };
  };
}

let databasePromise: Promise<IDBPDatabase<Pr5Schema>> | null = null;
function database() {
  databasePromise ??= openDB<Pr5Schema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      const evaluations = db.createObjectStore('evaluations', {
        keyPath: 'key',
      });
      evaluations.createIndex('by-user', 'userId');
      evaluations.createIndex('by-user-session', ['userId', 'sessionId']);
      const tests = db.createObjectStore('chapterTests', { keyPath: 'key' });
      tests.createIndex('by-user', 'userId');
      tests.createIndex('by-user-status', ['userId', 'status']);
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
    await db.add('evaluations', {
      key,
      userId,
      sessionId: evaluation.sessionId,
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
}
