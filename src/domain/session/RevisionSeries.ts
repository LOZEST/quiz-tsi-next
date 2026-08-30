import {
  createQuestionInstance,
  type FrozenQuestionInstance,
  type Question,
} from '../questions/Question';
import type { QuestionEvaluation } from '../evaluation/QuestionEvaluation';
import type { QuestionRepository } from '../repositories/QuestionRepository';
import { QuestionBankIndex } from '../questions/QuestionBankIndex';
import {
  prepareQuestion,
  type PreparedQuestion,
} from '../questions/PreparedQuestion';
import {
  selectFreeRevisionQuestions,
  toIndexFilter,
} from '../questions/QuestionSelection';
import { createSeededRandom } from '../questions/SeededRandom';
import type { FreeRevisionFilters } from './Session';
import { deepFreezeOwned } from '../validation/SafeSnapshot';

export type RevisionSeriesKind = 'daily' | 'weak-points';

export interface RevisionSeriesBlueprint {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly kind: RevisionSeriesKind;
  readonly unitLabel: string;
  readonly seed: string;
  readonly orderedQuestionInstances: readonly FrozenQuestionInstance[];
  readonly createdAt: string;
}

export interface RevisionSeriesSession {
  readonly blueprint: RevisionSeriesBlueprint;
  readonly currentIndex: number;
  readonly status: 'active' | 'finished';
}

function contentHash(prepared: PreparedQuestion): string {
  return `${prepared.questionId}:${prepared.questionVersion}:${prepared.seed}`;
}

function toOrderedInstances(
  items: readonly PreparedQuestion[],
  repository: QuestionRepository,
  sessionId: string,
  createdAt: string,
): readonly FrozenQuestionInstance[] | null {
  const instances: FrozenQuestionInstance[] = [];
  for (const [index, prepared] of items.entries()) {
    const question = repository.getByIdAndVersion(
      prepared.questionId,
      prepared.questionVersion,
    );
    if (!question) return null;
    const instance = createQuestionInstance({
      id: `${sessionId}:question:${index + 1}`,
      questionId: question.id,
      questionVersion: question.version,
      sessionId,
      ordinal: index,
      frozenQuestion: question,
      parameterValues: prepared.parameterValues,
      seed: prepared.seed,
      createdAt,
    });
    if (!instance.ok) return null;
    instances.push({ ...instance.value, contentHash: contentHash(prepared) });
  }
  return instances;
}

function queryPool(
  repository: QuestionRepository,
  filters: FreeRevisionFilters,
): readonly Question[] {
  const latest = new Map<string, Question>();
  for (const question of repository.listPublished()) {
    const current = latest.get(question.id);
    if (!current || question.version > current.version)
      latest.set(question.id, question);
  }
  const query = new QuestionBankIndex([...latest.values()]).query(
    toIndexFilter(filters),
  );
  return query.ok ? query.questions : [];
}

/**
 * A bounded, playable draw scoped to a single notion/quizz — used for
 * "Révision du jour" (spaced-repetition recall, any question in the unit)
 * and as the fallback for "Consolidation" when no individually-failed
 * question exists yet in that unit.
 */
export function createBoundedRevisionBlueprint(input: {
  id: string;
  userId: string;
  sessionId: string;
  kind: RevisionSeriesKind;
  unitLabel: string;
  filters: FreeRevisionFilters;
  questionCount: number;
  seed: string;
  createdAt: string;
  repository: QuestionRepository;
  questionWeights?: ReadonlyMap<string, number>;
}): RevisionSeriesBlueprint | null {
  const available = queryPool(input.repository, input.filters).length;
  if (available === 0 || input.questionCount < 1) return null;
  const selected = selectFreeRevisionQuestions(
    input.repository,
    input.filters,
    input.seed,
    Math.min(input.questionCount, available),
    [],
    input.questionWeights,
  );
  if (selected.kind !== 'ready') return null;
  const orderedQuestionInstances = toOrderedInstances(
    selected.items,
    input.repository,
    input.sessionId,
    input.createdAt,
  );
  if (!orderedQuestionInstances) return null;
  return deepFreezeOwned({
    id: input.id,
    userId: input.userId,
    sessionId: input.sessionId,
    kind: input.kind,
    unitLabel: input.unitLabel,
    seed: input.seed,
    orderedQuestionInstances,
    createdAt: input.createdAt,
  });
}

