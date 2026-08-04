import type { ParameterPrimitive, ParameterizedQuestionSpec } from './Question';
import { validateParameterizedQuestionSpec } from './Question';
import { evaluateSafeExpression } from './SafeExpressionEvaluator';
import { createSeededRandom } from './SeededRandom';
import {
  buildCanonicalVariableDomain,
  MAX_PARAMETER_VARIABLES,
} from './VariableDomain';

export const MAX_EXHAUSTIVE_COMBINATIONS = 100_000;
export const MAX_DETERMINISTIC_SEARCH_ATTEMPTS = 20_000;
export const MAX_REQUESTED_PARAMETER_VARIANTS = 1_000;

export type ParameterValues = Readonly<Record<string, ParameterPrimitive>>;
export type SearchStatistics = Readonly<{
  totalCombinations: number;
  examinedCombinations: number;
  validCombinations: number;
  searchMode: 'exhaustive-capable' | 'bounded';
  searchCompleted: boolean;
  exhaustive: boolean;
}>;
export type ParameterGenerationResult =
  | Readonly<{
      kind: 'ready';
      variants: readonly ParameterValues[];
      statistics: SearchStatistics;
      evaluationDiagnostics: readonly string[];
    }>
  | Readonly<{
      kind:
        | 'invalid-question'
        | 'impossible'
        | 'insufficient-distinct-variants'
        | 'search-limit-exceeded'
        | 'invalid-evaluation';
      variants: readonly ParameterValues[];
      statistics: SearchStatistics;
      diagnostics: readonly string[];
    }>;

const canonicalValue = (value: ParameterPrimitive) =>
  typeof value === 'number'
    ? `n:${Object.is(value, -0) ? 0 : value}`
    : typeof value === 'string'
      ? `s:${JSON.stringify(value)}`
      : `b:${value}`;
export const serializeParameterValues = (
  values: ParameterValues,
  ids: readonly string[],
): string =>
  ids
    .map(
      (id) =>
        `${JSON.stringify(id)}=${canonicalValue(values[id] as ParameterPrimitive)}`,
    )
    .join('|');
const freezeValues = (
  value: Record<string, ParameterPrimitive>,
): ParameterValues => Object.freeze({ ...value });

