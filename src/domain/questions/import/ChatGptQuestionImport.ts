import {
  validateContentSegment,
  validateParameterizedQuestionSpec,
  type ContentSegment,
  type ParameterizedQuestionSpec,
  type QuestionType,
  type Difficulty,
} from '../Question.ts';
import {
  CHATGPT_IMPORT_FORBIDDEN_FIELDS,
  CHATGPT_IMPORT_LIMITS,
} from './ChatGptImportPolicy.ts';

export type AnalysisCoverage = 'text-and-visuals' | 'text-only' | 'incomplete';
export type ImportClassification =
  | Readonly<{
      kind: 'official';
      chapterId: string;
      notionId: string;
      confidence: 'certain' | 'uncertain';
    }>
  | Readonly<{
      kind: 'personal';
      proposedCourseTitle: string;
      proposedChapterTitle: string | null;
      proposedNotionTitle: string | null;
      reason: string;
      requiresUserConfirmation: true;
    }>;
export type ImportUncertaintyCode =
  | 'ocr'
  | 'formula'
  | 'classification'
  | 'text-visual-conflict'
  | 'missing-visual-analysis';
export interface ImportUncertainty {
  readonly code: ImportUncertaintyCode;
  readonly path: string;
  readonly message: string;
}
export interface ChatGptQuestionImportEntryV1 {
  readonly clientEntryId: string | null;
  readonly classification: ImportClassification;
  readonly type: QuestionType;
  readonly difficulty: Difficulty | null;
  readonly parameterization: ParameterizedQuestionSpec | null;
  readonly prompt: readonly ContentSegment[];
  readonly hint: readonly ContentSegment[];
  readonly correction: readonly {
    readonly title: string | null;
    readonly content: readonly ContentSegment[];
  }[];
  readonly tags: readonly string[];
  readonly uncertainties: readonly ImportUncertainty[];
}
export interface ChatGptQuestionImportV1 {
  readonly schemaVersion: 1;
  readonly importId: string;
  readonly analysisCoverage: AnalysisCoverage;
  readonly confirmedByUser: true;
  readonly document: Readonly<{
    kind: 'photo' | 'pdf';
    title: string | null;
    pageCount: number | null;
  }>;
  readonly questions: readonly ChatGptQuestionImportEntryV1[];
}
export interface ImportReportEntryV1 {
  readonly index: number;
  readonly code: string;
  readonly path: string;
  readonly message: string;
}
export interface ImportReportV1 {
  readonly schemaVersion: 1;
  readonly importId: string;
  readonly accepted: readonly number[];
  readonly quarantined: readonly ImportReportEntryV1[];
  readonly warnings: readonly ImportReportEntryV1[];
  readonly replayed: boolean;
}

type Result =
  | Readonly<{
      ok: true;
      value: ChatGptQuestionImportV1;
      acceptedIndices: readonly number[];
      quarantined: readonly ImportReportEntryV1[];
    }>
  | Readonly<{ ok: false; issues: readonly ImportReportEntryV1[] }>;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);
const text = (value: unknown, nullable = false): value is string | null =>
  (nullable && value === null) ||
  (typeof value === 'string' &&
    value.length <= CHATGPT_IMPORT_LIMITS.textCharacters);
const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
) => Object.keys(value).every((key) => allowed.includes(key));
const hasDangerousKey = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasDangerousKey);
  if (!record(value)) return false;
  return Object.keys(value).some(
    (key) =>
      ['__proto__', 'constructor', 'prototype'].includes(key) ||
      hasDangerousKey(value[key]),
  );
};
const hasOwnDangerousKey = (value: Record<string, unknown>) =>
  Object.keys(value).some((key) =>
    ['__proto__', 'constructor', 'prototype'].includes(key),
  );
const boundedText = (value: unknown, maximum: number, nullable = false) =>
  (nullable && (value === null || value === undefined)) ||
  (typeof value === 'string' && value.length <= maximum);
const issue = (
  index: number,
  code: string,
  path: string,
  message: string,
): ImportReportEntryV1 => ({ index, code, path, message });
const forbidden = (
  value: unknown,
  path: string,
  index: number,
): ImportReportEntryV1 | null => {
  if (!record(value)) return null;
  for (const key of CHATGPT_IMPORT_FORBIDDEN_FIELDS)
    if (Object.hasOwn(value, key))
      return issue(
        index,
        'forbidden-field',
        `${path}.${key}`,
        `Le champ ${key} n'est pas accepté comme autorité.`,
      );
  return null;
};
const segments = (
  value: unknown,
  allowEmpty: boolean,
): value is ContentSegment[] =>
  Array.isArray(value) &&
  value.length <= CHATGPT_IMPORT_LIMITS.segmentsPerField &&
  (allowEmpty || value.length > 0) &&
  value.every(
    (entry) => strictSegment(entry) && validateContentSegment(entry).ok,
  );

