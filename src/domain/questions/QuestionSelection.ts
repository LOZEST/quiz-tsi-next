import type { QuestionRepository } from '../repositories/QuestionRepository';
import type { FreeRevisionFilters } from '../session/Session';
import { validateFreeRevisionFilters } from '../session/Session';
import { deepFreezeOwned } from '../validation/SafeSnapshot';
import type { Question } from './Question';
import {
  QuestionBankIndex,
  type QuestionIndexFilter,
} from './QuestionBankIndex';
import { prepareQuestion, type PreparedQuestion } from './PreparedQuestion';
import { RECURRENCE_POLICY } from './QuestionRecurrence';
import { createSeededRandom } from './SeededRandom';

export const MAX_QUESTION_SELECTION_COUNT = 1_000;
export const NO_VALIDATED_BANK_MESSAGE =
  'Aucune banque de questions validée n’est disponible pour le moment.';
export type QuestionSelectionResult =
  | Readonly<{ kind: 'ready'; items: readonly PreparedQuestion[] }>
  | Readonly<{
      kind:
        | 'invalid-config'
        | 'no-bank'
        | 'no-match'
        | 'insufficient-stock'
        | 'repository-error'
        | 'question-preparation-error';
      code: string;
      message: string;
      available?: number;
    }>;

function toIndexFilter(filters: FreeRevisionFilters): QuestionIndexFilter {
  return {
    ...(filters.part.kind === 'one' ? { partId: filters.part.value } : {}),
    ...(filters.chapter.kind === 'one'
      ? { chapterId: filters.chapter.value }
      : {}),
    ...(filters.notion.kind === 'one'
      ? { notionId: filters.notion.value }
      : {}),
    ...(filters.questionType.kind === 'one'
      ? { type: filters.questionType.value }
      : {}),
    difficulty:
      filters.difficulty.kind === 'one'
        ? filters.difficulty.value
        : filters.difficulty.kind,
    status: 'published',
  };
}

export function selectFreeRevisionQuestions(
  repository: QuestionRepository,
  filtersValue: unknown,
  seed: unknown,
  quantity: unknown,
  excludedIds: readonly string[] = [],
  questionWeights: ReadonlyMap<string, number> = new Map(),
): QuestionSelectionResult {
  if (
    typeof seed !== 'string' ||
    seed.length === 0 ||
    !Number.isInteger(quantity) ||
    (quantity as number) < 1 ||
    (quantity as number) > MAX_QUESTION_SELECTION_COUNT
  )
    return {
      kind: 'invalid-config',
      code: 'invalid-selection-config',
      message: 'Configuration de sélection invalide.',
    };
  const filters = validateFreeRevisionFilters(filtersValue);
  if (!filters.ok)
    return {
      kind: 'invalid-config',
      code: 'invalid-free-filters',
      message: filters.issues[0]?.message ?? 'Filtres invalides.',
    };
  try {
    if (!repository.getBankMetadata())
      return {
        kind: 'no-bank',
        code: 'no-validated-bank',
        message: NO_VALIDATED_BANK_MESSAGE,
      };
    const latest = new Map<string, Question>();
    for (const question of repository.listPublished()) {
      const current = latest.get(question.id);
      if (!current || question.version > current.version)
        latest.set(question.id, question);
    }
    const query = new QuestionBankIndex([...latest.values()]).query(
      toIndexFilter(filters.value),
    );
    if (!query.ok)
      return {
        kind: 'invalid-config',
        code: query.code,
        message: query.message,
      };
    const excluded = new Set(excludedIds);
    const stock = query.questions.filter(
      (question) => !excluded.has(question.id),
    );
    if (stock.length === 0)
      return {
        kind: 'no-match',
        code: 'no-matching-question',
        message:
          'Aucune question ne correspond à ces filtres. Modifie un critère ou sélectionne « Tout » pour élargir la recherche.',
      };
    if (stock.length < (quantity as number))
      return {
        kind: 'insufficient-stock',
        code: 'insufficient-stock',
        message: 'Le stock de questions compatibles est insuffisant.',
        available: stock.length,
      };
    const random = createSeededRandom(seed);
    if (!random)
      return {
        kind: 'invalid-config',
        code: 'invalid-seed',
        message: 'Seed invalide.',
      };
    const ordered = [...stock].sort(
      (a, b) => a.id.localeCompare(b.id) || b.version - a.version,
    );
    const keyed = ordered.map((question) => {
      const weight = questionWeights.get(question.id);
      const safeWeight =
        weight !== undefined && Number.isFinite(weight) && weight > 0
          ? weight
          : RECURRENCE_POLICY.baselineWeight;
      return { question, key: random.next() ** (1 / safeWeight) };
    });
    keyed.sort((a, b) => b.key - a.key);
    const ranked = keyed.map((entry) => entry.question);
    const items: PreparedQuestion[] = [];
    for (let index = 0; index < (quantity as number); index += 1) {
      const prepared = prepareQuestion(ranked[index] as Question, seed, index);
      if (prepared.kind !== 'ready')
        return {
          kind: 'question-preparation-error',
          code: prepared.code,
          message: prepared.message,
        };
      items.push(prepared.value);
    }
    return deepFreezeOwned({ kind: 'ready', items });
  } catch {
    return {
      kind: 'repository-error',
      code: 'repository-inaccessible',
      message: 'La banque de questions est inaccessible.',
    };
  }
}
