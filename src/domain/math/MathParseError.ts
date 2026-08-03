export interface MathParseError {
  readonly code: string;
  readonly message: string;
  readonly sourceStart: number | null;
  readonly sourceEnd: number | null;
  readonly correctionExample: string | null;
}

export function mathParseError(
  code: string,
  message: string,
  sourceStart: number | null,
  sourceEnd: number | null,
  correctionExample: string | null = null,
): MathParseError {
  return { code, message, sourceStart, sourceEnd, correctionExample };
}
