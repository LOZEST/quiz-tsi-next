import { useEffect, useState } from 'react';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';
import { Button } from '@design-system/components/Button/Button';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';
import { userRoleLabels, userRoles } from '@domain/auth/UserRole';
import type { ManagedAccount } from '@domain/account/AccountManagementGateway';
import type { Question } from '@domain/questions/Question';
import type { QuestionWorkspaceSnapshot } from '@domain/repositories/QuestionWorkspaceRepository';
import {
  questionReportReasonLabels,
  questionReportStatuses,
  questionReportStatusLabels,
  type QuestionReport,
  type QuestionReportStatus,
} from '@domain/questions/QuestionReport';
import type { QuizzListing } from '@domain/quizz/QuizzListing';
import styles from './AdminPage.module.css';

const emptySnapshot: QuestionWorkspaceSnapshot = {
  questions: [],
  quizzes: [],
  pendingOperationCount: 0,
  conflicts: [],
};

const statusLabels: Record<Question['status'], string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  archived: 'Archivée',
};

function AccountsPanel({ currentUserId }: { currentUserId: string }) {
  const { state } = useAuth();
  const { accountManagementGateway } = useAppServices();
  const [accounts, setAccounts] = useState<readonly ManagedAccount[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const isOwner =
    state.status === 'authenticated' && state.session.user.role === 'owner';

  const reload = () => {
    accountManagementGateway
      .listAccounts()
      .then(setAccounts)
      .catch(() => setError('La liste des comptes n’a pas pu être chargée.'));
  };
  useEffect(reload, [accountManagementGateway]);

  const changeRole = async (userId: string, role: ManagedAccount['role']) => {
    setPendingUserId(userId);
    setError(null);
    try {
      await accountManagementGateway.setAccountRole(userId, role);
      reload();
    } catch {
      setError('Le rôle n’a pas pu être modifié.');
    } finally {
      setPendingUserId(null);
    }
  };

  return (
    <Surface>
      <h2>Comptes</h2>
      {error ? <p role="alert">{error}</p> : null}
      {accounts === null ? (
        <p>Chargement des comptes…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Nom</th>
              <th scope="col">Rôle</th>
              {isOwner ? <th scope="col">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.userId}>
                <td>{account.email}</td>
                <td>{account.displayName ?? '—'}</td>
                <td>{userRoleLabels[account.role]}</td>
                {isOwner ? (
                  <td>
                    {account.userId === currentUserId ? (
                      <span>Compte actuel</span>
                    ) : (
                      <select
                        aria-label={`Rôle de ${account.email}`}
                        value={account.role}
                        disabled={pendingUserId === account.userId}
                        onChange={(event) =>
                          void changeRole(
                            account.userId,
                            event.target.value as ManagedAccount['role'],
                          )
                        }
                      >
                        {userRoles.map((role) => (
                          <option key={role} value={role}>
                            {userRoleLabels[role]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Surface>
  );
}

function ContentPanel({ userId }: { userId: string }) {
  const { questionWorkspaceRepository } = useAppServices();
  const [workspace, setWorkspace] =
    useState<QuestionWorkspaceSnapshot>(emptySnapshot);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = () => {
    questionWorkspaceRepository
      .load(userId)
      .then(setWorkspace)
      .catch(() => setWorkspace(emptySnapshot));
  };
  useEffect(reload, [questionWorkspaceRepository, userId]);

  const sharedQuestions = workspace.questions.filter(
    (question) => question.source === 'shared',
  );

  const archive = async (question: Readonly<Question>) => {
    setBusyId(question.id);
    try {
      await questionWorkspaceRepository.saveQuestion(
        userId,
        {
          ...question,
          version: question.version + 1,
          status: 'archived',
          updatedAt: new Date().toISOString(),
        },
        'archive',
        crypto.randomUUID(),
      );
      reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Surface>
      <h2>Contenus partagés</h2>
      {sharedQuestions.length === 0 ? (
        <p>Aucune question partagée sur cet appareil pour le moment.</p>
      ) : (
        <ul>
          {sharedQuestions.map((question) => {
            const label =
              question.prompt.find((segment) => segment.kind === 'text')
                ?.value ?? 'Question mathématique';
            return (
              <li key={`${question.id}:${question.version}`}>
                <span>{label}</span>
                <span> — {statusLabels[question.status]}</span>
                {question.status !== 'archived' ? (
                  <Button
                    variant="quiet"
                    busy={busyId === question.id}
                    onClick={() => void archive(question)}
                  >
                    Archiver
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p>
        La création et la publication de contenus partagés se font depuis la{' '}
        Banque de questions.
      </p>
    </Surface>
  );
}

const reportStatusFilters = ['all', ...questionReportStatuses] as const;
type ReportStatusFilter = (typeof reportStatusFilters)[number];
const reportStatusFilterLabels: Record<ReportStatusFilter, string> = {
  all: 'Tous les statuts',
  ...questionReportStatusLabels,
};

function formatReportsForAi(reports: readonly QuestionReport[]): string {
  return reports
    .map((report) => {
      const lines = [
        `Question ${report.questionId} (version ${report.questionVersion})`,
        `Motif : ${questionReportReasonLabels[report.reason]}`,
        `Remarque : ${report.comment ?? 'Aucune remarque'}`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}

function ReportsPanel() {
  const { questionReportGateway } = useAppServices();
  const [reports, setReports] = useState<readonly QuestionReport[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('all');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );

  const reload = () => {
    questionReportGateway
      .listReports()
      .then(setReports)
      .catch(() => setError('Les signalements n’ont pas pu être chargés.'));
  };
  useEffect(reload, [questionReportGateway]);

  const changeStatus = async (
    reportId: string,
    status: QuestionReportStatus,
  ) => {
    setPendingReportId(reportId);
    setError(null);
    try {
      await questionReportGateway.setReportStatus(reportId, status);
      reload();
    } catch {
      setError('Le statut du signalement n’a pas pu être modifié.');
    } finally {
      setPendingReportId(null);
    }
  };

  const filteredReports = (reports ?? []).filter(
    (report) => statusFilter === 'all' || report.status === statusFilter,
  );

  const copyForAi = async () => {
    setCopyState('idle');
    try {
      await navigator.clipboard.writeText(formatReportsForAi(filteredReports));
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <Surface>
      <h2>Signalements</h2>
      {error ? <p role="alert">{error}</p> : null}
      {reports !== null && reports.length > 0 ? (
        <div className={styles.reportsToolbar}>
          <label>
            Filtrer par statut
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ReportStatusFilter)
              }
            >
              {reportStatusFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {reportStatusFilterLabels[filter]}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={filteredReports.length === 0}
            onClick={() => void copyForAi()}
          >
            Copier pour l’IA
          </Button>
          {copyState === 'copied' ? (
            <span role="status">Copié dans le presse-papiers.</span>
          ) : null}
          {copyState === 'error' ? (
            <span role="alert">La copie a échoué.</span>
          ) : null}
        </div>
      ) : null}
      {reports === null ? (
        <p>Chargement des signalements…</p>
      ) : reports.length === 0 ? (
        <p>Aucun signalement pour le moment.</p>
      ) : filteredReports.length === 0 ? (
        <p>Aucun signalement pour ce statut.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Motif</th>
              <th scope="col">Remarque</th>
              <th scope="col">Signalé par</th>
              <th scope="col">Date</th>
              <th scope="col">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((report) => (
              <tr key={report.id}>
                <td>
                  {report.questionId.slice(0, 8)} · v{report.questionVersion}
                </td>
                <td>{questionReportReasonLabels[report.reason]}</td>
                <td>{report.comment ?? '—'}</td>
                <td>{report.reporterEmail}</td>
                <td>{new Date(report.createdAt).toLocaleString('fr-FR')}</td>
                <td>
                  <select
                    aria-label={`Statut du signalement ${report.id}`}
                    value={report.status}
                    disabled={pendingReportId === report.id}
                    onChange={(event) =>
                      void changeStatus(
                        report.id,
                        event.target.value as QuestionReportStatus,
                      )
                    }
                  >
                    {questionReportStatuses.map((status) => (
                      <option key={status} value={status}>
                        {questionReportStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Surface>
  );
}

function QuizzListingsPanel() {
  const { quizzMarketplaceGateway } = useAppServices();
  const [listings, setListings] = useState<readonly QuizzListing[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);

  const reload = () => {
    quizzMarketplaceGateway
      .adminListListings()
      .then(setListings)
      .catch(() =>
        setError('La modération marketplace n’a pas pu être chargée.'),
      );
  };
  useEffect(reload, [quizzMarketplaceGateway]);

  const toggleCertified = async (listing: QuizzListing) => {
    setPendingListingId(listing.id);
    setError(null);
    try {
      await quizzMarketplaceGateway.adminSetCertified(
        listing.id,
        !listing.certified,
      );
      reload();
    } catch {
      setError('La certification n’a pas pu être modifiée.');
    } finally {
      setPendingListingId(null);
    }
  };

  const toggleHidden = async (listing: QuizzListing) => {
    setPendingListingId(listing.id);
    setError(null);
    try {
      await quizzMarketplaceGateway.adminSetHidden(listing.id, !listing.hidden);
      reload();
    } catch {
      setError('Le retrait/rétablissement a échoué.');
    } finally {
      setPendingListingId(null);
    }
  };

  return (
    <Surface>
      <h2>Marketplace</h2>
      {error ? <p role="alert">{error}</p> : null}
      {listings === null ? (
        <p>Chargement des listings…</p>
      ) : listings.length === 0 ? (
        <p>Aucun Quizz publié pour le moment.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Quizz</th>
              <th scope="col">Description</th>
              <th scope="col">Publié le</th>
              <th scope="col">Certifié</th>
              <th scope="col">Visible</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr key={listing.id}>
                <td>{listing.title}</td>
                <td>{listing.description || '—'}</td>
                <td>{new Date(listing.publishedAt).toLocaleString('fr-FR')}</td>
                <td>{listing.certified ? 'Oui' : 'Non'}</td>
                <td>{listing.hidden ? 'Masqué' : 'Visible'}</td>
                <td>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pendingListingId === listing.id}
                    onClick={() => void toggleCertified(listing)}
                  >
                    {listing.certified ? 'Décertifier' : 'Certifier'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pendingListingId === listing.id}
                    onClick={() => void toggleHidden(listing)}
                  >
                    {listing.hidden ? 'Rétablir' : 'Masquer'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Surface>
  );
}

export function AdminPage() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  const userId = state.session.user.id;
  return (
    <>
      <PageHeader
        title="Administration"
        description="Gestion des comptes, des rôles et des contenus partagés."
      />
      <AccountsPanel currentUserId={userId} />
      <ContentPanel userId={userId} />
      <ReportsPanel />
      <QuizzListingsPanel />
    </>
  );
}
