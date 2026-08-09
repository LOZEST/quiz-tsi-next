export const MAX_SAFE_SNAPSHOT_DEPTH = 64;
export const MAX_SAFE_SNAPSHOT_NODES = 50_000;
export const MAX_SAFE_SNAPSHOT_ARRAY_LENGTH = 10_000;
export const MAX_SAFE_SNAPSHOT_STRING_LENGTH = 10_000;
export const MAX_SAFE_SNAPSHOT_TOTAL_CHARACTERS = 100_000;
export const MAX_SAFE_SNAPSHOT_OBJECT_PROPERTIES = 10_000;
export const MAX_SAFE_SNAPSHOT_TOTAL_PROPERTIES = 20_000;
export const MAX_SAFE_SNAPSHOT_PROPERTY_NAME_LENGTH = 512;

export type SafeSnapshotResult =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false; message: string }>;

export interface SafeSnapshotLimits {
  readonly maxTotalCharacters?: number;
}

export function createSafeSnapshot(
  value: unknown,
  limits: SafeSnapshotLimits = {},
): SafeSnapshotResult {
  try {
    let nodes = 0;
    let totalCharacters = 0;
    let totalProperties = 0;
    const active = new WeakSet<object>();
    const copy = (input: unknown, depth: number): unknown => {
      if (depth > MAX_SAFE_SNAPSHOT_DEPTH) throw new Error('depth');
      nodes += 1;
      if (nodes > MAX_SAFE_SNAPSHOT_NODES) throw new Error('size');
      if (input === null || typeof input === 'boolean') return input;
      if (typeof input === 'string') {
        if (input.length > MAX_SAFE_SNAPSHOT_STRING_LENGTH)
          throw new Error('string-length');
        totalCharacters += input.length;
        if (
          totalCharacters >
          (limits.maxTotalCharacters ?? MAX_SAFE_SNAPSHOT_TOTAL_CHARACTERS)
        )
          throw new Error('character-budget');
        return input;
      }
      if (typeof input === 'number') {
        if (!Number.isFinite(input)) throw new Error('non-finite');
        return input;
      }
      if (typeof input !== 'object') throw new Error('unsupported');
      if (active.has(input)) throw new Error('cycle');
      const isArray = Array.isArray(input);
      const prototype: unknown = Object.getPrototypeOf(input);
      if (
        isArray
          ? prototype !== Array.prototype
          : prototype !== Object.prototype && prototype !== null
      )
        throw new Error('prototype');
      if (Object.getOwnPropertySymbols(input).length > 0)
        throw new Error('symbol');
      const accountProperty = (key: string): void => {
        if (key.length > MAX_SAFE_SNAPSHOT_PROPERTY_NAME_LENGTH)
          throw new Error('property-name-length');
        totalProperties += 1;
        if (totalProperties > MAX_SAFE_SNAPSHOT_TOTAL_PROPERTIES)
          throw new Error('property-budget');
        totalCharacters += key.length;
        if (
          totalCharacters >
          (limits.maxTotalCharacters ?? MAX_SAFE_SNAPSHOT_TOTAL_CHARACTERS)
        )
          throw new Error('character-budget');
      };
      active.add(input);
      if (isArray) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(
          input,
          'length',
        );
        if (
          !lengthDescriptor ||
          !('value' in lengthDescriptor) ||
          typeof lengthDescriptor.value !== 'number'
        )
          throw new Error('array-length');
        const length = lengthDescriptor.value;
        if (
          !Number.isInteger(length) ||
          length < 0 ||
          length > MAX_SAFE_SNAPSHOT_ARRAY_LENGTH
        )
          throw new Error('array-length');
        const names = Object.getOwnPropertyNames(input);
        if (names.length !== length + 1)
          throw new Error('sparse-or-custom-array');
        const output = new Array<unknown>(length);
        for (let index = 0; index < length; index += 1) {
          const key = String(index);
          if (names[index] !== key) throw new Error('sparse-or-custom-array');
          const descriptor = Object.getOwnPropertyDescriptor(input, key);
          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
            throw new Error('accessor');
          output[index] = copy(descriptor.value, depth + 1);
        }
        active.delete(input);
        return output;
      }
      const output: Record<string, unknown> = {};
      const names = Object.getOwnPropertyNames(input);
      if (names.length > MAX_SAFE_SNAPSHOT_OBJECT_PROPERTIES)
        throw new Error('object-property-limit');
      for (const key of names) {
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
          throw new Error('accessor');
        accountProperty(key);
        output[key] = copy(descriptor.value, depth + 1);
      }
      active.delete(input);
      return output;
    };
    return { ok: true, value: copy(value, 0) };
  } catch {
    return {
      ok: false,
      message: 'La donnée ne peut pas être lue en toute sécurité.',
    };
  }
}

export function deepFreezeOwned<T>(value: T): Readonly<T> {
  if (typeof value !== 'object' || value === null) return value;
  const pending: object[] = [value];
  const visited = new WeakSet<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor && 'value' in descriptor) {
        const child: unknown = descriptor.value;
        if (typeof child === 'object' && child !== null) pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}
