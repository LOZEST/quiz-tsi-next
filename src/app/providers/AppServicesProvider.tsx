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
import type { ProgramIndex } from '@domain/program/Program';
import type { QuestionRepository } from '@domain/repositories/QuestionRepository';
import type {
  Clock,
  DailyPlanStateRepository,
  RevisionSeedSource,
  WeakPointsStateRepository,
} from '@domain/repositories/RevisionStateRepositories';
import { InMemoryQuestionRepository } from '@infrastructure/questions/InMemoryQuestionRepository';
import { BrowserRevisionSeedSource } from '@infrastructure/session/BrowserRevisionSeedSource';
import { SystemClock } from '@infrastructure/session/SystemClock';
import {
  UnavailableDailyPlanStateRepository,
  UnavailableWeakPointsStateRepository,
} from '@infrastructure/session/UnavailableRevisionStateRepositories';
import { createRevisionTestServices } from '@infrastructure/session/RevisionServicesComposition';

export interface AppServices {
  authGateway: AuthGateway;
  workspaceRepository: WorkspaceRepository;
  programIndex?: ProgramIndex | null;
  questionRepository?: QuestionRepository;
  dailyPlanStateRepository?: DailyPlanStateRepository;
  weakPointsStateRepository?: WeakPointsStateRepository;
  revisionSeedSource?: RevisionSeedSource;
  clock?: Clock;
}

export type ResolvedAppServices = Required<AppServices>;
const AppServicesContext = createContext<ResolvedAppServices | null>(null);

function withRevisionDefaults(services: AppServices): ResolvedAppServices {
  return {
    ...services,
    programIndex: services.programIndex ?? null,
    questionRepository:
      services.questionRepository ?? new InMemoryQuestionRepository(),
    dailyPlanStateRepository:
      services.dailyPlanStateRepository ??
      new UnavailableDailyPlanStateRepository(),
    weakPointsStateRepository:
      services.weakPointsStateRepository ??
      new UnavailableWeakPointsStateRepository(),
    revisionSeedSource:
      services.revisionSeedSource ?? new BrowserRevisionSeedSource(),
    clock: services.clock ?? new SystemClock(),
  };
}

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
      ...createRevisionTestServices(),
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
    ...createRevisionTestServices(),
  };
}

export function AppServicesProvider({
  children,
  services,
}: {
  children: ReactNode;
  services?: AppServices;
}) {
  const value = useMemo(
    () => withRevisionDefaults(services ?? createDefaultServices()),
    [services],
  );
  return (
    <AppServicesContext.Provider value={value}>
      {children}
    </AppServicesContext.Provider>
  );
}

export function useAppServices(): ResolvedAppServices {
  const services = useContext(AppServicesContext);
  if (!services) throw new Error('AppServicesProvider is missing.');
  return services;
}
