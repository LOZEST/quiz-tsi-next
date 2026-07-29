import type { AuthAction, AuthState } from './AuthState';

export const initialAuthState: AuthState = {
  status: 'booting',
  generation: 0,
  operationId: 0,
};

function matchesOperation(
  state: AuthState,
  action: { generation: number; operationId: number },
): boolean {
  return (
    'operationId' in state &&
    state.generation === action.generation &&
    state.operationId === action.operationId
  );
}

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTHENTICATE_START':
      if (action.generation < state.generation) return state;
      return {
        status: 'authenticating',
        generation: action.generation,
        operationId: action.operationId,
      };
    case 'RESTORE_EMPTY':
      if (!matchesOperation(state, action)) return state;
      return { status: 'unauthenticated', generation: action.generation };
    case 'AUTHENTICATE_SUCCESS':
      if (!matchesOperation(state, action)) return state;
      return {
        status: 'authenticated',
        generation: action.generation,
        session: {
          ...action.session,
          workspaceGeneration: action.generation,
        },
        offline: action.offline ?? false,
      };
    case 'AUTHENTICATE_FAILURE':
      if (!matchesOperation(state, action)) return state;
      return {
        status: 'unauthenticated',
        generation: action.generation,
        error: action.error,
      };
    case 'SIGN_OUT_START':
      if (action.generation < state.generation) return state;
      return {
        status: 'signing-out',
        generation: action.generation,
        operationId: action.operationId,
        session: action.session,
      };
    case 'SIGN_OUT_COMPLETE':
      if (!matchesOperation(state, action)) return state;
      return {
        status: 'unauthenticated',
        generation: action.generation,
        ...(action.error ? { error: action.error } : {}),
      };
    case 'SESSION_INVALIDATED':
      if (action.generation < state.generation) return state;
      return { status: 'unauthenticated', generation: action.generation };
  }
}
