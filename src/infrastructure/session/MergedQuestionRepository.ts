import type {
  QuestionBankMetadata,
  QuestionRepository,
  QuestionRepositoryQuery,
} from '@domain/repositories/QuestionRepository';
import type { QuestionBankBundle } from '@domain/questions/QuestionBank';
import { questionClassification, type Question } from '@domain/questions/Question';

function matchesQuery(item: Readonly<Question>, query: QuestionRepositoryQuery): boolean {
  const classification = questionClassification(item);
  return (
    (query.partId === undefined ||
      (classification?.kind === 'official' && classification.partId === query.partId)) &&
    (query.chapterId === undefined ||
      (classification?.kind === 'official' && classification.chapterId === query.chapterId)) &&
    (query.notionId === undefined ||
      (classification?.kind === 'official' && classification.notionId === query.notionId)) &&
    (query.source === undefined || item.source === query.source)
  );
}

/**
 * Wraps the static production/controlled repository and merges in the current
 * user's own private/shared/marketplace-added Quizz questions, so sessions can
 * draw from both pools instead of the static bank only.
 */
export class MergedQuestionRepository implements QuestionRepository {
  #userQuestions: readonly Readonly<Question>[] = [];

  constructor(private readonly staticRepository: QuestionRepository) {}

  setUserContributions(questions: readonly Readonly<Question>[]): void {
    this.#userQuestions = questions;
  }

  getByIdAndVersion(id: string, version: number): Readonly<Question> | null {
    return (
      this.staticRepository.getByIdAndVersion(id, version) ??
      this.#userQuestions.find(
        (item) => item.id === id && item.version === version,
      ) ??
      null
    );
  }

  getLatestById(id: string): Readonly<Question> | null {
    const userMatch = [...this.#userQuestions]
      .reverse()
      .find((item) => item.id === id);
    return userMatch ?? this.staticRepository.getLatestById(id);
  }

  listPublished(): readonly Readonly<Question>[] {
    return [
      ...this.staticRepository.listPublished(),
      ...this.#userQuestions.filter(
        (item) => item.status === 'published' && item.validated,
      ),
    ];
  }

  query(query: QuestionRepositoryQuery): readonly Readonly<Question>[] {
    return [
      ...this.staticRepository.query(query),
      ...this.#userQuestions.filter((item) => matchesQuery(item, query)),
    ];
  }

  replaceBankAtomically(bundle: QuestionBankBundle): void {
    this.staticRepository.replaceBankAtomically(bundle);
  }

  getBankMetadata(): Readonly<QuestionBankMetadata> | null {
    return this.staticRepository.getBankMetadata();
  }
}

export function isMergedQuestionRepository(
  repository: QuestionRepository,
): repository is MergedQuestionRepository {
  return repository instanceof MergedQuestionRepository;
}
