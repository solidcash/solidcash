import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest 5 clears mock call history before every test. This suite reads history recorded in hooks.
    clearMocks: false,
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    globals: true,
    silent: 'passed-only',
    // These tests compile real contracts, so the 5s vitest default is not enough. Matches solidc's 30s; solidcash
    // uses 120s for the same reason.
    testTimeout: 30_000,
  },
});
