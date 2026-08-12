import type { ParameterizedQuestionSpec } from '../../src/domain/questions/Question.ts';

export const SUPPORTED_SCHEMA_VERSIONS: readonly string[];

export function parseParameterSpecification(row: {
  readonly Calcul_ID: string;
  readonly Type_base: string;
  readonly Parametres_JSON: string;
}): Readonly<{
  sourceSchemaVersion: string;
  sourceSpecification: unknown;
  parameterization: ParameterizedQuestionSpec | null;
}>;

export function parameterIds(
  parameterization: ParameterizedQuestionSpec | null,
): string[];
