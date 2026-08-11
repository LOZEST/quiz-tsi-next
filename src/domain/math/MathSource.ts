import {
  invalid,
  issue,
  valid,
  type ValidationResult,
} from '../validation/ValidationResult.ts';

export const MATH_SYNTAX_VERSION = 1 as const;

export interface MathSource {
  readonly syntaxVersion: typeof MATH_SYNTAX_VERSION;
  readonly source: string;
}

export function validateMathSource(
  value: unknown,
): ValidationResult<MathSource> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).syntaxVersion !== MATH_SYNTAX_VERSION ||
    typeof (value as Record<string, unknown>).source !== 'string' ||
    ((value as Record<string, unknown>).source as string).trim() === ''
  ) {
    return invalid(
      issue('math', 'Une source mathématique v1 non vide est requise.'),
    );
  }
  return valid(value as unknown as MathSource);
}
