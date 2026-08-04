import { deepFreezeOwned } from '../validation/SafeSnapshot';
import {
  DIFFICULTIES,
  QUESTION_SOURCES,
  QUESTION_TYPES,
  type Difficulty,
  type Question,
  type QuestionSource,
  type QuestionType,
} from './Question';

export type QuestionDifficultyFilter = Difficulty | 'all' | 'not-applicable';
export interface QuestionIndexFilter {
  readonly partId?: string;
  readonly chapterId?: string;
  readonly notionId?: string;
  readonly type?: QuestionType;
  readonly difficulty?: QuestionDifficultyFilter;
  readonly source?: QuestionSource;
  readonly status?: Question['status'];
}
export type QuestionIndexQueryResult =
  | Readonly<{ ok: true; questions: readonly Readonly<Question>[] }>
  | Readonly<{ ok: false; code: 'invalid-filter'; message: string }>;

export class QuestionBankIndex {
  readonly #questions: readonly Readonly<Question>[];
  constructor(questions: readonly Question[]) {
    const latest = new Map<string, Question>();
    for (const question of questions) {
      const key = `${question.id}\u0000${question.version}`;
      if (!latest.has(key)) latest.set(key, question);
    }
    this.#questions = deepFreezeOwned(
      [...latest.values()].sort(
        (a, b) => a.id.localeCompare(b.id) || b.version - a.version,
      ),
    );
  }
  query(value: unknown): QuestionIndexQueryResult {
    try {
      if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new Error();
      const filter = value as QuestionIndexFilter;
      if (filter.type !== undefined && !QUESTION_TYPES.includes(filter.type))
        throw new Error();
      if (
        filter.source !== undefined &&
        !QUESTION_SOURCES.includes(filter.source)
      )
        throw new Error();
      if (
        filter.status !== undefined &&
        !['draft', 'published', 'archived'].includes(filter.status)
      )
        throw new Error();
      if (
        filter.difficulty !== undefined &&
        !['all', 'not-applicable', ...DIFFICULTIES].includes(filter.difficulty)
      )
        throw new Error();
      const questions = this.#questions.filter(
        (question) =>
          (filter.partId === undefined || question.partId === filter.partId) &&
          (filter.chapterId === undefined ||
            question.chapterId === filter.chapterId) &&
          (filter.notionId === undefined ||
            question.notionId === filter.notionId) &&
          (filter.type === undefined || question.type === filter.type) &&
          (filter.source === undefined || question.source === filter.source) &&
          (filter.status === undefined || question.status === filter.status) &&
          (filter.difficulty === undefined ||
            filter.difficulty === 'all' ||
            (filter.difficulty === 'not-applicable'
              ? question.type === 'reflex'
              : question.difficulty === filter.difficulty)),
      );
      return deepFreezeOwned({ ok: true, questions: [...questions] });
    } catch {
      return {
        ok: false,
        code: 'invalid-filter',
        message: 'Le filtre de questions est invalide.',
      };
    }
  }
}
