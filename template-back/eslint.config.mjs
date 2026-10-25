// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Engines are written by other developers. They work through the SDK's ctx, never through Node, the network or the database directly.
const ENGINE_FORBIDDEN_MODULES = [
  'fs',
  'fs/promises',
  'child_process',
  'worker_threads',
  'cluster',
  'net',
  'tls',
  'dgram',
  'dns',
  'dns/promises',
  'http',
  'https',
  'http2',
  'os',
  'vm',
  'module',
  'v8',
  'inspector',
  'process',
  'readline',
  'repl',
];
const ENGINE_FORBIDDEN_PACKAGES = ['pg', 'typeorm', 'typeorm-transactional', 'ioredis', 'nodemailer', 'bcrypt', 'axios', 'undici', 'node-fetch'];
const ENGINE_FORBIDDEN_GLOBALS = ['process', 'fetch', 'require', 'XMLHttpRequest', 'WebSocket', 'EventSource', '__dirname', '__filename'];

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      "no-multiple-empty-lines": ["error", { max: 1, maxBOF: 1, maxEOF: 0 }]
    },
  },
  {
    // src/engines/<id>/** : the engine developers' folder. index.ts (the list) and sdk.ts (the contract) belong to the core team.
    files: ['src/engines/**/*.ts'],
    ignores: ['src/engines/index.ts', 'src/engines/sdk.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...ENGINE_FORBIDDEN_MODULES.flatMap((name) => [name, `node:${name}`]), ...ENGINE_FORBIDDEN_PACKAGES].map((name) => ({
            name,
            message: 'Engines may not import this. Use the ctx the platform passes in (ctx.http, ctx.db, ctx.log) or ask the core team.',
          })),
          patterns: [
            {
              group: ['@nestjs/*', '@domain/*', '@application/*', '@infrastructure/*', '@presentation/*', '@engines/*'],
              message: 'Engines import only ../sdk and their own files.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...ENGINE_FORBIDDEN_GLOBALS.map((name) => ({
          name,
          message: 'Not available to engines. Use ctx (ctx.http for network access); configuration comes from the core team, never from process.env.',
        })),
      ],
      'no-console': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
);
