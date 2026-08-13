import { parseMathSource } from '../../src/domain/math/MathParser.ts';

const delimiters = /\\\((.*?)\\\)|\\\[(.*?)\\\]/gs;

const SPACING_COMMANDS =
  /^\\(left|right|displaystyle|!|,|;|:|quad|qquad|mathrm|operatorname)/;

const FRACTION_COMMANDS = /^\\(dfrac|frac|tfrac)\{/;
const SQRT_COMMAND = /^\\sqrt\{/;
const MATHBB_COMMAND = /^\\mathbb\{([A-Za-z])\}/;
const MATHBB_GLYPHS = { N: 'ℕ', Z: 'ℤ', Q: 'ℚ', R: 'ℝ', C: 'ℂ' };

const FUNCTION_NAMES = ['sqrt', 'abs', 'vec', 'sin', 'cos', 'tan', 'ln', 'exp'];
const functionBraceRegex = new RegExp(`^\\\\(${FUNCTION_NAMES.join('|')})\\{`);
const functionBarRegex = new RegExp(`^\\\\(${FUNCTION_NAMES.join('|')})\\|`);
const functionParenRegex = new RegExp(
  `^\\\\(${FUNCTION_NAMES.join('|')})(?=\\()`,
);

// Longest-match-first so e.g. \neq is tried before \ne, \geq before \ge.
const SIMPLE_SYMBOLS = [
  ['\\Leftrightarrow', '⇔'],
  ['\\Rightarrow', '⇒'],
  ['\\rightarrow', '⇒'],
  ['\\iff', '⇔'],
  ['\\notin', '∉'],
  ['\\subseteq', '⊆'],
  ['\\subset', '⊂'],
  ['\\varnothing', '∅'],
  ['\\emptyset', '∅'],
  ['\\infty', '∞'],
  ['\\forall', '∀'],
  ['\\exists', '∃'],
  ['\\cdot', '*'],
  ['\\times', '*'],
  ['\\neq', '≠'],
  ['\\ne', '≠'],
  ['\\geq', '≥'],
  ['\\ge', '≥'],
  ['\\leq', '≤'],
  ['\\le', '≤'],
  ['\\in', '∈'],
  ['\\cup', '∪'],
  ['\\cap', '∩'],
  ['\\pi', 'π'],
  ['\\alpha', 'α'],
  ['\\beta', 'β'],
  ['\\gamma', 'γ'],
  ['\\delta', 'δ'],
  ['\\theta', 'θ'],
  ['\\lambda', 'λ'],
  ['\\mu', 'μ'],
  ['\\rho', 'ρ'],
  ['\\sigma', 'σ'],
  ['\\varphi', 'φ'],
  ['\\phi', 'φ'],
  ['\\omega', 'ω'],
].sort((a, b) => b[0].length - a[0].length);

function matchBraceArg(str, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < str.length; index += 1) {
    if (str[index] === '{') depth += 1;
    else if (str[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Translates the LaTeX vocabulary actually used by the 1765-generator
 * source (\dfrac, \sqrt, \ln, \cdot, comparison/set symbols, |abs| bars…)
 * into the app's own simplified math grammar. Anything it cannot confidently
 * translate is left untouched, so canUseMathSource's backslash/brace check
 * still rejects it and the caller falls back to plain text as before —
 * this never trades a safe fallback for a guessed-wrong formula.
 */
export function translateLatexToGrammar(source) {
  let out = '';
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);

    const spacing = SPACING_COMMANDS.exec(rest);
    if (spacing) {
      index += spacing[0].length;
      continue;
    }

    const fraction = FRACTION_COMMANDS.exec(rest);
    if (fraction) {
      const openA = index + fraction[0].length - 1;
      const closeA = matchBraceArg(source, openA);
      if (closeA !== -1 && source[closeA + 1] === '{') {
        const closeB = matchBraceArg(source, closeA + 1);
        if (closeB !== -1) {
          const numerator = translateLatexToGrammar(
            source.slice(openA + 1, closeA),
          );
          const denominator = translateLatexToGrammar(
            source.slice(closeA + 2, closeB),
          );
          out += `(${numerator})/(${denominator})`;
          index = closeB + 1;
          continue;
        }
      }
    }

    const sqrt = SQRT_COMMAND.exec(rest);
    if (sqrt) {
      const open = index + sqrt[0].length - 1;
      const close = matchBraceArg(source, open);
      if (close !== -1) {
        const argument = translateLatexToGrammar(source.slice(open + 1, close));
        out += `sqrt(${argument})`;
        index = close + 1;
        continue;
      }
    }

    const mathbb = MATHBB_COMMAND.exec(rest);
    if (mathbb && MATHBB_GLYPHS[mathbb[1]]) {
      out += MATHBB_GLYPHS[mathbb[1]];
      index += mathbb[0].length;
      continue;
    }

    const fnBrace = functionBraceRegex.exec(rest);
    if (fnBrace) {
      const open = index + fnBrace[0].length - 1;
      const close = matchBraceArg(source, open);
      if (close !== -1) {
        const argument = translateLatexToGrammar(source.slice(open + 1, close));
        out += `${fnBrace[1]}(${argument})`;
        index = close + 1;
        continue;
      }
    }

    const fnBar = functionBarRegex.exec(rest);
    if (fnBar) {
      const barStart = index + fnBar[0].length - 1;
      const barEnd = source.indexOf('|', barStart + 1);
      if (barEnd !== -1) {
        const argument = translateLatexToGrammar(
          source.slice(barStart + 1, barEnd),
        );
        out += `${fnBar[1]}(abs(${argument}))`;
        index = barEnd + 1;
        continue;
      }
    }

    const fnParen = functionParenRegex.exec(rest);
    if (fnParen) {
      out += fnParen[1];
      index += fnParen[0].length;
      continue;
    }

    let matchedSymbol = false;
    for (const [latex, glyph] of SIMPLE_SYMBOLS) {
      if (source.startsWith(latex, index)) {
        out += glyph;
        index += latex.length;
        matchedSymbol = true;
        break;
      }
    }
    if (matchedSymbol) continue;

    if (source[index] === '|') {
      const barEnd = source.indexOf('|', index + 1);
      if (barEnd !== -1) {
        const argument = translateLatexToGrammar(
          source.slice(index + 1, barEnd),
        );
        out += `abs(${argument})`;
        index = barEnd + 1;
        continue;
      }
    }

    // A leftover brace group not owned by a specific command above — e.g.
    // the {k} in \sqrt{x^{k}} once the outer \sqrt has been unwrapped.
    // Drop the braces for a single simple token (x^{k} -> x^k); keep them
    // as parentheses, matching this grammar's own composite-exponent
    // syntax, when the content is itself an expression (x^{k+1} -> x^(k+1)).
    if (source[index] === '{') {
      const close = matchBraceArg(source, index);
      if (close !== -1) {
        const inner = translateLatexToGrammar(source.slice(index + 1, close));
        out += /^[A-Za-z0-9αβγδεθλμπρσφω]+$/u.test(inner)
          ? inner
          : `(${inner})`;
        index = close + 1;
        continue;
      }
    }

    out += source[index];
    index += 1;
  }
  return out;
}

const LATIN_OR_GREEK = 'A-Za-zαβγδεθλμπρσφω';
const boundaryChar = new RegExp(`^[${LATIN_OR_GREEK}0-9)]$`, 'u');
const followChar = new RegExp(`^[${LATIN_OR_GREEK}0-9(]$`, 'u');
const digitChar = /^[0-9]$/;
const letterChar = new RegExp(`^[${LATIN_OR_GREEK}]$`, 'u');
const functionHeadAt = new RegExp(`^(${FUNCTION_NAMES.join('|')})(?=\\()`, 'u');

function lastNonSpace(str) {
  for (let index = str.length - 1; index >= 0; index -= 1) {
    if (str[index] !== ' ') return str[index];
  }
  return undefined;
}

function nextNonSpace(str, fromIndex) {
  let index = fromIndex;
  while (index < str.length && str[index] === ' ') index += 1;
  return str[index];
}

/**
 * LaTeX never needs an explicit multiplication sign ("ax" already reads as
 * a·x), but this app's grammar requires one. This inserts "*" at the
 * unambiguous juxtaposition boundaries this dataset actually produces
 * (digit-letter, letter-letter, and any of those next to parentheses),
 * while keeping known function calls ("sqrt(", "ln(", …) intact — a
 * function name is consumed as one atomic token so its own letters are
 * never split, and nothing here relies on characters the source text
 * could itself contain (unlike a sentinel/placeholder scheme, which a
 * literal space in the input — e.g. "\cdot a" — would corrupt).
 */
export function insertImplicitMultiplication(source) {
  let out = '';
  let index = 0;
  while (index < source.length) {
    const functionHead = functionHeadAt.exec(source.slice(index));
    if (functionHead) {
      const previous = lastNonSpace(out);
      if (previous !== undefined && boundaryChar.test(previous)) out += '*';
      out += functionHead[1];
      index += functionHead[1].length;
      continue;
    }

    const current = source[index];
    out += current;
    // Look past any whitespace so LaTeX's optional spacing ("a x+b", from
    // e.g. "\dfrac{k}{a x+b}") doesn't hide a juxtaposition that still
    // needs an explicit "*" in this grammar.
    const next = current === ' ' ? undefined : nextNonSpace(source, index + 1);
    if (next !== undefined) {
      const bothDigits = digitChar.test(current) && digitChar.test(next);
      const letterThenDigit = letterChar.test(current) && digitChar.test(next);
      // "f(" / "u(" reads as a function application (f(x) = …), not a
      // multiplication — this grammar has no user-defined functions, so
      // leaving it alone means it correctly fails to parse and falls back
      // to text instead of silently becoming "f * (x)".
      const letterThenParen = letterChar.test(current) && next === '(';
      if (
        boundaryChar.test(current) &&
        followChar.test(next) &&
        !bothDigits &&
        !letterThenDigit &&
        !letterThenParen
      ) {
        out += '*';
      }
    }
    index += 1;
  }
  return out;
}

function replaceDeclaredPlaceholders(source, parameterIds) {
  let result = source;
  for (const id of [...parameterIds].sort((a, b) => b.length - a.length)) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
      new RegExp(`\\{${escaped}\\}(?=[A-Za-z0-9{])`, 'g'),
      `@${id}*`,
    );
    result = result.replaceAll(`{${id}}`, `@${id}`);
  }
  return result;
}

function replaceMathIdentifiers(source, parameterIds) {
  let result = replaceDeclaredPlaceholders(source, parameterIds);
  for (const id of [...parameterIds].sort((a, b) => b.length - a.length)) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
      new RegExp(`(?<![A-Za-z0-9_@])${escaped}(?![A-Za-z0-9_])`, 'g'),
      `@${id}`,
    );
  }
  return result;
}

