import type { AuthUser } from './AuthUser';

export interface AuthSession {
  user: AuthUser;
  expiresAt?: string;
  validity: 'valid' | 'offline-unverified';
  workspaceGeneration: number;
}
