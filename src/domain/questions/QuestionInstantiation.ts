import type { MathAstNode } from '../math/MathAst';
import { parseMathSource } from '../math/MathParser';
import type { MathSource } from '../math/MathSource';
import type { ContentSegment, ParameterPrimitive, Question } from './Question';
import { scanParameterReferences } from './ParameterReferenceScanner';

export type ResolvedMathAstNode = Readonly<
  Record<string, unknown> & { kind: string }
>;
export type InstantiatedContentSegment =
  | Readonly<{ kind: 'text'; value: string }>
  | Readonly<{
      kind: 'inline-math' | 'display-math';
      mathSource: MathSource;
      ast: ResolvedMathAstNode;
    }>
  | Readonly<{ kind: 'line-break' }>;
export type InstantiatedQuestion = Readonly<{
  questionId: string;
  questionVersion: number;
  parameterValues: Readonly<Record<string, ParameterPrimitive>>;
  prompt: readonly InstantiatedContentSegment[];
  hint: readonly InstantiatedContentSegment[];
  correction: readonly Readonly<{
    id: string;
    title: string | null;
    content: readonly InstantiatedContentSegment[];
  }>[];
}>;
export type QuestionInstantiationResult =
  | Readonly<{ ok: true; value: InstantiatedQuestion }>
  | Readonly<{ ok: false; path: string; message: string }>;

const format = (value: ParameterPrimitive): string =>
  typeof value === 'boolean'
    ? value
      ? 'true'
      : 'false'
    : typeof value === 'number' && Object.is(value, -0)
      ? '0'
      : String(value);
function replaceText(
  source: string,
  values: Readonly<Record<string, ParameterPrimitive>>,
):
  | (QuestionInstantiationResult & { value?: never })
  | { ok: true; value: string } {
  const scanned = scanParameterReferences(source);
  if (scanned.diagnostics.length > 0)
    return {
      ok: false,
      path: '',
      message: scanned.diagnostics[0]?.message ?? 'Référence invalide.',
    };
  let result = '';
  let cursor = 0;
  for (const reference of scanned.references) {
    if (!Object.hasOwn(values, reference.name))
      return {
        ok: false,
        path: '',
        message: `Référence inconnue : @${reference.name}.`,
      };
    result +=
      source.slice(cursor, reference.start) +
      format(values[reference.name] as ParameterPrimitive);
    cursor = reference.end;
  }
  return { ok: true, value: result + source.slice(cursor) };
}
function resolveAst(
  node: MathAstNode,
  values: Readonly<Record<string, ParameterPrimitive>>,
): ResolvedMathAstNode {
  if (node.kind === 'parameter')
    return Object.freeze({
      kind: 'resolved-parameter',
      name: node.name,
      value: values[node.name] as ParameterPrimitive,
    });
  if (node.kind === 'unary')
    return Object.freeze({
      ...node,
      operand: resolveAst(node.operand, values),
    });
  if (
    node.kind === 'binary' ||
    node.kind === 'comparison' ||
    node.kind === 'relation'
  )
    return Object.freeze({
      ...node,
      left: resolveAst(node.left, values),
      right: resolveAst(node.right, values),
    }) as ResolvedMathAstNode;
  if (node.kind === 'power')
    return Object.freeze({
      ...node,
      base: resolveAst(node.base, values),
      exponent: resolveAst(node.exponent, values),
    }) as ResolvedMathAstNode;
  if (node.kind === 'subscript')
    return Object.freeze({
      ...node,
      base: resolveAst(node.base, values),
      subscript: resolveAst(node.subscript, values),
    }) as ResolvedMathAstNode;
  if (node.kind === 'function')
    return Object.freeze({
      ...node,
      argument: resolveAst(node.argument, values),
    }) as ResolvedMathAstNode;
  if (node.kind === 'interval')
    return Object.freeze({
      ...node,
      lower: resolveAst(node.lower, values),
      upper: resolveAst(node.upper, values),
    }) as ResolvedMathAstNode;
  if (node.kind === 'bounded-operator')
    return Object.freeze({
      ...node,
      lower: node.lower && resolveAst(node.lower, values),
      upper: node.upper && resolveAst(node.upper, values),
    }) as ResolvedMathAstNode;
  return Object.freeze({ ...node }) as ResolvedMathAstNode;
}
function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value))
    return value;
  Object.values(value).forEach((entry) => deepFreeze(entry));
  return Object.freeze(value);
}

