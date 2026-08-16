import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';
import { Logo, LogoMark } from '@design-system/components/Logo/Logo';
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
      <aside className="qtsi-login-aside" aria-hidden="true">
        <span className="qtsi-login-mark">
          <LogoMark size={28} />
        </span>
        <div className="qtsi-login-pitch">
          <h2>Rejoins ton espace de révision.</h2>
          <p>
            Un compte pour retrouver ta progression, ton tableau blanc et ta
            banque de questions partout.
          </p>
        </div>
        <span className="qtsi-login-signature">Prépa Math</span>
      </aside>
      <div className="qtsi-login-main">
        <div>
          <Logo tagline="Espace de révision" />
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
      </div>
    </main>
  );
}
