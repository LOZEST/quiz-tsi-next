import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@app/AppRouter';
import { AuthProvider } from '@app/providers/AuthProvider';
import {
  AppServicesProvider,
  type AppServices,
} from '@app/providers/AppServicesProvider';
import { normalizeBasename } from '@app/routing/basename';
import { safeRedirectTarget } from '@app/routing/redirect';
import { mainNavigation } from '@app/routes';
import type { AuthGateway } from '@domain/auth/AuthGateway';
import type { AuthSession } from '@domain/auth/AuthSession';
import type { WorkspaceRepository } from '@domain/workspace/WorkspaceRepository';

const sessions: Record<'user' | 'admin' | 'owner', AuthSession> = {
  user: {
    user: { id: 'u', email: 'user@example.test', role: 'user' },
    validity: 'valid',
    workspaceGeneration: 0,
  },
  admin: {
    user: {
      id: 'a',
      email: 'admin@example.test',
      role: 'admin',
      displayName: 'Ada Admin',
    },
    validity: 'valid',
    workspaceGeneration: 0,
  },
  owner: {
    user: { id: 'o', email: 'owner@example.test', role: 'owner' },
    validity: 'valid',
    workspaceGeneration: 0,
  },
};

const offlineSessions = Object.fromEntries(
  Object.entries(sessions).map(([role, session]) => [
    role,
    { ...session, validity: 'offline-unverified' },
  ]),
) as Record<'user' | 'admin' | 'owner', AuthSession>;

