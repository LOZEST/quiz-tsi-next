import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { LoadingState } from '@design-system/components/LoadingState/LoadingState';
import { safeRedirectTarget } from './redirect';

export function PublicOnlyRoute() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'booting') {
    return <LoadingState message="Restauration de la session…" />;
  }
  if (state.status === 'authenticated') {
    return (
      <Navigate
        replace
        to={safeRedirectTarget(
          new URLSearchParams(location.search).get('returnTo'),
        )}
      />
    );
  }
  return <Outlet />;
}
