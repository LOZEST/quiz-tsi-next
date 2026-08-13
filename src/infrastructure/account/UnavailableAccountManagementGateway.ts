import type { AccountManagementGateway } from '@domain/account/AccountManagementGateway';

export class UnavailableAccountManagementGateway implements AccountManagementGateway {
  private unavailable(): Error {
    return new Error('La gestion des comptes n’est pas configurée.');
  }
  updateDisplayName(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  listAccounts(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  setAccountRole(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
}
