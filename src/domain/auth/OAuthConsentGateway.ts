export interface OAuthAuthorizationDetails {
  readonly authorizationId: string;
  readonly clientName: string;
  readonly scopes: readonly string[];
}

export type OAuthAuthorizationResult =
  | Readonly<{ kind: 'consent'; details: OAuthAuthorizationDetails }>
  | Readonly<{ kind: 'redirect'; redirectUrl: string }>;

export interface OAuthConsentGateway {
  getAuthorizationDetails(
    authorizationId: string,
  ): Promise<OAuthAuthorizationResult>;
  approve(authorizationId: string): Promise<string>;
  deny(authorizationId: string): Promise<string>;
}
