import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/HardhatConsoleImport.test.ts'],
        globals: true,
        isolate: false,
        maxWorkers: 1,
        testTimeout: 60_000,
        setupFiles: ['./vitest.setup.ts'],
    },
});
//# sourceMappingURL=vitest.hardhat-console.config.js.map