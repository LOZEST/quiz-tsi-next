import { AppErrorBoundary } from '@app/errors/AppErrorBoundary';
import { AppRouter } from '@app/AppRouter';
import { AppServicesProvider } from '@app/providers/AppServicesProvider';
import { AuthProvider } from '@app/providers/AuthProvider';
import { ThemeProvider } from '@app/providers/ThemeProvider';

export function App() {
  return (
    <ThemeProvider>
      <AppErrorBoundary>
        <AppServicesProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </AppServicesProvider>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
