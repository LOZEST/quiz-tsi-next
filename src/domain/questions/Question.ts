import { validateMathSource, type MathSource } from '../math/MathSource';
import {
  invalid,
  issue,
  valid,
  type ValidationIssue,
  type ValidationResult,
} from '../validation/ValidationResult';

export const QUESTION_TYPES = [
  'formula',
  'course',
  'calculation',
  'reflex',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ['fundamental', 'standard', 'trap'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_SOURCES = ['static', 'private', 'shared'] as const;
export type QuestionSource = (typeof QUESTION_SOURCES)[number];

export type ParameterPrimitive = string | number | boolean;

export const SAFE_EXPRESSION_MAX_DEPTH = 32;
export const SAFE_EXPRESSION_MAX_NODES = 256;
export const SAFE_EXPRESSION_MAX_LIST_ITEMS = 32;

export type ContentSegment =
  | Readonly<{ kind: 'text'; value: string }>
  | Readonly<{ kind: 'inline-math'; math: MathSource }>
  | Readonly<{ kind: 'display-math'; math: MathSource }>
  | Readonly<{ kind: 'line-break' }>;

export interface IntegerVariableDomain {
  readonly kind: 'integer';
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly excludedValues: readonly number[];
}

export interface DecimalVariableDomain {
  readonly kind: 'decimal';
  readonly minimum: number;
  readonly maximum: number;
  readonly decimals: number;
  readonly excludedValues: readonly number[];
}

export interface ChoiceVariableDomain {
  readonly kind: 'choice';
  readonly values: readonly ParameterPrimitive[];
}

export type VariableDomain =
  | IntegerVariableDomain
  | DecimalVariableDomain
  | ChoiceVariableDomain;

export interface VariableDefinition {
  readonly id: string;
  readonly label: string;
  readonly domain: VariableDomain;
}

export type SafeExpressionNode =
  | Readonly<{ kind: 'literal'; value: ParameterPrimitive }>
  | Readonly<{ kind: 'variable'; variableId: string }>
  | Readonly<{
      kind: 'unary';
      operator: 'negate' | 'absolute';
      operand: SafeExpressionNode;
    }>
  | Readonly<{
      kind: 'binary';
      operator: 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'power';
      left: SafeExpressionNode;
      right: SafeExpressionNode;
    }>
  | Readonly<{
      kind: 'comparison';
      operator:
        | 'equal'
        | 'not-equal'
        | 'less-than'
        | 'less-than-or-equal'
        | 'greater-than'
        | 'greater-than-or-equal';
      left: SafeExpressionNode;
      right: SafeExpressionNode;
    }>
  | Readonly<{
      kind: 'math-function';
      function: 'abs' | 'sqrt' | 'min' | 'max' | 'round' | 'floor' | 'ceil';
      arguments: readonly SafeExpressionNode[];
    }>
  | Readonly<{
      kind: 'logical';
      operator: 'and' | 'or';
      operands: readonly SafeExpressionNode[];
    }>
  | Readonly<{ kind: 'logical-not'; operand: SafeExpressionNode }>;

export interface ParameterizedQuestionSpec {
  readonly schemaVersion: 1;
  readonly variables: readonly VariableDefinition[];
  readonly constraints: readonly SafeExpressionNode[];
  readonly validationVariantCount: number;
}

export interface CorrectionStep {
  readonly id: string;
  readonly title: string | null;
  readonly content: readonly ContentSegment[];
}

export interface QuestionSourceReference {
  readonly sourceLabel: string;
  readonly sourceReference: string | null;
  readonly sourceLocator: string | null;
}

export interface QuestionProvenance {
  readonly bundleId: string;
  readonly importedAt: string;
  readonly references: readonly QuestionSourceReference[];
}

export interface Question {
  readonly id: string;
  readonly version: number;
  readonly source: QuestionSource;
  readonly ownerId: string | null;
  readonly status: 'draft' | 'published' | 'archived';
  readonly provenance: QuestionProvenance | null;
  readonly partId: string;
  readonly chapterId: string;
  readonly notionId: string;
  readonly type: QuestionType;
  readonly difficulty: Difficulty | null;
  readonly parameterization: ParameterizedQuestionSpec | null;
  readonly prompt: readonly ContentSegment[];
  readonly hint: readonly ContentSegment[];
  readonly correction: readonly CorrectionStep[];
  readonly tags: readonly string[];
  readonly validated: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QuestionInstance {
  readonly id: string;
  readonly questionId: string;
  readonly questionVersion: number;
  readonly sessionId: string;
  readonly ordinal: number;
  readonly frozenQuestion: Readonly<Question>;
  readonly parameterValues: Readonly<Record<string, ParameterPrimitive>>;
  readonly seed: string;
  readonly createdAt: string;
}

export interface FrozenQuestionInstance extends QuestionInstance {
  readonly contentHash: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

export function validateContentSegment(
  value: unknown,
): ValidationResult<ContentSegment> {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return invalid(issue('segment', 'Segment de contenu invalide.'));
  }
  if (value.kind === 'line-break') return valid({ kind: 'line-break' });
  if (value.kind === 'text' && typeof value.value === 'string') {
    return valid({ kind: 'text', value: value.value });
  }
  if (value.kind === 'inline-math' || value.kind === 'display-math') {
    const math = validateMathSource(value.math);
    return math.ok
      ? valid({ kind: value.kind, math: math.value })
      : invalid(...math.issues);
  }
  return invalid(issue('segment.kind', 'Type de segment non autorisé.'));
}

function validateSegments(
  value: unknown,
  path: string,
  allowEmpty: boolean,
): ValidationIssue[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    return [issue(path, 'Une liste de segments est requise.')];
  }
  return value.flatMap((segment, index) => {
    const result = validateContentSegment(segment);
    return result.ok
      ? []
      : result.issues.map((entry) => ({
          ...entry,
          path: `${path}.${index}.${entry.path}`,
        }));
  });
}

function validateParameterization(
  value: unknown,
  published: boolean,
): ValidationIssue[] {
  if (value === null) return [];
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return [issue('parameterization', 'Paramétrisation v1 invalide.')];
  }
  if (
    !Array.isArray(value.variables) ||
    !Array.isArray(value.constraints) ||
    !Number.isInteger(value.validationVariantCount) ||
    (value.validationVariantCount as number) < (published ? 10 : 0)
  ) {
    return [
      issue(
        'parameterization',
        'Variables, contraintes ou nombre de variantes invalides.',
      ),
    ];
  }
  const ids = new Set<string>();
  for (const variable of value.variables) {
    if (
      !isRecord(variable) ||
      !isNonEmptyString(variable.id) ||
      !isNonEmptyString(variable.label) ||
      !isRecord(variable.domain) ||
      ids.has(variable.id)
    ) {
      return [
        issue(
          'parameterization.variables',
          'Définition de variable invalide ou dupliquée.',
        ),
      ];
    }
    if (!validateVariableDomain(variable.domain)) {
      return [
        issue(
          'parameterization.variables',
          'Domaine de variable structurellement invalide.',
        ),
      ];
    }
    ids.add(variable.id);
  }
  for (const [index, constraint] of value.constraints.entries()) {
    const result = validateSafeExpression(
      constraint,
      published ? ids : undefined,
    );
    if (!result.ok) {
      return result.issues.map((entry) => ({
        ...entry,
        path: `parameterization.constraints.${index}.${entry.path}`,
      }));
    }
  }
  return [];
}

function isPrimitive(value: unknown): value is ParameterPrimitive {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function validateVariableDomain(value: unknown): value is VariableDomain {
  if (!isRecord(value)) return false;
  if (value.kind === 'choice') {
    return (
      Array.isArray(value.values) &&
      value.values.length > 0 &&
      value.values.every(isPrimitive)
    );
  }
  if (value.kind === 'integer') {
    return (
      Number.isInteger(value.minimum) &&
      Number.isInteger(value.maximum) &&
      (value.minimum as number) <= (value.maximum as number) &&
      Number.isInteger(value.step) &&
      (value.step as number) > 0 &&
      Array.isArray(value.excludedValues) &&
      value.excludedValues.every(Number.isInteger)
    );
  }
  if (value.kind === 'decimal') {
    return (
      typeof value.minimum === 'number' &&
      Number.isFinite(value.minimum) &&
      typeof value.maximum === 'number' &&
      Number.isFinite(value.maximum) &&
      value.minimum <= value.maximum &&
      Number.isInteger(value.decimals) &&
      (value.decimals as number) >= 0 &&
      Array.isArray(value.excludedValues) &&
      value.excludedValues.every(
        (entry) => typeof entry === 'number' && Number.isFinite(entry),
      )
    );
  }
  return false;
}

const binaryOperators = new Set([
  'add',
  'subtract',
  'multiply',
  'divide',
  'modulo',
  'power',
]);
const comparisonOperators = new Set([
  'equal',
  'not-equal',
  'less-than',
  'less-than-or-equal',
  'greater-than',
  'greater-than-or-equal',
]);
const mathFunctions = new Set([
  'abs',
  'sqrt',
  'min',
  'max',
  'round',
  'floor',
  'ceil',
]);

export function validateSafeExpression(
  value: unknown,
  definedVariableIds?: ReadonlySet<string>,
): ValidationResult<SafeExpressionNode> {
  const pending: Array<{ node: unknown; depth: number }> = [
    { node: value, depth: 1 },
  ];
  let nodeCount = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    nodeCount += 1;
    if (
      current.depth > SAFE_EXPRESSION_MAX_DEPTH ||
      nodeCount > SAFE_EXPRESSION_MAX_NODES
    ) {
      return invalid(
        issue('expression.limits', 'AST trop profond ou trop grand.'),
      );
    }
    if (!isRecord(current.node)) {
      return invalid(issue('expression.node', 'Nœud AST invalide.'));
    }
    const node = current.node;
    const push = (...children: unknown[]) => {
      for (const child of children) {
        pending.push({ node: child, depth: current.depth + 1 });
      }
    };

    if (node.kind === 'literal') {
      if (!isPrimitive(node.value)) {
        return invalid(issue('expression.literal', 'Littéral invalide.'));
      }
      continue;
    }
    if (node.kind === 'variable') {
      if (
        !isNonEmptyString(node.variableId) ||
        (definedVariableIds !== undefined &&
          !definedVariableIds.has(node.variableId))
      ) {
        return invalid(
          issue('expression.variable', 'Référence de variable invalide.'),
        );
      }
      continue;
    }
    if (node.kind === 'unary') {
      if (node.operator !== 'negate' && node.operator !== 'absolute') {
        return invalid(issue('expression.unary', 'Opérateur unaire invalide.'));
      }
      push(node.operand);
      continue;
    }
    if (node.kind === 'binary' || node.kind === 'comparison') {
      const operators =
        node.kind === 'binary' ? binaryOperators : comparisonOperators;
      if (!operators.has(node.operator as string)) {
        return invalid(issue('expression.operator', 'Opérateur invalide.'));
      }
      push(node.left, node.right);
      continue;
    }
    if (node.kind === 'math-function') {
      if (
        !mathFunctions.has(node.function as string) ||
        !Array.isArray(node.arguments) ||
        node.arguments.length > SAFE_EXPRESSION_MAX_LIST_ITEMS
      ) {
        return invalid(issue('expression.function', 'Fonction invalide.'));
      }
      const arityIsValid =
        node.function === 'min' || node.function === 'max'
          ? node.arguments.length >= 2
          : node.arguments.length === 1;
      if (!arityIsValid) {
        return invalid(issue('expression.function', 'Arité invalide.'));
      }
      for (const argument of node.arguments as unknown[]) push(argument);
      continue;
    }
    if (node.kind === 'logical') {
      if (
        (node.operator !== 'and' && node.operator !== 'or') ||
        !Array.isArray(node.operands) ||
        node.operands.length < 2 ||
        node.operands.length > SAFE_EXPRESSION_MAX_LIST_ITEMS
      ) {
        return invalid(issue('expression.logical', 'Logique invalide.'));
      }
      for (const operand of node.operands as unknown[]) push(operand);
      continue;
    }
    if (node.kind === 'logical-not') {
      push(node.operand);
      continue;
    }
    return invalid(issue('expression.kind', 'Type de nœud AST invalide.'));
  }

  return valid(value as SafeExpressionNode);
}

export function validateQuestionSourceReference(
  value: unknown,
): ValidationResult<QuestionSourceReference> {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.sourceLabel) ||
    !(
      value.sourceReference === null ||
      typeof value.sourceReference === 'string'
    ) ||
    !(value.sourceLocator === null || typeof value.sourceLocator === 'string')
  ) {
    return invalid(issue('provenance.reference', 'Référence source invalide.'));
  }
  return valid(value as unknown as QuestionSourceReference);
}

