import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { AuthError } from '@domain/auth/AuthError';
import type { AuthUser } from '@domain/auth/AuthUser';
import type { UserWorkspace } from '@domain/workspace/UserWorkspace';
import type { WorkspaceRepository } from '@domain/workspace/WorkspaceRepository';

const DATABASE_NAME = 'quiz-tsi-user-workspaces';
const DATABASE_VERSION = 1;

interface WorkspaceSchema extends DBSchema {
  workspaces: {
    key: string;
    value: UserWorkspace;
  };
}

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  private database: IDBPDatabase<WorkspaceSchema> | null = null;
  private active: { userId: string; generation: number } | null = null;

  async open(userId: string, generation: number): Promise<UserWorkspace> {
    await this.close();
    try {
      const database = await openDB<WorkspaceSchema>(
        DATABASE_NAME,
        DATABASE_VERSION,
        {
          upgrade(db) {
            if (!db.objectStoreNames.contains('workspaces')) {
              db.createObjectStore('workspaces');
            }
          },
        },
      );
      this.database = database;
      this.active = { userId, generation };
      const existing = await database.get('workspaces', userId);
      const now = new Date().toISOString();
      const workspace: UserWorkspace = existing
        ? { ...existing, workspaceGeneration: generation, updatedAt: now }
        : {
            userId,
            workspaceGeneration: generation,
            schemaVersion: DATABASE_VERSION,
            createdAt: now,
            updatedAt: now,
          };
      await database.put('workspaces', workspace, userId);
      return workspace;
    } catch (error) {
      this.database = null;
      this.active = null;
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
    this.active = null;
    this.database?.close();
    this.database = null;
    return Promise.resolve();
  }

  async delete(userId: string): Promise<void> {
    const database =
      this.database ??
      (await openDB<WorkspaceSchema>(DATABASE_NAME, DATABASE_VERSION));
    await database.delete('workspaces', userId);
    if (!this.database) database.close();
  }

  isGenerationActive(generation: number, userId: string): boolean {
    return (
      this.active?.generation === generation && this.active.userId === userId
    );
  }
}
