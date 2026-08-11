import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

let getAuthorizationDetails = vi.fn();
const approve = vi.fn();
const deny = vi.fn();
vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    oauthConsentGateway: { getAuthorizationDetails, approve, deny },
  }),
}));

import { OAuthConsentPage } from '@pages/OAuthConsentPage/OAuthConsentPage';

const renderPage = (query = '') =>
  render(
    <MemoryRouter initialEntries={[`/oauth/consent${query}`]}>
      <OAuthConsentPage />
    </MemoryRouter>,
  );

describe('OAuthConsentPage', () => {
  it('refuse une requête sans identifiant', () => {
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Identifiant d’autorisation manquant',
    );
  });

  it('présente clairement le client et ses permissions', async () => {
    getAuthorizationDetails = vi.fn().mockResolvedValue({
      kind: 'details',
      details: {
        authorizationId: 'authorization-1',
        clientName: 'ChatGPT Quiz TSI',
        scopes: ['questions.write'],
      },
    });
    renderPage('?authorization_id=authorization-1');
    expect(await screen.findByText('ChatGPT Quiz TSI')).toBeInTheDocument();
    expect(screen.getByText('questions.write')).toBeInTheDocument();
    expect(
      screen.getByText(/Aucune question ne sera publiée/),
    ).toBeInTheDocument();
  });

  it.each([
    [new Error('Demande expirée'), 'Demande expirée'],
    ['erreur', 'Autorisation inaccessible.'],
  ])('rend une erreur de chargement exploitable', async (reason, message) => {
    getAuthorizationDetails = vi.fn().mockRejectedValue(reason);
    renderPage('?authorization_id=authorization-1');
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});
