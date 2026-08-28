import {
  MAX_DERIVATIVE_ORDER,
  MAX_MATH_AST_DEPTH,
  MAX_MATH_AST_NODES,
  parseMathSource,
  parseMathSourceText,
} from '@domain/math/MathParser';

const ast = (source: string) => {
  const result = parseMathSourceText(source);
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) throw new Error('Expected a valid test formula');
  return result.ast;
};

describe('MathParser V1', () => {
  it.each([
    null,
    undefined,
    [],
    {},
    new Date(),
    { syntaxVersion: 1 },
    { source: 'x' },
    { syntaxVersion: '1', source: 'x' },
    { syntaxVersion: 1, source: 12 },
  ])('rejects the invalid MathSource root %# without throwing', (value) => {
    expect(() => parseMathSource(value)).not.toThrow();
    expect(parseMathSource(value)).toEqual({
      ok: false,
      source: null,
      errors: [
        {
          code: 'invalid-math-source',
          message:
            'La formule reçue n’est pas dans un format MathSource valide.',
          sourceStart: null,
          sourceEnd: null,
          correctionExample: null,
        },
      ],
    });
  });

  it('contains hostile root object behavior at the public boundary', () => {
    const hostilePrototype = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error('hostile getPrototypeOf detail');
        },
      },
    );
    const hostileGet = new Proxy(
      { syntaxVersion: 1, source: 'x' },
      {
        get: () => {
          throw new Error('hostile get detail');
        },
      },
    );
    const hostileVersionGetter = Object.defineProperty({}, 'syntaxVersion', {
      get: () => {
        throw new Error('hostile syntaxVersion getter detail');
      },
    });
    Object.defineProperty(hostileVersionGetter, 'source', { value: 'x' });
    const hostileSourceGetter = Object.defineProperties(
      {},
      {
        syntaxVersion: { value: 1 },
        source: {
          get: () => {
            throw new Error('hostile source getter detail');
          },
        },
      },
    );

    for (const value of [
      hostilePrototype,
      hostileGet,
      hostileVersionGetter,
      hostileSourceGetter,
    ]) {
      expect(() => parseMathSource(value)).not.toThrow();
      const result = parseMathSource(value);
      expect(result).toMatchObject({
        ok: false,
        source: null,
        errors: [{ code: 'invalid-math-source' }],
      });
      if (!result.ok) {
        expect(result.errors[0]?.message).not.toContain('hostile');
        expect(result.errors[0]?.message).not.toContain('Error');
        expect(result.errors[0]).not.toHaveProperty('stack');
      }
    }
  });

  it('rejects a cyclic root without traversing or retaining it', () => {
    const cyclic: Record<string, unknown> = {
      syntaxVersion: 1,
      source: 'x',
    };
    cyclic.self = cyclic;
    expect(() => parseMathSource(cyclic)).not.toThrow();
    expect(parseMathSource(cyclic)).toMatchObject({
      ok: false,
      source: null,
      errors: [{ code: 'invalid-math-source' }],
    });
  });

  it('accepts a valid null-prototype MathSource without mutating it', () => {
    const value = Object.assign(Object.create(null) as object, {
      syntaxVersion: 1,
      source: 'x+1',
    });
    const before = { ...value };
    expect(parseMathSource(value)).toMatchObject({
      ok: true,
      source: { syntaxVersion: 1, source: 'x+1' },
    });
    expect({ ...value }).toEqual(before);
  });

  it('preserves safe source snapshots for unsupported versions and invalid syntax', () => {
    const unsupported = { syntaxVersion: 2, source: '  x+1  ' };
    expect(parseMathSource(unsupported)).toMatchObject({
      ok: false,
      source: unsupported,
      errors: [{ code: 'unsupported-version' }],
    });
    const invalid = { syntaxVersion: 1, source: '  2x  ' };
    expect(parseMathSource(invalid)).toMatchObject({
      ok: false,
      source: invalid,
      errors: [{ code: 'implicit-multiplication' }],
    });
  });

  it('keeps parseMathSourceText working through the hardened boundary', () => {
    expect(parseMathSourceText('x+1')).toMatchObject({ ok: true });
  });

  it.each([
    ['12', { kind: 'number', value: '12' }],
    ['-12', { kind: 'unary', operator: 'negative' }],
    ['1.5', { kind: 'number', value: '1.5' }],
    ['1,5', { kind: 'number', value: '1.5' }],
  ])('parses the number %s', (source, expected) => {
    expect(ast(source)).toMatchObject(expected);
  });

  it.each(['1e3', '.5', '1.', '0x10'])(
    'rejects undefined numeric form %s',
    (source) => {
      expect(parseMathSourceText(source)).toMatchObject({ ok: false });
    },
  );

  it('requires explicit multiplication', () => {
    expect(ast('2 * x')).toMatchObject({
      kind: 'binary',
      operator: 'multiply',
    });
    expect(ast('a*(b+c)')).toMatchObject({
      kind: 'binary',
      operator: 'multiply',
    });
    expect(parseMathSourceText('2x')).toMatchObject({
      ok: false,
      errors: [{ code: 'implicit-multiplication', correctionExample: '2*x' }],
    });
    expect(parseMathSourceText('2(x+1)')).toMatchObject({ ok: false });
  });

  it('implements the normative precedence', () => {
    expect(ast('-x^2')).toMatchObject({
      kind: 'unary',
      operator: 'negative',
      operand: { kind: 'power', base: { kind: 'identifier', name: 'x' } },
    });
    expect(ast('(-x)^2')).toMatchObject({
      kind: 'power',
      base: { kind: 'unary', operator: 'negative' },
    });
    expect(ast('a+b*c')).toMatchObject({
      kind: 'binary',
      operator: 'add',
      right: { kind: 'binary', operator: 'multiply' },
    });
    expect(ast('(a+b)*c')).toMatchObject({
      kind: 'binary',
      operator: 'multiply',
      left: { kind: 'binary', operator: 'add' },
    });
    expect(ast('x_n^2')).toMatchObject({
      kind: 'power',
      base: { kind: 'subscript', base: { kind: 'identifier', name: 'x' } },
    });
  });

  it('parses explicit fractions and rejects ambiguous division', () => {
    expect(ast('a/b')).toMatchObject({ kind: 'binary', operator: 'divide' });
    expect(ast('(a+b)/(c-d)')).toMatchObject({
      kind: 'binary',
      operator: 'divide',
    });
    expect(ast('(a/b)/c')).toMatchObject({
      kind: 'binary',
      operator: 'divide',
    });
    expect(ast('a/(b/c)')).toMatchObject({
      kind: 'binary',
      operator: 'divide',
    });
    const result = parseMathSourceText('a/b/c');
    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: 'ambiguous-division' }],
    });
    if (!result.ok) expect(result.errors[0]?.message).toContain('(a/b)/c');
  });

  it.each([
    'sqrt',
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
  ])('parses the registered function %s', (name) =>
    expect(ast(`${name}(x)`)).toMatchObject({ kind: 'function', name }),
  );

  it('requires lowercase function calls with parentheses', () => {
    expect(parseMathSourceText('sqrt x')).toMatchObject({
      ok: false,
      errors: [
        {
          code: 'function-parentheses-required',
          correctionExample: 'sqrt(x+1)',
        },
      ],
    });
    expect(parseMathSourceText('Sqrt(x)')).toMatchObject({
      ok: false,
      errors: [{ code: 'reserved-command-case' }],
    });
  });

  it('parses and deduplicates parameter references', () => {
    const result = parseMathSourceText('@a+@coefficient_1+@a');
    expect(result).toMatchObject({
      ok: true,
      parameterReferences: ['a', 'coefficient_1'],
    });
    expect(ast('@a')).toMatchObject({ kind: 'parameter', name: 'a' });
    expect(ast('a')).toMatchObject({ kind: 'identifier', name: 'a' });
    expect(parseMathSourceText('@1a')).toMatchObject({ ok: false });
    expect(parseMathSourceText('@a b')).toMatchObject({ ok: false });
    expect(parseMathSourceText('@sqrt')).toMatchObject({
      ok: false,
      errors: [{ code: 'reserved-parameter' }],
    });
  });

  it.each([
    ['=', 'equal'],
    ['!=', 'not-equal'],
    ['≠', 'not-equal'],
    ['<', 'less-than'],
    ['<=', 'less-than-or-equal'],
    ['≤', 'less-than-or-equal'],
    ['>', 'greater-than'],
    ['>=', 'greater-than-or-equal'],
    ['≥', 'greater-than-or-equal'],
  ])('normalizes comparison %s', (sourceOperator, operator) => {
    expect(ast(`a${sourceOperator}b`)).toMatchObject({
      kind: 'comparison',
      operator,
    });
  });

  it('distinguishes π from the latin identifier pi', () => {
    expect(ast('π')).toEqual({ kind: 'constant', name: 'pi' });
    expect(ast('pi')).toEqual({ kind: 'identifier', name: 'pi' });
  });

  it('parses membership and all normative index forms', () => {
    expect(ast('x ∈ ℝ')).toMatchObject({
      kind: 'relation',
      operator: 'belongs-to',
    });
    expect(ast('x_n')).toMatchObject({
      kind: 'subscript',
      subscript: { kind: 'identifier', name: 'n' },
    });
    expect(ast('x_(n+1)')).toMatchObject({
      kind: 'subscript',
      subscript: { kind: 'binary', operator: 'add' },
    });
    expect(ast('x_(n+1)^2')).toMatchObject({
      kind: 'power',
      base: { kind: 'subscript' },
    });
    expect(parseMathSourceText('x^2_n')).toMatchObject({
      ok: false,
      errors: [{ code: 'invalid-postfix-order' }],
    });
    expect(parseMathSourceText('x_n_m')).toMatchObject({
      ok: false,
      errors: [{ code: 'invalid-postfix-order' }],
    });
  });

  it('parses derivative marks in the normative order', () => {
    expect(ast("y'")).toMatchObject({
      kind: 'derivative',
      order: 1,
      base: { kind: 'identifier', name: 'y' },
    });
    expect(ast("y''")).toMatchObject({ kind: 'derivative', order: 2 });
    expect(ast("y_1'")).toMatchObject({
      kind: 'derivative',
      order: 1,
      base: { kind: 'subscript', base: { kind: 'identifier', name: 'y' } },
    });
    expect(ast("y'^2")).toMatchObject({
      kind: 'power',
      base: { kind: 'derivative', order: 1 },
    });
    expect(ast("y_1'^2")).toMatchObject({
      kind: 'power',
      base: {
        kind: 'derivative',
        base: { kind: 'subscript' },
      },
    });
    expect(ast("(x^2)'")).toMatchObject({
      kind: 'derivative',
      base: { kind: 'power' },
    });
    expect(parseMathSourceText("y'_1")).toMatchObject({
      ok: false,
      errors: [{ code: 'invalid-postfix-order' }],
    });
    expect(parseMathSourceText("y^2'")).toMatchObject({
      ok: false,
      errors: [{ code: 'invalid-postfix-order' }],
    });
    expect(
      parseMathSourceText(`y${"'".repeat(MAX_DERIVATIVE_ORDER + 1)}`),
    ).toMatchObject({
      ok: false,
      errors: [{ code: 'derivative-order-too-high' }],
    });
    expect(
      parseMathSourceText(`y${"'".repeat(MAX_DERIVATIVE_ORDER)}`),
    ).toMatchObject({ ok: true });
  });

  it.each([
    ['∑_(k=1)^n', 'sum'],
    ['∏_(k=1)^n', 'product'],
    ['∫_a^b', 'integral'],
  ])('parses bounded operator %s', (source, operator) => {
    const node = ast(source);
    expect(node).toMatchObject({
      kind: 'bounded-operator',
      operator,
    });
    if (node.kind === 'bounded-operator') {
      expect(node.lower).not.toBeNull();
      expect(node.upper).not.toBeNull();
    }
  });

  it.each([
    ['[a;b]', true, true],
    [']a;b[', false, false],
    ['[a;b[', true, false],
    [']a;b]', false, true],
    ['[0;π]', true, true],
    [']-∞;0]', false, true],
    ['[1;∞[', true, false],
  ])('parses interval %s', (source, leftClosed, rightClosed) => {
    expect(ast(source)).toMatchObject({
      kind: 'interval',
      leftClosed,
      rightClosed,
    });
  });

  it('reports malformed intervals pedagogically', () => {
    expect(parseMathSourceText('[a,b]')).toMatchObject({
      ok: false,
      errors: [
        { code: 'interval-separator-required', correctionExample: '[a;b]' },
      ],
    });
    expect(parseMathSourceText('[a;]')).toMatchObject({ ok: false });
  });

  it('turns invalid user input and resource limits into controlled results', () => {
    expect(parseMathSourceText('')).toMatchObject({
      ok: false,
      errors: [{ code: 'empty-expression' }],
    });
    expect(
      parseMathSource({ syntaxVersion: 2, source: 'x' } as never),
    ).toMatchObject({ ok: false, errors: [{ code: 'unsupported-version' }] });
    expect(
      parseMathSourceText(
        '('.repeat(MAX_MATH_AST_DEPTH + 1) +
          'x' +
          ')'.repeat(MAX_MATH_AST_DEPTH + 1),
      ),
    ).toMatchObject({ ok: false, errors: [{ code: 'too-deep' }] });
    expect(
      parseMathSourceText(
        Array.from({ length: MAX_MATH_AST_NODES / 2 + 1 }, () => 'x').join('+'),
      ),
    ).toMatchObject({ ok: false, errors: [{ code: 'too-many-nodes' }] });
    expect(parseMathSourceText('(x')).toMatchObject({
      ok: false,
      errors: [{ code: 'unclosed-parenthesis' }],
    });
  });

  it('preserves the exact original source on failure', () => {
    const source = ' 2x ';
    expect(parseMathSourceText(source)).toMatchObject({
      ok: false,
      source: { source },
    });
  });
});
