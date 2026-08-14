export const questionReportReasons = [
  'math_rendering',
  'question_incorrect',
  'correction_incomplete',
  'hint_unclear',
  'other',
] as const;

export type QuestionReportReason = (typeof questionReportReasons)[number];

export const questionReportReasonLabels: Record<QuestionReportReason, string> =
  {
    math_rendering: 'Rendu mathématique cassé',
    question_incorrect: 'Question fausse ou incohérente',
    correction_incomplete: 'Correction incomplète',
    hint_unclear: 'Indice pas assez clair',
    other: 'Autre',
  };

export function isQuestionReportReason(
  value: unknown,
): value is QuestionReportReason {
  return (
    typeof value === 'string' &&
    (questionReportReasons as readonly string[]).includes(value)
  );
}

export const questionReportStatuses = [
  'open',
  'in_progress',
  'resolved',
  'dismissed',
] as const;

export type QuestionReportStatus = (typeof questionReportStatuses)[number];

export const questionReportStatusLabels: Record<QuestionReportStatus, string> =
  {
    open: 'À traiter',
    in_progress: 'En cours',
    resolved: 'Résolu',
    dismissed: 'Rejeté',
  };

export function isQuestionReportStatus(
  value: unknown,
): value is QuestionReportStatus {
  return (
    typeof value === 'string' &&
    (questionReportStatuses as readonly string[]).includes(value)
  );
}

export interface QuestionReport {
  readonly id: string;
  readonly questionId: string;
  readonly questionVersion: number;
  readonly reporterId: string;
  readonly reporterEmail: string;
  readonly reason: QuestionReportReason;
  readonly comment: string | null;
  readonly status: QuestionReportStatus;
  readonly createdAt: string;
}
