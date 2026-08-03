import type {
  MathAstNode,
  MathComparisonOperator,
  MathFunctionName,
  MathRelationOperator,
} from './MathAst';
import { mathParseError, type MathParseError } from './MathParseError';
import { MATH_SYNTAX_VERSION, type MathSource } from './MathSource';
import { isMathFunctionName, MATH_FUNCTION_NAMES } from './MathSyntaxRegistry';
import { tokenizeMathSource, type MathToken } from './MathTokenizer';

export const MAX_MATH_AST_DEPTH = 32;
export const MAX_MATH_AST_NODES = 256;
export const MAX_MATH_LIST_ELEMENTS = 32;

export type MathParseResult =
  | Readonly<{
      ok: true;
      source: MathSource;
      ast: MathAstNode;
      parameterReferences: readonly string[];
    }>
  | Readonly<{
      ok: false;
      source: MathSourceSnapshot | null;
      errors: readonly MathParseError[];
    }>;

export type MathSourceSnapshot = Readonly<{
  syntaxVersion: number;
  source: string;
}>;

class ControlledParseFailure extends Error {
  constructor(readonly parseError: MathParseError) {
    super('Controlled math parse failure');
    this.name = 'ControlledParseFailure';
  }
}

const constantBySymbol: Readonly<Record<string, MathAstNode>> = {
  π: { kind: 'constant', name: 'pi' },
  '∞': { kind: 'constant', name: 'infinity' },
  '∅': { kind: 'constant', name: 'empty-set' },
  ℕ: { kind: 'constant', name: 'natural' },
  ℤ: { kind: 'constant', name: 'integer' },
  ℚ: { kind: 'constant', name: 'rational' },
  ℝ: { kind: 'constant', name: 'real' },
  ℂ: { kind: 'constant', name: 'complex' },
};

class Parser {
  private position = 0;
  private nodeCount = 0;
  private depth = 0;
  readonly references = new Set<string>();

  constructor(private readonly tokens: readonly MathToken[]) {}

  parse(): MathAstNode {
    const ast = this.parseRelation();
    if (!this.at('eof')) {
      const token = this.current();
      if (this.startsPrimary(token)) {
        this.fail(
          'implicit-multiplication',
          'La multiplication implicite n’existe pas en version 1. Utilise `2*x` pour écrire une multiplication.',
          token,
          '2*x',
        );
      }
      this.fail(
        'unexpected-token',
        `L’élément \`${token.value}\` n’est pas attendu ici.`,
        token,
      );
    }
    return ast;
  }

  private parseRelation(): MathAstNode {
    let left = this.parseComparison();
    const operators: Record<string, MathRelationOperator> = {
      '∈': 'belongs-to',
      '∉': 'does-not-belong-to',
      '⊂': 'strict-subset',
      '⊆': 'subset',
      '∪': 'union',
      '∩': 'intersection',
      '⇒': 'implies',
      '⇔': 'equivalent',
    };
    while (operators[this.current().value] !== undefined) {
      const operator = operators[this.advance().value] as MathRelationOperator;
      left = this.node({
        kind: 'relation',
        operator,
        left,
        right: this.parseComparison(),
      });
    }
    return left;
  }

  private parseComparison(): MathAstNode {
    let left = this.parseAdditive();
    const operators: Record<string, MathComparisonOperator> = {
      '=': 'equal',
      '!=': 'not-equal',
      '≠': 'not-equal',
      '<': 'less-than',
      '<=': 'less-than-or-equal',
      '≤': 'less-than-or-equal',
      '>': 'greater-than',
      '>=': 'greater-than-or-equal',
      '≥': 'greater-than-or-equal',
    };
    const operator = operators[this.current().value];
    if (operator !== undefined) {
      this.advance();
      left = this.node({
        kind: 'comparison',
        operator,
        left,
        right: this.parseAdditive(),
      });
      if (operators[this.current().value] !== undefined) {
        this.fail(
          'chained-comparison',
          'Les comparaisons en chaîne ne sont pas définies en version 1. Écris chaque comparaison séparément.',
          this.current(),
        );
      }
    }
    return left;
  }

