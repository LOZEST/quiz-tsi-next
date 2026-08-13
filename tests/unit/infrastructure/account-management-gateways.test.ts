import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { SupabaseAccountManagementGateway } from '../../../src/infrastructure/account/SupabaseAccountManagementGateway';
import { ControlledAccountManagementGateway } from '../../../src/infrastructure/account/ControlledAccountManagementGateway';
import { UnavailableAccountManagementGateway } from '../../../src/infrastructure/account/UnavailableAccountManagementGateway';
import type { AccountManagementGateway } from '../../../src/domain/account/AccountManagementGateway';

function clientWith(rpcResponses: Record<string, unknown>) {
  return {
    rpc(name: string) {
      const response = rpcResponses[name];
      if (response instanceof Error) {
        return Promise.resolve({ data: null, error: response });
      }
      return Promise.resolve({ data: response, error: null });
    },
  } as unknown as SupabaseClient;
}

const profileRow = {
  user_id: 'user-1',
  email: 'eleve@example.test',
  display_name: 'Élève',
  role: 'user',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('SupabaseAccountManagementGateway', () => {
  it('updates the display name from the RPC row', async () => {
    const gateway = new SupabaseAccountManagementGateway(
      clientWith({ set_display_name: [profileRow] }),
    );
    const user = await gateway.updateDisplayName('Élève');
    expect(user.displayName).toBe('Élève');
    expect(user.role).toBe('user');
  });

  it('lists accounts from the RPC rows', async () => {
    const gateway = new SupabaseAccountManagementGateway(
      clientWith({ admin_list_profiles: [profileRow] }),
    );
    const accounts = await gateway.listAccounts();
    expect(accounts).toEqual([
      {
        userId: 'user-1',
        email: 'eleve@example.test',
        displayName: 'Élève',
        role: 'user',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('sets an account role', async () => {
    const gateway = new SupabaseAccountManagementGateway(
      clientWith({ owner_set_profile_role: null }),
    );
    await expect(
      gateway.setAccountRole('user-1', 'admin'),
    ).resolves.toBeUndefined();
  });

  it('surfaces RPC errors', async () => {
    const gateway = new SupabaseAccountManagementGateway(
      clientWith({ admin_list_profiles: new Error('permission denied') }),
    );
    await expect(gateway.listAccounts()).rejects.toThrow();
  });
});

describe('ControlledAccountManagementGateway', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('lets any signed-in identity rename itself', async () => {
    sessionStorage.setItem('qtsi-controlled-auth-session', 'user@example.test');
    const gateway = new ControlledAccountManagementGateway();
    const user = await gateway.updateDisplayName('Nouveau nom');
    expect(user.displayName).toBe('Nouveau nom');
  });

  it('rejects listAccounts for a plain user', async () => {
    sessionStorage.setItem('qtsi-controlled-auth-session', 'user@example.test');
    const gateway = new ControlledAccountManagementGateway();
    await expect(gateway.listAccounts()).rejects.toThrow();
  });

  it('lets an admin list accounts but not change roles', async () => {
    sessionStorage.setItem(
      'qtsi-controlled-auth-session',
      'admin@example.test',
    );
    const gateway = new ControlledAccountManagementGateway();
    const accounts = await gateway.listAccounts();
    expect(accounts).toHaveLength(3);
    await expect(
      gateway.setAccountRole('controlled-user', 'admin'),
    ).rejects.toThrow();
  });

  it('lets the owner change another account role but not their own', async () => {
    sessionStorage.setItem(
      'qtsi-controlled-auth-session',
      'owner@example.test',
    );
    const gateway = new ControlledAccountManagementGateway();
    await gateway.setAccountRole('controlled-user', 'admin');
    const accounts = await gateway.listAccounts();
    expect(
      accounts.find((account) => account.userId === 'controlled-user')?.role,
    ).toBe('admin');
    await expect(
      gateway.setAccountRole('controlled-owner', 'admin'),
    ).rejects.toThrow();
  });
});

describe('UnavailableAccountManagementGateway', () => {
  it('rejects every operation', async () => {
    const gateway: AccountManagementGateway =
      new UnavailableAccountManagementGateway();
    await expect(gateway.updateDisplayName('Nom')).rejects.toThrow();
    await expect(gateway.listAccounts()).rejects.toThrow();
    await expect(gateway.setAccountRole('user-1', 'admin')).rejects.toThrow();
  });
});
