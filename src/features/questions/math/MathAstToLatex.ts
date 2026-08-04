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

export function mathAstToLatex(root: ResolvedMathAstNode): string {
  let count = 0;
  const visit = (raw: unknown, depth: number): string => {
    count += 1;
    if (count > MAX_RENDER_MATH_NODES || depth > MAX_RENDER_MATH_DEPTH)
      throw new Error('Formule trop complexe.');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
      throw new Error('Arbre mathématique invalide.');
    const node = raw as Record<string, unknown>;
    const child = (value: unknown) => visit(value, depth + 1);
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
        }${child(node.operand)}`;
      case 'binary': {
        const left = child(node.left);
        const right = child(node.right);
        switch (node.operator) {
          case 'add':
            return `{${left}}+{${right}}`;
          case 'subtract':
            return `{${left}}-{${right}}`;
          case 'multiply':
            return `{${left}}\\,{${right}}`;
          case 'divide':
            return `\\frac{${left}}{${right}}`;
          default:
            throw new Error('Opérateur binaire inconnu.');
        }
      }
      case 'power':
        return `{${child(node.base)}}^{${child(node.exponent)}}`;
      case 'subscript':
        return `{${child(node.base)}}_{${child(node.subscript)}}`;
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
