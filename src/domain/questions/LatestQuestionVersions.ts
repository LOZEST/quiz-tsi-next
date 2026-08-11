import type { Question } from './Question';

/** Returns one current question per id without mutating the supplied history. */
export function latestQuestionVersions(
  questions: readonly Readonly<Question>[],
): readonly Readonly<Question>[] {
  const latestById = new Map<string, Readonly<Question>>();
  for (const question of questions) {
    const current = latestById.get(question.id);
    if (!current || question.version > current.version) {
      latestById.set(question.id, question);
    }
  }
  return [...latestById.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}
