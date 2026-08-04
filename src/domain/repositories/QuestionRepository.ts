import type { QuestionBankBundle } from '../questions/QuestionBank';
import type { Question, QuestionSource } from '../questions/Question';

export interface QuestionBankMetadata {
  readonly bundleId: string;
  readonly schemaVersion: number;
  readonly generatedAt: string;
  readonly questionCount: number;
}
export interface QuestionRepositoryQuery {
  readonly partId?: string;
  readonly chapterId?: string;
  readonly notionId?: string;
  readonly source?: QuestionSource;
}
export interface QuestionRepository {
  getByIdAndVersion(id: string, version: number): Readonly<Question> | null;
  getLatestById(id: string): Readonly<Question> | null;
  listPublished(): readonly Readonly<Question>[];
  query(query: QuestionRepositoryQuery): readonly Readonly<Question>[];
  replaceBankAtomically(bundle: QuestionBankBundle): void;
  getBankMetadata(): Readonly<QuestionBankMetadata> | null;
}
