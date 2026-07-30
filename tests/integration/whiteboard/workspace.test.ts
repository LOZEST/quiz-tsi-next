import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDbWorkspaceRepository } from '@infrastructure/database/indexeddb/IndexedDbWorkspaceRepository';
import { createEmptyScene } from '@features/whiteboard/model/WhiteboardState';

describe('whiteboard workspace isolation', () => {
  const repositories: IndexedDbWorkspaceRepository[] = [];
  afterEach(async () => {
    await Promise.all(repositories.map((repository) => repository.close()));
  });

  it('never returns user A scene in user B workspace', async () => {
    const repository = new IndexedDbWorkspaceRepository();
    repositories.push(repository);
    await repository.open('user-a', 1);
    await repository.saveWhiteboardScene(createEmptyScene('main'), 1, 'user-a');
    await repository.close();
    await repository.open('user-b', 2);
    expect(await repository.getWhiteboardScene('main', 2, 'user-b')).toBeNull();
    expect(await repository.getWhiteboardScene('main', 1, 'user-a')).toBeNull();
  });

  it('deletes only the targeted account scenes', async () => {
    const repository = new IndexedDbWorkspaceRepository();
    repositories.push(repository);
    await repository.open('delete-a', 1);
    await repository.saveWhiteboardScene(
      createEmptyScene('main'),
      1,
      'delete-a',
    );
    await repository.close();
    await repository.open('keep-b', 2);
    await repository.saveWhiteboardScene(createEmptyScene('main'), 2, 'keep-b');
    await repository.close();
    await repository.delete('delete-a');
    await repository.open('delete-a', 3);
    expect(
      await repository.getWhiteboardScene('main', 3, 'delete-a'),
    ).toBeNull();
    await repository.close();
    await repository.open('keep-b', 4);
    expect(
      await repository.getWhiteboardScene('main', 4, 'keep-b'),
    ).not.toBeNull();
  });
});