function strictSegment(value: unknown): boolean {
  if (!record(value)) return false;
  if (value.kind === 'text')
    return (
      hasOnlyKeys(value, ['kind', 'value']) &&
      boundedText(value.value, CHATGPT_IMPORT_LIMITS.textCharacters)
    );
  if (value.kind === 'line-break') return hasOnlyKeys(value, ['kind']);
  if (value.kind === 'inline-math' || value.kind === 'display-math')
    return (
      hasOnlyKeys(value, ['kind', 'math']) &&
      record(value.math) &&
      hasOnlyKeys(value.math, ['syntaxVersion', 'source']) &&
      boundedText(value.math.source, CHATGPT_IMPORT_LIMITS.textCharacters)
    );
  return false;
}

function strictExpression(value: unknown): boolean {
  if (!record(value)) return false;
  const keys: Record<string, readonly string[]> = {
    literal: ['kind', 'value'],
    variable: ['kind', 'variableId'],
    unary: ['kind', 'operator', 'operand'],
    binary: ['kind', 'operator', 'left', 'right'],
    comparison: ['kind', 'operator', 'left', 'right'],
    'math-function': ['kind', 'function', 'arguments'],
    logical: ['kind', 'operator', 'operands'],
    'logical-not': ['kind', 'operand'],
  };
  const allowed = keys[String(value.kind)];
  if (!allowed || !hasOnlyKeys(value, allowed)) return false;
  if ('operand' in value && !strictExpression(value.operand)) return false;
  if (
    'left' in value &&
    (!strictExpression(value.left) || !strictExpression(value.right))
  )
    return false;
  if (
    'arguments' in value &&
    (!Array.isArray(value.arguments) ||
      !value.arguments.every(strictExpression))
  )
    return false;
  if (
    'operands' in value &&
    (!Array.isArray(value.operands) || !value.operands.every(strictExpression))
  )
    return false;
  return true;
}

function strictParameterization(value: unknown): boolean {
  if (
    !record(value) ||
    !hasOnlyKeys(value, [
      'schemaVersion',
      'variables',
      'constraints',
      'validationVariantCount',
    ]) ||
    !Array.isArray(value.variables) ||
    value.variables.length > CHATGPT_IMPORT_LIMITS.variables ||
    !Array.isArray(value.constraints) ||
    !value.constraints.every(strictExpression)
  )
    return false;
  return value.variables.every((variable) => {
    if (
      !record(variable) ||
      !hasOnlyKeys(variable, ['id', 'label', 'domain']) ||
      !record(variable.domain)
    )
      return false;
    const domainKeys =
      variable.domain.kind === 'integer'
        ? ['kind', 'minimum', 'maximum', 'step', 'excludedValues']
        : variable.domain.kind === 'decimal'
          ? ['kind', 'minimum', 'maximum', 'decimals', 'excludedValues']
          : variable.domain.kind === 'choice'
            ? ['kind', 'values']
            : [];
    return domainKeys.length > 0 && hasOnlyKeys(variable.domain, domainKeys);
  });
}

