import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { normalizeBasename } from '@app/routing/basename';
import { AppShell } from '@design-system/components/AppShell/AppShell';
import { AccountPage } from '@pages/AccountPage/AccountPage';
import { AdminPage } from '@pages/AdminPage/AdminPage';
import { LoginPage } from '@pages/LoginPage/LoginPage';
import { NotFoundPage } from '@pages/NotFoundPage/NotFoundPage';
import { ProgressPage } from '@pages/ProgressPage/ProgressPage';
import { QuestionsPage } from '@pages/QuestionsPage/QuestionsPage';
import { SettingsPage } from '@pages/SettingsPage/SettingsPage';
import { WhiteboardPage } from '@pages/WhiteboardPage/WhiteboardPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/login" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route path="/whiteboard" element={<WhiteboardPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/questions" element={<QuestionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
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
