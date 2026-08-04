import type { ProgramIndex } from '../program/Program';
import {
  createSafeSnapshot,
  deepFreezeOwned,
} from '../validation/SafeSnapshot';
import {
  invalid,
  issue,
  valid,
  type ValidationResult,
} from '../validation/ValidationResult';
import {
  validateQuestion,
  validateQuestionSourceReference,
  type Question,
  type QuestionSourceReference,
} from './Question';
import { validateParameterizedQuestion } from './QuestionParameterValidation';

export const QUESTION_BANK_SCHEMA_VERSION = 1 as const;
export const MAX_QUESTION_BANK_ENTRIES = 10_000;
export const MAX_QUESTION_BANK_BUNDLE_ID_LENGTH = 200;

export type QuestionBankEntryProvenance = Readonly<{
  mode: 'default' | 'extend' | 'replace';
  references: readonly QuestionSourceReference[];
}>;
export interface QuestionBankEntry {
  readonly question: Question;
  readonly provenance: QuestionBankEntryProvenance | null;
}
export interface QuestionBankBundle {
  readonly schemaVersion: typeof QUESTION_BANK_SCHEMA_VERSION;
  readonly bundleId: string;
  readonly generatedAt: string;
  readonly defaultProvenance: readonly QuestionSourceReference[] | null;
  readonly questions: readonly QuestionBankEntry[];
}

const utc = (value: unknown): value is string =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function references(
  value: unknown,
  path: string,
): ValidationResult<readonly QuestionSourceReference[]> {
  if (!Array.isArray(value))
    return invalid(issue(path, 'Une liste de références est requise.'));
  const output: QuestionSourceReference[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const result = validateQuestionSourceReference(value[index]);
    if (!result.ok)
      return invalid(
        ...result.issues.map((entry) =>
          issue(`${path}.${index}`, entry.message),
        ),
      );
    output.push({ ...result.value });
  }
  return valid(output);
}

