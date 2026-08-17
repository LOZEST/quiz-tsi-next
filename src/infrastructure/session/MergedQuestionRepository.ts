import type {
  QuestionBankMetadata,
  QuestionRepository,
  QuestionRepositoryQuery,
} from '@domain/repositories/QuestionRepository';
import type { QuestionBankBundle } from '@domain/questions/QuestionBank';
import {
  questionClassification,
  type Question,
} from '@domain/questions/Question';

function matchesQuery(
  item: Readonly<Question>,
  query: QuestionRepositoryQuery,
): boolean {
  const classification = questionClassification(item);
  const chapterMatches =
    query.chapterId === undefined ||
    (classification?.kind === 'official'
      ? classification.chapterId === query.chapterId
      : classification?.kind === 'personal' &&
        classification.courseId === query.chapterId);
  return (
    (query.partId === undefined ||
      (classification?.kind === 'official' &&
        classification.partId === query.partId)) &&
    chapterMatches &&
    (query.notionId === undefined ||
      classification?.notionId === query.notionId) &&
    (query.source === undefined || item.source === query.source)
  );
}

/**
 * Wraps the shared static/official repository and layers in the current
 * user's own quizz questions, so revision selection can draw from both
 * pools. A quizz is flat (Phase 7): its questions carry `courseId` with
 * `chapterId`/`notionId` null, so a "chapterId" query is matched against
 * `courseId` for personal questions — a quizz fills the chapter slot.
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
