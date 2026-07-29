import type { UserRole } from './UserRole';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
}
