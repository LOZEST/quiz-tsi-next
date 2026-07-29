export const mainNavigation = [
  { label: 'Tableau blanc', to: '/whiteboard' },
  { label: 'Mon parcours', to: '/progress' },
  { label: 'Banque de questions', to: '/questions' },
  { label: 'Réglages', to: '/settings' },
] as const;

export const appRoutes = [
  '/',
  '/login',
  '/whiteboard',
  '/progress',
  '/questions',
  '/settings',
  '/account',
  '/admin',
  '/access-denied',
] as const;
