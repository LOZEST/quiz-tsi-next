import type {
  QuestionBankMetadata,
  QuestionRepository,
  QuestionRepositoryQuery,
} from '../../domain/repositories/QuestionRepository';
import type { QuestionBankImportRepository } from '../../domain/repositories/QuestionBankImportRepository';
import type { ProgramIndex } from '../../domain/program/Program';
import {
  importQuestionBankBundle,
  type QuestionBankImportResult,
} from '../../domain/questions/QuestionBankImporter';
import type { QuestionBankBundle } from '../../domain/questions/QuestionBank';
import {
  questionClassification,
  type Question,
} from '../../domain/questions/Question';
import {
  createSafeSnapshot,
  deepFreezeOwned,
} from '../../domain/validation/SafeSnapshot';

const compare = (left: Question, right: Question) =>
  left.id.localeCompare(right.id) || left.version - right.version;
const clone = <T>(value: T): Readonly<T> => {
  const copied = createSafeSnapshot(value);
  if (!copied.ok) throw new Error('Snapshot interne invalide.');
  return deepFreezeOwned(copied.value as T);
};
const cloneCollection = <T>(values: readonly T[]): readonly Readonly<T>[] =>
  Object.freeze(values.map((value) => clone(value)));

export class InMemoryQuestionRepository
  implements QuestionRepository, QuestionBankImportRepository
{
  #questions: readonly Readonly<Question>[] = Object.freeze([]);
  #metadata: Readonly<QuestionBankMetadata> | null = null;

  constructor(bundle?: QuestionBankBundle) {
    if (bundle) this.replaceBankAtomically(bundle);
  }
  getByIdAndVersion(id: string, version: number): Readonly<Question> | null {
    const found = this.#questions.find(
      (item) => item.id === id && item.version === version,
    );
    return found ? clone(found) : null;
  }
  getLatestById(id: string): Readonly<Question> | null {
    const found = [...this.#questions].reverse().find((item) => item.id === id);
    return found ? clone(found) : null;
  }
  listPublished(): readonly Readonly<Question>[] {
    return cloneCollection(
      this.#questions.filter(
        (item) => item.status === 'published' && item.validated,
      ),
    );
  }
  query(query: QuestionRepositoryQuery): readonly Readonly<Question>[] {
    return cloneCollection(
      this.#questions.filter((item) => {
        const classification = questionClassification(item);
        return (
          (query.partId === undefined ||
            (classification?.kind === 'official' &&
              classification.partId === query.partId)) &&
          (query.chapterId === undefined ||
            (classification?.kind === 'official' &&
              classification.chapterId === query.chapterId)) &&
          (query.notionId === undefined ||
            (classification?.kind === 'official' &&
              classification.notionId === query.notionId)) &&
          (query.source === undefined || item.source === query.source)
        );
      }),
    );
  }
  replaceBankAtomically(bundle: QuestionBankBundle): void {
    const next = bundle.questions
      .map((entry) => clone(entry.question))
      .sort(compare);
    const metadata = clone({
      bundleId: bundle.bundleId,
      schemaVersion: bundle.schemaVersion,
      generatedAt: bundle.generatedAt,
      questionCount: next.length,
    });
    this.#questions = Object.freeze(next);
    this.#metadata = metadata;
  }
  getBankMetadata(): Readonly<QuestionBankMetadata> | null {
    return this.#metadata ? clone(this.#metadata) : null;
  }

  importAndReplace(
    bundle: unknown,
    program?: ProgramIndex,
  ): QuestionBankImportResult {
    const result = importQuestionBankBundle(bundle, this.#questions, program);
    if (result.kind === 'ready') this.replaceBankAtomically(result.bundle);
    return result;
  }
}