  private parseAdditive(): MathAstNode {
    let left = this.parseMultiplicative();
    while (this.atValue('+') || this.atValue('-')) {
      const operator = this.advance().value === '+' ? 'add' : 'subtract';
      left = this.node({
        kind: 'binary',
        operator,
        left,
        right: this.parseMultiplicative(),
      });
    }
    return left;
  }

  private parseMultiplicative(): MathAstNode {
    let left = this.parseUnary();
    let unparenthesizedDivision = false;
    while (this.atValue('*') || this.atValue('/')) {
      const token = this.advance();
      if (token.value === '/' && unparenthesizedDivision) {
        this.fail(
          'ambiguous-division',
          'Cette division est ambiguë. Utilise `(a/b)/c` ou `a/(b/c)`.',
          token,
          '(a/b)/c ou a/(b/c)',
        );
      }
      if (token.value === '/') unparenthesizedDivision = true;
      left = this.node({
        kind: 'binary',
        operator: token.value === '*' ? 'multiply' : 'divide',
        left,
        right: this.parseUnary(),
      });
    }
    return left;
  }

  private parseUnary(): MathAstNode {
    if (this.atValue('+') || this.atValue('-')) {
      const operator = this.advance().value === '+' ? 'positive' : 'negative';
      return this.withDepth(() =>
        this.node({ kind: 'unary', operator, operand: this.parseUnary() }),
      );
    }
    return this.parsePostfix();
  }

  private parsePostfix(): MathAstNode {
    let base = this.parsePrimary();
    let hasSubscript = false;
    let hasPower = false;
    while (this.atValue('_') || this.atValue('^')) {
      const operatorToken = this.advance();
      const operator = operatorToken.value;
      if (
        (operator === '_' && (hasSubscript || hasPower)) ||
        (operator === '^' && hasPower)
      ) {
        this.fail(
          'invalid-postfix-order',
          'Un indice unique doit précéder une puissance unique. Exemple : `x_n^2`.',
          operatorToken,
          'x_n^2',
        );
      }
      if (operator === '_') hasSubscript = true;
      if (operator === '^') hasPower = true;
      const value = this.parsePostfixArgument(operator);
      if (base.kind === 'bounded-operator') {
        base = this.node({
          ...base,
          lower: operator === '_' ? value : base.lower,
          upper: operator === '^' ? value : base.upper,
        });
      } else if (operator === '_') {
        base = this.node({ kind: 'subscript', base, subscript: value });
      } else {
        base = this.node({ kind: 'power', base, exponent: value });
      }
    }
    return base;
  }

  private parsePostfixArgument(operator: string): MathAstNode {
    if (this.atValue('(')) return this.parseParenthesized();
    const token = this.current();
    if (!this.startsAtomicPrimary(token)) {
      this.fail(
        operator === '_' ? 'missing-subscript' : 'missing-exponent',
        operator === '_'
          ? 'Un indice doit contenir un identifiant, un nombre ou une expression entre parenthèses.'
          : 'Une puissance doit contenir un identifiant, un nombre ou une expression entre parenthèses.',
        token,
        operator === '_' ? 'x_(n+1)' : 'x^(n+1)',
      );
    }
    return this.parsePrimary();
  }

