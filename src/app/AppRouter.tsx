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
import { RegisterPage } from '@pages/RegisterPage/RegisterPage';
import { NotFoundPage } from '@pages/NotFoundPage/NotFoundPage';
import { ProgressPage } from '@pages/ProgressPage/ProgressPage';
import { QuestionsPage } from '@pages/QuestionsPage/QuestionsPage';
import { MarketplacePage } from '@pages/MarketplacePage/MarketplacePage';
import { SettingsPage } from '@pages/SettingsPage/SettingsPage';
import { WhiteboardPage } from '@pages/WhiteboardPage/WhiteboardPage';
import { AccessDeniedPage } from '@pages/AccessDeniedPage/AccessDeniedPage';
import { WhiteboardProvider } from '@app/providers/WhiteboardProvider';
import { RevisionExperienceProvider } from '@features/session/RevisionExperienceProvider';
import { RevisionDrawerPanel } from '@features/session/RevisionDrawerPanel';
import { OAuthConsentPage } from '@pages/OAuthConsentPage/OAuthConsentPage';
import { ChatGptImportPrivacyPage } from '@pages/ChatGptImportPrivacyPage/ChatGptImportPrivacyPage';

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
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route
        path="/privacy/chatgpt-import"
        element={<ChatGptImportPrivacyPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <WhiteboardProvider>
              <RevisionExperienceProvider
                userId={
                  state.status === 'authenticated' ? state.session.user.id : ''
                }
              >
                <AppShell whiteboardOptions={<RevisionDrawerPanel />} />
              </RevisionExperienceProvider>
            </WhiteboardProvider>
          }
        >
          <Route path="/whiteboard" element={<WhiteboardPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/questions" element={<QuestionsPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/oauth/consent" element={<OAuthConsentPage />} />
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
