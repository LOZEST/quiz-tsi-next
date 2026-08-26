import { parseMathSource } from '../../src/domain/math/MathParser.ts';

const delimiters = /\\\((.*?)\\\)|\\\[(.*?)\\\]/gs;

const SPACING_COMMANDS =
  /^\\(left|right|displaystyle|!|,|;|:|quad|qquad|mathrm|operatorname)/;
// Same set, but global and unanchored: purely typographic spacing commands
// (\ln\!(...), a\,b) are safe to elide wherever they land, including right
// between a function name and its argument — where the main per-position
// scan below never gets a chance to strip them, since \ln is consumed as
// one atomic token before \! is ever reached.
const SPACING_COMMANDS_ANYWHERE =
  /\\(left|right|displaystyle|!|,|;|:|quad|qquad|mathrm|operatorname)/g;

const FRACTION_COMMANDS = /^\\(dfrac|frac|tfrac)/;
const MATHBB_COMMAND = /^\\mathbb\{([A-Za-z])\}/;
const MATHBB_BARE_COMMAND = /^\\mathbb\s*([A-Za-z])/;
const MATHBB_GLYPHS = { N: 'ℕ', Z: 'ℤ', Q: 'ℚ', R: 'ℝ', C: 'ℂ' };

const FUNCTION_NAMES = [
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
];
const functionBraceRegex = new RegExp(`^\\\\(${FUNCTION_NAMES.join('|')})\\{`);
const functionBarRegex = new RegExp(`^\\\\(${FUNCTION_NAMES.join('|')})\\|`);
const functionParenRegex = new RegExp(
  `^\\\\(${FUNCTION_NAMES.join('|')})(?=\\()`,
);
// Excludes "\cos^3(kx)" (= (cos x)^3) style shorthand — the exponent sits
// between the command and its argument, which a plain atom-consumer would
// misread as "cos(^) 3 (kx)"; safer to leave the whole thing untranslated.
const functionNameRegex = new RegExp(
  // (?![a-z]) rather than \b: a word boundary would reject "\sqrt2" since
  // "t" and "2" are both word characters with no boundary between them.
  `^\\\\(${FUNCTION_NAMES.join('|')})(?![a-z])(?!\\s*\\^)`,
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
  ['\\sum', '∑'],
  ['\\prod', '∏'],
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
 * Classic TeX lets \frac, \sin, \ln… take a single ungrouped token as their
 * argument ("\dfrac pq", "\sin x", "\sqrt2") instead of a {…} group. This
 * consumes exactly one such token: a braced group, one backslash symbol
 * (e.g. \theta), or one plain character.
 */
const parameterReferenceAt = /^@[A-Za-z][A-Za-z0-9_]*/;

function consumeAtom(str, index) {
  if (index >= str.length) return null;
  if (str[index] === '{') {
    const close = matchBraceArg(str, index);
    if (close === -1) return null;
    return [translateLatexToGrammar(str.slice(index + 1, close)), close + 1];
  }
  if (str[index] === '\\') {
    for (const [latex, glyph] of SIMPLE_SYMBOLS) {
      if (str.startsWith(latex, index)) return [glyph, index + latex.length];
    }
    return null;
  }
  if (str[index] === '@') {
    const reference = parameterReferenceAt.exec(str.slice(index));
    if (reference) return [reference[0], index + reference[0].length];
  }
  return [str[index], index + 1];
}

// French interval notation ("]0,+\infty[") separates its bounds with a
// comma; this grammar requires a semicolon ("]0;+∞["). Only swaps a comma
// sitting directly between two [ ] delimiters with no other bracket in
// between, so a comma inside a set or an argument list is never touched.
const intervalComma = /([[\]])([^[\]{}()]*),([^[\]{}()]*)([[\]])/g;

// Many AUTOMATISME answers write powers as literal Unicode superscript
// digits ("x²", "abx³") instead of "^2"/"^3" — unambiguous, so every run
// of them converts to this grammar's own "^" notation up front.
const SUPERSCRIPT_DIGITS = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};
const superscriptRun = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g;
const toSuperscriptPower = (run) =>
  `^${[...run].map((digit) => SUPERSCRIPT_DIGITS[digit]).join('')}`;

/**
 * Translates the LaTeX vocabulary actually used by the 1765-generator
 * source (\dfrac, \sqrt, \ln, \cdot, comparison/set symbols, |abs| bars…)
 * into the app's own simplified math grammar. Anything it cannot confidently
 * translate is left untouched, so canUseMathSource's backslash/brace check
 * still rejects it and the caller falls back to plain text as before —
 * this never trades a safe fallback for a guessed-wrong formula.
 */
