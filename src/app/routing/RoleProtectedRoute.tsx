import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';

export function RoleProtectedRoute() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  if (state.session.user.role === 'user') {
    return <Navigate replace to="/access-denied" />;
  }
  return <Outlet />;
}
