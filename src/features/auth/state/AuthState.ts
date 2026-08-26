import type { AuthError } from '@domain/auth/AuthError';
import type { AuthSession } from '@domain/auth/AuthSession';

interface OperationState {
  generation: number;
  operationId: number;
}

export type AuthState =
  | ({ status: 'booting' } & OperationState)
  | { status: 'unauthenticated'; generation: number; error?: AuthError }
  | ({ status: 'authenticating' } & OperationState)
  | {
      status: 'authenticated';
      generation: number;
      session: AuthSession;
      offline: boolean;
    }
  | ({ status: 'signing-out'; session: AuthSession } & OperationState)
  | {
      status: 'error';
      generation: number;
      error: AuthError;
      recoverable: boolean;
    };

export type AuthAction =
  | { type: 'RESTORE_EMPTY'; generation: number; operationId: number }
  | {
      type: 'AUTHENTICATE_START';
      generation: number;
      operationId: number;
    }
  | {
      type: 'AUTHENTICATE_SUCCESS';
      generation: number;
      operationId: number;
      session: AuthSession;
      offline?: boolean;
    }
  | {
      type: 'AUTHENTICATE_FAILURE';
      generation: number;
      operationId: number;
      error: AuthError;
    }
  | {
      type: 'SESSION_REFRESHED';
      generation: number;
      session: AuthSession;
    }
  | {
      type: 'SIGN_OUT_START';
      generation: number;
      operationId: number;
      session: AuthSession;
    }
  | {
      type: 'SIGN_OUT_COMPLETE';
      generation: number;
      operationId: number;
      error?: AuthError;
    }
  | { type: 'SESSION_INVALIDATED'; generation: number };
