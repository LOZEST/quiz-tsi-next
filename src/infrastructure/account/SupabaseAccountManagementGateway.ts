import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AccountManagementGateway,
  ManagedAccount,
} from '@domain/account/AccountManagementGateway';
import type { AuthUser } from '@domain/auth/AuthUser';
import type { UserRole } from '@domain/auth/UserRole';
import { isUserRole } from '@domain/auth/UserRole';
import {
  mapProfile,
  mapSupabaseError,
  type ProfileRow,
} from '@infrastructure/auth/SupabaseAuthMapper';

function mapManagedAccount(row: ProfileRow): ManagedAccount {
  if (!isUserRole(row.role)) {
    throw new Error('Le serveur a retourné un rôle de compte invalide.');
  }
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

export class SupabaseAccountManagementGateway implements AccountManagementGateway {
  constructor(private readonly client: SupabaseClient) {}

  async updateDisplayName(displayName: string): Promise<AuthUser> {
    try {
      const response = await this.client.rpc('set_display_name', {
        p_display_name: displayName,
      });
      if (response.error) throw response.error;
      const data = response.data as ProfileRow[] | null;
      const row = Array.isArray(data) ? (data[0] ?? null) : null;
      return mapProfile(row);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  async listAccounts(): Promise<readonly ManagedAccount[]> {
    try {
      const response = await this.client.rpc('admin_list_profiles');
      if (response.error) throw response.error;
      const data = response.data as ProfileRow[] | null;
      return (data ?? []).map(mapManagedAccount);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  async setAccountRole(userId: string, role: UserRole): Promise<void> {
    try {
      const { error } = await this.client.rpc('owner_set_profile_role', {
        p_user_id: userId,
        p_role: role,
      });
      if (error) throw error;
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }
}