/**
 * Restricts a unit's question pool to only the questions that still need
 * consolidating: their most recent non-skipped evaluation (across all
 * modes) was 'failed' or 'partial'. A never-attempted question isn't
 * "raté ou à consolider" — it's simply new — so it's excluded, and so is
 * a question whose most recent attempt succeeded.
 */
export function selectConsolidationCandidates(
  pool: readonly Question[],
  evaluations: readonly QuestionEvaluation[],
): readonly Question[] {
  const latestByQuestion = new Map<string, QuestionEvaluation>();
  for (const evaluation of evaluations) {
    if (evaluation.outcome === 'skipped') continue;
    if (!Number.isFinite(Date.parse(evaluation.completedAt))) continue;
    const current = latestByQuestion.get(evaluation.questionId);
    if (
      !current ||
      Date.parse(evaluation.completedAt) > Date.parse(current.completedAt)
    )
      latestByQuestion.set(evaluation.questionId, evaluation);
  }
  return pool.filter((question) => {
    const latest = latestByQuestion.get(question.id);
    return latest !== undefined && latest.outcome !== 'success';
  });
}

export function createConsolidationBlueprint(input: {
  id: string;
  userId: string;
  sessionId: string;
  unitLabel: string;
  filters: FreeRevisionFilters;
  evaluations: readonly QuestionEvaluation[];
  maxCount: number;
  seed: string;
  createdAt: string;
  repository: QuestionRepository;
  questionWeights?: ReadonlyMap<string, number>;
}): RevisionSeriesBlueprint | null {
  const pool = queryPool(input.repository, input.filters);
  if (pool.length === 0) return null;
  const candidates = selectConsolidationCandidates(pool, input.evaluations);
  if (candidates.length === 0) {
    // Ranked as a weak point overall (low mastery/confidence) but no single
    // question in the unit is individually marked failed/partial yet — fall
    // back to the unit's full pool so the bubble is never a dead click.
    return createBoundedRevisionBlueprint({
      id: input.id,
      userId: input.userId,
      sessionId: input.sessionId,
      kind: 'weak-points',
      unitLabel: input.unitLabel,
      filters: input.filters,
      questionCount: Math.min(pool.length, Math.max(1, input.maxCount)),
      seed: input.seed,
      createdAt: input.createdAt,
      repository: input.repository,
      ...(input.questionWeights
        ? { questionWeights: input.questionWeights }
        : {}),
    });
  }
  const random = createSeededRandom(input.seed);
  if (!random) return null;
  const ordered = [...candidates]
    .sort((a, b) => a.id.localeCompare(b.id) || b.version - a.version)
    .map((question) => ({ question, key: random.next() }))
    .sort((a, b) => b.key - a.key)
    .slice(0, Math.max(1, input.maxCount))
    .map((entry) => entry.question);
  const prepared: PreparedQuestion[] = [];
  for (const [index, question] of ordered.entries()) {
    const result = prepareQuestion(question, input.seed, index);
    if (result.kind !== 'ready') return null;
    prepared.push(result.value);
  }
  const orderedQuestionInstances = toOrderedInstances(
    prepared,
    input.repository,
    input.sessionId,
    input.createdAt,
  );
  if (!orderedQuestionInstances) return null;
  return deepFreezeOwned({
    id: input.id,
    userId: input.userId,
    sessionId: input.sessionId,
    kind: 'weak-points' as const,
    unitLabel: input.unitLabel,
    seed: input.seed,
    orderedQuestionInstances,
    createdAt: input.createdAt,
  });
}

export function advanceRevisionSeries(
  session: RevisionSeriesSession,
  index: number,
): RevisionSeriesSession {
  if (
    session.status !== 'active' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= session.blueprint.orderedQuestionInstances.length
  )
    return session;
  return deepFreezeOwned({ ...session, currentIndex: index });
}

export function finishRevisionSeries(
  session: RevisionSeriesSession,
): RevisionSeriesSession {
  if (session.status !== 'active') return session;
  return deepFreezeOwned({ ...session, status: 'finished' as const });
}
