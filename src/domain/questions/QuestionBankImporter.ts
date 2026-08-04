import type { ProgramIndex } from '../program/Program';
import {
  createSafeSnapshot,
  deepFreezeOwned,
} from '../validation/SafeSnapshot';
import type { Question } from './Question';
import {
  validateQuestionBankBundle,
  type QuestionBankBundle,
} from './QuestionBank';

export type QuestionImportStatus =
  | 'accepted'
  | 'rejected'
  | 'updated'
  | 'ignored'
  | 'quarantined';
export interface QuestionImportReportEntry {
  readonly entryIndex: number;
  readonly questionExternalId: string | null;
  readonly questionId: string | null;
  readonly questionVersion: number | null;
  readonly sourceLocator: string | null;
  readonly status: QuestionImportStatus;
  readonly path: string;
  readonly code: string;
  readonly message: string;
}
export interface QuarantinedQuestionEntry {
  readonly entryIndex: number;
  readonly snapshot: string;
  readonly code: string;
}
export interface QuestionImportReport {
  readonly bundleId: string;
  readonly schemaVersion: number;
  readonly importedAt: string;
  readonly totalReceived: number;
  readonly totalAccepted: number;
  readonly totalIgnored: number;
  readonly totalUpdated: number;
  readonly totalQuarantined: number;
  readonly totalRejected: number;
  readonly diagnostics: readonly string[];
  readonly entries: readonly QuestionImportReportEntry[];
}
export type QuestionBankImportResult =
  | Readonly<{
      kind: 'ready';
      bundle: QuestionBankBundle;
      report: QuestionImportReport;
      quarantine: readonly QuarantinedQuestionEntry[];
    }>
  | Readonly<{
      kind: 'rejected';
      report: QuestionImportReport;
      quarantine: readonly QuarantinedQuestionEntry[];
    }>;

const safeText = (value: unknown): string => {
  try {
    return JSON.stringify(value).slice(0, 2_048);
  } catch {
    return '[donnée inaccessible]';
  }
};
const canonical = (value: unknown): string => JSON.stringify(value);

