import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { normalizeBasename } from '@app/routing/basename';
import { ProtectedRoute } from '@app/routing/ProtectedRoute';
import { PublicOnlyRoute } from '@app/routing/PublicOnlyRoute';
import { RoleProtectedRoute } from '@app/routing/RoleProtectedRoute';
import { useAuth } from '@app/providers/AuthProvider';
import { AppShell } from '@design-system/components/AppShell/AppShell';
import { AccountPage } from '@pages/AccountPage/AccountPage';
import { AdminPage } from '@pages/AdminPage/AdminPage';
import { LoginPage } from '@pages/LoginPage/LoginPage';
import { NotFoundPage } from '@pages/NotFoundPage/NotFoundPage';
import { ProgressPage } from '@pages/ProgressPage/ProgressPage';
import { QuestionsPage } from '@pages/QuestionsPage/QuestionsPage';
import { SettingsPage } from '@pages/SettingsPage/SettingsPage';
import { WhiteboardPage } from '@pages/WhiteboardPage/WhiteboardPage';
import { AccessDeniedPage } from '@pages/AccessDeniedPage/AccessDeniedPage';

export function AppRoutes() {
  const { state } = useAuth();
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            replace
            to={state.status === 'authenticated' ? '/whiteboard' : '/login'}
          />
        }
      />
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/whiteboard" element={<WhiteboardPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/questions" element={<QuestionsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />
          <Route element={<RoleProtectedRoute />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter basename={normalizeBasename(import.meta.env.BASE_URL)}>
      <AppRoutes />
    </BrowserRouter>
  );
}
