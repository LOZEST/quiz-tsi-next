import type { ProgramIndex } from '../program/Program';
import {
  MAX_SAFE_SNAPSHOT_ARRAY_LENGTH,
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

type EnvelopeEntry =
  | Readonly<{ readable: true; value: unknown }>
  | Readonly<{ readable: false }>;
type ImportEnvelope = Readonly<{
  schemaVersion: unknown;
  bundleId: unknown;
  generatedAt: unknown;
  defaultProvenance: unknown;
  entries: readonly EnvelopeEntry[];
}>;

function readImportEnvelope(input: unknown): ImportEnvelope | null {
  try {
    if (typeof input !== 'object' || input === null || Array.isArray(input))
      return null;
    const prototype: unknown = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    if (Object.getOwnPropertySymbols(input).length > 0) return null;
    const root = input;
    const allowed = new Set([
      'schemaVersion',
      'bundleId',
      'generatedAt',
      'defaultProvenance',
      'questions',
    ]);
    if (Object.keys(root).some((key) => !allowed.has(key))) return null;
    const read = (key: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (!descriptor || !('value' in descriptor)) throw new Error();
      return descriptor.value;
    };
    const questions = read('questions');
    if (
      !Array.isArray(questions) ||
      Object.getPrototypeOf(questions) !== Array.prototype
    )
      return null;
    if (Object.getOwnPropertySymbols(questions).length > 0) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(
      questions,
      'length',
    );
    if (!lengthDescriptor || !('value' in lengthDescriptor)) return null;
    const length: unknown = lengthDescriptor.value;
    if (
      typeof length !== 'number' ||
      !Number.isInteger(length) ||
      length < 0 ||
      length > MAX_SAFE_SNAPSHOT_ARRAY_LENGTH
    )
      return null;
    const names = Object.getOwnPropertyNames(questions);
    if (names.length !== length + 1) return null;
    const entries: EnvelopeEntry[] = [];
    for (let index = 0; index < length; index += 1) {
      if (names[index] !== String(index)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(
        questions,
        String(index),
      );
      entries.push(
        descriptor && 'value' in descriptor
          ? { readable: true, value: descriptor.value }
          : { readable: false },
      );
    }
    return {
      schemaVersion: read('schemaVersion'),
      bundleId: read('bundleId'),
      generatedAt: read('generatedAt'),
      defaultProvenance: read('defaultProvenance'),
      entries,
    };
  } catch {
    return null;
  }
}

export function importQuestionBankBundle(
  input: unknown,
  currentQuestions: readonly Question[] = [],
  program?: ProgramIndex,
): QuestionBankImportResult {
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
  const envelope = readImportEnvelope(input);
  if (!envelope)
    return deepFreezeOwned({
      kind: 'rejected',
      report: emptyReport('Enveloppe de bundle invalide ou inaccessible.'),
      quarantine: [],
    });
  const header = validateQuestionBankBundle(
    {
      schemaVersion: envelope.schemaVersion,
      bundleId: envelope.bundleId,
      generatedAt: envelope.generatedAt,
      defaultProvenance: envelope.defaultProvenance,
      questions: [],
    },
    program,
  );
  if (!header.ok)
    return deepFreezeOwned({
      kind: 'rejected',
      report: emptyReport(
        header.issues[0]?.message ?? 'Enveloppe de bundle incomplète.',
      ),
      quarantine: [],
    });
  const root = header.value;
  const snapshots: Array<
    Readonly<{
      readable: boolean;
      value: unknown;
      id: string | null;
      version: number | null;
    }>
  > = [];
  const duplicatePaths: string[] = [];
  const firstById = new Map<string, number>();
  const firstByPair = new Map<string, number>();
  for (let index = 0; index < envelope.entries.length; index += 1) {
    const envelopeEntry = envelope.entries[index] as EnvelopeEntry;
    const snapshot = envelopeEntry.readable
      ? createSafeSnapshot(envelopeEntry.value)
      : { ok: false as const };
    if (!snapshot.ok) {
      snapshots.push({ readable: false, value: null, id: null, version: null });
      continue;
    }
    const value = snapshot.value;
    const entryRecord =
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    const rawQuestion = entryRecord?.question;
    const questionRecord =
      typeof rawQuestion === 'object' &&
      rawQuestion !== null &&
      !Array.isArray(rawQuestion)
        ? (rawQuestion as Record<string, unknown>)
        : null;
    const id =
      typeof questionRecord?.id === 'string' ? questionRecord.id : null;
    const version = Number.isInteger(questionRecord?.version)
      ? (questionRecord?.version as number)
      : null;
    snapshots.push({ readable: true, value, id, version });
    if (id !== null) {
      const firstId = firstById.get(id);
      if (firstId !== undefined)
        duplicatePaths.push(
          `questions.${firstId}.question.id et questions.${index}.question.id`,
        );
      else firstById.set(id, index);
      if (version !== null) {
        const pair = `${id}\u0000${version}`;
        const firstPair = firstByPair.get(pair);
        if (firstPair !== undefined)
          duplicatePaths.push(
            `questions.${firstPair}.question.version et questions.${index}.question.version`,
          );
        else firstByPair.set(pair, index);
      }
    }
  }
  if (duplicatePaths.length > 0) {
    const entries: QuestionImportReportEntry[] = snapshots.map(
      (snapshot, index) => ({
        entryIndex: index,
        questionExternalId: snapshot.id,
        questionId: null,
        questionVersion: snapshot.version,
        sourceLocator: null,
        status: snapshot.readable ? 'rejected' : 'quarantined',
        path: `questions.${index}`,
        code: snapshot.readable ? 'ambiguous-bundle' : 'hostile-entry',
        message: snapshot.readable
          ? 'Le bundle contient un identifiant de question dupliqué.'
          : 'Entrée inaccessible mise en quarantaine.',
      }),
    );
    const quarantine = snapshots.flatMap((snapshot, index) =>
      snapshot.readable
        ? []
        : [
            {
              entryIndex: index,
              snapshot: '[donnée inaccessible]',
              code: 'hostile-entry',
            },
          ],
    );
    return deepFreezeOwned({
      kind: 'rejected',
      report: {
        bundleId: root.bundleId,
        schemaVersion: root.schemaVersion,
        importedAt: root.generatedAt,
        totalReceived: snapshots.length,
        totalAccepted: 0,
        totalIgnored: 0,
        totalUpdated: 0,
        totalQuarantined: quarantine.length,
        totalRejected: entries.length - quarantine.length,
        diagnostics: duplicatePaths.map(
          (paths) => `Identifiant dupliqué : ${paths}.`,
        ),
        entries,
      },
      quarantine,
    });
  }
  const byId = new Map<string, Question>();
  for (const question of currentQuestions) {
    const current = byId.get(question.id);
    if (!current || question.version > current.version)
      byId.set(question.id, question);
  }
  const entries: QuestionImportReportEntry[] = [];
  const quarantine: QuarantinedQuestionEntry[] = [];
  for (let index = 0; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index] as (typeof snapshots)[number];
    if (!snapshot.readable) {
      quarantine.push({
        entryIndex: index,
        snapshot: '[donnée inaccessible]',
        code: 'hostile-entry',
      });
      entries.push({
        entryIndex: index,
        questionExternalId: null,
        questionId: null,
        questionVersion: null,
        sourceLocator: null,
        status: 'quarantined',
        path: `questions.${index}`,
        code: 'hostile-entry',
        message: 'Entrée inaccessible mise en quarantaine.',
      });
      continue;
    }
    const raw = snapshot.value;
    const singleton = {
      schemaVersion: root.schemaVersion,
      bundleId: root.bundleId,
      generatedAt: root.generatedAt,
      defaultProvenance: root.defaultProvenance,
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
    defaultProvenance: root.defaultProvenance,
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
    totalReceived: snapshots.length,
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
