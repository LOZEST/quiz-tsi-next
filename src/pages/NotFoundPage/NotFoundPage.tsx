import { Link, useLocation } from 'react-router-dom';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';

export function NotFoundPage() {
  const location = useLocation();

  return (
    <>
      <PageHeader
        title="Page introuvable"
        description={`Le chemin « ${location.pathname} » n’existe pas.`}
      />
      <Link className="qtsi-text-link" to="/login">
        Revenir à la connexion
      </Link>
    </>
  );
}
