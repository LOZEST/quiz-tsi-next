import type { AuthUser } from '../auth/AuthUser';

export interface UserWorkspace {
  userId: string;
  workspaceGeneration: number;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  validatedProfile?: AuthUser;
}
