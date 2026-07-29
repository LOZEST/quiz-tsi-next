import 'fake-indexeddb/auto';
import type { IDBPDatabase } from 'idb';
import { IndexedDbWorkspaceRepository } from '@infrastructure/database/indexeddb/IndexedDbWorkspaceRepository';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('IndexedDbWorkspaceRepository', () => {
  it('opens, caches and isolates account workspaces', async () => {
    const repository = new IndexedDbWorkspaceRepository();
    const workspaceA = await repository.open('account-a', 1);
    expect(workspaceA.schemaVersion).toBe(1);
    await repository.cacheValidatedProfile(
      { id: 'account-a', email: 'a@example.test', role: 'user' },
      1,
    );
    await repository.close();

    const workspaceB = await repository.open('account-b', 2);
    expect(workspaceB.userId).toBe('account-b');
    expect(await repository.getCachedProfile('account-a')).toMatchObject({
      id: 'account-a',
    });
    expect(await repository.getCachedProfile('account-b')).toBeNull();
    expect(repository.isGenerationActive(1, 'account-a')).toBe(false);
    expect(repository.isGenerationActive(2, 'account-b')).toBe(true);
    await repository.close();
  });

  it('ignores profile writes from a stale generation', async () => {
    const repository = new IndexedDbWorkspaceRepository();
    await repository.open('account-late', 4);
    await repository.cacheValidatedProfile(
      { id: 'account-late', email: 'late@example.test', role: 'owner' },
      3,
    );
    expect(await repository.getCachedProfile('account-late')).toBeNull();
    await repository.close();
  });

  it('deletes one partition without deleting another account', async () => {
    const repository = new IndexedDbWorkspaceRepository();
    await repository.open('delete-a', 8);
    await repository.cacheValidatedProfile(
      { id: 'delete-a', email: 'delete-a@example.test', role: 'user' },
      8,
    );
    await repository.delete('delete-a');
    expect(await repository.getCachedProfile('delete-a')).toBeNull();
    await repository.close();

    await repository.open('keep-b', 9);
    await repository.cacheValidatedProfile(
      { id: 'keep-b', email: 'keep-b@example.test', role: 'user' },
      9,
    );
    await repository.close();
    await repository.delete('delete-a');
    expect(await repository.getCachedProfile('keep-b')).toMatchObject({
      id: 'keep-b',
    });
  });

  it('closes a stale opening attempt without replacing the newer workspace', async () => {
    const openingA = deferred<IDBPDatabase<never>>();
    const openingB = deferred<IDBPDatabase<never>>();
    const databaseA = {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    } as unknown as IDBPDatabase<never>;
    const databaseB = {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    } as unknown as IDBPDatabase<never>;
    const openDatabase = vi
      .fn()
      .mockReturnValueOnce(openingA.promise)
      .mockReturnValueOnce(openingB.promise);
    const repository = new IndexedDbWorkspaceRepository(openDatabase);

    const openA = repository.open('account-a', 10);
    const openB = repository.open('account-b', 11);
    openingB.resolve(databaseB);
    await expect(openB).resolves.toMatchObject({ userId: 'account-b' });
    openingA.resolve(databaseA);
    await expect(openA).rejects.toMatchObject({ code: 'storage-unavailable' });

    expect(databaseA.close).toHaveBeenCalledOnce();
    expect(databaseB.close).not.toHaveBeenCalled();
    expect(repository.isGenerationActive(10, 'account-a')).toBe(false);
    expect(repository.isGenerationActive(11, 'account-b')).toBe(true);
    await repository.close();
  });
});
