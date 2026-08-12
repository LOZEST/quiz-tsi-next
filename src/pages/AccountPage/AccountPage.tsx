import { useState } from 'react';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Button } from '@design-system/components/Button/Button';
import { Surface } from '@design-system/components/Surface/Surface';
import { userRoleLabels } from '@domain/auth/UserRole';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';

export function AccountPage() {
  const auth = useAuth();
  const { state } = auth;
  const services = useAppServices();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (state.status !== 'authenticated') return null;
  const { session, offline } = state;
  const displayName = displayNameOverride ?? session.user.displayName;

  const startEditing = () => {
    setDraftName(displayName ?? '');
    setError(null);
    setEditing(true);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated =
        await services.accountManagementGateway.updateDisplayName(draftName);
      setDisplayNameOverride(updated.displayName ?? null);
      setEditing(false);
    } catch {
      setError('Le nom n’a pas pu être enregistré.');
    } finally {
      setSaving(false);
    }
  };

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
          {displayName ? (
            <>
              <dt>Nom</dt>
              <dd>{displayName}</dd>
            </>
          ) : null}
          <dt>Email</dt>
          <dd>{session.user.email}</dd>
          <dt>Rôle</dt>
          <dd>{userRoleLabels[session.user.role]}</dd>
          <dt>Session</dt>
          <dd>{offline ? 'Restaurée hors connexion' : 'Active'}</dd>
        </dl>
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label>
              Nom affiché
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={80}
                disabled={offline}
              />
            </label>
            {error ? <p role="alert">{error}</p> : null}
            <Button type="submit" busy={saving} disabled={offline}>
              Enregistrer
            </Button>
            <Button
              type="button"
              variant="quiet"
              onClick={() => setEditing(false)}
            >
              Annuler
            </Button>
          </form>
        ) : (
          <Button variant="secondary" onClick={startEditing} disabled={offline}>
            Modifier le nom affiché
          </Button>
        )}
        <Button variant="secondary" onClick={() => void auth.signOut()}>
          Déconnexion
        </Button>
      </Surface>
    </>
  );
}