function services(session: AuthSession | null): AppServices {
  const authGateway: AuthGateway = {
    getCurrentSession: vi.fn().mockResolvedValue(session),
    signInWithPassword: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    subscribeToAuthChanges: vi.fn().mockReturnValue(() => undefined),
  };
  const workspaceRepository: WorkspaceRepository = {
    open: vi.fn().mockImplementation((userId: string, generation: number) =>
      Promise.resolve({
        userId,
        workspaceGeneration: generation,
        schemaVersion: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
    ),
    cacheValidatedProfile: vi.fn().mockResolvedValue(undefined),
    getCachedProfile: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    isGenerationActive: vi.fn().mockReturnValue(true),
  };
  return { authGateway, workspaceRepository };
}

function renderRoute(route: string, session: AuthSession | null) {
  return render(
    <AppServicesProvider services={services(session)}>
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </AppServicesProvider>,
  );
}

describe('application routing', () => {
  it('redirects root and private routes to login without a session', async () => {
    renderRoute('/whiteboard', null);
    expect(
      await screen.findByRole('heading', { name: 'Connexion' }),
    ).toBeInTheDocument();
  });

  it('validates and submits the accessible login form', async () => {
    const user = userEvent.setup();
    const testServices = services(null);
    vi.mocked(
      // The test gateway is a Vitest mock behind the domain interface.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      testServices.authGateway.signInWithPassword,
    ).mockResolvedValue(sessions.user);
    render(
      <AppServicesProvider services={testServices}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </AppServicesProvider>,
    );
    await screen.findByRole('heading', { name: 'Connexion' });
    const submit = screen.getByRole('button', { name: 'Se connecter' });
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Saisis ton adresse email.',
    );
    expect(screen.getByLabelText('Email')).toHaveFocus();
    await user.type(screen.getByLabelText('Email'), 'user@example.test');
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Saisis ton mot de passe.',
    );
    expect(screen.getByLabelText('Mot de passe')).toHaveFocus();
    await user.type(screen.getByLabelText('Mot de passe'), 'test-password');
    await user.click(submit);
    expect(
      await screen.findByRole('heading', { name: 'Tableau blanc' }),
    ).toBeInTheDocument();
    expect(
      // The test gateway is a Vitest mock behind the domain interface.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      testServices.authGateway.signInWithPassword,
    ).toHaveBeenCalledWith(
      'user@example.test',
      'test-password',
      expect.any(AbortSignal),
    );
  });

  it('redirects root and login to whiteboard with a session', async () => {
    const view = renderRoute('/', sessions.user);
    expect(
      await screen.findByRole('heading', { name: 'Tableau blanc' }),
    ).toBeInTheDocument();
    view.unmount();
    renderRoute('/login', sessions.user);
    expect(
      await screen.findByRole('heading', { name: 'Tableau blanc' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['/whiteboard', 'Tableau blanc'],
    ['/progress', 'Mon parcours'],
    ['/questions', 'Banque de questions'],
    ['/settings', 'Réglages'],
    ['/account', 'Compte'],
  ])('renders protected route %s', async (route, heading) => {
    renderRoute(route, sessions.user);
    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
  });

  it('refuses user and accepts admin and owner on /admin', async () => {
    const user = userEvent.setup();
    const userView = renderRoute('/admin', sessions.user);
    expect(
      await screen.findByRole('heading', { name: 'Accès refusé' }),
    ).toBeInTheDocument();
    userView.unmount();
    const adminView = renderRoute('/admin', sessions.admin);
    expect(
      await screen.findByRole('heading', { name: 'Administration' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    expect(
      screen.getByRole('link', { name: 'Administration' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Ada Admin')).toBeVisible();
    adminView.unmount();
    renderRoute('/admin', sessions.owner);
    expect(
      await screen.findByRole('heading', { name: 'Administration' }),
    ).toBeInTheDocument();
  });

  it.each(['user', 'admin', 'owner'] as const)(
    'requires online permission verification for an offline %s on /admin',
    async (role) => {
      renderRoute('/admin', offlineSessions[role]);
      expect(
        await screen.findByRole('heading', {
          name: 'Vérification en ligne requise',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/permissions d’administration.*vérifiées en ligne/i),
      ).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: 'Administration' }),
      ).toBeNull();
      expect(
        screen.queryByRole('heading', { name: 'Accès refusé' }),
      ).toBeNull();
    },
  );

  it('renders the compact account card without logout or admin for a user', async () => {
    const user = userEvent.setup();
    renderRoute('/whiteboard', sessions.user);
    await screen.findByRole('heading', { name: 'Tableau blanc' });
    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    expect(screen.getByText('user@example.test')).toBeVisible();
    expect(screen.getByText('Élève')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Déconnexion' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Fermer le menu' }));
  });

  it('signs out from the account page and clears private UI', async () => {
    const user = userEvent.setup();
    const testServices = services(sessions.user);
    render(
      <AppServicesProvider services={testServices}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/account']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </AppServicesProvider>,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Déconnexion' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Connexion' }),
    ).toBeInTheDocument();
    expect(
      // The test gateway is a Vitest mock behind the domain interface.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      testServices.authGateway.signOut,
    ).toHaveBeenCalledOnce();
  });

  it('does not render private content before session restoration', async () => {
    let resolveSession: ((value: AuthSession | null) => void) | undefined;
    const pending = new Promise<AuthSession | null>((resolve) => {
      resolveSession = resolve;
    });
    const delayed = services(null);
    // The test gateway is a Vitest mock behind the domain interface.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(delayed.authGateway.getCurrentSession).mockReturnValue(pending);
    render(
      <AppServicesProvider services={delayed}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/account']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </AppServicesProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Vérification de la session',
    );
    expect(screen.queryByRole('heading', { name: 'Compte' })).toBeNull();
    resolveSession?.(null);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Connexion' }),
      ).toBeInTheDocument(),
    );
  });

  it('accepts only allow-listed internal return routes', () => {
    expect(safeRedirectTarget('/account?from=test')).toBe('/account?from=test');
    expect(safeRedirectTarget('https://evil.example')).toBe('/whiteboard');
    expect(safeRedirectTarget('//evil.example')).toBe('/whiteboard');
    expect(safeRedirectTarget('/unknown')).toBe('/whiteboard');
  });

  it('keeps exactly four primary destinations and the Pages basename', () => {
    expect(mainNavigation.map(({ to }) => to)).toEqual([
      '/whiteboard',
      '/progress',
      '/questions',
      '/settings',
    ]);
    expect(normalizeBasename('/quiz-tsi-next/')).toBe('/quiz-tsi-next');
  });
});