export function validateQuestionBankBundle(
  input: unknown,
  program?: ProgramIndex,
): ValidationResult<QuestionBankBundle> {
  const snapshot = createSafeSnapshot(input);
  if (!snapshot.ok) return invalid(issue('bundle', snapshot.message));
  const value = snapshot.value;
  if (!record(value))
    return invalid(issue('bundle', 'Le bundle doit être un objet simple.'));
  const errors = [];
  if (value.schemaVersion !== QUESTION_BANK_SCHEMA_VERSION)
    errors.push(
      issue('schemaVersion', 'Version de bundle non prise en charge.'),
    );
  if (
    typeof value.bundleId !== 'string' ||
    value.bundleId.trim() === '' ||
    value.bundleId !== value.bundleId.trim() ||
    value.bundleId.length > MAX_QUESTION_BANK_BUNDLE_ID_LENGTH
  )
    errors.push(
      issue('bundleId', 'Identifiant de bundle non vide et normalisé requis.'),
    );
  if (!utc(value.generatedAt))
    errors.push(issue('generatedAt', 'Timestamp UTC invalide.'));
  if (!Array.isArray(value.questions))
    errors.push(issue('questions', 'Tableau de questions requis.'));
  else if (value.questions.length > MAX_QUESTION_BANK_ENTRIES)
    errors.push(
      issue('questions', 'La taille maximale du bundle est dépassée.'),
    );
  let defaults: readonly QuestionSourceReference[] | null = null;
  if (value.defaultProvenance !== null) {
    const result = references(value.defaultProvenance, 'defaultProvenance');
    if (result.ok) defaults = result.value;
    else errors.push(...result.issues);
  }
  if (
    errors.length > 0 ||
    !Array.isArray(value.questions) ||
    typeof value.bundleId !== 'string' ||
    !utc(value.generatedAt)
  )
    return invalid(...errors);
  const ids = new Set<string>();
  const versions = new Set<string>();
  const entries: QuestionBankEntry[] = [];
  for (let index = 0; index < value.questions.length; index += 1) {
    const raw: unknown = value.questions[index];
    const path = `questions.${index}`;
    if (!record(raw)) {
      errors.push(issue(path, 'Entrée de banque invalide.'));
      continue;
    }
    const validated = validateQuestion(raw.question);
    if (!validated.ok) {
      errors.push(
        ...validated.issues.map((entry) =>
          issue(`${path}.${entry.path}`, entry.message),
        ),
      );
      continue;
    }
    const question = validated.value;
    if (ids.has(question.id))
      errors.push(
        issue(`${path}.question.id`, 'Identifiant de question dupliqué.'),
      );
    ids.add(question.id);
    const pair = `${question.id}\u0000${question.version}`;
    if (versions.has(pair))
      errors.push(
        issue(
          `${path}.question.version`,
          'Couple identifiant/version dupliqué.',
        ),
      );
    versions.add(pair);
    let entryProvenance: QuestionBankEntryProvenance | null = null;
    if (raw.provenance !== null) {
      if (
        !record(raw.provenance) ||
        !['default', 'extend', 'replace'].includes(
          raw.provenance.mode as string,
        )
      )
        errors.push(
          issue(`${path}.provenance`, 'Mode de provenance invalide.'),
        );
      else {
        const checked = references(
          raw.provenance.references,
          `${path}.provenance.references`,
        );
        if (!checked.ok) errors.push(...checked.issues);
        else
          entryProvenance = {
            mode: raw.provenance.mode as QuestionBankEntryProvenance['mode'],
            references: checked.value,
          };
      }
    }
    const resolved =
      entryProvenance?.mode === 'replace'
        ? entryProvenance.references
        : entryProvenance?.mode === 'extend'
          ? [...(defaults ?? []), ...entryProvenance.references]
          : defaults;
    if (!resolved || resolved.length === 0)
      errors.push(
        issue(`${path}.provenance`, 'Une provenance fournie est requise.'),
      );
    if (question.status === 'published') {
      const semantic = validateParameterizedQuestion(
        question,
        `${value.bundleId}:${question.id}:${question.version}`,
      );
      if (semantic.kind !== 'ready')
        errors.push(
          ...semantic.errors.map((entry) =>
            issue(`${path}.${entry.path}`, entry.message),
          ),
        );
    }
    if (program) {
      const part = program.getPart(question.partId);
      const chapter = program.getChapter(question.chapterId);
      const notion = program.getNotion(question.notionId);
      if (!part)
        errors.push(
          issue(`${path}.question.partId`, 'Partie absente du programme.'),
        );
      if (!chapter)
        errors.push(
          issue(`${path}.question.chapterId`, 'Chapitre absent du programme.'),
        );
      if (!notion)
        errors.push(
          issue(`${path}.question.notionId`, 'Notion absente du programme.'),
        );
      if (chapter && chapter.partId !== question.partId)
        errors.push(
          issue(
            `${path}.question.chapterId`,
            'Le chapitre ne dépend pas de cette partie.',
          ),
        );
      if (notion && notion.chapterId !== question.chapterId)
        errors.push(
          issue(
            `${path}.question.notionId`,
            'La notion ne dépend pas de ce chapitre.',
          ),
        );
    }
    const importedAt = value.generatedAt;
    entries.push({
      question: {
        ...question,
        provenance: {
          bundleId: value.bundleId,
          importedAt,
          references: resolved ?? [],
        },
      },
      provenance: entryProvenance,
    });
  }
  return errors.length > 0
    ? invalid(...errors)
    : valid(
        deepFreezeOwned({
          schemaVersion: QUESTION_BANK_SCHEMA_VERSION,
          bundleId: value.bundleId,
          generatedAt: value.generatedAt,
          defaultProvenance: defaults,
          questions: entries,
        }) as QuestionBankBundle,
      );
}
