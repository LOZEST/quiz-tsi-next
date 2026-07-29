export const userRoles = ['user', 'admin', 'owner'] as const;

export type UserRole = (typeof userRoles)[number];

export const userRoleLabels: Record<UserRole, string> = {
  user: 'Élève',
  admin: 'Administrateur',
  owner: 'Propriétaire',
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && userRoles.includes(value as UserRole);
}