// Returns null when valid, or a short diagnostic string identifying which
// check failed — surfaced in the quarantine message so a rejected import
// says exactly what was wrong instead of a generic "invalide ou inconnue".
function classificationIssue(value: unknown): string | null {
  if (!record(value)) return 'classification absente ou non-objet';
  if (value.kind === 'official') {
    if (!hasOnlyKeys(value, ['kind', 'chapterId', 'notionId', 'confidence']))
      return 'clé inconnue pour une classification officielle';
    if (Object.hasOwn(value, 'partId'))
      return 'partId non autorisé (déduit du serveur, jamais envoyé)';
    if (!text(value.chapterId)) return 'chapterId manquant ou invalide';
    if (!text(value.notionId)) return 'notionId manquant ou invalide';
    if (value.confidence !== 'certain' && value.confidence !== 'uncertain')
      return 'confidence manquant ou invalide (certain|uncertain attendu)';
    return null;
  }
  if (value.kind !== 'personal')
    return 'kind doit être "official" ou "personal"';
  if (
    !hasOnlyKeys(value, [
      'kind',
      'proposedCourseTitle',
      'proposedChapterTitle',
      'proposedNotionTitle',
      'reason',
      'requiresUserConfirmation',
    ])
  )
    return 'clé inconnue pour une classification personnelle';
  if (
    typeof value.proposedCourseTitle !== 'string' ||
    !boundedText(
      value.proposedCourseTitle,
      CHATGPT_IMPORT_LIMITS.taxonomyTitleCharacters,
    ) ||
    value.proposedCourseTitle.trim() === ''
  )
    return 'proposedCourseTitle manquant, vide ou trop long';
  if (
    !boundedText(
      value.proposedChapterTitle,
      CHATGPT_IMPORT_LIMITS.taxonomyTitleCharacters,
      true,
    )
  )
    return 'proposedChapterTitle invalide (chaîne ou null attendu)';
  if (
    !boundedText(
      value.proposedNotionTitle,
      CHATGPT_IMPORT_LIMITS.taxonomyTitleCharacters,
      true,
    )
  )
    return 'proposedNotionTitle invalide (chaîne ou null attendu)';
  if (!text(value.reason)) return 'reason manquant, vide ou trop long';
  if (value.requiresUserConfirmation !== true)
    return 'requiresUserConfirmation doit être true';
  return null;
}

function validateEntry(
  value: unknown,
  index: number,
): ChatGptQuestionImportEntryV1 | ImportReportEntryV1 {
  const path = `questions[${index}]`;
  if (!record(value))
    return issue(index, 'invalid-entry', path, 'Question invalide.');
  const injected = forbidden(value, path, index);
  if (injected) return injected;
  if (
    hasDangerousKey(value) ||
    !hasOnlyKeys(value, [
      'clientEntryId',
      'classification',
      'type',
      'difficulty',
      'parameterization',
      'prompt',
      'hint',
      'correction',
      'tags',
      'uncertainties',
    ])
  )
    return issue(
      index,
      'unknown-field',
      path,
      'Propriété inconnue ou dangereuse.',
    );
  if (
    !boundedText(
      value.clientEntryId,
      CHATGPT_IMPORT_LIMITS.clientEntryIdCharacters,
      true,
    )
  )
    return issue(
      index,
      'invalid-client-entry-id',
      `${path}.clientEntryId`,
      'Identifiant client invalide.',
    );
  const classificationProblem = classificationIssue(value.classification);
  if (classificationProblem)
    return issue(
      index,
      'invalid-classification',
      `${path}.classification`,
      `Classification invalide : ${classificationProblem}.`,
    );
  if (
    !['formula', 'course', 'calculation', 'reflex'].includes(String(value.type))
  )
    return issue(index, 'invalid-type', `${path}.type`, 'Type invalide.');
  if (
    value.type === 'reflex'
      ? value.difficulty !== null
      : !['fundamental', 'standard', 'trap'].includes(String(value.difficulty))
  )
    return issue(
      index,
      'invalid-difficulty',
      `${path}.difficulty`,
      'Difficulté invalide.',
    );
  if (!segments(value.prompt, false) || !segments(value.hint, true))
    return issue(
      index,
      'invalid-content',
      `${path}.prompt`,
      'Segments de contenu invalides.',
    );
  if (
    !Array.isArray(value.correction) ||
    value.correction.length > CHATGPT_IMPORT_LIMITS.correctionSteps ||
    !value.correction.every(
      (step) =>
        record(step) &&
        hasOnlyKeys(step, ['title', 'content']) &&
        boundedText(
          step.title,
          CHATGPT_IMPORT_LIMITS.correctionTitleCharacters,
          true,
        ) &&
        segments(step.content, false),
    )
  )
    return issue(
      index,
      'invalid-correction',
      `${path}.correction`,
      'Correction invalide.',
    );
  if (
    !Array.isArray(value.tags) ||
    value.tags.length > CHATGPT_IMPORT_LIMITS.tags ||
    !value.tags.every((tag) =>
      boundedText(tag, CHATGPT_IMPORT_LIMITS.tagCharacters),
    )
  )
    return issue(index, 'invalid-tags', `${path}.tags`, 'Tags invalides.');
  const codes = new Set([
    'ocr',
    'formula',
    'classification',
    'text-visual-conflict',
    'missing-visual-analysis',
  ]);
  if (
    !Array.isArray(value.uncertainties) ||
    value.uncertainties.length > CHATGPT_IMPORT_LIMITS.uncertainties ||
    !value.uncertainties.every(
      (entry) =>
        record(entry) &&
        hasOnlyKeys(entry, ['code', 'path', 'message']) &&
        codes.has(String(entry.code)) &&
        boundedText(
          entry.path,
          CHATGPT_IMPORT_LIMITS.uncertaintyPathCharacters,
        ) &&
        boundedText(
          entry.message,
          CHATGPT_IMPORT_LIMITS.uncertaintyMessageCharacters,
        ),
    )
  )
    return issue(
      index,
      'invalid-uncertainty',
      `${path}.uncertainties`,
      'Incertitudes invalides.',
    );
  if (
    value.parameterization !== null &&
    (!strictParameterization(value.parameterization) ||
      !validateParameterizedQuestionSpec(value.parameterization).ok)
  )
    return issue(
      index,
      'invalid-parameterization',
      `${path}.parameterization`,
      'Paramétrisation invalide.',
    );
  return value as unknown as ChatGptQuestionImportEntryV1;
}

