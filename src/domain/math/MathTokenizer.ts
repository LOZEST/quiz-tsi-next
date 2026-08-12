import { mathParseError, type MathParseError } from './MathParseError.ts';
import {
  MATH_CONTROLLED_STANDALONE_SYMBOLS,
  MATH_GREEK_IDENTIFIER_SYMBOLS,
} from './MathSyntaxRegistry.ts';

export const MAX_MATH_SOURCE_LENGTH = 2_048;
export const MAX_MATH_TOKENS = 512;

export type MathTokenKind =
  | 'number'
  | 'identifier'
  | 'parameter'
  | 'symbol'
  | 'operator'
  | 'punctuation'
  | 'eof';
export interface MathToken {
  readonly kind: MathTokenKind;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}
export type MathTokenizeResult =
  | Readonly<{ ok: true; tokens: readonly MathToken[] }>
  | Readonly<{ ok: false; errors: readonly MathParseError[] }>;

const singleOperators = new Set([...'+-*/^_=<>∈∉⊂⊆∪∩⇒⇔≤≥≠']);
const punctuation = new Set([...'(),;[]']);
const isLatin = (value: string): boolean => /[A-Za-z]/u.test(value);
const isGreek = (value: string): boolean =>
  MATH_GREEK_IDENTIFIER_SYMBOLS.has(value);
const isDigit = (value: string): boolean => /[0-9]/u.test(value);

export function tokenizeMathSource(value: unknown): MathTokenizeResult {
  if (typeof value !== 'string') {
    return {
      ok: false,
      errors: [
        mathParseError(
          'invalid-tokenizer-source',
          'Le tokenizer mathématique attend une source textuelle.',
          null,
          null,
        ),
      ],
    };
  }
  const source = value;
  if (source.length > MAX_MATH_SOURCE_LENGTH)
    return {
      ok: false,
      errors: [
        mathParseError(
          'source-too-long',
          `La formule dépasse la limite technique de ${MAX_MATH_SOURCE_LENGTH} caractères.`,
          0,
          source.length,
        ),
      ],
    };
  const tokens: MathToken[] = [];
  const push = (token: MathToken): MathParseError | null => {
    tokens.push(token);
    return tokens.length > MAX_MATH_TOKENS
      ? mathParseError(
          'too-many-tokens',
          `La formule dépasse la limite technique de ${MAX_MATH_TOKENS} éléments.`,
          token.start,
          token.end,
        )
      : null;
  };
  let index = 0;
  while (index < source.length) {
    const character = source[index] as string;
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    const start = index;
    if (isDigit(character)) {
      while (index < source.length && isDigit(source[index] as string))
        index += 1;
      if (
        (source[index] === '.' || source[index] === ',') &&
        isDigit(source[index + 1] ?? '')
      ) {
        index += 1;
        while (index < source.length && isDigit(source[index] as string))
          index += 1;
      }
      const raw = source.slice(start, index);
      const error = push({
        kind: 'number',
        value: raw.replace(',', '.'),
        start,
        end: index,
      });
      if (error) return { ok: false, errors: [error] };
      continue;
    }
    if (character === '@') {
      index += 1;
      if (!isLatin(source[index] ?? ''))
        return {
          ok: false,
          errors: [
            mathParseError(
              'invalid-parameter',
              'Une variable paramétrée doit commencer par une lettre latine après `@`.',
              start,
              Math.min(index + 1, source.length),
              '@nom',
            ),
          ],
        };
      index += 1;
      while (
        index < source.length &&
        (isLatin(source[index] as string) ||
          isDigit(source[index] as string) ||
          source[index] === '_')
      )
        index += 1;
      const error = push({
        kind: 'parameter',
        value: source.slice(start + 1, index),
        start,
        end: index,
      });
      if (error) return { ok: false, errors: [error] };
      continue;
    }
    if (character === 'π') {
      index += 1;
      const error = push({
        kind: 'symbol',
        value: character,
        start,
        end: index,
      });
      if (error) return { ok: false, errors: [error] };
      continue;
    }
    if (isLatin(character) || isGreek(character)) {
      index += 1;
      while (
        index < source.length &&
        (isLatin(source[index] as string) ||
          isGreek(source[index] as string) ||
          isDigit(source[index] as string))
      )
        index += 1;
      const error = push({
        kind: 'identifier',
        value: source.slice(start, index),
        start,
        end: index,
      });
      if (error) return { ok: false, errors: [error] };
      continue;
    }
    const pair = source.slice(index, index + 2);
    if (pair === '<=' || pair === '>=' || pair === '!=') {
      index += 2;
      const error = push({ kind: 'operator', value: pair, start, end: index });
      if (error) return { ok: false, errors: [error] };
      continue;
    }
    if (MATH_CONTROLLED_STANDALONE_SYMBOLS.has(character)) {
      index += 1;
      const error = push({
        kind: 'symbol',
        value: character,
        start,
        end: index,
      });
      if (error) return { ok: false, errors: [error] };
      continue;
    }
    if (singleOperators.has(character)) {
      index += 1;
      const error = push({
        kind: 'operator',
        value: character,
        start,
        end: index,
      });
      if (error) return { ok: false, errors: [error] };
      continue;
    }
    if (punctuation.has(character)) {
      index += 1;
      const error = push({
        kind: 'punctuation',
        value: character,
        start,
        end: index,
      });
      if (error) return { ok: false, errors: [error] };
      continue;
    }
    return {
      ok: false,
      errors: [
        mathParseError(
          'unknown-character',
          `Le caractère \`${character}\` n’appartient pas au langage mathématique V1.`,
          start,
          start + 1,
        ),
      ],
    };
  }
  tokens.push({
    kind: 'eof',
    value: '',
    start: source.length,
    end: source.length,
  });
  return { ok: true, tokens };
}
