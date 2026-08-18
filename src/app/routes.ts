export const mainNavigation = [
  { label: 'Tableau blanc', to: '/whiteboard' },
  { label: 'Mon parcours', to: '/progress' },
  { label: 'Mes Quizz', to: '/questions' },
  { label: 'Marketplace', to: '/marketplace' },
  { label: 'Réglages', to: '/settings' },
] as const;

export const appRoutes = [
  '/',
  '/login',
  '/whiteboard',
  '/progress',
  '/questions',
  '/marketplace',
  '/settings',
  '/account',
  '/admin',
  '/access-denied',
  '/oauth/consent',
  '/privacy/chatgpt-import',
] as const;
