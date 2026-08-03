import {
  MATH_FUNCTION_NAMES,
  MATH_SYMBOL_REGISTRY_V1,
  MATH_SYNTAX_REGISTRY_V1,
} from '@domain/math/MathSyntaxRegistry';
import { parseMathSourceText } from '@domain/math/MathParser';

describe('MathSyntaxRegistry V1', () => {
  it('has one version and stable unique identifiers', () => {
    expect(new Set(MATH_SYNTAX_REGISTRY_V1.map(({ id }) => id)).size).toBe(
      MATH_SYNTAX_REGISTRY_V1.length,
    );
    expect(
      MATH_SYNTAX_REGISTRY_V1.every(({ syntaxVersion }) => syntaxVersion === 1),
    ).toBe(true);
  });

  it('defines exactly the normative reserved commands', () => {
    expect(MATH_FUNCTION_NAMES).toEqual([
      'sqrt',
      'abs',
      'vec',
      'sin',
      'cos',
      'tan',
      'ln',
      'exp',
    ]);
  });

  it('registers every normative Unicode symbol exactly once', () => {
    const symbols = MATH_SYMBOL_REGISTRY_V1.map(({ symbol }) => symbol);
    expect(symbols.join('')).toBe('ℕℤℚℝℂ∅αβγδεθλμπρσφωΔΣΩ∈∉⊂⊆∪∩∀∃⇒⇔∞∑∏∫∂∇∥⟂∠');
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('keeps every registry example parseable', () => {
    for (const entry of MATH_SYNTAX_REGISTRY_V1) {
      expect(parseMathSourceText(entry.example), entry.id).toMatchObject({
        ok: true,
      });
    }
  });

  it('refuses commands that are absent from the registry', () => {
    expect(parseMathSourceText('log(x)')).toMatchObject({
      ok: false,
      errors: [{ code: 'implicit-multiplication' }],
    });
  });
});
