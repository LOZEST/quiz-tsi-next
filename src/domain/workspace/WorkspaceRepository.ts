import type { AuthUser } from '../auth/AuthUser';
import type { UserWorkspace } from './UserWorkspace';

export interface WorkspaceRepository {
  open(userId: string, generation: number): Promise<UserWorkspace>;
  cacheValidatedProfile(profile: AuthUser, generation: number): Promise<void>;
  getCachedProfile(userId: string): Promise<AuthUser | null>;
  close(): Promise<void>;
  delete(userId: string): Promise<void>;
  isGenerationActive(generation: number, userId: string): boolean;
}
