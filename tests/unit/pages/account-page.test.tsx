import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signOut = vi.fn(() => Promise.resolve());
const updateDisplayName = vi.fn();
let offline = false;

vi.mock('@app/providers/AuthProvider', () => ({
  useAuth: () => ({
    state: {
      status: 'authenticated',
      offline,
      session: {
        user: { id: 'user-1', email: 'eleve@example.test', role: 'user' },
      },
    },
    signOut,
  }),
}));
vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    accountManagementGateway: { updateDisplayName },
  }),
}));

import { AccountPage } from '@pages/AccountPage/AccountPage';

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offline = false;
  });

  it('edits and saves the display name', async () => {
    updateDisplayName.mockResolvedValue({
      id: 'user-1',
      email: 'eleve@example.test',
      role: 'user',
      displayName: 'Nouveau nom',
    });
    const user = userEvent.setup();
    render(<AccountPage />);
    await user.click(
      screen.getByRole('button', { name: 'Modifier le nom affiché' }),
    );
    const input = screen.getByLabelText('Nom affiché');
    await user.clear(input);
    await user.type(input, 'Nouveau nom');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Nouveau nom')).toBeInTheDocument();
    expect(updateDisplayName).toHaveBeenCalledWith('Nouveau nom');
  });

  it('shows an error when saving fails', async () => {
    updateDisplayName.mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<AccountPage />);
    await user.click(
      screen.getByRole('button', { name: 'Modifier le nom affiché' }),
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(
      await screen.findByText('Le nom n’a pas pu être enregistré.'),
    ).toBeInTheDocument();
  });

  it('disables editing while offline', () => {
    offline = true;
    render(<AccountPage />);
    expect(
      screen.getByRole('button', { name: 'Modifier le nom affiché' }),
    ).toBeDisabled();
  });

  it('signs out', async () => {
    const user = userEvent.setup();
    render(<AccountPage />);
    await user.click(screen.getByRole('button', { name: 'Déconnexion' }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