function canUseMathSource(source) {
  return (
    source.length > 0 &&
    !source.includes('\\') &&
    !/[{}]/.test(source) &&
    /^[A-Za-z0-9_@ αβγδεθλμπρσφωΔΣΩℕℤℚℝℂ∅∈∉⊂⊆∪∩∀∃⇒⇔∞∑∏∫∂∇∥⟂∠π≠≤≥+\-*/^<>=!()[\];,.]+$/u.test(
      source,
    ) &&
    parseMathSource({ syntaxVersion: 1, source }).ok
  );
}

export function compileContent(source, parameterIds) {
  const segments = [];
  let cursor = 0;
  let structured = 0;
  let fallback = 0;
  for (const match of source.matchAll(delimiters)) {
    const start = match.index;
    if (start > cursor)
      segments.push({
        kind: 'text',
        value: replaceDeclaredPlaceholders(
          source.slice(cursor, start),
          parameterIds,
        ),
      });
    const rawMath = match[1] ?? match[2] ?? '';
    const translated = insertImplicitMultiplication(
      translateLatexToGrammar(rawMath),
    );
    const compiled = replaceMathIdentifiers(translated, parameterIds);
    if (canUseMathSource(compiled)) {
      segments.push({
        kind: match[2] === undefined ? 'inline-math' : 'display-math',
        math: { syntaxVersion: 1, source: compiled },
      });
      structured += 1;
    } else {
      const fallbackCompiled = replaceMathIdentifiers(rawMath, parameterIds);
      segments.push({
        kind: 'text',
        value: `${match[2] === undefined ? '\\(' : '\\['}${fallbackCompiled}${
          match[2] === undefined ? '\\)' : '\\]'
        }`,
      });
      fallback += 1;
    }
    cursor = start + match[0].length;
  }
  if (cursor < source.length || segments.length === 0)
    segments.push({
      kind: 'text',
      value: replaceDeclaredPlaceholders(source.slice(cursor), parameterIds),
    });
  return { segments, structured, fallback };
}