export function validateChatGptQuestionImport(input: unknown): Result {
  let size = Number.POSITIVE_INFINITY;
  try {
    size = JSON.stringify(input).length;
  } catch {
    /* inaccessible input */
  }
  if (size > CHATGPT_IMPORT_LIMITS.totalCharacters)
    return {
      ok: false,
      issues: [issue(-1, 'payload-too-large', '$', 'Payload trop volumineux.')],
    };
  if (!record(input))
    return {
      ok: false,
      issues: [issue(-1, 'invalid-payload', '$', 'Payload invalide.')],
    };
  const injected = forbidden(input, '$', -1);
  if (injected) return { ok: false, issues: [injected] };
  if (
    hasOwnDangerousKey(input) ||
    !hasOnlyKeys(input, [
      'schemaVersion',
      'importId',
      'analysisCoverage',
      'confirmedByUser',
      'document',
      'questions',
    ])
  )
    return {
      ok: false,
      issues: [
        issue(-1, 'unknown-field', '$', 'Propriété inconnue ou dangereuse.'),
      ],
    };
  if (
    input.schemaVersion !== 1 ||
    typeof input.importId !== 'string' ||
    !input.importId.trim() ||
    input.importId.length > CHATGPT_IMPORT_LIMITS.importIdCharacters ||
    input.confirmedByUser !== true
  )
    return {
      ok: false,
      issues: [
        issue(
          -1,
          'invalid-envelope',
          '$',
          'Version, importId ou confirmation invalide.',
        ),
      ],
    };
  if (
    !['text-and-visuals', 'text-only', 'incomplete'].includes(
      String(input.analysisCoverage),
    )
  )
    return {
      ok: false,
      issues: [
        issue(
          -1,
          'invalid-coverage',
          '$.analysisCoverage',
          'Couverture invalide.',
        ),
      ],
    };
  if (
    !record(input.document) ||
    hasOwnDangerousKey(input.document) ||
    !hasOnlyKeys(input.document, ['kind', 'title', 'pageCount']) ||
    !['photo', 'pdf'].includes(String(input.document.kind)) ||
    !text(input.document.title, true) ||
    !(
      input.document.pageCount === null ||
      (Number.isInteger(input.document.pageCount) &&
        Number(input.document.pageCount) > 0)
    )
  )
    return {
      ok: false,
      issues: [
        issue(-1, 'invalid-document', '$.document', 'Document invalide.'),
      ],
    };
  if (
    !Array.isArray(input.questions) ||
    input.questions.length > CHATGPT_IMPORT_LIMITS.questions
  )
    return {
      ok: false,
      issues: [
        issue(
          -1,
          'invalid-questions',
          '$.questions',
          'Lot de questions invalide.',
        ),
      ],
    };
  const accepted: ChatGptQuestionImportEntryV1[] = [];
  const acceptedIndices: number[] = [];
  const quarantined: ImportReportEntryV1[] = [];
  input.questions.forEach((entry, index) => {
    const result = validateEntry(entry, index);
    if ('code' in result) quarantined.push(result);
    else {
      accepted.push(result);
      acceptedIndices.push(index);
    }
  });
  return {
    ok: true,
    value: {
      ...input,
      questions: accepted,
    } as unknown as ChatGptQuestionImportV1,
    quarantined,
    acceptedIndices,
  };
}

export function canonicalizeImport(value: unknown): string {
  const normalize = (entry: unknown): unknown =>
    Array.isArray(entry)
      ? entry.map(normalize)
      : record(entry)
        ? Object.fromEntries(
            Object.keys(entry)
              .sort()
              .map((key) => [key, normalize(entry[key])]),
          )
        : entry;
  return JSON.stringify(normalize(value));
}
