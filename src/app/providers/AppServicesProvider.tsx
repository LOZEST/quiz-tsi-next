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
import type { Question } from '@domain/questions/Question';
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
import type { QuestionReportGateway } from '@domain/questions/QuestionReportGateway';
import { SupabaseQuestionReportGateway } from '@infrastructure/questions/SupabaseQuestionReportGateway';
import { ControlledQuestionReportGateway } from '@infrastructure/questions/ControlledQuestionReportGateway';
import { UnavailableQuestionReportGateway } from '@infrastructure/questions/UnavailableQuestionReportGateway';
import type { QuizzMarketplaceGateway } from '@domain/quizz/QuizzMarketplaceGateway';
import { SupabaseQuizzMarketplaceGateway } from '@infrastructure/quizz/SupabaseQuizzMarketplaceGateway';
import { ControlledQuizzMarketplaceGateway } from '@infrastructure/quizz/ControlledQuizzMarketplaceGateway';
import { UnavailableQuizzMarketplaceGateway } from '@infrastructure/quizz/UnavailableQuizzMarketplaceGateway';
import { isMergedQuestionRepository } from '@infrastructure/session/MergedQuestionRepository';
import {
  createQuestionWorkspaceSyncCoordinator,
  type QuestionWorkspaceSyncOutcome,
} from '@features/questions/QuestionWorkspaceSyncCoordinator';

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
  questionReportGateway?: QuestionReportGateway;
  quizzMarketplaceGateway?: QuizzMarketplaceGateway;
  refreshQuestionRepositoryForUser?: (userId: string) => Promise<void>;
  syncQuestionWorkspaceForUser?: (
    userId: string,
  ) => Promise<QuestionWorkspaceSyncOutcome>;
}

export type ResolvedAppServices = Required<AppServices>;
const AppServicesContext = createContext<ResolvedAppServices | null>(null);

function withRevisionDefaults(services: AppServices): ResolvedAppServices {
  const clock = services.clock ?? new SystemClock();
  const evaluationRepository =
    services.evaluationRepository ?? new IndexedDbEvaluationRepository();
  const chapterTestRepository =
    services.chapterTestRepository ?? new IndexedDbChapterTestRepository();
  const questionRepository =
    services.questionRepository ?? new InMemoryQuestionRepository();
  const questionWorkspaceRepository =
    services.questionWorkspaceRepository ??
    new IndexedDbQuestionWorkspaceRepository();
  const quizzMarketplaceGateway =
    services.quizzMarketplaceGateway ??
    new UnavailableQuizzMarketplaceGateway();
  const questionRemoteGateway =
    services.questionRemoteGateway ?? new UnavailableQuestionRemoteGateway();
  const refreshQuestionRepositoryForUser =
    services.refreshQuestionRepositoryForUser ??
    (async (userId: string) => {
      if (!isMergedQuestionRepository(questionRepository)) return;
      const contributions: Readonly<Question>[] = [];
      try {
        const snapshot = await questionWorkspaceRepository.load(userId);
        contributions.push(
          ...snapshot.questions.filter(
            (question) =>
              question.status === 'published' &&
              question.validated &&
              question.source !== 'static',
          ),
        );
      } catch {
        // The user's own Quizz questions are an enhancement over the static
        // bank; if the local workspace is unavailable, sessions still work
        // with the static bank alone.
      }
      try {
        const subscribed =
          await quizzMarketplaceGateway.listSubscribedQuizzContent();
        contributions.push(
          ...subscribed.flatMap((content) =>
            content.questions.filter(
              (question) =>
                question.status === 'published' && question.validated,
            ),
          ),
        );
      } catch {
        // Marketplace subscriptions are an enhancement over the static bank
        // and the user's own Quizz; if unavailable, sessions still work
        // without them.
      }
      questionRepository.setUserContributions(contributions);
    });
  const syncCoordinator = createQuestionWorkspaceSyncCoordinator(
    questionWorkspaceRepository,
    questionRemoteGateway,
    refreshQuestionRepositoryForUser,
  );
  return {
    ...services,
    programIndex: services.programIndex ?? null,
    questionRepository,
    questionWorkspaceRepository,
    refreshQuestionRepositoryForUser,
    syncQuestionWorkspaceForUser:
      services.syncQuestionWorkspaceForUser ??
      ((userId: string) => syncCoordinator.requestSync(userId)),
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
    oauthConsentGateway:
      services.oauthConsentGateway ?? new UnavailableOAuthConsentGateway(),
    questionRemoteGateway,
    accountManagementGateway:
      services.accountManagementGateway ??
      new UnavailableAccountManagementGateway(),
    questionReportGateway:
      services.questionReportGateway ?? new UnavailableQuestionReportGateway(),
    quizzMarketplaceGateway,
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
  signUp(): Promise<never> {
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
      questionReportGateway: new ControlledQuestionReportGateway(),
      quizzMarketplaceGateway: new ControlledQuizzMarketplaceGateway(),
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
      questionReportGateway: new SupabaseQuestionReportGateway(client),
      quizzMarketplaceGateway: new SupabaseQuizzMarketplaceGateway(client),
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
