import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { LoadingState } from '@design-system/components/LoadingState/LoadingState';

export function ProtectedRoute() {
  const { state } = useAuth();
  const location = useLocation();
  if (
    state.status === 'booting' ||
    state.status === 'authenticating' ||
    state.status === 'signing-out'
  ) {
    return <LoadingState message="Vérification de la session…" />;
  }
  if (state.status !== 'authenticated') {
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(
          `${location.pathname}${location.search}${location.hash}`,
        )}`}
      />
    );
  }
  return <Outlet />;
}
