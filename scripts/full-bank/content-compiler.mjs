import { parseMathSource } from '../../src/domain/math/MathParser.ts';

const delimiters = /\\\((.*?)\\\)|\\\[(.*?)\\\]/gs;

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
    /^[A-Za-z0-9_@ αβγδεθλμπρσφωΔΣΩℕℤℚℝℂ∅∈∉⊂⊆∪∩∀∃⇒⇔∞∑∏∫∂∇∥⟂∠π+\-*/^<>=!()[\];,.]+$/u.test(
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
    const compiled = replaceMathIdentifiers(rawMath, parameterIds);
    if (canUseMathSource(compiled)) {
      segments.push({
        kind: match[2] === undefined ? 'inline-math' : 'display-math',
        math: { syntaxVersion: 1, source: compiled },
      });
      structured += 1;
    } else {
      segments.push({
        kind: 'text',
        value: `${match[2] === undefined ? '\\(' : '\\['}${compiled}${
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
