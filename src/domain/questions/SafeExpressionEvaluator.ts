import type { ParameterPrimitive, SafeExpressionNode } from './Question';

export type SafeExpressionEvaluation =
  | Readonly<{ ok: true; value: ParameterPrimitive }>
  | Readonly<{
      ok: false;
      code:
        | 'invalid-expression'
        | 'missing-variable'
        | 'invalid-type'
        | 'invalid-operation';
      message: string;
    }>;
const error = (
  code:
    | 'invalid-expression'
    | 'missing-variable'
    | 'invalid-type'
    | 'invalid-operation',
  message: string,
): SafeExpressionEvaluation => ({ ok: false, code, message });
const finite = (value: ParameterPrimitive): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function evaluateSafeExpression(
  node: unknown,
  parameterValues: unknown,
): SafeExpressionEvaluation {
  try {
    if (
      typeof parameterValues !== 'object' ||
      parameterValues === null ||
      Array.isArray(parameterValues)
    )
      return error('invalid-expression', 'Table de paramètres invalide.');
    const values = parameterValues as Record<string, ParameterPrimitive>;
    const evaluate = (
      candidate: SafeExpressionNode,
    ): SafeExpressionEvaluation => {
      if (candidate.kind === 'literal')
        return { ok: true, value: candidate.value };
      if (candidate.kind === 'variable')
        return Object.hasOwn(values, candidate.variableId)
          ? {
              ok: true,
              value: values[candidate.variableId] as ParameterPrimitive,
            }
          : error(
              'missing-variable',
              `Variable absente : ${candidate.variableId}.`,
            );
      if (candidate.kind === 'unary') {
        const operand = evaluate(candidate.operand);
        if (!operand.ok) return operand;
        if (!finite(operand.value))
          return error('invalid-type', 'Un nombre fini est requis.');
        const result =
          candidate.operator === 'negate'
            ? -operand.value
            : Math.abs(operand.value);
        return Number.isFinite(result)
          ? { ok: true, value: Object.is(result, -0) ? 0 : result }
          : error('invalid-operation', 'Résultat numérique invalide.');
      }
      if (candidate.kind === 'binary' || candidate.kind === 'comparison') {
        const left = evaluate(candidate.left);
        if (!left.ok) return left;
        const right = evaluate(candidate.right);
        if (!right.ok) return right;
        if (candidate.kind === 'comparison') {
          if (candidate.operator === 'equal')
            return {
              ok: true,
              value:
                typeof left.value === typeof right.value &&
                left.value === right.value,
            };
          if (candidate.operator === 'not-equal')
            return {
              ok: true,
              value:
                typeof left.value !== typeof right.value ||
                left.value !== right.value,
            };
          if (!finite(left.value) || !finite(right.value))
            return error(
              'invalid-type',
              'Une comparaison ordonnée exige deux nombres finis.',
            );
          const compared =
            candidate.operator === 'less-than'
              ? left.value < right.value
              : candidate.operator === 'less-than-or-equal'
                ? left.value <= right.value
                : candidate.operator === 'greater-than'
                  ? left.value > right.value
                  : left.value >= right.value;
          return { ok: true, value: compared };
        }
        if (!finite(left.value) || !finite(right.value))
          return error('invalid-type', 'Deux nombres finis sont requis.');
        if (
          (candidate.operator === 'divide' ||
            candidate.operator === 'modulo') &&
          right.value === 0
        )
          return error('invalid-operation', 'Division ou modulo par zéro.');
        const result =
          candidate.operator === 'add'
            ? left.value + right.value
            : candidate.operator === 'subtract'
              ? left.value - right.value
              : candidate.operator === 'multiply'
                ? left.value * right.value
                : candidate.operator === 'divide'
                  ? left.value / right.value
                  : candidate.operator === 'modulo'
                    ? left.value % right.value
                    : left.value ** right.value;
        return Number.isFinite(result)
          ? { ok: true, value: Object.is(result, -0) ? 0 : result }
          : error(
              'invalid-operation',
              'Résultat numérique non réel ou non fini.',
            );
      }
      if (candidate.kind === 'math-function') {
        const results = candidate.arguments.map(evaluate);
        const failed = results.find((entry) => !entry.ok);
        if (failed && !failed.ok) return failed;
        const numbers = results.map((entry) => (entry.ok ? entry.value : 0));
        const numericValues = numbers.filter(finite);
        if (numericValues.length !== numbers.length)
          return error('invalid-type', 'La fonction exige des nombres finis.');
        if (candidate.function === 'sqrt' && (numbers[0] as number) < 0)
          return error(
            'invalid-operation',
            'La racine carrée exige un nombre positif ou nul.',
          );
        const fn =
          candidate.function === 'abs'
            ? Math.abs
            : candidate.function === 'sqrt'
              ? Math.sqrt
              : candidate.function === 'round'
                ? Math.round
                : candidate.function === 'floor'
                  ? Math.floor
                  : candidate.function === 'ceil'
                    ? Math.ceil
                    : candidate.function === 'min'
                      ? Math.min
                      : Math.max;
        const result = fn(...numericValues);
        return Number.isFinite(result)
          ? { ok: true, value: Object.is(result, -0) ? 0 : result }
          : error('invalid-operation', 'Résultat de fonction invalide.');
      }
      if (candidate.kind === 'logical') {
        const results = candidate.operands.map(evaluate);
        const failed = results.find((entry) => !entry.ok);
        if (failed && !failed.ok) return failed;
        const booleans = results.map((entry) =>
          entry.ok ? entry.value : false,
        );
        if (!booleans.every((entry) => typeof entry === 'boolean'))
          return error('invalid-type', 'La logique exige des booléens.');
        return {
          ok: true,
          value:
            candidate.operator === 'and'
              ? booleans.every(Boolean)
              : booleans.some(Boolean),
        };
      }
      if (candidate.kind === 'logical-not') {
        const operand = evaluate(candidate.operand);
        return !operand.ok
          ? operand
          : typeof operand.value === 'boolean'
            ? { ok: true, value: !operand.value }
            : error('invalid-type', 'La négation logique exige un booléen.');
      }
      return error('invalid-expression', 'Type de nœud inconnu.');
    };
    if (typeof node !== 'object' || node === null)
      return error('invalid-expression', 'Expression invalide.');
    return evaluate(node as SafeExpressionNode);
  } catch {
    return error('invalid-expression', 'Expression inaccessible.');
  }
}
