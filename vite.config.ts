import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The exhaustive no-dash reachability simulation can exceed Vitest's
    // 5 s default when all test files transform concurrently on a busy host.
    testTimeout: 10_000,
  },
});