  private parsePrimary(): MathAstNode {
    const token = this.current();
    if (token.kind === 'number') {
      this.advance();
      return this.node({ kind: 'number', value: token.value });
    }
    if (token.kind === 'parameter') {
      this.advance();
      if (isMathFunctionName(token.value)) {
        this.fail(
          'reserved-parameter',
          `Le nom \`${token.value}\` est réservé à une commande mathématique.`,
          token,
          '@nom',
        );
      }
      this.references.add(token.value);
      return this.node({ kind: 'parameter', name: token.value });
    }
    if (token.kind === 'identifier') {
      this.advance();
      if (isMathFunctionName(token.value)) return this.parseFunction(token);
      const lower = token.value.toLowerCase();
      if (MATH_FUNCTION_NAMES.some((name) => name === lower)) {
        this.fail(
          'reserved-command-case',
          `La commande \`${lower}\` doit être écrite en minuscules.`,
          token,
          `${lower}(x)`,
        );
      }
      return this.node({ kind: 'identifier', name: token.value });
    }
    if (token.kind === 'symbol') {
      this.advance();
      const constant = constantBySymbol[token.value];
      if (constant !== undefined) return this.node(constant);
      if (token.value === '∑' || token.value === '∏' || token.value === '∫') {
        return this.node({
          kind: 'bounded-operator',
          operator:
            token.value === '∑'
              ? 'sum'
              : token.value === '∏'
                ? 'product'
                : 'integral',
          lower: null,
          upper: null,
        });
      }
      return this.node({ kind: 'symbol', symbol: token.value });
    }
    if (token.value === '(') return this.parseParenthesized();
    if (token.value === '[' || token.value === ']') return this.parseInterval();
    this.fail(
      token.kind === 'eof' ? 'empty-expression' : 'expected-expression',
      token.kind === 'eof'
        ? 'La formule doit contenir une expression mathématique.'
        : `Une expression mathématique est attendue avant \`${token.value}\`.`,
      token,
    );
  }

  private parseFunction(functionToken: MathToken): MathAstNode {
    if (!this.atValue('(')) {
      this.fail(
        'function-parentheses-required',
        `La fonction \`${functionToken.value}\` doit contenir une expression entre parenthèses. Exemple : \`${functionToken.value}(x+1)\`.`,
        functionToken,
        `${functionToken.value}(x+1)`,
      );
    }
    return this.node({
      kind: 'function',
      name: functionToken.value as MathFunctionName,
      argument: this.parseParenthesized(),
    });
  }

  private parseParenthesized(): MathAstNode {
    const opening = this.expect('(');
    return this.withDepth(() => {
      const expression = this.parseRelation();
      if (!this.atValue(')')) {
        this.fail(
          'unclosed-parenthesis',
          'Cette parenthèse n’est pas fermée. Ajoute `)` à la fin de l’expression.',
          opening,
          '(x+1)',
        );
      }
      this.advance();
      return expression;
    });
  }

  private parseInterval(): MathAstNode {
    const opening = this.advance();
    return this.withDepth(() => {
      const lower = this.parseRelation();
      if (!this.atValue(';')) {
        this.fail(
          'interval-separator-required',
          'Un intervalle doit séparer ses deux bornes avec `;`. Exemple : `[a;b]`.',
          this.current(),
          '[a;b]',
        );
      }
      this.advance();
      const upper = this.parseRelation();
      if (!this.atValue('[') && !this.atValue(']')) {
        this.fail(
          'unclosed-interval',
          'L’intervalle doit se terminer par `[` ou `]`.',
          this.current(),
          '[a;b]',
        );
      }
      const closing = this.advance();
      return this.node({
        kind: 'interval',
        leftClosed: opening.value === '[',
        rightClosed: closing.value === ']',
        lower,
        upper,
      });
    });
  }

  private node<T extends MathAstNode>(node: T): T {
    this.nodeCount += 1;
    if (this.nodeCount > MAX_MATH_AST_NODES) {
      this.fail(
        'too-many-nodes',
        `La formule dépasse la limite technique de ${MAX_MATH_AST_NODES} nœuds.`,
        this.current(),
      );
    }
    return node;
  }

  private withDepth<T>(operation: () => T): T {
    this.depth += 1;
    if (this.depth > MAX_MATH_AST_DEPTH) {
      this.fail(
        'too-deep',
        `La formule dépasse la profondeur technique maximale de ${MAX_MATH_AST_DEPTH}.`,
        this.current(),
      );
    }
    try {
      return operation();
    } finally {
      this.depth -= 1;
    }
  }

