import { describe, expect, it } from 'vitest';
import {
  createSeededRandom,
  deriveQuestionValidationSeed,
  SEEDED_RANDOM_ALGORITHM,
  SEEDED_RANDOM_VERSION,
} from '../../../src/domain/questions/SeededRandom';

describe('SeededRandom', () => {
  it('reproduit exactement une séquence et reste versionné', () => {
    const a = createSeededRandom('seed')!;
    const b = createSeededRandom('seed')!;
    expect([a.next(), a.next(), a.next()]).toEqual([
      b.next(),
      b.next(),
      b.next(),
    ]);
    expect(SEEDED_RANDOM_ALGORITHM).toBe('xmur3-mulberry32');
    expect(SEEDED_RANDOM_VERSION).toBe(1);
  });
  it('distingue les seeds et refuse la chaîne vide', () => {
    expect(createSeededRandom('a')!.next()).not.toBe(
      createSeededRandom('b')!.next(),
    );
    expect(createSeededRandom('')).toBeNull();
  });
  it('dérive une seed sans date ni environnement', () =>
    expect(deriveQuestionValidationSeed('q', 2)).toBe(
      'parameter-validation:v1:q:v2',
    ));
});
