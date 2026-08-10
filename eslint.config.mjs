import eslint from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const restrictedGlobals = ['alert', 'confirm', 'prompt', 'eval'];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      '**/*.d.mts',
      'node_modules/**',
      'playwright-report/**',
      'supabase/.branches/**',
      'supabase/.temp/**',
      'test-results/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['supabase/functions/*/*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'import-x': importX,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['tsconfig.app.json', 'tsconfig.node.json'],
        }),
      ],
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'import-x/no-cycle': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-restricted-globals': ['error', ...restrictedGlobals],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Function']",
          message: 'new Function is forbidden.',
        },
        {
          selector:
            "CallExpression[callee.object.name='console'][callee.property.name='log']",
          message: 'console.log is forbidden in production code.',
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react',
            'react-dom',
            '@app/*',
            '@pages/*',
            '@features/*',
            '@infrastructure/*',
            '@design-system/*',
          ],
        },
      ],
    },
  },
  {
    files: ['src/design-system/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@pages/*', '@features/*', '@infrastructure/*'] },
      ],
    },
  },
  {
    files: ['src/infrastructure/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@pages/*', '@design-system/*'] },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['supabase/functions/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['scripts/**/*.mjs', '*.config.mjs'],
    languageOptions: { globals: globals.node },
  },
);
