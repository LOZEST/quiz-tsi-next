import {
  createSafeSnapshot,
  deepFreezeOwned,
} from '../validation/SafeSnapshot';
import {
  DIFFICULTIES,
  questionClassification,
  QUESTION_SOURCES,
  QUESTION_TYPES,
  type Difficulty,
  type Question,
  type QuestionSource,
  type QuestionType,
  validateQuestion,
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
    for (const source of questions) {
      const snapshot = createSafeSnapshot(source);
      if (!snapshot.ok)
        throw new TypeError('Une question de l’index est inaccessible.');
      const validated = validateQuestion(snapshot.value);
      if (!validated.ok)
        throw new TypeError('Une question de l’index est invalide.');
      const question = validated.value;
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
      const snapshot = createSafeSnapshot(value);
      if (!snapshot.ok) throw new Error();
      const filter = snapshot.value;
      if (
        typeof filter !== 'object' ||
        filter === null ||
        Array.isArray(filter)
      )
        throw new Error();
      const record = filter as Record<string, unknown>;
      const allowed = new Set([
        'partId',
        'chapterId',
        'notionId',
        'type',
        'difficulty',
        'source',
        'status',
      ]);
      if (Object.keys(record).some((key) => !allowed.has(key)))
        throw new Error();
      for (const key of ['partId', 'chapterId', 'notionId'] as const) {
        if (
          record[key] !== undefined &&
          (typeof record[key] !== 'string' || record[key].length === 0)
        )
          throw new Error();
      }
      const typed = record as QuestionIndexFilter;
      if (typed.type !== undefined && !QUESTION_TYPES.includes(typed.type))
        throw new Error();
      if (
        typed.source !== undefined &&
        !QUESTION_SOURCES.includes(typed.source)
      )
        throw new Error();
      if (
        typed.status !== undefined &&
        !['draft', 'published', 'archived'].includes(typed.status)
      )
        throw new Error();
      if (
        typed.difficulty !== undefined &&
        !['all', 'not-applicable', ...DIFFICULTIES].includes(typed.difficulty)
      )
        throw new Error();
      const questions = this.#questions.filter((question) => {
        const classification = questionClassification(question);
        return (
          (typed.partId === undefined ||
            (classification?.kind === 'official' &&
              classification.partId === typed.partId)) &&
          (typed.chapterId === undefined ||
            classification?.chapterId === typed.chapterId) &&
          (typed.notionId === undefined ||
            classification?.notionId === typed.notionId) &&
          (typed.type === undefined || question.type === typed.type) &&
          (typed.source === undefined || question.source === typed.source) &&
          (typed.status === undefined || question.status === typed.status) &&
          (typed.difficulty === undefined ||
            typed.difficulty === 'all' ||
            (typed.difficulty === 'not-applicable'
              ? question.type === 'reflex'
              : question.difficulty === typed.difficulty))
        );
      });
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
