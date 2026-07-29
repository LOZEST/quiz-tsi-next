import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { OnlineVerificationRequiredPage } from '@pages/OnlineVerificationRequiredPage/OnlineVerificationRequiredPage';

export function RoleProtectedRoute() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  if (state.session.validity === 'offline-unverified') {
    return <OnlineVerificationRequiredPage />;
  }
  if (state.session.user.role === 'user') {
    return <Navigate replace to="/access-denied" />;
  }
  return <Outlet />;
}
