import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@app/App';
import { restoreGithubPagesLocation } from '@app/routing/githubPagesFallback';
import '@design-system/styles/reset.css';
import '@design-system/styles/tokens.css';
import '@design-system/styles/global.css';

restoreGithubPagesLocation(window);

const root = document.getElementById('root');

if (!root) {
  throw new Error('Le point de montage de l’application est introuvable.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
