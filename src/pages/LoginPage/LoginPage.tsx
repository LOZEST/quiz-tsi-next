import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';
import { LoginForm } from '@features/auth/components/LoginForm/LoginForm';
import { safeRedirectTarget } from '@app/routing/redirect';

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const target = safeRedirectTarget(
    new URLSearchParams(location.search).get('returnTo') ??
      (location.state as { from?: unknown } | null)?.from,
  );
  return (
    <main className="qtsi-login" id="main-content">
      <div>
        <p className="qtsi-wordmark">Quiz TSI</p>
        <Surface>
          <PageHeader
            title="Connexion"
            description="Retrouve ton espace de travail personnel."
          />
          <LoginForm
            onSuccess={() => {
              void navigate(target, { replace: true });
            }}
          />
        </Surface>
      </div>
    </main>
  );
}
