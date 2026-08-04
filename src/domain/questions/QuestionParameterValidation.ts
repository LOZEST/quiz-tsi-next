import { validateQuestion, type Question } from './Question';
import { analyzeQuestionParameterReferences } from './ParameterReferenceScanner';
import {
  generateParameterVariants,
  type ParameterGenerationResult,
  type ParameterValues,
} from './ParameterizedQuestionGenerator';
import {
  instantiateQuestionVariant,
  type InstantiatedQuestion,
} from './QuestionInstantiation';

export type ParameterizedQuestionValidation = Readonly<{
  kind:
    | 'ready'
    | 'invalid-question'
    | 'invalid-reference'
    | 'impossible'
    | 'insufficient-distinct-variants'
    | 'search-limit-exceeded'
    | 'invalid-evaluation';
  errors: readonly Readonly<{ path: string; message: string }>[];
  warnings: readonly Readonly<{ path: string; message: string }>[];
  variants: readonly Readonly<{
    parameterValues: ParameterValues;
    content: InstantiatedQuestion;
  }>[];
  usedReferences: readonly string[];
  unusedVariables: readonly string[];
  statistics: ParameterGenerationResult['statistics'];
}>;

function deepFreezeOwned<T>(value: T): Readonly<T> {
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
    if (!Object.isFrozen(current)) Object.freeze(current);
  }
  return value;
}

export function validateParameterizedQuestion(
  value: unknown,
  validationSeed: unknown,
): ParameterizedQuestionValidation {
  const structural = validateQuestion(value);
  const zero = {
    totalCombinations: 0,
    examinedCombinations: 0,
    validCombinations: 0,
    searchMode: 'bounded' as const,
    searchCompleted: false,
    exhaustive: false,
  };
  if (!structural.ok)
    return {
      kind: 'invalid-question',
      errors: structural.issues,
      warnings: [],
      variants: [],
      usedReferences: [],
      unusedVariables: [],
      statistics: zero,
    };
  const question: Question = structural.value;
  if (typeof validationSeed !== 'string' || validationSeed.length === 0)
    return {
      kind: 'invalid-question',
      errors: [
        { path: 'validationSeed', message: 'Seed de validation requise.' },
      ],
      warnings: [],
      variants: [],
      usedReferences: [],
      unusedVariables: [],
      statistics: zero,
    };
  const references = analyzeQuestionParameterReferences(question);
  if (references.diagnostics.length > 0)
    return {
      kind: 'invalid-reference',
      errors: references.diagnostics.map((entry) => ({
        path: entry.path,
        message: entry.message,
      })),
      warnings: references.unusedVariables.map((name) => ({
        path: 'parameterization.variables',
        message: `Variable inutilisée : ${name}.`,
      })),
      variants: [],
      usedReferences: references.usedReferences,
      unusedVariables: references.unusedVariables,
      statistics: zero,
    };
  if (question.parameterization === null) {
    const instantiated = instantiateQuestionVariant(question, {});
    const staticResult: ParameterizedQuestionValidation = {
      kind: instantiated.ok ? 'ready' : 'invalid-reference',
      errors: instantiated.ok
        ? []
        : [{ path: instantiated.path, message: instantiated.message }],
      warnings: [],
      variants: instantiated.ok
        ? [{ parameterValues: {}, content: instantiated.value }]
        : [],
      usedReferences: [],
      unusedVariables: [],
      statistics: {
        totalCombinations: 1,
        examinedCombinations: 1,
        validCombinations: 1,
        searchMode: 'exhaustive-capable',
        searchCompleted: true,
        exhaustive: true,
      },
    };
    return instantiated.ok ? deepFreezeOwned(staticResult) : staticResult;
  }
  const requested =
    question.status === 'published'
      ? Math.max(10, question.parameterization.validationVariantCount)
      : Math.max(1, question.parameterization.validationVariantCount);
  const generated = generateParameterVariants(
    question.parameterization,
    validationSeed,
    requested,
  );
  if (generated.kind !== 'ready')
    return {
      kind: generated.kind,
      errors: generated.diagnostics.map((message) => ({
        path: 'parameterization',
        message,
      })),
      warnings: references.unusedVariables.map((name) => ({
        path: 'parameterization.variables',
        message: `Variable inutilisée : ${name}.`,
      })),
      variants: [],
      usedReferences: references.usedReferences,
      unusedVariables: references.unusedVariables,
      statistics: generated.statistics,
    };
  const variants: Array<{
    parameterValues: ParameterValues;
    content: InstantiatedQuestion;
  }> = [];
  for (const parameterValues of generated.variants) {
    const content = instantiateQuestionVariant(question, parameterValues);
    if (!content.ok)
      return {
        kind: 'invalid-reference',
        errors: [{ path: content.path, message: content.message }],
        warnings: [],
        variants: [],
        usedReferences: references.usedReferences,
        unusedVariables: references.unusedVariables,
        statistics: generated.statistics,
      };
    variants.push({ parameterValues, content: content.value });
  }
  return deepFreezeOwned({
    kind: 'ready',
    errors: [],
    warnings: references.unusedVariables.map((name) => ({
      path: 'parameterization.variables',
      message: `Variable inutilisée : ${name}.`,
    })),
    variants,
    usedReferences: [...references.usedReferences],
    unusedVariables: [...references.unusedVariables],
    statistics: generated.statistics,
  } satisfies ParameterizedQuestionValidation);
}