export function validateQuestionProvenance(
  value: unknown,
): ValidationResult<QuestionProvenance> {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.bundleId) ||
    !isIsoDate(value.importedAt) ||
    !Array.isArray(value.references)
  ) {
    return invalid(issue('provenance', 'Provenance de question invalide.'));
  }
  for (const reference of value.references) {
    const result = validateQuestionSourceReference(reference);
    if (!result.ok) return result;
  }
  return valid(value as unknown as QuestionProvenance);
}

export function validateQuestion(value: unknown): ValidationResult<Question> {
  if (!isRecord(value)) {
    return invalid(issue('question', 'Une question doit être un objet.'));
  }
  const issues: ValidationIssue[] = [];
  const requiredStrings = ['id', 'partId', 'chapterId', 'notionId'] as const;
  for (const key of requiredStrings) {
    if (!isNonEmptyString(value[key])) {
      issues.push(issue(`question.${key}`, 'Valeur requise.'));
    }
  }
  if (!Number.isInteger(value.version) || (value.version as number) < 1) {
    issues.push(
      issue('question.version', 'Version strictement positive requise.'),
    );
  }
  if (!QUESTION_SOURCES.includes(value.source as QuestionSource)) {
    issues.push(issue('question.source', 'Source de question invalide.'));
  }
  if (!QUESTION_TYPES.includes(value.type as QuestionType)) {
    issues.push(issue('question.type', 'Type de question invalide.'));
  }
  if (
    value.type === 'reflex'
      ? value.difficulty !== null
      : !DIFFICULTIES.includes(value.difficulty as Difficulty)
  ) {
    issues.push(
      issue(
        'question.difficulty',
        'Réflexe exige null ; les autres types exigent une difficulté.',
      ),
    );
  }
  if (
    !['draft', 'published', 'archived'].includes(value.status as string) ||
    typeof value.validated !== 'boolean'
  ) {
    issues.push(issue('question.status', 'État de validation invalide.'));
  }
  if (value.status === 'published' && value.validated !== true) {
    issues.push(
      issue('question.validated', 'Une question publiée doit être validée.'),
    );
  }
  if (
    (value.source === 'static' && value.ownerId !== null) ||
    ((value.source === 'private' || value.source === 'shared') &&
      !isNonEmptyString(value.ownerId))
  ) {
    issues.push(
      issue('question.ownerId', 'Propriétaire incohérent avec la source.'),
    );
  }
  if (value.provenance !== null) {
    const provenance = validateQuestionProvenance(value.provenance);
    if (!provenance.ok) issues.push(...provenance.issues);
  }
  issues.push(...validateSegments(value.prompt, 'question.prompt', false));
  issues.push(...validateSegments(value.hint, 'question.hint', true));
  if (!Array.isArray(value.correction)) {
    issues.push(issue('question.correction', 'Correction structurée requise.'));
  } else {
    value.correction.forEach((step, index) => {
      if (
        !isRecord(step) ||
        !isNonEmptyString(step.id) ||
        !(step.title === null || typeof step.title === 'string')
      ) {
        issues.push(
          issue(
            `question.correction.${index}`,
            'Étape de correction invalide.',
          ),
        );
      } else {
        issues.push(
          ...validateSegments(
            step.content,
            `question.correction.${index}.content`,
            false,
          ),
        );
      }
    });
  }
  if (
    !Array.isArray(value.tags) ||
    value.tags.some((tag) => typeof tag !== 'string')
  ) {
    issues.push(issue('question.tags', 'Liste de tags invalide.'));
  }
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) {
    issues.push(
      issue('question.timestamps', 'Timestamps ISO 8601 UTC requis.'),
    );
  }
  issues.push(
    ...validateParameterization(
      value.parameterization,
      value.status === 'published',
    ),
  );
  return issues.length
    ? invalid(...issues)
    : valid(value as unknown as Question);
}

