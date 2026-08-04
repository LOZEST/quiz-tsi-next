import {
  MAX_SAFE_SNAPSHOT_ARRAY_LENGTH,
  MAX_SAFE_SNAPSHOT_STRING_LENGTH,
  MAX_SAFE_SNAPSHOT_TOTAL_CHARACTERS,
  createSafeSnapshot,
} from '../../../src/domain/validation/SafeSnapshot';

describe('createSafeSnapshot', () => {
  it('conserve exactement un tableau dense ordinaire', () => {
    const source = ['a', { value: 2 }, false];
    const result = createSafeSnapshot(source);
    expect(result).toEqual({ ok: true, value: source });
    if (result.ok) expect(result.value).not.toBe(source);
  });

  it.each([
    [
      'longueur excessive',
      () => new Array<unknown>(MAX_SAFE_SNAPSHOT_ARRAY_LENGTH + 1),
    ],
    ['tableau immense et creux', () => new Array<unknown>(4_000_000_000)],
    [
      'trou intermédiaire',
      () => {
        const value = new Array<number>(3);
        value[0] = 1;
        value[2] = 3;
        return value;
      },
    ],
    ['propriété personnalisée', () => Object.assign([1], { custom: true })],
    [
      'getter sur indice',
      () => Object.defineProperty([1], '0', { get: () => 1 }),
    ],
    [
      'Proxy hostile',
      () =>
        new Proxy([], {
          ownKeys: () => {
            throw new Error('hostile');
          },
        }),
    ],
  ])('refuse un %s', (_label, create) => {
    expect(createSafeSnapshot(create()).ok).toBe(false);
  });

  it('accepte une chaîne exactement à la limite', () => {
    expect(
      createSafeSnapshot('x'.repeat(MAX_SAFE_SNAPSHOT_STRING_LENGTH)).ok,
    ).toBe(true);
  });

  it('refuse une chaîne au-dessus de la limite', () => {
    expect(
      createSafeSnapshot('x'.repeat(MAX_SAFE_SNAPSHOT_STRING_LENGTH + 1)).ok,
    ).toBe(false);
  });

  it('refuse plusieurs chaînes dépassant le budget total', () => {
    const values = Array.from(
      {
        length:
          Math.floor(
            MAX_SAFE_SNAPSHOT_TOTAL_CHARACTERS /
              MAX_SAFE_SNAPSHOT_STRING_LENGTH,
          ) + 1,
      },
      () => 'x'.repeat(MAX_SAFE_SNAPSHOT_STRING_LENGTH),
    );
    expect(createSafeSnapshot(values).ok).toBe(false);
  });
});
