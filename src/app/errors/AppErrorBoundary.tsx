import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@design-system/components/ErrorState/ErrorState';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  public override state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Erreur de rendu', error, info.componentStack);
    }
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="qtsi-centered-state">
          <ErrorState
            title="L’application n’a pas pu s’afficher"
            message="Recharge la page pour repartir sur une base saine."
            actionLabel="Recharger la page"
            onAction={() => window.location.reload()}
          />
        </main>
      );
    }

    return this.props.children;
  }
}
