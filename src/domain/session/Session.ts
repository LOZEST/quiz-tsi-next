import {
  DIFFICULTIES,
  QUESTION_TYPES,
  type Difficulty,
  type QuestionInstance,
  type QuestionType,
} from '../questions/Question';
import {
  invalid,
  issue,
  valid,
  type ValidationResult,
} from '../validation/ValidationResult';

export const SESSION_MODES = [
  'daily',
  'weak-points',
  'free',
  'chapter-test',
] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export type FilterSelection<T> =
  | Readonly<{ kind: 'all' }>
  | Readonly<{ kind: 'one'; value: T }>;

export type DifficultyFilterSelection =
  | Readonly<{ kind: 'all' }>
  | Readonly<{ kind: 'one'; value: Difficulty }>
  | Readonly<{ kind: 'not-applicable' }>;

export interface FreeRevisionFilters {
  readonly part: FilterSelection<string>;
  readonly chapter: FilterSelection<string>;
  readonly notion: FilterSelection<string>;
  readonly questionType: FilterSelection<QuestionType>;
  readonly difficulty: DifficultyFilterSelection;
}

export type SessionConfig =
  | Readonly<{ mode: 'daily' }>
  | Readonly<{ mode: 'weak-points' }>
  | Readonly<{ mode: 'free'; filters: FreeRevisionFilters }>
  | Readonly<{
      mode: 'chapter-test';
      chapterId: string;
      questionCount: 20 | 40;
    }>;

export interface DailyPlanItem {
  readonly notionId: string;
  readonly plannedCount: number;
  readonly successCount: number;
  readonly partialCount: number;
  readonly failedCount: number;
  readonly reason: string;
  readonly recommendedDifficulty: Difficulty;
  readonly dueAt: string | null;
}

export type DailyPlanState =
  | Readonly<{ kind: 'ready'; items: readonly DailyPlanItem[] }>
  | Readonly<{ kind: 'none-scheduled' }>
  | Readonly<{ kind: 'completed'; items: readonly DailyPlanItem[] }>
  | Readonly<{ kind: 'unavailable'; message: string }>;

export interface WeakPointItem {
  readonly notionId: string;
  readonly priority: number;
  readonly recommendedDifficulty: Difficulty;
  readonly rationale: string;
  readonly masteryEstimate: number | null;
  readonly lastActivityAt: string | null;
  readonly successCount: number;
  readonly partialCount: number;
  readonly failedCount: number;
  readonly recurringErrors: readonly string[];
}

export interface CalibrationEvidence {
  readonly observedEvidence: number;
  readonly requiredEvidence: number;
  readonly coveredNotions: number | null;
  readonly requiredCoveredNotions: number | null;
}

export type WeakPointsState =
  | Readonly<{ kind: 'ready'; items: readonly WeakPointItem[] }>
  | Readonly<{
      kind: 'calibrating';
      evidence: CalibrationEvidence | null;
      message: string;
    }>
  | Readonly<{ kind: 'unavailable'; message: string }>;

export type ChapterTestPreparation =
  | Readonly<{
      kind: 'available';
      chapterId: string;
      questionCount: 20 | 40;
      compatibleQuestionCount: number;
    }>
  | Readonly<{
      kind: 'insufficient-stock';
      chapterId: string;
      questionCount: 20 | 40;
      compatibleQuestionCount: number;
    }>
  | Readonly<{ kind: 'unavailable'; message: string }>;

export type QuestionSelectionState =
  | Readonly<{ kind: 'ready'; instance: QuestionInstance }>
  | Readonly<{
      kind: 'empty';
      reason: 'no-matching-question' | 'no-validated-bank';
      message: string;
    }>
  | Readonly<{ kind: 'unavailable'; message: string }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSelection(value: unknown): value is FilterSelection<string> {
  return (
    isRecord(value) &&
    (value.kind === 'all' ||
      (value.kind === 'one' &&
        typeof value.value === 'string' &&
        value.value.length > 0))
  );
}