function isPlainPrimitiveRecord(
  value: unknown,
): value is Record<string, ParameterPrimitive> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) return false;
  if (Object.getOwnPropertySymbols(value).length > 0) return false;
  return Object.values(value).every(isPrimitive);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== 'object' || value === null) return value;
  const pending: object[] = [value];
  const visited = new WeakSet<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      const child = descriptor?.value as unknown;
      if (typeof child === 'object' && child !== null) pending.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

export function createQuestionInstance(
  value: unknown,
): ValidationResult<QuestionInstance> {
  if (!isRecord(value)) {
    return invalid(issue('instance', 'Une instance doit être un objet.'));
  }
  const question = validateQuestion(value.frozenQuestion);
  const issues: ValidationIssue[] = question.ok ? [] : [...question.issues];
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.questionId) ||
    !isNonEmptyString(value.sessionId) ||
    !isNonEmptyString(value.seed) ||
    !Number.isInteger(value.questionVersion) ||
    (value.questionVersion as number) < 1 ||
    !Number.isInteger(value.ordinal) ||
    (value.ordinal as number) < 0 ||
    !isIsoDate(value.createdAt) ||
    !isPlainPrimitiveRecord(value.parameterValues)
  ) {
    issues.push(issue('instance', 'Structure d’instance invalide.'));
  }
  if (
    question.ok &&
    (value.questionId !== question.value.id ||
      value.questionVersion !== question.value.version)
  ) {
    issues.push(
      issue(
        'instance.frozenQuestion',
        'Version de question figée incohérente.',
      ),
    );
  }
  if (issues.length) return invalid(...issues);
  const snapshot = {
    id: value.id,
    questionId: value.questionId,
    questionVersion: value.questionVersion,
    sessionId: value.sessionId,
    ordinal: value.ordinal,
    frozenQuestion: value.frozenQuestion,
    parameterValues: Object.fromEntries(
      Object.entries(
        value.parameterValues as Record<string, ParameterPrimitive>,
      ),
    ),
    seed: value.seed,
    createdAt: value.createdAt,
  };
  try {
    return valid(
      deepFreeze(structuredClone(snapshot)) as unknown as QuestionInstance,
    );
  } catch {
    return invalid(
      issue('instance.snapshot', 'Impossible de figer cette instance.'),
    );
  }
}
