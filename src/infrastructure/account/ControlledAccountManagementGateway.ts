import type {
  AccountManagementGateway,
  ManagedAccount,
} from '@domain/account/AccountManagementGateway';
import type { AuthUser } from '@domain/auth/AuthUser';
import { isUserRole, type UserRole } from '@domain/auth/UserRole';

const SESSION_KEY = 'qtsi-controlled-auth-session';
const ACCOUNTS_KEY = 'qtsi-controlled-accounts';

const seedAccounts: ManagedAccount[] = [
  {
    userId: 'controlled-user',
    email: 'user@example.test',
    displayName: null,
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    userId: 'controlled-admin',
    email: 'admin@example.test',
    displayName: 'Compte admin',
    role: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    userId: 'controlled-owner',
    email: 'owner@example.test',
    displayName: 'Compte owner',
    role: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

function readAccounts(): ManagedAccount[] {
  const stored = sessionStorage.getItem(ACCOUNTS_KEY);
  if (!stored) return seedAccounts.map((account) => ({ ...account }));
  try {
    return JSON.parse(stored) as ManagedAccount[];
  } catch {
    return seedAccounts.map((account) => ({ ...account }));
  }
}

function writeAccounts(accounts: readonly ManagedAccount[]): void {
  sessionStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function currentIdentity(): { userId: string; email: string; role: UserRole } {
  const stored = sessionStorage.getItem(SESSION_KEY);
  const email = stored
    ? (() => {
        try {
          return (JSON.parse(stored) as { email: string }).email;
        } catch {
          return stored;
        }
      })()
    : 'user@example.test';
  const roleValue = email.split('@')[0];
  const role: UserRole = isUserRole(roleValue) ? roleValue : 'user';
  return { userId: `controlled-${role}`, email, role };
}

/**
 * Deterministic browser-test boundary mirroring ControlledAuthGateway. It is
 * selected only by the Playwright preview's VITE_AUTH_ADAPTER=controlled flag.
 */
export class ControlledAccountManagementGateway implements AccountManagementGateway {
  updateDisplayName(displayName: string): Promise<AuthUser> {
    const identity = currentIdentity();
    const accounts = readAccounts();
    const updated = accounts.map((account) =>
      account.userId === identity.userId
        ? { ...account, displayName }
        : account,
    );
    writeAccounts(updated);
    return Promise.resolve({
      id: identity.userId,
      email: identity.email,
      role: identity.role,
      displayName,
    });
  }

  listAccounts(): Promise<readonly ManagedAccount[]> {
    const identity = currentIdentity();
    if (identity.role === 'user') {
      return Promise.reject(
        new Error('Seuls les administrateurs consultent les comptes.'),
      );
    }
    return Promise.resolve(readAccounts());
  }

  setAccountRole(userId: string, role: UserRole): Promise<void> {
    const identity = currentIdentity();
    if (identity.role !== 'owner') {
      return Promise.reject(
        new Error('Seul le propriétaire modifie les rôles.'),
      );
    }
    if (userId === identity.userId) {
      return Promise.reject(
        new Error('Le propriétaire ne peut pas changer son propre rôle.'),
      );
    }
    const accounts = readAccounts();
    writeAccounts(
      accounts.map((account) =>
        account.userId === userId ? { ...account, role } : account,
      ),
    );
    return Promise.resolve();
  }
}
