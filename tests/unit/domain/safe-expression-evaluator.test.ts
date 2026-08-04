import { describe, expect, it } from 'vitest';
import { evaluateSafeExpression } from '../../../src/domain/questions/SafeExpressionEvaluator';
import type { SafeExpressionNode } from '../../../src/domain/questions/Question';
const literal = (value: string | number | boolean): SafeExpressionNode => ({
  kind: 'literal',
  value,
});

describe('evaluateSafeExpression', () => {
  it.each([
    ['add', 5],
    ['subtract', -1],
    ['multiply', 6],
    ['divide', 2 / 3],
    ['modulo', 2],
    ['power', 8],
  ] as const)('évalue binary %s', (operator, expected) =>
    expect(
      evaluateSafeExpression(
        { kind: 'binary', operator, left: literal(2), right: literal(3) },
        {},
      ),
    ).toEqual({ ok: true, value: expected }),
  );
  it.each([
    ['equal', false],
    ['not-equal', true],
    ['less-than', true],
    ['less-than-or-equal', true],
    ['greater-than', false],
    ['greater-than-or-equal', false],
  ] as const)('évalue comparison %s strictement', (operator, expected) =>
    expect(
      evaluateSafeExpression(
        { kind: 'comparison', operator, left: literal(2), right: literal(3) },
        {},
      ),
    ).toEqual({ ok: true, value: expected }),
  );
  it.each([
    ['abs', -2, 2],
    ['sqrt', 4, 2],
    ['round', 1.6, 2],
    ['floor', 1.6, 1],
    ['ceil', 1.2, 2],
  ] as const)('évalue %s', (fn, input, expected) =>
    expect(
      evaluateSafeExpression(
        { kind: 'math-function', function: fn, arguments: [literal(input)] },
        {},
      ),
    ).toEqual({ ok: true, value: expected }),
  );
  it('évalue min, max et la logique booléenne', () => {
    expect(
      evaluateSafeExpression(
        {
          kind: 'math-function',
          function: 'min',
          arguments: [literal(3), literal(1)],
        },
        {},
      ),
    ).toEqual({ ok: true, value: 1 });
    expect(
      evaluateSafeExpression(
        {
          kind: 'logical',
          operator: 'and',
          operands: [
            literal(true),
            { kind: 'logical-not', operand: literal(false) },
          ],
        },
        {},
      ),
    ).toEqual({ ok: true, value: true });
  });
  it('évalue variable, negate et absolute', () =>
    expect(
      evaluateSafeExpression(
        {
          kind: 'unary',
          operator: 'absolute',
          operand: {
            kind: 'unary',
            operator: 'negate',
            operand: { kind: 'variable', variableId: 'a' },
          },
        },
        { a: 2 },
      ),
    ).toEqual({ ok: true, value: 2 }));
  it('refuse coercion, variable absente et opérations invalides', () => {
    expect(
      evaluateSafeExpression(
        {
          kind: 'comparison',
          operator: 'less-than',
          left: literal('2'),
          right: literal(3),
        },
        {},
      ),
    ).toMatchObject({ ok: false, code: 'invalid-type' });
    expect(
      evaluateSafeExpression({ kind: 'variable', variableId: 'x' }, {}),
    ).toMatchObject({ ok: false, code: 'missing-variable' });
    expect(
      evaluateSafeExpression(
        {
          kind: 'binary',
          operator: 'divide',
          left: literal(1),
          right: literal(0),
        },
        {},
      ),
    ).toMatchObject({ ok: false });
    expect(
      evaluateSafeExpression(
        { kind: 'math-function', function: 'sqrt', arguments: [literal(-1)] },
        {},
      ),
    ).toMatchObject({ ok: false });
  });
  it('ne modifie pas l AST et absorbe les Proxies hostiles', () => {
    const ast = { kind: 'literal', value: 1 } as const;
    expect(evaluateSafeExpression(ast, {})).toEqual({ ok: true, value: 1 });
    expect(ast).toEqual({ kind: 'literal', value: 1 });
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('stack secret');
        },
      },
    );
    expect(() => evaluateSafeExpression(hostile, {})).not.toThrow();
  });
});
