import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';
import { RegisterForm } from '@features/auth/components/RegisterForm/RegisterForm';
import { safeRedirectTarget } from '@app/routing/redirect';

export function RegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const search = location.search;
  const target = safeRedirectTarget(
    new URLSearchParams(search).get('returnTo') ??
      (location.state as { from?: unknown } | null)?.from,
  );
  return (
    <main className="qtsi-login" id="main-content">
      <div>
        <p className="qtsi-wordmark">Quiz TSI</p>
        <Surface>
          <PageHeader
            title="Créer un compte"
            description="Rejoins ton espace de travail personnel."
          />
          <RegisterForm
            onSuccess={() => {
              void navigate(target, { replace: true });
            }}
          />
        </Surface>
        <Link className="qtsi-text-link" to={`/login${search}`}>
          Déjà un compte ? Se connecter
        </Link>
      </div>
    </main>
  );
}
