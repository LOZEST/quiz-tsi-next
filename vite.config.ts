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
  const revisionComposition = fileURLToPath(
    new URL(
      env.VITE_AUTH_ADAPTER === 'controlled'
        ? './src/infrastructure/session/ControlledRevisionServices.ts'
        : './src/infrastructure/session/ProductionRevisionServices.ts',
      import.meta.url,
    ),
  );

  return {
    base: normalizeBasePath(env.VITE_BASE_PATH || '/'),
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: '@infrastructure/session/RevisionServicesComposition',
          replacement: revisionComposition,
        },
        ...Object.entries(aliases).map(([find, replacement]) => ({
          find,
          replacement,
        })),
      ],
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rolldownOptions: {
        output: {
          manualChunks(id: string) {
            return id.includes('/full-production-v1.json')
              ? 'official-question-bank'
              : undefined;
          },
        },
      },
    },
  };
});
