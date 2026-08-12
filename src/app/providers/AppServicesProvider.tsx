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
  ProjectedDailyPlanRepository,
  ProjectedWeakPointsRepository,
} from '@infrastructure/session/ProjectedRevisionStateRepositories';
import { createRevisionTestServices as createControlledRevisionServices } from '@infrastructure/session/ControlledRevisionServices';
import { createRevisionTestServices as createProductionRevisionServices } from '@infrastructure/session/ProductionRevisionServices';
import type { EvaluationRepository } from '@domain/repositories/EvaluationRepository';
import type { ChapterTestRepository } from '@domain/repositories/ChapterTestRepository';
import type { QuestionAttemptRepository } from '@domain/repositories/QuestionAttemptRepository';
import {
  IndexedDbChapterTestRepository,
  IndexedDbEvaluationRepository,
  IndexedDbQuestionAttemptRepository,
} from '@infrastructure/database/indexeddb/IndexedDbPr5Repositories';
import type { QuestionWorkspaceRepository } from '@domain/repositories/QuestionWorkspaceRepository';
import { IndexedDbQuestionWorkspaceRepository } from '@infrastructure/questions/IndexedDbQuestionWorkspaceRepository';
import type { OAuthConsentGateway } from '@domain/auth/OAuthConsentGateway';
import {
  SupabaseOAuthConsentGateway,
  UnavailableOAuthConsentGateway,
} from '@infrastructure/auth/SupabaseOAuthConsentGateway';
import type { QuestionRemoteGateway } from '@domain/repositories/QuestionRemoteGateway';
import { UnavailableQuestionRemoteGateway } from '@infrastructure/questions/UnavailableQuestionRemoteGateway';
import { SupabaseQuestionRemoteGateway } from '@infrastructure/questions/SupabaseQuestionRemoteGateway';
import type { AccountManagementGateway } from '@domain/account/AccountManagementGateway';
import { SupabaseAccountManagementGateway } from '@infrastructure/account/SupabaseAccountManagementGateway';
import { ControlledAccountManagementGateway } from '@infrastructure/account/ControlledAccountManagementGateway';
import { UnavailableAccountManagementGateway } from '@infrastructure/account/UnavailableAccountManagementGateway';

export interface AppServices {
  authGateway: AuthGateway;
  workspaceRepository: WorkspaceRepository;
  programIndex?: ProgramIndex | null;
  questionRepository?: QuestionRepository;
  dailyPlanStateRepository?: DailyPlanStateRepository;
  weakPointsStateRepository?: WeakPointsStateRepository;
  revisionSeedSource?: RevisionSeedSource;
  clock?: Clock;
  evaluationRepository?: EvaluationRepository;
  chapterTestRepository?: ChapterTestRepository;
  questionAttemptRepository?: QuestionAttemptRepository;
  questionWorkspaceRepository?: QuestionWorkspaceRepository;
  oauthConsentGateway?: OAuthConsentGateway;
  questionRemoteGateway?: QuestionRemoteGateway;
  accountManagementGateway?: AccountManagementGateway;
}

export type ResolvedAppServices = Required<AppServices>;
const AppServicesContext = createContext<ResolvedAppServices | null>(null);

function withRevisionDefaults(services: AppServices): ResolvedAppServices {
  const clock = services.clock ?? new SystemClock();
  const evaluationRepository =
    services.evaluationRepository ?? new IndexedDbEvaluationRepository();
  const chapterTestRepository =
    services.chapterTestRepository ?? new IndexedDbChapterTestRepository();
  return {
    ...services,
    programIndex: services.programIndex ?? null,
    questionRepository:
      services.questionRepository ?? new InMemoryQuestionRepository(),
    dailyPlanStateRepository:
      services.dailyPlanStateRepository ??
      new ProjectedDailyPlanRepository(
        evaluationRepository,
        chapterTestRepository,
        clock,
      ),
    weakPointsStateRepository:
      services.weakPointsStateRepository ??
      new ProjectedWeakPointsRepository(
        evaluationRepository,
        chapterTestRepository,
        clock,
      ),
    revisionSeedSource:
      services.revisionSeedSource ?? new BrowserRevisionSeedSource(),
    clock,
    evaluationRepository,
    chapterTestRepository,
    questionAttemptRepository:
      services.questionAttemptRepository ??
      new IndexedDbQuestionAttemptRepository(),
    questionWorkspaceRepository:
      services.questionWorkspaceRepository ??
      new IndexedDbQuestionWorkspaceRepository(),
    oauthConsentGateway:
      services.oauthConsentGateway ?? new UnavailableOAuthConsentGateway(),
    questionRemoteGateway:
      services.questionRemoteGateway ?? new UnavailableQuestionRemoteGateway(),
    accountManagementGateway:
      services.accountManagementGateway ??
      new UnavailableAccountManagementGateway(),
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
      accountManagementGateway: new ControlledAccountManagementGateway(),
      ...createControlledRevisionServices(),
    };
  }
  try {
    const environment = readSupabaseEnvironment(
      import.meta.env as Record<string, string | boolean | undefined>,
    );
    const client = createSupabaseBrowserClient(environment);
    authGateway = new SupabaseAuthGateway(client);
    return {
      authGateway,
      oauthConsentGateway: new SupabaseOAuthConsentGateway(client),
      questionRemoteGateway: new SupabaseQuestionRemoteGateway(client),
      workspaceRepository: new IndexedDbWorkspaceRepository(),
      accountManagementGateway: new SupabaseAccountManagementGateway(client),
      ...createProductionRevisionServices(),
    };
  } catch {
    authGateway = new ConfigurationMissingGateway();
  }
  return {
    authGateway,
    workspaceRepository: new IndexedDbWorkspaceRepository(),
    ...createProductionRevisionServices(),
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
