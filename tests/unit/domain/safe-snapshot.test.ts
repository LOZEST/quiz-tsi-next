import {
  MAX_SAFE_SNAPSHOT_ARRAY_LENGTH,
  MAX_SAFE_SNAPSHOT_NODES,
  MAX_SAFE_SNAPSHOT_OBJECT_PROPERTIES,
  MAX_SAFE_SNAPSHOT_PROPERTY_NAME_LENGTH,
  MAX_SAFE_SNAPSHOT_STRING_LENGTH,
  MAX_SAFE_SNAPSHOT_TOTAL_CHARACTERS,
  MAX_SAFE_SNAPSHOT_TOTAL_PROPERTIES,
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

  const primitiveObject = (value: number | boolean | null) =>
    Object.fromEntries(
      Array.from(
        { length: MAX_SAFE_SNAPSHOT_OBJECT_PROPERTIES + 1 },
        (_, index) => [`p${index}`, value],
      ),
    );

  it.each([
    ['nombres', 1],
    ['booléens', true],
    ['valeurs nulles', null],
  ])('refuse un objet contenant énormément de %s', (_label, value) => {
    expect(() => createSafeSnapshot(primitiveObject(value))).not.toThrow();
    expect(createSafeSnapshot(primitiveObject(value)).ok).toBe(false);
  });

  it('compte les primitives dans le budget total de nœuds', () => {
    const groupLength = Math.floor(MAX_SAFE_SNAPSHOT_NODES / 6);
    const source = Array.from({ length: 6 }, () =>
      Array.from({ length: groupLength }, () => false),
    );
    expect(source.length + 6 * groupLength).toBeGreaterThan(
      MAX_SAFE_SNAPSHOT_NODES,
    );
    expect(createSafeSnapshot(source).ok).toBe(false);
  });

  it('refuse le dépassement de propriétés par objet', () => {
    expect(createSafeSnapshot(primitiveObject(0)).ok).toBe(false);
  });

  it('refuse le dépassement cumulé de propriétés', () => {
    const propertiesPerObject = Math.floor(
      MAX_SAFE_SNAPSHOT_TOTAL_PROPERTIES / 3,
    );
    const child = (prefix: string) =>
      Object.fromEntries(
        Array.from({ length: propertiesPerObject }, (_, index) => [
          `${prefix}${index}`,
          null,
        ]),
      );
    expect(
      createSafeSnapshot({ a: child('a'), b: child('b'), c: child('c') }).ok,
    ).toBe(false);
  });

  it('accepte un nom de propriété exactement à la limite', () => {
    const key = 'k'.repeat(MAX_SAFE_SNAPSHOT_PROPERTY_NAME_LENGTH);
    const result = createSafeSnapshot({ [key]: null });
    expect(result.ok).toBe(true);
  });

  it('refuse un nom de propriété au-dessus de la limite', () => {
    const key = 'k'.repeat(MAX_SAFE_SNAPSHOT_PROPERTY_NAME_LENGTH + 1);
    expect(createSafeSnapshot({ [key]: null }).ok).toBe(false);
  });

  it('compte les noms de propriétés dans le budget de caractères', () => {
    const keyLength = 500;
    const count =
      Math.floor(MAX_SAFE_SNAPSHOT_TOTAL_CHARACTERS / keyLength) + 1;
    const source = Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `${'k'.repeat(keyLength - 6)}${String(index).padStart(6, '0')}`,
        null,
      ]),
    );
    expect(createSafeSnapshot(source).ok).toBe(false);
  });

  it('accepte une structure juste sous les budgets applicables sans modifier la source', () => {
    const keyLength = 500;
    const fullKeys =
      Math.floor(MAX_SAFE_SNAPSHOT_TOTAL_CHARACTERS / keyLength) - 1;
    const source = Object.fromEntries(
      Array.from({ length: fullKeys }, (_, index) => [
        `${'k'.repeat(keyLength - 6)}${String(index).padStart(6, '0')}`,
        index,
      ]),
    );
    const result = createSafeSnapshot(source);
    expect(result.ok).toBe(true);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.keys(source)).toHaveLength(fullKeys);
    if (result.ok) expect(result.value).not.toBe(source);
  });

  it('refuse explicitement une propriété non énumérable', () => {
    const source = Object.defineProperty({}, 'hidden', {
      value: true,
      enumerable: false,
    });
    expect(createSafeSnapshot(source).ok).toBe(false);
  });
});