export function validateFreeRevisionFilters(
  value: unknown,
): ValidationResult<FreeRevisionFilters> {
  if (
    !isRecord(value) ||
    !isSelection(value.part) ||
    !isSelection(value.chapter) ||
    !isSelection(value.notion) ||
    !isRecord(value.questionType) ||
    !isRecord(value.difficulty)
  ) {
    return invalid(issue('filters', 'Structure de filtres invalide.'));
  }
  const questionType =
    value.questionType.kind === 'all'
      ? null
      : value.questionType.kind === 'one' &&
          QUESTION_TYPES.includes(value.questionType.value as QuestionType)
        ? (value.questionType.value as QuestionType)
        : undefined;
  if (questionType === undefined) {
    return invalid(issue('filters.questionType', 'Type de question invalide.'));
  }
  const difficultyValid =
    value.difficulty.kind === 'all' ||
    value.difficulty.kind === 'not-applicable' ||
    (value.difficulty.kind === 'one' &&
      DIFFICULTIES.includes(value.difficulty.value as Difficulty));
  if (!difficultyValid) {
    return invalid(
      issue('filters.difficulty', 'Difficulté de filtre invalide.'),
    );
  }
  if (
    (questionType === 'reflex') !==
    (value.difficulty.kind === 'not-applicable')
  ) {
    return invalid(
      issue(
        'filters.difficulty',
        'Réflexe exige not-applicable, interdit pour les autres types.',
      ),
    );
  }
  return valid(value as unknown as FreeRevisionFilters);
}

export function validateCalibrationEvidence(
  value: unknown,
): ValidationResult<CalibrationEvidence> {
  if (!isRecord(value)) {
    return invalid(issue('evidence', 'Preuves de calibration invalides.'));
  }
  const counts = [
    value.observedEvidence,
    value.requiredEvidence,
    value.coveredNotions,
    value.requiredCoveredNotions,
  ];
  if (
    counts.some(
      (count) =>
        count !== null && (!Number.isInteger(count) || (count as number) < 0),
    ) ||
    !Number.isInteger(value.requiredEvidence) ||
    (value.requiredEvidence as number) <= 0 ||
    value.observedEvidence === null ||
    (value.coveredNotions === null) !==
      (value.requiredCoveredNotions === null) ||
    (typeof value.coveredNotions === 'number' &&
      typeof value.requiredCoveredNotions === 'number' &&
      value.requiredCoveredNotions <= 0)
  ) {
    return invalid(issue('evidence', 'Comptages de calibration incohérents.'));
  }
  return valid(value as unknown as CalibrationEvidence);
}

export function validateChapterTestPreparation(
  value: unknown,
): ValidationResult<ChapterTestPreparation> {
  if (!isRecord(value)) {
    return invalid(issue('chapterTest', 'Configuration de test invalide.'));
  }
  if (
    value.kind === 'unavailable' &&
    typeof value.message === 'string' &&
    value.message.trim() &&
    Object.keys(value).every((key) => ['kind', 'message'].includes(key))
  ) {
    return valid(value as unknown as ChapterTestPreparation);
  }
  if (
    (value.kind !== 'available' && value.kind !== 'insufficient-stock') ||
    typeof value.chapterId !== 'string' ||
    !value.chapterId ||
    (value.questionCount !== 20 && value.questionCount !== 40) ||
    !Number.isInteger(value.compatibleQuestionCount) ||
    (value.compatibleQuestionCount as number) < 0 ||
    !Object.keys(value).every((key) =>
      [
        'kind',
        'chapterId',
        'questionCount',
        'compatibleQuestionCount',
      ].includes(key),
    )
  ) {
    return invalid(issue('chapterTest', 'Configuration de test invalide.'));
  }
  const sufficient =
    (value.compatibleQuestionCount as number) >= value.questionCount;
  if ((value.kind === 'available') !== sufficient) {
    return invalid(issue('chapterTest.kind', 'État de stock incohérent.'));
  }
  return valid(value as unknown as ChapterTestPreparation);
}