export function instantiateQuestionVariant(
  questionValue: unknown,
  parameterValuesValue: unknown,
): QuestionInstantiationResult {
  try {
    if (
      typeof questionValue !== 'object' ||
      questionValue === null ||
      typeof parameterValuesValue !== 'object' ||
      parameterValuesValue === null ||
      Array.isArray(parameterValuesValue)
    )
      return {
        ok: false,
        path: 'question',
        message: 'Question ou paramètres invalides.',
      };
    const question = questionValue as Question;
    const rawValues = parameterValuesValue as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(rawValues) as unknown;
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      Object.getOwnPropertySymbols(rawValues).length > 0 ||
      !Object.values(rawValues).every(
        (entry) =>
          typeof entry === 'string' ||
          typeof entry === 'boolean' ||
          (typeof entry === 'number' && Number.isFinite(entry)),
      )
    )
      return {
        ok: false,
        path: 'parameterValues',
        message: 'Table de paramètres invalide.',
      };
    const values = {
      ...(parameterValuesValue as Record<string, ParameterPrimitive>),
    };
    type SegmentResult =
      | Readonly<{ ok: true; value: InstantiatedContentSegment[] }>
      | Readonly<{ ok: false; path: string; message: string }>;
    const instantiateSegments = (
      segments: readonly ContentSegment[],
      path: string,
    ): SegmentResult => {
      const result: InstantiatedContentSegment[] = [];
      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index] as ContentSegment;
        if (segment.kind === 'line-break') result.push({ kind: 'line-break' });
        else if (segment.kind === 'text') {
          const replaced = replaceText(segment.value, values);
          if (!replaced.ok)
            return { ...replaced, path: `${path}.${index}.value` };
          result.push({ kind: 'text', value: replaced.value });
        } else {
          const parsed = parseMathSource(segment.math);
          if (!parsed.ok)
            return {
              ok: false,
              path: `${path}.${index}.math`,
              message: parsed.errors[0]?.message ?? 'Formule invalide.',
            };
          if (
            parsed.parameterReferences.some(
              (name) => !Object.hasOwn(values, name),
            )
          )
            return {
              ok: false,
              path: `${path}.${index}.math`,
              message: 'Référence mathématique inconnue.',
            };
          result.push({
            kind: segment.kind,
            mathSource: structuredClone(segment.math),
            ast: resolveAst(parsed.ast, values),
          });
        }
      }
      return { ok: true, value: result };
    };
    const prompt = instantiateSegments(question.prompt, 'prompt');
    if (!prompt.ok) return prompt;
    const hint = instantiateSegments(question.hint, 'hint');
    if (!hint.ok) return hint;
    const correction: Array<{
      id: string;
      title: string | null;
      content: readonly InstantiatedContentSegment[];
    }> = [];
    for (let index = 0; index < question.correction.length; index += 1) {
      const step = question.correction[index] as Question['correction'][number];
      const title =
        step.title === null
          ? { ok: true as const, value: null }
          : replaceText(step.title, values);
      if (!title.ok) return { ...title, path: `correction.${index}.title` };
      const content = instantiateSegments(
        step.content,
        `correction.${index}.content`,
      );
      if (!content.ok) return content;
      correction.push({
        id: step.id,
        title: title.value,
        content: content.value,
      });
    }
    return {
      ok: true,
      value: deepFreeze({
        questionId: question.id,
        questionVersion: question.version,
        parameterValues: Object.freeze(values),
        prompt: prompt.value,
        hint: hint.value,
        correction,
      }) as InstantiatedQuestion,
    };
  } catch {
    return { ok: false, path: 'question', message: 'Question inaccessible.' };
  }
}
