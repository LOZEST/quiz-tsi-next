import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';

import { normalizeBasePath } from './scripts/pages-config.mjs';

const aliases = {
  '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
  '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
  '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
  '@domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
  '@infrastructure': fileURLToPath(
    new URL('./src/infrastructure', import.meta.url),
  ),
  '@design-system': fileURLToPath(
    new URL('./src/design-system', import.meta.url),
  ),
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: normalizeBasePath(env.VITE_BASE_PATH || '/'),
    plugins: [react()],
    resolve: { alias: aliases },
    build: { outDir: 'dist', sourcemap: false },
  };
});
