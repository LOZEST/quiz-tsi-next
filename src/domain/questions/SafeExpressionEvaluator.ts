import {
  validateSafeExpression,
  type ParameterPrimitive,
  type SafeExpressionNode,
} from './Question';

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

const isPrimitive = (value: unknown): value is ParameterPrimitive =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

const finite = (value: ParameterPrimitive): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function copyParameterValues(
  value: unknown,
): Readonly<Record<string, ParameterPrimitive>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null;
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;
  const copy: Record<string, ParameterPrimitive> = {};
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !('value' in descriptor) ||
      !isPrimitive(descriptor.value)
    )
      return null;
    copy[key] = descriptor.value;
  }
  return Object.freeze(copy);
}

function evaluateValidated(
  candidate: SafeExpressionNode,
  values: Readonly<Record<string, ParameterPrimitive>>,
): SafeExpressionEvaluation {
  switch (candidate.kind) {
    case 'literal':
      return isPrimitive(candidate.value)
        ? { ok: true, value: candidate.value }
        : error('invalid-expression', 'Littéral invalide.');
    case 'variable':
      return Object.hasOwn(values, candidate.variableId)
        ? {
            ok: true,
            value: values[candidate.variableId] as ParameterPrimitive,
          }
        : error(
            'missing-variable',
            `Variable absente : ${candidate.variableId}.`,
          );
    case 'unary': {
      const operand = evaluateValidated(candidate.operand, values);
      if (!operand.ok) return operand;
      if (!finite(operand.value))
        return error('invalid-type', 'Un nombre fini est requis.');
      let result: number;
      switch (candidate.operator) {
        case 'negate':
          result = -operand.value;
          break;
        case 'absolute':
          result = Math.abs(operand.value);
          break;
        default:
          return error('invalid-expression', 'Opérateur unaire inconnu.');
      }
      return Number.isFinite(result)
        ? { ok: true, value: Object.is(result, -0) ? 0 : result }
        : error('invalid-operation', 'Résultat numérique invalide.');
    }
    case 'binary': {
      const left = evaluateValidated(candidate.left, values);
      if (!left.ok) return left;
      const right = evaluateValidated(candidate.right, values);
      if (!right.ok) return right;
      if (!finite(left.value) || !finite(right.value))
        return error('invalid-type', 'Deux nombres finis sont requis.');
      let result: number;
      switch (candidate.operator) {
        case 'add':
          result = left.value + right.value;
          break;
        case 'subtract':
          result = left.value - right.value;
          break;
        case 'multiply':
          result = left.value * right.value;
          break;
        case 'divide':
          if (right.value === 0)
            return error('invalid-operation', 'Division par zéro.');
          result = left.value / right.value;
          break;
        case 'modulo':
          if (right.value === 0)
            return error('invalid-operation', 'Modulo par zéro.');
          result = left.value % right.value;
          break;
        case 'power':
          result = left.value ** right.value;
          break;
        default:
          return error('invalid-expression', 'Opérateur binaire inconnu.');
      }
      return Number.isFinite(result)
        ? { ok: true, value: Object.is(result, -0) ? 0 : result }
        : error(
            'invalid-operation',
            'Résultat numérique non réel ou non fini.',
          );
    }
    case 'comparison': {
      const left = evaluateValidated(candidate.left, values);
      if (!left.ok) return left;
      const right = evaluateValidated(candidate.right, values);
      if (!right.ok) return right;
      switch (candidate.operator) {
        case 'equal':
          return {
            ok: true,
            value:
              typeof left.value === typeof right.value &&
              left.value === right.value,
          };
        case 'not-equal':
          return {
            ok: true,
            value:
              typeof left.value !== typeof right.value ||
              left.value !== right.value,
          };
        case 'less-than':
        case 'less-than-or-equal':
        case 'greater-than':
        case 'greater-than-or-equal':
          if (!finite(left.value) || !finite(right.value))
            return error(
              'invalid-type',
              'Une comparaison ordonnée exige deux nombres finis.',
            );
          if (candidate.operator === 'less-than')
            return { ok: true, value: left.value < right.value };
          if (candidate.operator === 'less-than-or-equal')
            return { ok: true, value: left.value <= right.value };
          if (candidate.operator === 'greater-than')
            return { ok: true, value: left.value > right.value };
          return { ok: true, value: left.value >= right.value };
        default:
          return error(
            'invalid-expression',
            'Opérateur de comparaison inconnu.',
          );
      }
    }
    case 'math-function': {
      const results = candidate.arguments.map((entry) =>
        evaluateValidated(entry, values),
      );
      const failed = results.find((entry) => !entry.ok);
      if (failed && !failed.ok) return failed;
      const numbers = results.map((entry) => (entry.ok ? entry.value : false));
      if (!numbers.every(finite))
        return error('invalid-type', 'La fonction exige des nombres finis.');
      let result: number;
      switch (candidate.function) {
        case 'abs':
          result = Math.abs(numbers[0] as number);
          break;
        case 'sqrt':
          if ((numbers[0] as number) < 0)
            return error(
              'invalid-operation',
              'La racine carrée exige un nombre positif ou nul.',
            );
          result = Math.sqrt(numbers[0] as number);
          break;
        case 'round':
          result = Math.round(numbers[0] as number);
          break;
        case 'floor':
          result = Math.floor(numbers[0] as number);
          break;
        case 'ceil':
          result = Math.ceil(numbers[0] as number);
          break;
        case 'min':
          result = Math.min(...numbers);
          break;
        case 'max':
          result = Math.max(...numbers);
          break;
        case 'gcd': {
          let left = Math.abs(numbers[0] as number);
          let right = Math.abs(numbers[1] as number);
          if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right))
            return error(
              'invalid-operation',
              'Le PGCD exige deux entiers sûrs.',
            );
          while (right !== 0) [left, right] = [right, left % right];
          result = left;
          break;
        }
        case 'is-square': {
          const value = numbers[0] as number;
          return {
            ok: true,
            value:
              Number.isSafeInteger(value) &&
              value >= 0 &&
              Number.isInteger(Math.sqrt(value)),
          };
        }
        case 'squarefree': {
          const value = Math.abs(numbers[0] as number);
          if (!Number.isSafeInteger(value))
            return error(
              'invalid-operation',
              'Le test carré libre exige un entier sûr.',
            );
          for (let factor = 2; factor * factor <= value; factor += 1)
            if (value % (factor * factor) === 0)
              return { ok: true, value: false };
          return { ok: true, value: true };
        }
        case 'has-prime-factor-other-than-2-or-5': {
          let value = Math.abs(numbers[0] as number);
          if (!Number.isSafeInteger(value) || value === 0)
            return error(
              'invalid-operation',
              'Le test de facteurs exige un entier sûr non nul.',
            );
          while (value % 2 === 0) value /= 2;
          while (value % 5 === 0) value /= 5;
          return { ok: true, value: value !== 1 };
        }
        default:
          return error('invalid-expression', 'Fonction mathématique inconnue.');
      }
      return Number.isFinite(result)
        ? { ok: true, value: Object.is(result, -0) ? 0 : result }
        : error('invalid-operation', 'Résultat de fonction invalide.');
    }
    case 'logical': {
      const results = candidate.operands.map((entry) =>
        evaluateValidated(entry, values),
      );
      const failed = results.find((entry) => !entry.ok);
      if (failed && !failed.ok) return failed;
      const booleans = results.map((entry) => (entry.ok ? entry.value : 0));
      if (!booleans.every((entry) => typeof entry === 'boolean'))
        return error('invalid-type', 'La logique exige des booléens.');
      switch (candidate.operator) {
        case 'and':
          return { ok: true, value: booleans.every((entry) => entry === true) };
        case 'or':
          return { ok: true, value: booleans.some((entry) => entry === true) };
        default:
          return error('invalid-expression', 'Opérateur logique inconnu.');
      }
    }
    case 'logical-not': {
      const operand = evaluateValidated(candidate.operand, values);
      if (!operand.ok) return operand;
      return typeof operand.value === 'boolean'
        ? { ok: true, value: !operand.value }
        : error('invalid-type', 'La négation logique exige un booléen.');
    }
    default:
      return error('invalid-expression', 'Type de nœud inconnu.');
  }
}

export function evaluateSafeExpression(
  node: unknown,
  parameterValues: unknown,
): SafeExpressionEvaluation {
  try {
    const values = copyParameterValues(parameterValues);
    if (!values)
      return error('invalid-expression', 'Table de paramètres invalide.');
    const validation = validateSafeExpression(node);
    if (!validation.ok)
      return error(
        'invalid-expression',
        validation.issues[0]?.message ?? 'Expression invalide.',
      );
    return evaluateValidated(validation.value, values);
  } catch {
    return error('invalid-expression', 'Expression inaccessible.');
  }
}
