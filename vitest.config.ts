import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest 5 clears mock call history before every test. This suite reads history recorded in hooks.
    clearMocks: false,
    projects: ['packages/**/vitest.config.ts'],
    globals: true,
  },
});
