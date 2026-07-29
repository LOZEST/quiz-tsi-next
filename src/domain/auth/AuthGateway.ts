import type { AuthSession } from './AuthSession';

export type AuthChangeHandler = (session: AuthSession | null) => void;

export interface AuthGateway {
  getCurrentSession(signal?: AbortSignal): Promise<AuthSession | null>;
  signInWithPassword(
    email: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<AuthSession>;
  signOut(): Promise<void>;
  subscribeToAuthChanges(handler: AuthChangeHandler): () => void;
}
