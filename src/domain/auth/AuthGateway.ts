import type { AuthSession } from './AuthSession';

export type AuthChangeHandler = (session: AuthSession | null) => void;
export type AuthChangeErrorHandler = (error: unknown) => void;

export type SignUpResult =
  | { status: 'signed-in'; session: AuthSession }
  | { status: 'confirmation-required' };

export interface AuthGateway {
  getCurrentSession(signal?: AbortSignal): Promise<AuthSession | null>;
  signInWithPassword(
    email: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<AuthSession>;
  signUp(
    email: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<SignUpResult>;
  signOut(): Promise<void>;
  subscribeToAuthChanges(
    handler: AuthChangeHandler,
    onError?: AuthChangeErrorHandler,
  ): () => void;
}
