import { AppErrorBoundary } from '@app/errors/AppErrorBoundary';
import { AppRouter } from '@app/AppRouter';

export function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  );
}
