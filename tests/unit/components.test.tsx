import { Component, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Disclosure } from '@design-system/components/Disclosure/Disclosure';
import { EmptyState } from '@design-system/components/EmptyState/EmptyState';
import { ErrorState } from '@design-system/components/ErrorState/ErrorState';
import { LoadingState } from '@design-system/components/LoadingState/LoadingState';
import { SkipLink } from '@design-system/components/SkipLink/SkipLink';
import { AppErrorBoundary } from '@app/errors/AppErrorBoundary';

describe('generic states and progressive disclosure', () => {
  it('opens and closes Disclosure deliberately with correct ARIA', async () => {
    const user = userEvent.setup();
    render(<Disclosure label="Détails">Contenu secondaire</Disclosure>);
    const trigger = screen.getByRole('button', { name: 'Détails' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Contenu secondaire')).not.toBeVisible();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Contenu secondaire')).toBeVisible();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('announces loading politely', () => {
    render(<LoadingState />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders human error and empty states without fake actions', () => {
    render(
      <>
        <ErrorState message="Réessaie dans quelques instants." />
        <EmptyState title="Aucun résultat" message="Modifie ta recherche." />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Réessaie dans quelques instants.',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('links the skip link to the main content', () => {
    render(<SkipLink />);
    expect(
      screen.getByRole('link', { name: 'Aller au contenu principal' }),
    ).toHaveAttribute('href', '#main-content');
  });

  it('renders the global error fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    class Broken extends Component {
      public override render(): ReactNode {
        throw new Error('test');
      }
    }

    render(
      <AppErrorBoundary>
        <Broken />
      </AppErrorBoundary>,
    );
    expect(
      screen.getByRole('heading', {
        name: 'L’application n’a pas pu s’afficher',
      }),
    ).toBeInTheDocument();
    spy.mockRestore();
  });
});
