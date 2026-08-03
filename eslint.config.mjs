import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/packages/db/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // The security boundary: sensitive values must never be printed.
      // packages/observability exposes the only sanctioned logger.
      'no-restricted-globals': ['error', { name: 'console', message: 'Use @machai/observability logger.' }],
    },
  },
  {
    // Tooling and worker entrypoints legitimately write to stdout.
    files: [
      '**/*.config.{js,mjs,ts}',
      'packages/db/src/seed/**',
      'packages/observability/src/**',
      'apps/worker/src/index.ts',
      '**/scripts/**',
    ],
    rules: { 'no-restricted-globals': 'off' },
  },
);
