import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { AuthError } from '@domain/auth/AuthError';
import type { AuthUser } from '@domain/auth/AuthUser';
import type { UserWorkspace } from '@domain/workspace/UserWorkspace';
import type { WorkspaceRepository } from '@domain/workspace/WorkspaceRepository';
import type { WhiteboardScene } from '@domain/whiteboard/WhiteboardScene';

const DATABASE_NAME = 'quiz-tsi-user-workspaces';
const DATABASE_VERSION = 2;
const WORKSPACE_SCHEMA_VERSION = 1;

interface StoredWhiteboardScene {
  key: string;
  userId: string;
  scene: WhiteboardScene;
}

interface WorkspaceSchema extends DBSchema {
  workspaces: {
    key: string;
    value: UserWorkspace;
  };
  whiteboardScenes: {
    key: string;
    value: StoredWhiteboardScene;
    indexes: { 'by-user': string };
  };
}

type WorkspaceDatabase = IDBPDatabase<WorkspaceSchema>;
type OpenWorkspaceDatabase = () => Promise<WorkspaceDatabase>;

function openWorkspaceDatabase(): Promise<WorkspaceDatabase> {
  return openDB<WorkspaceSchema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('workspaces')) {
        db.createObjectStore('workspaces');
      }
      if (!db.objectStoreNames.contains('whiteboardScenes')) {
        const scenes = db.createObjectStore('whiteboardScenes', {
          keyPath: 'key',
        });
        scenes.createIndex('by-user', 'userId');
      }
    },
  });
}

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  private database: WorkspaceDatabase | null = null;
  private active: { userId: string; generation: number } | null = null;
  private openAttempt = 0;

  constructor(
    private readonly openDatabase: OpenWorkspaceDatabase = openWorkspaceDatabase,
  ) {}

  async open(userId: string, generation: number): Promise<UserWorkspace> {
    await this.close();
    const activeAttempt = ++this.openAttempt;
    try {
      const database = await this.openDatabase();
      if (this.openAttempt !== activeAttempt) {
        database.close();
        throw new AuthError(
          'storage-unavailable',
          'A newer IndexedDB workspace replaced this opening attempt.',
        );
      }
      this.database = database;
      this.active = { userId, generation };
      const existing = await database.get('workspaces', userId);
      const now = new Date().toISOString();
      const workspace: UserWorkspace = existing
        ? { ...existing, workspaceGeneration: generation, updatedAt: now }
        : {
            userId,
            workspaceGeneration: generation,
            schemaVersion: WORKSPACE_SCHEMA_VERSION,
            createdAt: now,
            updatedAt: now,
          };
      await database.put('workspaces', workspace, userId);
      return workspace;
    } catch (error) {
      if (this.openAttempt === activeAttempt) {
        this.database = null;
        this.active = null;
      }
      if (error instanceof AuthError) throw error;
      throw new AuthError(
        'storage-unavailable',
        'IndexedDB workspace could not be opened.',
        { cause: error },
      );
    }
  }

  async cacheValidatedProfile(
    profile: AuthUser,
    generation: number,
  ): Promise<void> {
    if (!this.isGenerationActive(generation, profile.id) || !this.database) {
      return;
    }
    const current = await this.database.get('workspaces', profile.id);
    if (!current || !this.isGenerationActive(generation, profile.id)) return;
    await this.database.put(
      'workspaces',
      {
        ...current,
        validatedProfile: profile,
        updatedAt: new Date().toISOString(),
      },
      profile.id,
    );
  }

  async getCachedProfile(userId: string): Promise<AuthUser | null> {
    const database =
      this.database ??
      (await openDB<WorkspaceSchema>(DATABASE_NAME, DATABASE_VERSION));
    const workspace = await database.get('workspaces', userId);
    if (!this.database) database.close();
    return workspace?.validatedProfile ?? null;
  }

  close(): Promise<void> {
    this.openAttempt += 1;
    this.active = null;
    this.database?.close();
    this.database = null;
    return Promise.resolve();
  }

  async delete(userId: string): Promise<void> {
    const database =
      this.database ??
      (await openDB<WorkspaceSchema>(DATABASE_NAME, DATABASE_VERSION));
    const transaction = database.transaction(
      ['workspaces', 'whiteboardScenes'],
      'readwrite',
    );
    await transaction.objectStore('workspaces').delete(userId);
    let cursor = await transaction
      .objectStore('whiteboardScenes')
      .index('by-user')
      .openKeyCursor(userId);
    while (cursor) {
      await transaction
        .objectStore('whiteboardScenes')
        .delete(cursor.primaryKey);
      cursor = await cursor.continue();
    }
    await transaction.done;
    if (!this.database) database.close();
  }

  isGenerationActive(generation: number, userId: string): boolean {
    return (
      this.active?.generation === generation && this.active.userId === userId
    );
  }

  async getWhiteboardScene(
    sceneId: string,
    generation: number,
    userId: string,
  ): Promise<unknown> {
    if (!this.database || !this.isGenerationActive(generation, userId)) {
      return null;
    }
    const stored = await this.database.get(
      'whiteboardScenes',
      `${userId}:${sceneId}`,
    );
    return this.isGenerationActive(generation, userId)
      ? (stored?.scene ?? null)
      : null;
  }

  async saveWhiteboardScene(
    scene: WhiteboardScene,
    generation: number,
    userId: string,
  ): Promise<void> {
    if (!this.database || !this.isGenerationActive(generation, userId)) return;
    await this.database.put('whiteboardScenes', {
      key: `${userId}:${scene.sceneId}`,
      userId,
      scene,
    });
  }
}
