import type { SupabaseClient } from '@supabase/supabase-js';
import type { OAuthConsentGateway } from '@domain/auth/OAuthConsentGateway';

export class SupabaseOAuthConsentGateway implements OAuthConsentGateway {
  constructor(private readonly client: SupabaseClient) {}
  async getAuthorizationDetails(authorizationId: string) {
    const { data, error } =
      await this.client.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !data)
      throw new Error('La demande d’autorisation est invalide ou expirée.');
    if ('redirect_url' in data)
      return { kind: 'redirect' as const, redirectUrl: data.redirect_url };
    return {
      kind: 'consent' as const,
      details: {
        authorizationId: data.authorization_id,
        clientName: data.client.name,
        scopes: data.scope.split(' ').filter(Boolean),
      },
    };
  }
  async approve(authorizationId: string) {
    const { data, error } = await this.client.auth.oauth.approveAuthorization(
      authorizationId,
      { skipBrowserRedirect: true },
    );
    if (error || !data)
      throw new Error('L’autorisation n’a pas pu être approuvée.');
    return data.redirect_url;
  }
  async deny(authorizationId: string) {
    const { data, error } = await this.client.auth.oauth.denyAuthorization(
      authorizationId,
      { skipBrowserRedirect: true },
    );
    if (error || !data) throw new Error('Le refus n’a pas pu être transmis.');
    return data.redirect_url;
  }
}

export class UnavailableOAuthConsentGateway implements OAuthConsentGateway {
  private unavailable(): Error {
    return new Error('Le serveur OAuth Prépa Math n’est pas configuré.');
  }
  getAuthorizationDetails(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  approve(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  deny(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
}
