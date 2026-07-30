import type { AuthUser } from '../auth/AuthUser';
import type { UserWorkspace } from './UserWorkspace';
import type { WhiteboardScene } from '../whiteboard/WhiteboardScene';

export interface WorkspaceRepository {
  open(userId: string, generation: number): Promise<UserWorkspace>;
  cacheValidatedProfile(profile: AuthUser, generation: number): Promise<void>;
  getCachedProfile(userId: string): Promise<AuthUser | null>;
  close(): Promise<void>;
  delete(userId: string): Promise<void>;
  isGenerationActive(generation: number, userId: string): boolean;
  getWhiteboardScene?(
    sceneId: string,
    generation: number,
    userId: string,
  ): Promise<unknown>;
  saveWhiteboardScene?(
    scene: WhiteboardScene,
    generation: number,
    userId: string,
  ): Promise<void>;
}
