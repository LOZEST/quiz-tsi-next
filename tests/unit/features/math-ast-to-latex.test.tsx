import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ResolvedMathAstNode } from '@domain/questions/QuestionInstantiation';
import { mathAstToLatex } from '@features/questions/math/MathAstToLatex';
import { KatexMathRenderer } from '@features/questions/math/KatexMathRenderer';
import { QuestionContentRenderer } from '@features/questions/QuestionContentRenderer';

const node = (value: object) => value as ResolvedMathAstNode;

describe('safe math rendering', () => {
  it.each([
    [
      node({
        kind: 'binary',
        operator: 'divide',
        left: { kind: 'identifier', name: 'a' },
        right: { kind: 'identifier', name: 'b' },
      }),
      '\\frac{a}{b}',
    ],
    [
      node({
        kind: 'power',
        base: { kind: 'identifier', name: 'x' },
        exponent: { kind: 'number', value: '2' },
      }),
      '{x}^{2}',
    ],
    [
      node({
        kind: 'subscript',
        base: { kind: 'identifier', name: 'u' },
        subscript: { kind: 'identifier', name: 'n' },
      }),
      '{u}_{n}',
    ],
    [
      node({
        kind: 'function',
        name: 'sqrt',
        argument: { kind: 'identifier', name: 'x' },
      }),
      '\\sqrt{x}',
    ],
    [
      node({
        kind: 'comparison',
        operator: 'less-than-or-equal',
        left: { kind: 'identifier', name: 'x' },
        right: { kind: 'number', value: '2' },
      }),
      '{x}\\le{2}',
    ],
    [
      node({
        kind: 'interval',
        leftClosed: true,
        rightClosed: false,
        lower: { kind: 'number', value: '0' },
        upper: { kind: 'constant', name: 'infinity' },
      }),
      '[0;\\infty[',
    ],
    [
      node({
        kind: 'bounded-operator',
        operator: 'sum',
        lower: { kind: 'identifier', name: 'k' },
        upper: { kind: 'identifier', name: 'n' },
      }),
      '\\sum_{k}^{n}',
    ],
    [node({ kind: 'resolved-parameter', name: 'n', value: 3 }), '3'],
  ])('converts a controlled AST canonically', (ast, expected) => {
    expect(mathAstToLatex(ast)).toBe(expected);
  });

  it('refuses unknown nodes and unresolved parameters', () => {
    expect(() =>
      mathAstToLatex(node({ kind: 'html', value: '<script>' })),
    ).toThrow('Nœud');
    expect(() =>
      mathAstToLatex(node({ kind: 'parameter', name: 'x' })),
    ).toThrow('non résolu');
  });

  it('covers every supported V1 renderer family', () => {
    const id = { kind: 'identifier', name: 'α' };
    const number = { kind: 'number', value: '2' };
    const cases = [
      { kind: 'constant', name: 'real' },
      { kind: 'symbol', symbol: '∇' },
      { kind: 'unary', operator: 'negative', operand: number },
      { kind: 'unary', operator: 'positive', operand: number },
      ...(['add', 'subtract', 'multiply'] as const).map((operator) => ({
        kind: 'binary',
        operator,
        left: id,
        right: number,
      })),
      ...(
        [
          'abs',
          'vec',
          'sin',
          'cos',
          'tan',
          'ln',
          'exp',
          'arcsin',
          'arccos',
          'arctan',
        ] as const
      ).map((name) => ({ kind: 'function', name, argument: id })),
      ...(
        [
          'equal',
          'not-equal',
          'less-than',
          'greater-than',
          'greater-than-or-equal',
        ] as const
      ).map((operator) => ({
        kind: 'comparison',
        operator,
        left: id,
        right: number,
      })),
      ...(
        [
          'belongs-to',
          'does-not-belong-to',
          'strict-subset',
          'subset',
          'union',
          'intersection',
          'implies',
          'equivalent',
        ] as const
      ).map((operator) => ({
        kind: 'relation',
        operator,
        left: id,
        right: { kind: 'constant', name: 'real' },
      })),
      {
        kind: 'bounded-operator',
        operator: 'product',
        lower: null,
        upper: number,
      },
      {
        kind: 'bounded-operator',
        operator: 'integral',
        lower: number,
        upper: null,
      },
      { kind: 'resolved-parameter', name: 'flag', value: true },
      { kind: 'resolved-parameter', name: 'label', value: 'abc' },
    ];
    for (const ast of cases) expect(mathAstToLatex(node(ast))).not.toBe('');
  });

  it.each([
    [
      {
        kind: 'unary',
        operator: 'negative',
        operand: {
          kind: 'binary',
          operator: 'add',
          left: { kind: 'identifier', name: 'a' },
          right: { kind: 'identifier', name: 'b' },
        },
      },
      '-\\left(a+b\\right)',
    ],
    [
      {
        kind: 'binary',
        operator: 'subtract',
        left: { kind: 'identifier', name: 'a' },
        right: {
          kind: 'binary',
          operator: 'subtract',
          left: { kind: 'identifier', name: 'b' },
          right: { kind: 'identifier', name: 'c' },
        },
      },
      'a-\\left(b-c\\right)',
    ],
    [
      {
        kind: 'binary',
        operator: 'multiply',
        left: {
          kind: 'binary',
          operator: 'add',
          left: { kind: 'identifier', name: 'a' },
          right: { kind: 'identifier', name: 'b' },
        },
        right: { kind: 'identifier', name: 'c' },
      },
      '\\left(a+b\\right)\\times c',
    ],
    [
      {
        kind: 'binary',
        operator: 'multiply',
        left: { kind: 'identifier', name: 'a' },
        right: {
          kind: 'binary',
          operator: 'add',
          left: { kind: 'identifier', name: 'b' },
          right: { kind: 'identifier', name: 'c' },
        },
      },
      'a\\times \\left(b+c\\right)',
    ],
    [
      {
        kind: 'power',
        base: {
          kind: 'binary',
          operator: 'add',
          left: { kind: 'identifier', name: 'a' },
          right: { kind: 'identifier', name: 'b' },
        },
        exponent: { kind: 'number', value: '2' },
      },
      '{\\left(a+b\\right)}^{2}',
    ],
    [
      {
        kind: 'power',
        base: {
          kind: 'power',
          base: { kind: 'identifier', name: 'a' },
          exponent: { kind: 'identifier', name: 'b' },
        },
        exponent: { kind: 'identifier', name: 'c' },
      },
      '{\\left({a}^{b}\\right)}^{c}',
    ],
    [
      {
        kind: 'power',
        base: { kind: 'identifier', name: 'a' },
        exponent: {
          kind: 'binary',
          operator: 'add',
          left: { kind: 'identifier', name: 'b' },
          right: { kind: 'identifier', name: 'c' },
        },
      },
      '{a}^{\\left(b+c\\right)}',
    ],
    [
      {
        kind: 'binary',
        operator: 'divide',
        left: {
          kind: 'binary',
          operator: 'divide',
          left: { kind: 'identifier', name: 'a' },
          right: { kind: 'identifier', name: 'b' },
        },
        right: { kind: 'identifier', name: 'c' },
      },
      '\\frac{\\left(\\frac{a}{b}\\right)}{c}',
    ],
    [
      {
        kind: 'binary',
        operator: 'divide',
        left: { kind: 'identifier', name: 'a' },
        right: {
          kind: 'binary',
          operator: 'divide',
          left: { kind: 'identifier', name: 'b' },
          right: { kind: 'identifier', name: 'c' },
        },
      },
      '\\frac{a}{\\left(\\frac{b}{c}\\right)}',
    ],
    [
      {
        kind: 'subscript',
        base: { kind: 'identifier', name: 'x' },
        subscript: {
          kind: 'binary',
          operator: 'add',
          left: { kind: 'identifier', name: 'n' },
          right: { kind: 'number', value: '1' },
        },
      },
      '{x}_{\\left(n+1\\right)}',
    ],
    [
      {
        kind: 'comparison',
        operator: 'less-than',
        left: {
          kind: 'binary',
          operator: 'add',
          left: { kind: 'identifier', name: 'a' },
          right: { kind: 'identifier', name: 'b' },
        },
        right: {
          kind: 'binary',
          operator: 'multiply',
          left: { kind: 'identifier', name: 'c' },
          right: { kind: 'identifier', name: 'd' },
        },
      },
      '{a+b}<{c\\times d}',
    ],
  ])('preserves AST precedence and associativity', (ast, expected) => {
    expect(mathAstToLatex(node(ast))).toBe(expected);
  });

  it.each([
    [
      {
        kind: 'binary',
        operator: 'multiply',
        left: { kind: 'number', value: '2' },
        right: { kind: 'resolved-parameter', name: 'a', value: -5 },
      },
      '2\\times \\left(-5\\right)',
    ],
    [
      {
        kind: 'binary',
        operator: 'divide',
        left: { kind: 'number', value: '12' },
        right: { kind: 'resolved-parameter', name: 'b', value: -5 },
      },
      '\\frac{12}{\\left(-5\\right)}',
    ],
    [
      {
        kind: 'power',
        base: { kind: 'resolved-parameter', name: 'a', value: -2 },
        exponent: { kind: 'number', value: '3' },
      },
      '{\\left(-2\\right)}^{3}',
    ],
    [
      {
        kind: 'binary',
        operator: 'add',
        left: { kind: 'number', value: '2' },
        right: { kind: 'resolved-parameter', name: 'a', value: -5 },
      },
      '2+\\left(-5\\right)',
    ],
  ])('parenthèse un paramètre négatif selon sa position', (ast, expected) => {
    expect(mathAstToLatex(node(ast))).toBe(expected);
  });

  it('rejects malformed values without fallback conversion', () => {
    for (const ast of [
      { kind: 'number', value: '2<script>' },
      { kind: 'identifier', name: 'x_y' },
      { kind: 'constant', name: 'url' },
      { kind: 'symbol', symbol: '<' },
      { kind: 'binary', operator: 'eval', left: {}, right: {} },
      { kind: 'function', name: 'html', argument: {} },
      { kind: 'comparison', operator: 'script', left: {}, right: {} },
      { kind: 'relation', operator: 'link', left: {}, right: {} },
      {
        kind: 'interval',
        leftClosed: 'yes',
        rightClosed: false,
        lower: {},
        upper: {},
      },
      { kind: 'bounded-operator', operator: 'fetch', lower: null, upper: null },
    ])
      expect(() => mathAstToLatex(node(ast))).toThrow();
  });

  it('renders invalid formulas as an accessible state', () => {
    render(<KatexMathRenderer ast={node({ kind: 'unknown' })} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Formule mathématique indisponible.',
    );
  });

  it('keeps question text escaped and renders only controlled formula AST', () => {
    render(
      <QuestionContentRenderer
        segments={[
          { kind: 'text', value: '<script>window.evil=true</script>' },
          {
            kind: 'inline-math',
            mathSource: { syntaxVersion: 1, source: 'x^2' },
            ast: node({
              kind: 'power',
              base: { kind: 'identifier', name: 'x' },
              exponent: { kind: 'number', value: '2' },
            }),
          },
        ]}
      />,
    );
    expect(
      screen.getByText('<script>window.evil=true</script>'),
    ).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('[role="math"]')).toBeInTheDocument();
  });
});
