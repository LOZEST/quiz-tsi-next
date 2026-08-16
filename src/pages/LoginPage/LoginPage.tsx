import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';
import { Logo, LogoMark } from '@design-system/components/Logo/Logo';
import { LoginForm } from '@features/auth/components/LoginForm/LoginForm';
import { safeRedirectTarget } from '@app/routing/redirect';

export function LoginPage() {
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
          <h2>Progresse chapitre par chapitre.</h2>
          <p>
            Suis ta maîtrise, révise tes points faibles et entraîne-toi sur ta
            banque de questions.
          </p>
        </div>
        <span className="qtsi-login-signature">Prépa Math</span>
      </aside>
      <div className="qtsi-login-main">
        <div>
          <Logo tagline="Espace de révision" />
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
          <Link className="qtsi-text-link" to={`/register${search}`}>
            Pas encore de compte ? En créer un
          </Link>
        </div>
      </div>
    </main>
  );
}