export function translateLatexToGrammar(rawSource) {
  const source = rawSource
    .replace(SPACING_COMMANDS_ANYWHERE, '')
    .replace(intervalComma, '$1$2;$3$4')
    .replace(superscriptRun, toSuperscriptPower);
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
      // \dfrac{a}{b}, \dfrac pq, and even the mixed \dfrac{n(n-1)}2 all use
      // the same rule: each argument is either a {…} group or one ungrouped
      // token — exactly what consumeAtom already resolves.
      let atomStart = index + fraction[0].length;
      while (source[atomStart] === ' ') atomStart += 1;
      const numeratorAtom = consumeAtom(source, atomStart);
      if (numeratorAtom) {
        const [numerator, afterNumerator] = numeratorAtom;
        const denominatorAtom = consumeAtom(source, afterNumerator);
        if (denominatorAtom) {
          const [denominator, afterDenominator] = denominatorAtom;
          out += `(${numerator})/(${denominator})`;
          index = afterDenominator;
          continue;
        }
      }
    }

    const mathbb = MATHBB_COMMAND.exec(rest) ?? MATHBB_BARE_COMMAND.exec(rest);
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

    // \sin x, \ln @p, \sqrt2 : classic TeX also lets a function take a
    // single ungrouped token instead of (…)/{…}.
    const fnName = functionNameRegex.exec(rest);
    if (fnName) {
      let atomStart = index + fnName[0].length;
      while (source[atomStart] === ' ') atomStart += 1;
      const atom = consumeAtom(source, atomStart);
      if (atom) {
        const [argument, afterArgument] = atom;
        out += `${fnName[1]}(${argument})`;
        index = afterArgument;
        continue;
      }
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

    // The bare Unicode middle dot ("·", U+00B7) is used as a multiplication
    // sign throughout the source outside of \(...\) LaTeX spans too — this
    // is not a backslash command, so SIMPLE_SYMBOLS above never sees it.
    if (source[index] === '·') {
      out += '*';
      index += 1;
      continue;
    }

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
export function insertImplicitMultiplication(source, parameterIds = []) {
  // A declared parameter ("a" in "a(x-x0)") is confidently a coefficient,
  // never a function name, so it's exempt from the letterThenParen
  // exclusion below — matched longest-first so e.g. "alpha" isn't cut
  // short by a shorter unrelated id.
  const parameterHeadAt = parameterIds.length
    ? new RegExp(
        `^(${[...parameterIds]
          .sort((a, b) => b.length - a.length)
          .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|')})(?![A-Za-z0-9_])(?=\\()`,
      )
    : null;
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

    const parameterHead = parameterHeadAt?.exec(source.slice(index));
    if (parameterHead) {
      const previous = lastNonSpace(out);
      if (previous !== undefined && boundaryChar.test(previous)) out += '*';
      out += `${parameterHead[1]}*`;
      index += parameterHead[1].length;
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
      // to text instead of silently becoming "f * (x)". A declared
      // parameter immediately before "(" is handled above instead, since
      // that case is never ambiguous.
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

// "f(x)=…" / "f'(x)=…" / "(g\circ h)(x)=…": this grammar has no user-defined
// functions, function composition, or derivative notation (see
// insertImplicitMultiplication above), so the whole span would otherwise
// fall back to raw LaTeX text just because of this prefix, even when the
// right-hand side is perfectly translatable on its own. Splitting off the
// label — primes included, since they decorate the function symbol, not
// the formula — as plain text and compiling only the remainder lets the
// definition read naturally while still rendering the actual formula.
const namedFunctionDefinition =
  /^([A-Za-z](?:_[A-Za-z0-9]+)?)('*)\(([A-Za-z])\)\s*=\s*(.+)$/su;
const compositionDefinition =
  /^\(([A-Za-z](?:\\circ ?[A-Za-z])+)\)\(([A-Za-z])\)\s*=\s*(.+)$/su;

function extractDefinitionLabel(rawMath) {
  const composition = compositionDefinition.exec(rawMath);
  if (composition) {
    const [, chain, variable, rest] = composition;
    return [`(${chain.replace(/\\circ ?/g, '∘')})(${variable}) = `, rest];
  }
  const named = namedFunctionDefinition.exec(rawMath);
  if (named) {
    const [, name, primes, variable, rest] = named;
    return [`${name}${primes}(${variable}) = `, rest];
  }
  return null;
}

function compileMathSpan(rawMath, isDisplay, parameterIds) {
  const translated = insertImplicitMultiplication(
    translateLatexToGrammar(rawMath),
    parameterIds,
  );
  const compiled = replaceMathIdentifiers(translated, parameterIds);
  if (canUseMathSource(compiled)) {
    return {
      segments: [
        {
          kind: isDisplay ? 'display-math' : 'inline-math',
          math: { syntaxVersion: 1, source: compiled },
        },
      ],
      structured: 1,
      fallback: 0,
    };
  }
  const fallbackCompiled = replaceMathIdentifiers(rawMath, parameterIds);
  return {
    segments: [
      {
        kind: 'text',
        value: `${isDisplay ? '\\[' : '\\('}${fallbackCompiled}${
          isDisplay ? '\\]' : '\\)'
        }`,
      },
    ],
    structured: 0,
    fallback: 1,
  };
}

// About a quarter of the bank (the AUTOMATISME/"reflex" generators) never
// wraps its formulas in \(...\) at all — "Calculer {a}\cdot{t}+{b}." rather
// than "Calculer \({a}\cdot{t}+{b}\)". compileContent's delimiter loop above
// never sees these, so they'd otherwise show the raw grammar-ish source
// (asterisks, backslashes and all) verbatim.
//
// canUseMathSource's parse check alone isn't a safe enough net here: an
// unaccented French word ("Calculer", "dans") has no character this
// grammar's tokenizer rejects, and insertImplicitMultiplication would
// happily chop it into single-letter "variables" ("Calculer" ->
// "C*a*l*c*u*l*e*r*…") that then parse as bogus-but-valid math. So a
// candidate is rejected outright if it contains a run of 3+ plain Latin
// letters that isn't a recognized function name or a declared parameter —
// genuine math in this dataset never chains that many bare letters
// without an operator, a digit, or a backslash between them.
const mathSignal = /[0-9{}\\^√±@²³⁴⁵⁶⁷⁸⁹⁰¹]/;
// Not preceded by "\": a run right after a backslash is a LaTeX command
// name (cdot, circ, left…), not a bare word, and is handled elsewhere.
// Matches either a whole "\command" (group 1, always ignored below — it's
// a LaTeX command name, not a word) or a bare letter run (group 2, the one
// actually checked). A lookbehind alone isn't enough here: it only blocks a
// match from starting right after "\", so "\cdot" would still leave "dot"
// matchable as its own run starting at the second letter.
const commandOrLetterRun = /\\[A-Za-z]+|([A-Za-z]+)/g;
const namedFunctionOrCompositionSearch =
  /(?:\(([A-Za-z](?:\\circ ?[A-Za-z])+)\)\(([A-Za-z])\)|([A-Za-z](?:_[A-Za-z0-9]+)?)('*)\(([A-Za-z])\))\s*=\s*/su;

// Short French connector words this dataset's prose actually uses as
// standalone tokens ("e^{t} et e^({t}+1)") — a 3-letter threshold alone
// would let "et", "ou", "un"… through as bogus 1-letter-variable products.
const FRENCH_STOPWORDS = new Set([
  'et',
  'ou',
  'de',
  'du',
  'un',
  'une',
  'la',
  'le',
  'les',
  'des',
  'en',
  'sur',
  'par',
  'or',
  'ni',
  'au',
  'aux',
  'à',
  'est',
  'on',
  'ne',
  'si',
]);

function hasUnrecognizedWord(candidate, parameterIds) {
  const known = new Set([...FUNCTION_NAMES, ...parameterIds]);
  for (const match of candidate.matchAll(commandOrLetterRun)) {
    const word = match[1];
    if (word === undefined || known.has(word)) continue;
    if (word.length > 2) return true;
    if (FRENCH_STOPWORDS.has(word.toLowerCase())) return true;
  }
  return false;
}

function tryBareCandidate(candidate, parameterIds) {
  if (!mathSignal.test(candidate)) return null;
  if (hasUnrecognizedWord(candidate, parameterIds)) return null;
  const translated = insertImplicitMultiplication(
    translateLatexToGrammar(candidate),
    parameterIds,
  );
  const compiled = replaceMathIdentifiers(translated, parameterIds);
  return canUseMathSource(compiled) ? compiled : null;
}

function longestValidTrailingMath(text, parameterIds) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1)
    if (text[index] === ' ') starts.push(index + 1);
  for (const start of starts) {
    const compiled = tryBareCandidate(text.slice(start), parameterIds);
    if (compiled !== null) return [text.slice(0, start), compiled];
  }
  return null;
}

// "S=(ax+b)/x² ; D=R\{0}." pairs a formula with a domain clause this
// grammar can't express (set difference). Splitting on " ; " first lets
// the formula still convert even though the domain clause never will.
// Splits bare (non-\(...\)) text into independently-compilable clauses on
// " ; " and on a sentence-ending ". " followed by a capital letter (never
// inside a decimal like "0.01", which has no space after the digits) —
// "La droite fournie est y=ax+b. Trouver x pour y=7." has two unrelated
// formulas that would otherwise have to validate as a single, unparseable
// two-sentence blob.
const bareClauseSeparator = /( ; |\.\s+(?=[A-ZÀ-Ý]))/;

function compileBareText(rawText, parameterIds) {
  const parts = rawText.split(bareClauseSeparator);
  if (parts.length === 1) return compileBareClause(rawText, parameterIds);
  const segments = [];
  let structured = 0;
  let fallback = 0;
  for (const part of parts) {
    if (part === ' ; ' || /^\.\s+$/.test(part)) {
      segments.push({ kind: 'text', value: part });
      continue;
    }
    const compiled = compileBareClause(part, parameterIds);
    segments.push(...compiled.segments);
    structured += compiled.structured;
    fallback += compiled.fallback;
  }
  return { segments, structured, fallback };
}

function compileBareClause(rawText, parameterIds) {
  const trailingPeriod = /[.]\s*$/.exec(rawText);
  const body = trailingPeriod
    ? rawText.slice(0, trailingPeriod.index)
    : rawText;
  const suffix = trailingPeriod ? trailingPeriod[0] : '';

  const definitionMatch = namedFunctionOrCompositionSearch.exec(body);
  if (definitionMatch) {
    const [, chain, compVar, name, primes, fnVar] = definitionMatch;
    const label =
      chain !== undefined
        ? `(${chain.replace(/\\circ ?/g, '∘')})(${compVar}) = `
        : `${name}${primes}(${fnVar}) = `;
    const rest = body.slice(definitionMatch.index + definitionMatch[0].length);
    const compiled = tryBareCandidate(rest, parameterIds);
    if (compiled !== null) {
      const segments = [];
      const prefix = body.slice(0, definitionMatch.index);
      if (prefix)
        segments.push({
          kind: 'text',
          value: replaceDeclaredPlaceholders(prefix, parameterIds),
        });
      segments.push({ kind: 'text', value: label });
      segments.push({
        kind: 'inline-math',
        math: { syntaxVersion: 1, source: compiled },
      });
      if (suffix) segments.push({ kind: 'text', value: suffix });
      return { segments, structured: 1, fallback: 0 };
    }
  }

  const trailing = longestValidTrailingMath(body, parameterIds);
  if (trailing) {
    const [prefix, compiled] = trailing;
    const segments = [];
    if (prefix)
      segments.push({
        kind: 'text',
        value: replaceDeclaredPlaceholders(prefix, parameterIds),
      });
    segments.push({
      kind: 'inline-math',
      math: { syntaxVersion: 1, source: compiled },
    });
    if (suffix) segments.push({ kind: 'text', value: suffix });
    return { segments, structured: 1, fallback: 0 };
  }

  return {
    segments: [
      {
        kind: 'text',
        value: replaceDeclaredPlaceholders(rawText, parameterIds),
      },
    ],
    structured: 0,
    fallback: 0,
  };
}

export function compileContent(source, parameterIds) {
  const segments = [];
  let cursor = 0;
  let structured = 0;
  let fallback = 0;
  for (const match of source.matchAll(delimiters)) {
    const start = match.index;
    if (start > cursor) {
      const bare = compileBareText(source.slice(cursor, start), parameterIds);
      segments.push(...bare.segments);
      structured += bare.structured;
      fallback += bare.fallback;
    }
    const rawMath = match[1] ?? match[2] ?? '';
    const isDisplay = match[2] !== undefined;
    const definition = extractDefinitionLabel(rawMath);
    if (definition) {
      const [label, rest] = definition;
      segments.push({ kind: 'text', value: label });
      const compiled = compileMathSpan(rest, isDisplay, parameterIds);
      segments.push(...compiled.segments);
      structured += compiled.structured;
      fallback += compiled.fallback;
    } else {
      const compiled = compileMathSpan(rawMath, isDisplay, parameterIds);
      segments.push(...compiled.segments);
      structured += compiled.structured;
      fallback += compiled.fallback;
    }
    cursor = start + match[0].length;
  }
  if (cursor < source.length || segments.length === 0) {
    const bare = compileBareText(source.slice(cursor), parameterIds);
    segments.push(...bare.segments);
    structured += bare.structured;
    fallback += bare.fallback;
  }
  return { segments, structured, fallback };
}