export function importQuestionBankBundle(
  input: unknown,
  currentQuestions: readonly Question[] = [],
  program?: ProgramIndex,
): QuestionBankImportResult {
  const safe = createSafeSnapshot(input);
  const emptyReport = (diagnostic: string): QuestionImportReport => ({
    bundleId: '',
    schemaVersion: 0,
    importedAt: '',
    totalReceived: 0,
    totalAccepted: 0,
    totalIgnored: 0,
    totalUpdated: 0,
    totalQuarantined: 0,
    totalRejected: 1,
    diagnostics: [diagnostic],
    entries: [],
  });
  if (
    !safe.ok ||
    typeof safe.value !== 'object' ||
    safe.value === null ||
    Array.isArray(safe.value)
  )
    return deepFreezeOwned({
      kind: 'rejected',
      report: emptyReport(
        safe.ok ? 'Enveloppe de bundle invalide.' : safe.message,
      ),
      quarantine: [],
    });
  const root = safe.value as Record<string, unknown>;
  if (
    typeof root.bundleId !== 'string' ||
    typeof root.schemaVersion !== 'number' ||
    typeof root.generatedAt !== 'string' ||
    !Array.isArray(root.questions)
  )
    return deepFreezeOwned({
      kind: 'rejected',
      report: emptyReport('Enveloppe de bundle incomplète.'),
      quarantine: [],
    });
  const byId = new Map<string, Question>();
  for (const question of currentQuestions) {
    const current = byId.get(question.id);
    if (!current || question.version > current.version)
      byId.set(question.id, question);
  }
  const entries: QuestionImportReportEntry[] = [];
  const quarantine: QuarantinedQuestionEntry[] = [];
  for (let index = 0; index < root.questions.length; index += 1) {
    const raw: unknown = root.questions[index];
    const singleton = {
      schemaVersion: root.schemaVersion,
      bundleId: root.bundleId,
      generatedAt: root.generatedAt,
      defaultProvenance: root.defaultProvenance ?? null,
      questions: [raw],
    };
    const checked = validateQuestionBankBundle(singleton, program);
    const rawQuestion =
      typeof raw === 'object' && raw !== null && !Array.isArray(raw)
        ? (raw as Record<string, unknown>).question
        : null;
    const id =
      typeof rawQuestion === 'object' &&
      rawQuestion !== null &&
      !Array.isArray(rawQuestion) &&
      typeof (rawQuestion as Record<string, unknown>).id === 'string'
        ? ((rawQuestion as Record<string, unknown>).id as string)
        : null;
    const version =
      typeof rawQuestion === 'object' &&
      rawQuestion !== null &&
      !Array.isArray(rawQuestion) &&
      Number.isInteger((rawQuestion as Record<string, unknown>).version)
        ? ((rawQuestion as Record<string, unknown>).version as number)
        : null;
    if (!checked.ok) {
      quarantine.push({
        entryIndex: index,
        snapshot: safeText(raw),
        code: 'invalid-entry',
      });
      entries.push({
        entryIndex: index,
        questionExternalId: id,
        questionId: null,
        questionVersion: version,
        sourceLocator: null,
        status: 'quarantined',
        path: `questions.${index}`,
        code: 'invalid-entry',
        message:
          checked.issues[0]?.message ?? 'Entrée invalide mise en quarantaine.',
      });
      continue;
    }
    const question = checked.value.questions[0]?.question as Question;
    const current = byId.get(question.id);
    let status: QuestionImportStatus = 'accepted';
    let code = 'question-accepted';
    let message = 'Question importée.';
    if (current) {
      if (question.version < current.version) {
        status = 'rejected';
        code = 'older-version';
        message = 'Une version plus récente est déjà installée.';
      } else if (question.version === current.version) {
        if (canonical(question) === canonical(current)) {
          status = 'ignored';
          code = 'unchanged';
          message = 'Question déjà présente sans changement.';
        } else {
          status = 'quarantined';
          code = 'same-version-conflict';
          message = 'Même version avec un contenu différent.';
          quarantine.push({ entryIndex: index, snapshot: safeText(raw), code });
        }
      } else {
        status = 'updated';
        code = 'newer-version';
        message = 'Question remplacée par une version supérieure.';
      }
    }
    if (status === 'accepted' || status === 'updated' || status === 'ignored') {
      byId.set(
        question.id,
        status === 'ignored' ? (current as Question) : question,
      );
    }
    entries.push({
      entryIndex: index,
      questionExternalId: question.id,
      questionId: question.id,
      questionVersion: question.version,
      sourceLocator: question.provenance?.references[0]?.sourceLocator ?? null,
      status,
      path: `questions.${index}`,
      code,
      message,
    });
  }
  const finalQuestions = [...byId.values()].sort(
    (a, b) => a.id.localeCompare(b.id) || a.version - b.version,
  );
  const bundleCandidate = {
    schemaVersion: root.schemaVersion,
    bundleId: root.bundleId,
    generatedAt: root.generatedAt,
    defaultProvenance: root.defaultProvenance ?? null,
    questions: finalQuestions.map((question) => ({
      question,
      provenance: {
        mode: 'replace',
        references: question.provenance?.references ?? [],
      },
    })),
  };
  const final = validateQuestionBankBundle(bundleCandidate, program);
  if (!final.ok)
    return deepFreezeOwned({
      kind: 'rejected',
      report: emptyReport(final.issues[0]?.message ?? 'État final invalide.'),
      quarantine,
    });
  const count = (status: QuestionImportStatus) =>
    entries.filter((entry) => entry.status === status).length;
  const report: QuestionImportReport = {
    bundleId: root.bundleId,
    schemaVersion: root.schemaVersion,
    importedAt: root.generatedAt,
    totalReceived: root.questions.length,
    totalAccepted: count('accepted'),
    totalIgnored: count('ignored'),
    totalUpdated: count('updated'),
    totalQuarantined: count('quarantined'),
    totalRejected: count('rejected'),
    diagnostics: [],
    entries,
  };
  return deepFreezeOwned({
    kind: 'ready',
    bundle: final.value,
    report,
    quarantine,
  });
}
