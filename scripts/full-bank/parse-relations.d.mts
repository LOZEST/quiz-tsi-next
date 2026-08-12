import type {
  ParameterPrimitive,
  SafeExpressionNode,
} from '../../src/domain/questions/Question.ts';

export function parseSourceExpression(
  source: ParameterPrimitive,
  context?: string,
): SafeExpressionNode;

export function parseRelations(
  specification: Record<string, unknown>,
  calculId: string,
): SafeExpressionNode[];

export const supportedRelationOperators: readonly string[];
