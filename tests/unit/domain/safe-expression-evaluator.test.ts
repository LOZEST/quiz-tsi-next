import { describe, expect, it } from 'vitest';
import { evaluateSafeExpression } from '../../../src/domain/questions/SafeExpressionEvaluator';
import {
  SAFE_EXPRESSION_MAX_DEPTH,
  SAFE_EXPRESSION_MAX_NODES,
  type SafeExpressionNode,
} from '../../../src/domain/questions/Question';
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
  it.each([{}, null, [], Number.NaN, Number.POSITIVE_INFINITY])(
    'refuse le littéral hostile %j',
    (value) =>
      expect(
        evaluateSafeExpression({ kind: 'literal', value }, {}),
      ).toMatchObject({ ok: false, code: 'invalid-expression' }),
  );
  it.each([
    { kind: 'unary', operator: 'future', operand: literal(1) },
    { kind: 'binary', operator: 'future', left: literal(1), right: literal(2) },
    {
      kind: 'comparison',
      operator: 'future',
      left: literal(1),
      right: literal(2),
    },
    { kind: 'math-function', function: 'future', arguments: [literal(1)] },
    {
      kind: 'logical',
      operator: 'future',
      operands: [literal(true), literal(false)],
    },
  ])('refuse opérateur ou fonction inconnu', (node) =>
    expect(evaluateSafeExpression(node, {})).toMatchObject({
      ok: false,
      code: 'invalid-expression',
    }),
  );
  it.each([
    ['abs', []],
    ['sqrt', [literal(1), literal(2)]],
    ['round', []],
    ['floor', []],
    ['ceil', []],
    ['min', [literal(1)]],
    ['max', [literal(1)]],
  ])('refuse arité invalide pour %s', (fn, arguments_) =>
    expect(
      evaluateSafeExpression(
        { kind: 'math-function', function: fn, arguments: arguments_ },
        {},
      ),
    ).toMatchObject({ ok: false, code: 'invalid-expression' }),
  );
  it('applique les limites de profondeur et de nœuds', () => {
    let deep: unknown = literal(true);
    for (let index = 0; index <= SAFE_EXPRESSION_MAX_DEPTH; index += 1)
      deep = { kind: 'logical-not', operand: deep };
    expect(evaluateSafeExpression(deep, {})).toMatchObject({ ok: false });
    const balanced = (depth: number): unknown =>
      depth === 0
        ? literal(1)
        : {
            kind: 'binary',
            operator: 'add',
            left: balanced(depth - 1),
            right: balanced(depth - 1),
          };
    expect(
      evaluateSafeExpression(
        balanced(Math.ceil(Math.log2(SAFE_EXPRESSION_MAX_NODES))),
        {},
      ),
    ).toMatchObject({ ok: false });
  });
  it('refuse les tables non simples, symboliques, non primitives et hostiles', () => {
    const expression = { kind: 'variable', variableId: 'a' };
    expect(evaluateSafeExpression(expression, { a: {} })).toMatchObject({
      ok: false,
    });
    expect(
      evaluateSafeExpression(expression, Object.create({ a: 1 })),
    ).toMatchObject({ ok: false });
    expect(
      evaluateSafeExpression(expression, { [Symbol('a')]: 1 }),
    ).toMatchObject({ ok: false });
    const getter = Object.defineProperty({}, 'a', {
      get() {
        throw new Error('secret');
      },
    });
    expect(() => evaluateSafeExpression(expression, getter)).not.toThrow();
    const proxy = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('secret');
        },
      },
    );
    expect(() => evaluateSafeExpression(expression, proxy)).not.toThrow();
  });
});
