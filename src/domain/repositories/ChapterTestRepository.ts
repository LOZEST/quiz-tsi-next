import type { ChapterTestSession } from '../chapter-tests/ChapterTest';

export interface ChapterTestRepository {
  save(session: ChapterTestSession, userId: string): Promise<void>;
  getActive(userId: string): Promise<ChapterTestSession | null>;
  get(sessionId: string, userId: string): Promise<ChapterTestSession | null>;
}
