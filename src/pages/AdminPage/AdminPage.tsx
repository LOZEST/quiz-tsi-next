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

const emptySnapshot: QuestionWorkspaceSnapshot = {
  questions: [],
  courses: [],
  chapters: [],
  notions: [],
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
    </>
  );
}
