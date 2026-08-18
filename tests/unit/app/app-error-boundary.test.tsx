import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '@app/errors/AppErrorBoundary';

function Boom(): never {
  throw new Error('boom');
}

describe('AppErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <AppErrorBoundary>
        <p>Contenu normal</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('Contenu normal')).toBeInTheDocument();
  });

  it('renders a fallback and reloads the page when a child throws', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
    const user = userEvent.setup();
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(
      screen.getByText('L’application n’a pas pu s’afficher'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recharger la page' }));
    expect(reload).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
