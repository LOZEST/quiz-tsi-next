/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AuthGateway } from '@domain/auth/AuthGateway';
import type { WorkspaceRepository } from '@domain/workspace/WorkspaceRepository';
import { SupabaseAuthGateway } from '@infrastructure/auth/SupabaseAuthGateway';
import { IndexedDbWorkspaceRepository } from '@infrastructure/database/indexeddb/IndexedDbWorkspaceRepository';
import { createSupabaseBrowserClient } from '@infrastructure/supabase/createSupabaseClient';
import { readSupabaseEnvironment } from '@infrastructure/supabase/environment';
import { AuthError } from '@domain/auth/AuthError';
import { ControlledAuthGateway } from '@infrastructure/auth/ControlledAuthGateway';

export interface AppServices {
  authGateway: AuthGateway;
  workspaceRepository: WorkspaceRepository;
}

const AppServicesContext = createContext<AppServices | null>(null);

class ConfigurationMissingGateway implements AuthGateway {
  private error(): AuthError {
    return new AuthError(
      'configuration-missing',
      'Supabase environment is not configured.',
    );
  }
  getCurrentSession(): Promise<null> {
    return Promise.reject(this.error());
  }
  signInWithPassword(): Promise<never> {
    return Promise.reject(this.error());
  }
  signOut(): Promise<void> {
    return Promise.resolve();
  }
  subscribeToAuthChanges(): () => void {
    return () => undefined;
  }
}

function createDefaultServices(): AppServices {
  let authGateway: AuthGateway;
  if (import.meta.env.VITE_AUTH_ADAPTER === 'controlled') {
    return {
      authGateway: new ControlledAuthGateway(),
      workspaceRepository: new IndexedDbWorkspaceRepository(),
    };
  }
  try {
    const environment = readSupabaseEnvironment(
      import.meta.env as Record<string, string | boolean | undefined>,
    );
    authGateway = new SupabaseAuthGateway(
      createSupabaseBrowserClient(environment),
    );
  } catch {
    authGateway = new ConfigurationMissingGateway();
  }
  return {
    authGateway,
    workspaceRepository: new IndexedDbWorkspaceRepository(),
  };
}

export function AppServicesProvider({
  children,
  services,
}: {
  children: ReactNode;
  services?: AppServices;
}) {
  const value = useMemo(() => services ?? createDefaultServices(), [services]);
  return (
    <AppServicesContext.Provider value={value}>
      {children}
    </AppServicesContext.Provider>
  );
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) throw new Error('AppServicesProvider is missing.');
  return services;
}
