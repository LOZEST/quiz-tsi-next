export const SEEDED_RANDOM_ALGORITHM = 'xmur3-mulberry32';
export const SEEDED_RANDOM_VERSION = 1;

export type SeededRandom = Readonly<{
  next: () => number;
  nextInteger: (maximumExclusive: number) => number;
}>;

export function createSeededRandom(seed: unknown): SeededRandom | null {
  if (typeof seed !== 'string' || seed.length === 0) return null;
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  let state = (hash ^ (hash >>> 16)) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return Object.freeze({
    next,
    nextInteger(maximumExclusive: number) {
      if (!Number.isSafeInteger(maximumExclusive) || maximumExclusive <= 0) {
        return 0;
      }
      return Math.floor(next() * maximumExclusive);
    },
  });
}

export function deriveQuestionValidationSeed(
  questionId: string,
  questionVersion: number,
): string {
  return `parameter-validation:v${SEEDED_RANDOM_VERSION}:${questionId}:v${questionVersion}`;
}
