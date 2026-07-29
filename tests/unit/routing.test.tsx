import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@app/AppRouter';
import { normalizeBasename } from '@app/routing/basename';
import { mainNavigation } from '@app/routes';

function renderRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('application routing', () => {
  it('redirects the root route to login', () => {
    renderRoute('/');
    expect(
      screen.getByRole('heading', { name: 'Connexion' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['/login', 'Connexion'],
    ['/whiteboard', 'Tableau blanc'],
    ['/progress', 'Mon parcours'],
    ['/questions', 'Banque de questions'],
    ['/settings', 'Réglages'],
    ['/account', 'Compte'],
    ['/admin', 'Administration'],
  ])('renders %s', (route, heading) => {
    renderRoute(route);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('renders a useful not-found page', () => {
    renderRoute('/inconnue');
    expect(
      screen.getByRole('heading', { name: 'Page introuvable' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Revenir à la connexion' }),
    ).toHaveAttribute('href', '/login');
  });

  it('defines exactly four primary destinations', () => {
    expect(mainNavigation).toHaveLength(4);
    expect(mainNavigation.map(({ to }) => to)).toEqual([
      '/whiteboard',
      '/progress',
      '/questions',
      '/settings',
    ]);
  });

  it('marks the active navigation link', () => {
    renderRoute('/whiteboard');
    expect(
      screen.getByRole('link', { name: 'Tableau blanc', hidden: true }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('normalizes local and Pages basenames', () => {
    expect(normalizeBasename('/')).toBe('/');
    expect(normalizeBasename('/quiz-tsi-next/')).toBe('/quiz-tsi-next');
  });
});
