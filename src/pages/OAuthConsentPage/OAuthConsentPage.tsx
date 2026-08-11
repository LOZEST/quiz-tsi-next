import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppServices } from '@app/providers/AppServicesProvider';
import type { OAuthAuthorizationDetails } from '@domain/auth/OAuthConsentGateway';

export function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get('authorization_id');
  const { oauthConsentGateway } = useAppServices();
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(
    null,
  );
  const [error, setError] = useState<string | null>(
    authorizationId ? null : 'Identifiant d’autorisation manquant.',
  );
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!authorizationId) return;
    void oauthConsentGateway
      .getAuthorizationDetails(authorizationId)
      .then((result) => {
        if (result.kind === 'redirect')
          window.location.assign(result.redirectUrl);
        else setDetails(result.details);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Autorisation inaccessible.',
        ),
      );
  }, [authorizationId, oauthConsentGateway]);
  const decide = async (choice: 'approve' | 'deny') => {
    if (!authorizationId) return;
    setBusy(true);
    setError(null);
    try {
      const url =
        choice === 'approve'
          ? await oauthConsentGateway.approve(authorizationId)
          : await oauthConsentGateway.deny(authorizationId);
      window.location.assign(url);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Décision non transmise.',
      );
      setBusy(false);
    }
  };
  return (
    <main id="main-content">
      <h1>Autoriser l’import Quiz TSI</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : !details ? (
        <p role="status">Chargement de la demande…</p>
      ) : (
        <section aria-labelledby="oauth-client">
          <h2 id="oauth-client">{details.clientName}</h2>
          <p>
            Cette application demande l’autorisation de créer des brouillons
            privés dans ta banque Quiz TSI.
          </p>
          <h3>Autorisations demandées</h3>
          <ul>
            {details.scopes.map((scope) => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>
          <p>Aucune question ne sera publiée automatiquement.</p>
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('deny')}
            >
              Refuser
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('approve')}
            >
              Approuver
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
