export const MAX_SAFE_SNAPSHOT_DEPTH = 64;
export const MAX_SAFE_SNAPSHOT_NODES = 50_000;

export type SafeSnapshotResult =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false; message: string }>;

export function createSafeSnapshot(value: unknown): SafeSnapshotResult {
  try {
    let nodes = 0;
    const active = new WeakSet<object>();
    const copy = (input: unknown, depth: number): unknown => {
      if (
        input === null ||
        typeof input === 'string' ||
        typeof input === 'boolean'
      )
        return input;
      if (typeof input === 'number') {
        if (!Number.isFinite(input)) throw new Error('non-finite');
        return input;
      }
      if (typeof input !== 'object') throw new Error('unsupported');
      if (depth > MAX_SAFE_SNAPSHOT_DEPTH) throw new Error('depth');
      nodes += 1;
      if (nodes > MAX_SAFE_SNAPSHOT_NODES) throw new Error('size');
      if (active.has(input)) throw new Error('cycle');
      const prototype: unknown = Object.getPrototypeOf(input);
      if (
        !Array.isArray(input) &&
        prototype !== Object.prototype &&
        prototype !== null
      )
        throw new Error('prototype');
      if (Object.getOwnPropertySymbols(input).length > 0)
        throw new Error('symbol');
      active.add(input);
      const output: unknown[] | Record<string, unknown> = Array.isArray(input)
        ? []
        : {};
      for (const key of Object.keys(input)) {
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!descriptor || !('value' in descriptor))
          throw new Error('accessor');
        const child = copy(descriptor.value, depth + 1);
        if (Array.isArray(output)) output.push(child);
        else output[key] = child;
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
