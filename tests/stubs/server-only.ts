/**
 * Test stub for the `server-only` package.
 *
 * The real module throws on import so server code can never be bundled into a
 * client component. Vitest runs in Node, where that guard has nothing to
 * protect against — but the import still has to resolve.
 */
export {};
