import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Button } from '@design-system/components/Button/Button';
import { Surface } from '@design-system/components/Surface/Surface';
import { userRoleLabels } from '@domain/auth/UserRole';
import { useAuth } from '@app/providers/AuthProvider';

export function AccountPage() {
  const auth = useAuth();
  const { state } = auth;
  if (state.status !== 'authenticated') return null;
  const { session, offline } = state;
  return (
    <>
      <PageHeader
        title="Compte"
        description="Ton identité et l’état de ta session."
      />
      {offline ? (
        <p role="status">
          Hors connexion — le rôle affiché est informatif jusqu’à sa
          revalidation. Aucune opération sensible n’est disponible.
        </p>
      ) : null}
      <Surface>
        <dl>
          {session.user.displayName ? (
            <>
              <dt>Nom</dt>
              <dd>{session.user.displayName}</dd>
            </>
          ) : null}
          <dt>Email</dt>
          <dd>{session.user.email}</dd>
          <dt>Rôle</dt>
          <dd>{userRoleLabels[session.user.role]}</dd>
          <dt>Session</dt>
          <dd>{offline ? 'Restaurée hors connexion' : 'Active'}</dd>
        </dl>
        <Button variant="secondary" onClick={() => void auth.signOut()}>
          Déconnexion
        </Button>
      </Surface>
    </>
  );
}
