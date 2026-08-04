import { parseMathSource } from '../math/MathParser';
import type { Question, SafeExpressionNode } from './Question';

export const RESERVED_PARAMETER_NAMES = Object.freeze([
  'sqrt',
  'abs',
  'vec',
  'sin',
  'cos',
  'tan',
  'ln',
  'exp',
] as const);
const reserved = new Set<string>(RESERVED_PARAMETER_NAMES);
export type ParameterReference = Readonly<{
  name: string;
  start: number;
  end: number;
}>;
export type ReferenceDiagnostic = Readonly<{
  path: string;
  code:
    | 'malformed-reference'
    | 'reserved-reference'
    | 'unknown-reference'
    | 'invalid-math';
  message: string;
}>;

export function scanParameterReferences(value: unknown): Readonly<{
  references: readonly ParameterReference[];
  diagnostics: readonly ReferenceDiagnostic[];
}> {
  if (typeof value !== 'string')
    return {
      references: [],
      diagnostics: [
        { path: '', code: 'malformed-reference', message: 'Texte invalide.' },
      ],
    };
  const references: ParameterReference[] = [];
  const diagnostics: ReferenceDiagnostic[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '@') continue;
    const start = index;
    const first = value[index + 1];
    if (!first || !/[A-Za-z]/.test(first)) {
      diagnostics.push({
        path: '',
        code: 'malformed-reference',
        message: `Référence mal formée à la position ${start}.`,
      });
      continue;
    }
    index += 2;
    while (index < value.length && /[A-Za-z0-9_]/.test(value[index] as string))
      index += 1;
    const name = value.slice(start + 1, index);
    const reference = { name, start, end: index };
    references.push(reference);
    if (reserved.has(name))
      diagnostics.push({
        path: '',
        code: 'reserved-reference',
        message: `Le nom @${name} est réservé.`,
      });
    index -= 1;
  }
  return {
    references: Object.freeze(references),
    diagnostics: Object.freeze(diagnostics),
  };
}

function constraintReferences(
  node: SafeExpressionNode,
  found: Set<string>,
): void {
  if (node.kind === 'variable') {
    found.add(node.variableId);
    return;
  }
  if (node.kind === 'unary' || node.kind === 'logical-not')
    return constraintReferences(node.operand, found);
  if (node.kind === 'binary' || node.kind === 'comparison') {
    constraintReferences(node.left, found);
    constraintReferences(node.right, found);
    return;
  }
  if (node.kind === 'math-function')
    node.arguments.forEach((entry) => constraintReferences(entry, found));
  if (node.kind === 'logical')
    node.operands.forEach((entry) => constraintReferences(entry, found));
}

export type QuestionReferenceAnalysis = Readonly<{
  usedReferences: readonly string[];
  unknownReferences: readonly string[];
  unusedVariables: readonly string[];
  diagnostics: readonly ReferenceDiagnostic[];
}>;

export function analyzeQuestionParameterReferences(
  value: unknown,
): QuestionReferenceAnalysis {
  const empty: QuestionReferenceAnalysis = {
    usedReferences: [],
    unknownReferences: [],
    unusedVariables: [],
    diagnostics: [
      {
        path: 'question',
        code: 'malformed-reference',
        message: 'Question invalide.',
      },
    ],
  };
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return empty;
    const question = value as Question;
    const definitions = new Set(
      question.parameterization?.variables.map((entry) => entry.id) ?? [],
    );
    const used = new Set<string>();
    const diagnostics: ReferenceDiagnostic[] = [];
    const addText = (text: string, path: string) => {
      const result = scanParameterReferences(text);
      result.references.forEach((entry) => {
        used.add(entry.name);
        if (!definitions.has(entry.name))
          diagnostics.push({
            path,
            code: 'unknown-reference',
            message: `Référence inconnue : @${entry.name}.`,
          });
      });
      diagnostics.push(
        ...result.diagnostics.map((entry) => ({ ...entry, path })),
      );
    };
    const addSegments = (segments: Question['prompt'], path: string) =>
      segments.forEach((segment, index) => {
        const segmentPath = `${path}.${index}`;
        if (segment.kind === 'text')
          addText(segment.value, `${segmentPath}.value`);
        else if (
          segment.kind === 'inline-math' ||
          segment.kind === 'display-math'
        ) {
          const parsed = parseMathSource(segment.math);
          if (parsed.ok)
            parsed.parameterReferences.forEach((entry) => {
              used.add(entry);
              if (!definitions.has(entry))
                diagnostics.push({
                  path: `${segmentPath}.math`,
                  code: 'unknown-reference',
                  message: `Référence inconnue : @${entry}.`,
                });
            });
          else
            diagnostics.push({
              path: `${segmentPath}.math`,
              code: 'invalid-math',
              message: parsed.errors[0]?.message ?? 'Formule invalide.',
            });
        }
      });
    addSegments(question.prompt, 'prompt');
    addSegments(question.hint, 'hint');
    question.correction.forEach((step, index) => {
      if (step.title !== null) addText(step.title, `correction.${index}.title`);
      addSegments(step.content, `correction.${index}.content`);
    });
    question.parameterization?.constraints.forEach((entry, index) => {
      const local = new Set<string>();
      constraintReferences(entry, local);
      local.forEach((name) => {
        used.add(name);
        if (!definitions.has(name))
          diagnostics.push({
            path: `parameterization.constraints.${index}`,
            code: 'unknown-reference',
            message: `Référence inconnue : @${name}.`,
          });
      });
    });
    const unknown = [...used].filter((entry) => !definitions.has(entry));
    return Object.freeze({
      usedReferences: Object.freeze([...used]),
      unknownReferences: Object.freeze(unknown),
      unusedVariables: Object.freeze(
        [...definitions].filter((entry) => !used.has(entry)),
      ),
      diagnostics: Object.freeze(diagnostics),
    });
  } catch {
    return empty;
  }
}