export function generateParameterVariants(
  spec: unknown,
  seed: unknown,
  requestedCount: unknown,
): ParameterGenerationResult {
  const zero = {
    totalCombinations: 0,
    examinedCombinations: 0,
    validCombinations: 0,
    searchMode: 'bounded' as const,
    searchCompleted: false,
    exhaustive: false,
  };
  try {
    if (
      typeof spec !== 'object' ||
      spec === null ||
      Array.isArray(spec) ||
      typeof seed !== 'string' ||
      seed.length === 0 ||
      !Number.isInteger(requestedCount) ||
      (requestedCount as number) < 1 ||
      (requestedCount as number) > MAX_REQUESTED_PARAMETER_VARIANTS
    )
      return {
        kind: 'invalid-question',
        variants: [],
        statistics: zero,
        diagnostics: ['Paramétrisation, seed ou quantité invalide.'],
      };
    const validatedSpec = validateParameterizedQuestionSpec(spec);
    if (!validatedSpec.ok)
      return {
        kind: 'invalid-question',
        variants: [],
        statistics: zero,
        diagnostics: validatedSpec.issues.map((entry) => entry.message),
      };
    const typed: ParameterizedQuestionSpec = validatedSpec.value;
    if (typed.variables.length > MAX_PARAMETER_VARIABLES)
      return {
        kind: 'invalid-question',
        variants: [],
        statistics: zero,
        diagnostics: ['Le nombre de variables dépasse la limite technique.'],
      };
    const variables = typed.variables;
    const ids: string[] = [];
    for (const entry of variables) {
      if (typeof entry.id !== 'string' || entry.id.length === 0)
        return {
          kind: 'invalid-question',
          variants: [],
          statistics: zero,
          diagnostics: ['Identifiant de variable invalide.'],
        };
      ids.push(entry.id);
    }
    if (new Set(ids).size !== ids.length)
      return {
        kind: 'invalid-question',
        variants: [],
        statistics: zero,
        diagnostics: ['Identifiants de variables dupliqués.'],
      };
    const domains: ParameterPrimitive[][] = [];
    let total = 1;
    for (const variable of variables) {
      const built = buildCanonicalVariableDomain(variable);
      if (!built.ok)
        return {
          kind: 'invalid-question',
          variants: [],
          statistics: zero,
          diagnostics: [built.message],
        };
      domains.push([...built.values]);
      total *= built.values.length;
      if (!Number.isSafeInteger(total)) total = Number.MAX_SAFE_INTEGER;
    }
    const random = createSeededRandom(seed);
    if (!random)
      return {
        kind: 'invalid-question',
        variants: [],
        statistics: zero,
        diagnostics: ['Seed invalide.'],
      };
    const exhaustiveCapable = total <= MAX_EXHAUSTIVE_COMBINATIONS;
    const attempts = exhaustiveCapable
      ? total
      : Math.min(MAX_DETERMINISTIC_SEARCH_ATTEMPTS, total);
    const order = exhaustiveCapable
      ? Array.from({ length: total }, (_, index) => index)
      : [];
    for (let index = order.length - 1; index > 0; index -= 1) {
      const other = random.nextInteger(index + 1);
      [order[index], order[other]] = [
        order[other] as number,
        order[index] as number,
      ];
    }
    const variants: ParameterValues[] = [];
    const seen = new Set<string>();
    const evaluationDiagnostics: string[] = [];
    let validCombinations = 0;
    let examinedCombinations = 0;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      examinedCombinations += 1;
      const values: Record<string, ParameterPrimitive> = {};
      let cursor = exhaustiveCapable ? (order[attempt] as number) : 0;
      for (let index = 0; index < ids.length; index += 1) {
        const domain = domains[index] as readonly ParameterPrimitive[];
        const selected = exhaustiveCapable
          ? cursor % domain.length
          : random.nextInteger(domain.length);
        values[ids[index] as string] = domain[selected] as ParameterPrimitive;
        if (exhaustiveCapable) cursor = Math.floor(cursor / domain.length);
      }
      let valid = true;
      for (let index = 0; index < typed.constraints.length; index += 1) {
        const result = evaluateSafeExpression(typed.constraints[index], values);
        if (!result.ok || result.value !== true) {
          valid = false;
          if (!result.ok)
            evaluationDiagnostics.push(
              `parameterization.constraints.${index}: ${result.message}`,
            );
          break;
        }
      }
      if (!valid) continue;
      validCombinations += 1;
      const key = serializeParameterValues(values, ids);
      if (!seen.has(key)) {
        seen.add(key);
        variants.push(freezeValues(values));
        if (variants.length === requestedCount) break;
      }
    }
    const searchCompleted = examinedCombinations === total;
    const statistics = Object.freeze({
      totalCombinations: total,
      examinedCombinations,
      validCombinations,
      searchMode: exhaustiveCapable ? 'exhaustive-capable' : 'bounded',
      searchCompleted,
      exhaustive: searchCompleted,
    });
    if (variants.length === requestedCount)
      return Object.freeze({
        kind: 'ready',
        variants: Object.freeze(variants),
        statistics,
        evaluationDiagnostics: Object.freeze([
          ...new Set(evaluationDiagnostics),
        ]),
      });
    if (!exhaustiveCapable)
      return {
        kind: 'search-limit-exceeded',
        variants: Object.freeze(variants),
        statistics,
        diagnostics: Object.freeze([
          ...new Set(evaluationDiagnostics),
          'La limite de recherche a été atteinte sans conclusion exhaustive.',
        ]),
      };
    if (validCombinations === 0)
      return {
        kind:
          evaluationDiagnostics.length > 0
            ? 'invalid-evaluation'
            : 'impossible',
        variants: [],
        statistics,
        diagnostics: Object.freeze([
          ...new Set(evaluationDiagnostics),
          'Aucune combinaison ne respecte toutes les règles.',
        ]),
      };
    return {
      kind: 'insufficient-distinct-variants',
      variants: Object.freeze(variants),
      statistics,
      diagnostics: [
        `Seulement ${variants.length} variante(s) distincte(s) existent.`,
      ],
    };
  } catch {
    return {
      kind: 'invalid-question',
      variants: [],
      statistics: zero,
      diagnostics: ['Paramétrisation inaccessible.'],
    };
  }
}

export function generateParameterAssignment(
  spec: unknown,
  seed: unknown,
): ParameterGenerationResult {
  return generateParameterVariants(spec, seed, 1);
}
