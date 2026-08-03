import { MATH_SYNTAX_VERSION } from './MathSource';
import type { MathFunctionName } from './MathAst';

export type MathSyntaxCategory =
  | 'operations'
  | 'fractions'
  | 'powers-indices'
  | 'functions'
  | 'comparisons'
  | 'vectors'
  | 'variables';

export interface MathSyntaxCommand {
  readonly id: string;
  readonly syntaxVersion: typeof MATH_SYNTAX_VERSION;
  readonly category: MathSyntaxCategory;
  readonly syntax: string;
  readonly description: string;
  readonly example: string;
  readonly reservedWord: MathFunctionName | null;
  readonly unicodeAliases: readonly string[];
  readonly suggestion: string | null;
}

export interface MathSymbolEntry {
  readonly id: string;
  readonly symbol: string;
  readonly label: string;
  readonly category: 'sets' | 'greek' | 'logic' | 'analysis' | 'geometry';
  readonly aliases: readonly string[];
  readonly availableSince: typeof MATH_SYNTAX_VERSION;
}

const command = (
  value: Omit<MathSyntaxCommand, 'syntaxVersion'>,
): MathSyntaxCommand =>
  Object.freeze({ syntaxVersion: MATH_SYNTAX_VERSION, ...value });

export const MATH_SYNTAX_REGISTRY_V1: readonly MathSyntaxCommand[] =
  Object.freeze([
    command({
      id: 'explicit-multiplication',
      category: 'operations',
      syntax: 'a*b',
      description: 'Multiplication explicite',
      example: '2*x',
      reservedWord: null,
      unicodeAliases: [],
      suggestion: 'Utilise `2*x` pour écrire une multiplication.',
    }),
    command({
      id: 'fraction',
      category: 'fractions',
      syntax: 'a/b',
      description: 'Fraction',
      example: '(a+b)/(c-d)',
      reservedWord: null,
      unicodeAliases: [],
      suggestion: 'Entoure chaque expression composée de parenthèses.',
    }),
    command({
      id: 'power',
      category: 'powers-indices',
      syntax: 'x^n',
      description: 'Puissance',
      example: 'x^2',
      reservedWord: null,
      unicodeAliases: [],
      suggestion: null,
    }),
    command({
      id: 'subscript',
      category: 'powers-indices',
      syntax: 'x_n',
      description: 'Indice',
      example: 'x_(n+1)',
      reservedWord: null,
      unicodeAliases: [],
      suggestion: 'Un indice composé doit être entouré de parenthèses.',
    }),
    ...(['sqrt', 'abs', 'vec', 'sin', 'cos', 'tan', 'ln', 'exp'] as const).map(
      (name) =>
        command({
          id: `function-${name}`,
          category: name === 'vec' ? 'vectors' : 'functions',
          syntax: `${name}(x)`,
          description: `Fonction ${name}`,
          example: `${name}(x)`,
          reservedWord: name,
          unicodeAliases: [],
          suggestion: `Utilise \`${name}(x)\`.`,
        }),
    ),
    command({
      id: 'comparison',
      category: 'comparisons',
      syntax: 'a<=b',
      description: 'Comparaison mathématique',
      example: 'a<=b',
      reservedWord: null,
      unicodeAliases: ['≤', '≥', '≠'],
      suggestion: null,
    }),
    command({
      id: 'parameter',
      category: 'variables',
      syntax: '@nom',
      description: 'Variable paramétrée',
      example: '@coefficient_1',
      reservedWord: null,
      unicodeAliases: [],
      suggestion: 'Un nom commence par une lettre latine.',
    }),
  ]);

export const MATH_FUNCTION_NAMES: readonly MathFunctionName[] = Object.freeze(
  MATH_SYNTAX_REGISTRY_V1.flatMap((entry) =>
    entry.reservedWord === null ? [] : [entry.reservedWord],
  ),
);

const symbolGroups = {
  sets: [...'ℕℤℚℝℂ∅'],
  greek: [...'αβγδεθλμπρσφωΔΣΩ'],
  logic: [...'∈∉⊂⊆∪∩∀∃⇒⇔'],
  analysis: [...'∞∑∏∫∂∇'],
  geometry: [...'∥⟂∠'],
} as const;

export const MATH_SYMBOL_REGISTRY_V1: readonly MathSymbolEntry[] =
  Object.freeze(
    Object.entries(symbolGroups).flatMap(([category, symbols]) =>
      symbols.map((symbol, index) =>
        Object.freeze({
          id: `${category}-${String(index + 1)}`,
          symbol,
          label: symbol,
          category: category as MathSymbolEntry['category'],
          aliases: [],
          availableSince: MATH_SYNTAX_VERSION,
        }),
      ),
    ),
  );

export const MATH_GREEK_IDENTIFIER_SYMBOLS = new Set(
  MATH_SYMBOL_REGISTRY_V1.filter(
    ({ category, symbol }) => category === 'greek' && symbol !== 'π',
  ).map(({ symbol }) => symbol),
);

export const MATH_CONTROLLED_STANDALONE_SYMBOLS = new Set(
  MATH_SYMBOL_REGISTRY_V1.filter(({ category }) => category !== 'greek').map(
    ({ symbol }) => symbol,
  ),
);

export function isMathFunctionName(value: string): value is MathFunctionName {
  return MATH_FUNCTION_NAMES.some((name) => name === value);
}
