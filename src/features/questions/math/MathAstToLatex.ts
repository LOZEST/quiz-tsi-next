import type { ResolvedMathAstNode } from '@domain/questions/QuestionInstantiation';

export const MAX_RENDER_MATH_DEPTH = 32;
export const MAX_RENDER_MATH_NODES = 256;

const escapedSymbols: Readonly<Record<string, string>> = Object.freeze({
  '∂': '\\partial',
  '∇': '\\nabla',
  '∥': '\\parallel',
  '⟂': '\\perp',
  '∠': '\\angle',
  '∀': '\\forall',
  '∃': '\\exists',
  Δ: '\\Delta',
  Σ: '\\Sigma',
  Ω: '\\Omega',
  α: '\\alpha',
  β: '\\beta',
  γ: '\\gamma',
  δ: '\\delta',
  ε: '\\varepsilon',
  θ: '\\theta',
  λ: '\\lambda',
  μ: '\\mu',
  ρ: '\\rho',
  σ: '\\sigma',
  φ: '\\varphi',
  ω: '\\omega',
});

const constants: Readonly<Record<string, string>> = Object.freeze({
  pi: '\\pi',
  infinity: '\\infty',
  'empty-set': '\\varnothing',
  natural: '\\mathbb{N}',
  integer: '\\mathbb{Z}',
  rational: '\\mathbb{Q}',
  real: '\\mathbb{R}',
  complex: '\\mathbb{C}',
});

function safeIdentifier(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z\p{Script=Greek}][A-Za-z0-9\p{Script=Greek}]*$/u.test(value)
  )
    throw new Error('Identifiant mathématique invalide.');
  return [...value]
    .map((character) => escapedSymbols[character] ?? character)
    .join('');
}

function precedence(raw: unknown): number {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 0;
  switch ((raw as Record<string, unknown>).kind) {
    case 'comparison':
    case 'relation':
      return 1;
    case 'binary': {
      const operator = (raw as Record<string, unknown>).operator;
      return operator === 'add' || operator === 'subtract' ? 2 : 3;
    }
    case 'unary':
      return 4;
    case 'power':
      return 5;
    case 'subscript':
      return 6;
    default:
      return 7;
  }
}

function isNegativeResolvedParameter(raw: unknown): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    !Array.isArray(raw) &&
    (raw as Record<string, unknown>).kind === 'resolved-parameter' &&
    typeof (raw as Record<string, unknown>).value === 'number' &&
    ((raw as Record<string, unknown>).value as number) < 0
  );
}

