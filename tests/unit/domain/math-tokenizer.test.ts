import {
  MAX_MATH_SOURCE_LENGTH,
  MAX_MATH_TOKENS,
  tokenizeMathSource,
} from '@domain/math/MathTokenizer';

describe('MathTokenizer V1', () => {
  it.each([null, undefined, {}, [], 12])(
    'rejects the non-string public input %# without throwing',
    (value) => {
      expect(() => tokenizeMathSource(value)).not.toThrow();
      expect(tokenizeMathSource(value)).toMatchObject({
        ok: false,
        errors: [{ code: 'invalid-tokenizer-source' }],
      });
    },
  );

  it('normalizes decimal commas without changing offsets', () => {
    const result = tokenizeMathSource('1,5 + 1.5');
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.tokens.slice(0, -1)).toEqual([
        { kind: 'number', value: '1.5', start: 0, end: 3 },
        { kind: 'operator', value: '+', start: 4, end: 5 },
        { kind: 'number', value: '1.5', start: 6, end: 9 },
      ]);
    }
  });

  it('terminates an ordinary identifier before underscore', () => {
    const result = tokenizeMathSource('x_n');
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(
        result.tokens.slice(0, -1).map(({ kind, value }) => ({ kind, value })),
      ).toEqual([
        { kind: 'identifier', value: 'x' },
        { kind: 'operator', value: '_' },
        { kind: 'identifier', value: 'n' },
      ]);
    }
  });

  it('merges consecutive apostrophes into one derivative mark', () => {
    const result = tokenizeMathSource("y''+1");
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(
        result.tokens.slice(0, -1).map(({ kind, value }) => ({ kind, value })),
      ).toEqual([
        { kind: 'identifier', value: 'y' },
        { kind: 'operator', value: "''" },
        { kind: 'operator', value: '+' },
        { kind: 'number', value: '1' },
      ]);
    }
  });

  it('keeps underscores inside parameter names only', () => {
    const result = tokenizeMathSource('@coefficient_1');
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.tokens[0]).toMatchObject({
        kind: 'parameter',
        value: 'coefficient_1',
      });
    }
  });

  it.each([...'ℕℤℚℝℂ∅αβγδεθλμπρσφωΔΣΩ∈∉⊂⊆∪∩∀∃⇒⇔∞∑∏∫∂∇∥⟂∠'])(
    'tokenizes the safe symbol %s',
    (symbol) => {
      expect(tokenizeMathSource(symbol)).toMatchObject({ ok: true });
    },
  );

  it('rejects unknown and hostile characters without executing them', () => {
    expect(
      tokenizeMathSource('<script>globalThis.compromised=true</script>'),
    ).toMatchObject({ ok: false });
    expect(tokenizeMathSource('x\\frac{1}{2}')).toMatchObject({ ok: false });
  });

  it('enforces source and token limits as controlled failures', () => {
    expect(
      tokenizeMathSource('x'.repeat(MAX_MATH_SOURCE_LENGTH + 1)),
    ).toMatchObject({
      ok: false,
      errors: [{ code: 'source-too-long' }],
    });
    expect(tokenizeMathSource('x+'.repeat(MAX_MATH_TOKENS))).toMatchObject({
      ok: false,
      errors: [{ code: 'too-many-tokens' }],
    });
  });
});
