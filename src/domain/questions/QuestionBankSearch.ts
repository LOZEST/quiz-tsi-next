import type { ProgramIndex } from '../program/Program';
import {
  questionClassification,
  type Difficulty,
  type Question,
  type QuestionSource,
  type QuestionType,
} from './Question';
import type { Quizz } from './quizz/Quizz';

export type FolderLocation =
  | { kind: 'root' }
  | { kind: 'source'; source: 'static' | 'shared' }
  | { kind: 'quizz'; courseId: string };

export function questionsInFolder(
  questions: readonly Readonly<Question>[],
  location: FolderLocation,
): readonly Readonly<Question>[] {
  if (location.kind === 'root') return [];
  if (location.kind === 'source')
    return questions.filter((question) => question.source === location.source);
  return questions.filter((question) => {
    const classification = questionClassification(question);
    if (!classification || classification.kind !== 'personal') return false;
    return classification.courseId === location.courseId;
  });
}

export interface QuestionBankFilters {
  readonly source?: QuestionSource | undefined;
  readonly classificationKind?: 'official' | 'personal' | undefined;
  readonly courseOrPartId?: string | undefined;
  readonly chapterId?: string | undefined;
  readonly chapter?: string | undefined;
  readonly type?: QuestionType | undefined;
  readonly difficulty?: Difficulty | undefined;
  readonly status?: Question['status'] | undefined;
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/\s+/g, ' ')
    .trim();
const textSegments = (question: Readonly<Question>) =>
  question.prompt.flatMap((segment) =>
    segment.kind === 'text' ? [segment.value] : [],
  );

export function searchAndFilterQuestions(input: {
  questions: readonly Readonly<Question>[];
  search: string;
  filters: QuestionBankFilters;
  program?: ProgramIndex | null;
  quizzes?: readonly Quizz[];
}): readonly Readonly<Question>[] {
  const needle = normalize(input.search);
  return [...input.questions]
    .filter((question) => {
      const classification = questionClassification(question);
      if (!classification) return false;
      const { filters } = input;
      if (filters.source && question.source !== filters.source) return false;
      if (
        filters.classificationKind &&
        classification.kind !== filters.classificationKind
      )
        return false;
      if (filters.type && question.type !== filters.type) return false;
      if (filters.difficulty && question.difficulty !== filters.difficulty)
        return false;
      if (filters.status && question.status !== filters.status) return false;
      if (
        filters.courseOrPartId &&
        (classification.kind === 'official'
          ? classification.partId
          : classification.courseId) !== filters.courseOrPartId
      )
        return false;
      if (
        filters.chapterId &&
        (classification.kind !== 'official' ||
          classification.chapterId !== filters.chapterId)
      )
        return false;
      if (
        filters.chapter &&
        (classification.kind !== 'personal' ||
          classification.chapter !== filters.chapter)
      )
        return false;
      if (!needle) return true;
      const labels =
        classification.kind === 'official'
          ? [
              input.program?.getPart(classification.partId)?.label,
              input.program?.getChapter(classification.chapterId)?.label,
              input.program?.getNotion(classification.notionId)?.label,
            ]
          : [
              input.quizzes?.find((item) => item.id === classification.courseId)
                ?.title,
              classification.chapter,
            ];
      return [
        ...textSegments(question),
        ...question.tags,
        question.type,
        ...labels,
      ]
        .filter((value): value is string => typeof value === 'string')
        .some((value) => normalize(value).includes(needle));
    })
    .sort(
      (left, right) =>
        left.id.localeCompare(right.id) || right.version - left.version,
    );
}
