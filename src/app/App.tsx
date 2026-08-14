import { AppErrorBoundary } from '@app/errors/AppErrorBoundary';
import { AppRouter } from '@app/AppRouter';
import { AppServicesProvider } from '@app/providers/AppServicesProvider';
import { AuthProvider } from '@app/providers/AuthProvider';

export function App() {
  return (
    <AppErrorBoundary>
      <AppServicesProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </AppServicesProvider>
    </AppErrorBoundary>
  );
}