  private startsAtomicPrimary(token: MathToken): boolean {
    return (
      token.kind === 'number' ||
      token.kind === 'identifier' ||
      token.kind === 'parameter' ||
      token.kind === 'symbol'
    );
  }

  private startsPrimary(token: MathToken): boolean {
    return (
      this.startsAtomicPrimary(token) ||
      token.value === '(' ||
      token.value === '[' ||
      token.value === ']'
    );
  }

  private current(): MathToken {
    return this.tokens[this.position] as MathToken;
  }

  private advance(): MathToken {
    const token = this.current();
    this.position += 1;
    return token;
  }

  private at(kind: MathToken['kind']): boolean {
    return this.current().kind === kind;
  }

  private atValue(value: string): boolean {
    return this.current().value === value;
  }

  private expect(value: string): MathToken {
    if (!this.atValue(value)) {
      this.fail(
        'expected-token',
        `L’élément \`${value}\` est attendu ici.`,
        this.current(),
      );
    }
    return this.advance();
  }

  private fail(
    code: string,
    message: string,
    token: MathToken,
    correctionExample: string | null = null,
  ): never {
    throw new ControlledParseFailure(
      mathParseError(code, message, token.start, token.end, correctionExample),
    );
  }
}

function invalidMathSourceResult(): MathParseResult {
  return {
    ok: false,
    source: null,
    errors: [
      mathParseError(
        'invalid-math-source',
        'La formule reçue n’est pas dans un format MathSource valide.',
        null,
        null,
      ),
    ],
  };
}

function readMathSource(value: unknown): MathSourceSnapshot | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) return null;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2 ||
    !keys.includes('syntaxVersion') ||
    !keys.includes('source')
  ) {
    return null;
  }
  const syntaxVersion = Reflect.get(value, 'syntaxVersion') as unknown;
  const source = Reflect.get(value, 'source') as unknown;
  if (typeof syntaxVersion !== 'number' || typeof source !== 'string') {
    return null;
  }
  return { syntaxVersion, source };
}

export function parseMathSource(value: unknown): MathParseResult {
  let preservedSource: MathSourceSnapshot;
  try {
    const candidate = readMathSource(value);
    if (candidate === null) return invalidMathSourceResult();
    preservedSource = candidate;
  } catch {
    return invalidMathSourceResult();
  }

  if (preservedSource.syntaxVersion !== MATH_SYNTAX_VERSION) {
    return {
      ok: false,
      source: preservedSource,
      errors: [
        mathParseError(
          'unsupported-version',
          `La version ${String(preservedSource.syntaxVersion)} du langage mathématique n’est pas prise en charge.`,
          null,
          null,
        ),
      ],
    };
  }
  const tokenized = tokenizeMathSource(preservedSource.source);
  if (!tokenized.ok)
    return { ok: false, source: preservedSource, errors: tokenized.errors };
  try {
    const parser = new Parser(tokenized.tokens);
    const ast = parser.parse();
    const validatedSource: MathSource = {
      syntaxVersion: MATH_SYNTAX_VERSION,
      source: preservedSource.source,
    };
    return {
      ok: true,
      source: validatedSource,
      ast,
      parameterReferences: [...parser.references],
    };
  } catch (error: unknown) {
    if (error instanceof ControlledParseFailure) {
      return { ok: false, source: preservedSource, errors: [error.parseError] };
    }
    return {
      ok: false,
      source: preservedSource,
      errors: [
        mathParseError(
          'internal-parser-error',
          'La formule n’a pas pu être analysée. Vérifie sa syntaxe puis réessaie.',
          null,
          null,
        ),
      ],
    };
  }
}

export function parseMathSourceText(
  source: string,
  syntaxVersion: number = MATH_SYNTAX_VERSION,
): MathParseResult {
  return parseMathSource({ syntaxVersion, source });
}
