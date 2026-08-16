export type AuthErrorCode =
  | 'invalid-credentials'
  | 'network-unavailable'
  | 'configuration-missing'
  | 'session-expired'
  | 'profile-missing'
  | 'permission-denied'
  | 'storage-unavailable'
  | 'email-already-registered'
  | 'weak-password'
  | 'unknown';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    options?: ErrorOptions,
    public readonly offlineCandidate?: {
      userId: string;
      email: string;
      expiresAt?: string;
    },
  ) {
    super(message, options);
    this.name = 'AuthError';
  }
}

export const authErrorMessages: Record<AuthErrorCode, string> = {
  'invalid-credentials': 'Email ou mot de passe incorrect.',
  'network-unavailable':
    'Connexion impossible pour le moment. Vérifie ta connexion puis réessaie.',
  'configuration-missing':
    'La connexion n’est pas configurée sur cet environnement.',
  'session-expired': 'Ta session a expiré. Connecte-toi à nouveau.',
  'profile-missing':
    'Ton profil est indisponible. Réessaie ou contacte un administrateur.',
  'permission-denied': 'Tu n’as pas accès à cette ressource.',
  'storage-unavailable':
    'L’espace local ne peut pas être ouvert sur cet appareil.',
  'email-already-registered': 'Un compte existe déjà avec cet email.',
  'weak-password': 'Ton mot de passe doit contenir au moins 6 caractères.',
  unknown: 'Une erreur inattendue empêche la connexion. Réessaie.',
};