export function mathAstToLatex(root: ResolvedMathAstNode): string {
  let count = 0;
  const visit = (raw: unknown, depth: number): string => {
    count += 1;
    if (count > MAX_RENDER_MATH_NODES || depth > MAX_RENDER_MATH_DEPTH)
      throw new Error('Formule trop complexe.');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
      throw new Error('Arbre mathématique invalide.');
    const node = raw as Record<string, unknown>;
    const child = (
      value: unknown,
      parentPrecedence = 0,
      groupEqual = false,
    ) => {
      const rendered = visit(value, depth + 1);
      const childPrecedence = precedence(value);
      return childPrecedence < parentPrecedence ||
        (parentPrecedence >= 2 && isNegativeResolvedParameter(value)) ||
        (groupEqual && childPrecedence === parentPrecedence)
        ? `\\left(${rendered}\\right)`
        : rendered;
    };
    switch (node.kind) {
      case 'number':
        if (
          typeof node.value !== 'string' ||
          !/^-?\d+(?:\.\d+)?$/.test(node.value)
        )
          throw new Error('Nombre invalide.');
        return node.value;
      case 'identifier':
        return safeIdentifier(node.name);
      case 'constant': {
        const result =
          typeof node.name === 'string' ? constants[node.name] : undefined;
        if (!result) throw new Error('Constante inconnue.');
        return result;
      }
      case 'parameter':
        throw new Error('Paramètre non résolu.');
      case 'resolved-parameter':
        if (!['string', 'number', 'boolean'].includes(typeof node.value))
          throw new Error('Paramètre invalide.');
        return typeof node.value === 'string'
          ? `\\mathrm{${safeIdentifier(node.value)}}`
          : String(node.value);
      case 'symbol': {
        const result =
          typeof node.symbol === 'string'
            ? escapedSymbols[node.symbol]
            : undefined;
        if (!result) throw new Error('Symbole inconnu.');
        return result;
      }
      case 'unary':
        return `${
          node.operator === 'negative'
            ? '-'
            : node.operator === 'positive'
              ? '+'
              : (() => {
                  throw new Error('Opérateur inconnu.');
                })()
        }${child(node.operand, 4)}`;
      case 'binary': {
        switch (node.operator) {
          case 'add':
            return `${child(node.left, 2)}+${child(node.right, 2, true)}`;
          case 'subtract':
            return `${child(node.left, 2)}-${child(node.right, 2, true)}`;
          case 'multiply':
            return `${child(node.left, 3, true)}\\times ${child(node.right, 3, true)}`;
          case 'divide':
            return `\\frac{${child(node.left, 3, true)}}{${child(node.right, 3, true)}}`;
          default:
            throw new Error('Opérateur binaire inconnu.');
        }
      }
      case 'power':
        return `{${child(node.base, 5, true)}}^{${child(node.exponent, 5, true)}}`;
      case 'subscript':
        return `{${child(node.base, 6, true)}}_{${child(node.subscript, 7)}}`;
      case 'function': {
        const argument = child(node.argument);
        switch (node.name) {
          case 'sqrt':
            return `\\sqrt{${argument}}`;
          case 'abs':
            return `\\left|${argument}\\right|`;
          case 'vec':
            return `\\vec{${argument}}`;
          case 'sin':
          case 'cos':
          case 'tan':
          case 'ln':
          case 'exp':
          case 'arcsin':
          case 'arccos':
          case 'arctan':
            return `\\${node.name}\\left(${argument}\\right)`;
          default:
            throw new Error('Fonction inconnue.');
        }
      }
      case 'comparison': {
        const operators: Record<string, string> = {
          equal: '=',
          'not-equal': '\\ne',
          'less-than': '<',
          'less-than-or-equal': '\\le',
          'greater-than': '>',
          'greater-than-or-equal': '\\ge',
        };
        const operator =
          typeof node.operator === 'string'
            ? operators[node.operator]
            : undefined;
        if (!operator) throw new Error('Comparaison inconnue.');
        return `{${child(node.left)}}${operator}{${child(node.right)}}`;
      }
      case 'relation': {
        const operators: Record<string, string> = {
          'belongs-to': '\\in',
          'does-not-belong-to': '\\notin',
          'strict-subset': '\\subset',
          subset: '\\subseteq',
          union: '\\cup',
          intersection: '\\cap',
          implies: '\\Rightarrow',
          equivalent: '\\Leftrightarrow',
        };
        const operator =
          typeof node.operator === 'string'
            ? operators[node.operator]
            : undefined;
        if (!operator) throw new Error('Relation inconnue.');
        return `{${child(node.left)}}${operator}{${child(node.right)}}`;
      }
      case 'interval': {
        if (
          typeof node.leftClosed !== 'boolean' ||
          typeof node.rightClosed !== 'boolean'
        )
          throw new Error('Intervalle invalide.');
        return `${node.leftClosed ? '[' : ']'}${child(node.lower)};${child(node.upper)}${node.rightClosed ? ']' : '['}`;
      }
      case 'bounded-operator': {
        const operator =
          node.operator === 'sum'
            ? '\\sum'
            : node.operator === 'product'
              ? '\\prod'
              : node.operator === 'integral'
                ? '\\int'
                : null;
        if (!operator) throw new Error('Opérateur borné inconnu.');
        return `${operator}${node.lower === null ? '' : `_{${child(node.lower)}}`}${node.upper === null ? '' : `^{${child(node.upper)}}`}`;
      }
      default:
        throw new Error('Nœud mathématique inconnu.');
    }
  };
  return visit(root, 1);
}
