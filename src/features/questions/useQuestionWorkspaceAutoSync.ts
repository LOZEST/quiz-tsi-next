import { useEffect } from 'react';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Background safety net for the question workspace sync: mutations already
 * nudge a sync right after they happen, but this catches whatever that
 * missed — the tab was closed before the push went out, a request failed
 * silently, the device was offline. Mounted once near the app root so it
 * keeps running across route navigation, not just while "Mes Quizz" is open.
 */
export function useQuestionWorkspaceAutoSync(): void {
  const { state } = useAuth();
  const { syncQuestionWorkspaceForUser, clock } = useAppServices();
  const userId = state.status === 'authenticated' ? state.session.user.id : '';
  useEffect(() => {
    if (!userId) return;
    const attempt = () => {
      if (navigator.onLine) void syncQuestionWorkspaceForUser(userId);
    };
    const handle = clock.setInterval(attempt, AUTO_SYNC_INTERVAL_MS);
    window.addEventListener('online', attempt);
    return () => {
      clock.clearInterval(handle);
      window.removeEventListener('online', attempt);
    };
  }, [clock, syncQuestionWorkspaceForUser, userId]);
}
