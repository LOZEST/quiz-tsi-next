import type { AuthUser } from '../auth/AuthUser';
import type { UserRole } from '../auth/UserRole';

export interface ManagedAccount {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: UserRole;
  readonly createdAt: string;
}

export interface AccountManagementGateway {
  updateDisplayName(displayName: string): Promise<AuthUser>;
  listAccounts(): Promise<readonly ManagedAccount[]>;
  setAccountRole(userId: string, role: UserRole): Promise<void>;
}
