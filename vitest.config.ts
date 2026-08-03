import { defineConfig } from 'vitest/config';

/**
 * Single Vitest project across the whole workspace.
 *
 * One config rather than per-package ones: the suites are small, they share the
 * same environment setup, and a single `pnpm test` that runs everything is what
 * CI needs. Workspace packages resolve through pnpm's node_modules links, so no
 * aliasing is required.
 */
export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws on import outside a React Server Component to stop
      // server code being bundled for the browser. That guard is correct in the
      // app and meaningless in a Node test runner, so it is stubbed here.
      'server-only': new URL('./tests/stubs/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/seed/**'],
    },
  },
});
