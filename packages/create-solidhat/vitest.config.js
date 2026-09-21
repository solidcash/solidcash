import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    },
});
//# sourceMappingURL=vitest.config.js.map