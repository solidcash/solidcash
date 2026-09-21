import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const cipher = (entry) => fileURLToPath(new URL(`node_modules/@noble/ciphers/${entry}.js`, import.meta.url));
const worktreeRoot = fileURLToPath(new URL('.', import.meta.url));
const bchCompatSrc = fileURLToPath(new URL('examples/effectiveacceleration/src', import.meta.url));
process.env.SOLIDCASH_PROJECT_ROOT = worktreeRoot;
/** Relative imports skip Vite aliases; remap the Ethereum EA src onto the BCH-aware copy. */
export function redirectEffectiveAccelerationSrc(id) {
    const normalized = id.replace(/\\/g, '/');
    for (const marker of ['/.marketplace/project/src/', '/effectiveacceleration.ai/contract/src/']) {
        const index = normalized.indexOf(marker);
        if (index < 0)
            continue;
        return path.join(bchCompatSrc, normalized.slice(index + marker.length));
    }
    return undefined;
}
function existingSource(candidate) {
    if (!candidate)
        return undefined;
    if (existsSync(candidate))
        return candidate;
    if (existsSync(`${candidate}.ts`))
        return `${candidate}.ts`;
    if (existsSync(`${candidate}.js`))
        return `${candidate}.js`;
    if (existsSync(path.join(candidate, 'index.ts')))
        return path.join(candidate, 'index.ts');
    return undefined;
}
function eaSrcRedirectPlugin() {
    return {
        name: 'ea-bch-src-redirect',
        enforce: 'pre',
        resolveId(source, importer) {
            const direct = existingSource(redirectEffectiveAccelerationSrc(source) ?? '');
            if (direct)
                return direct;
            if (!source.startsWith('.') || !importer)
                return undefined;
            const resolved = path.resolve(path.dirname(importer), source);
            const redirected = redirectEffectiveAccelerationSrc(resolved);
            return redirected ? existingSource(redirected) : undefined;
        },
    };
}
export default defineConfig(solidhatPreset({ hardhat: 2, ethers: 6 }, {
    root: worktreeRoot,
    cacheDir: '.marketplace/vite-cache-marketplace',
    plugins: [eaSrcRedirectPlugin()],
    resolve: {
        alias: [
            { find: '@noble/ciphers/chacha', replacement: cipher('chacha') },
            { find: '@noble/ciphers/crypto', replacement: cipher('utils') },
            { find: '@noble/ciphers/utils', replacement: cipher('utils') },
            { find: '@noble/ciphers/webcrypto', replacement: cipher('utils') },
        ],
    },
    test: {
        include: ['.marketplace/project/test/marketplace.test.ts'],
        testTimeout: 600_000,
        hookTimeout: 600_000,
        fileParallelism: false,
        // The fixture retains several multi-megabyte covenant transactions. Avoid spending most of a full run in
        // major GC at Node's default ~4 GB worker ceiling, and expose per-test progress without SDK debug logging.
        execArgv: ['--max-old-space-size=8192'],
        reporters: ['verbose'],
    },
}));
//# sourceMappingURL=vitest.marketplace.config.js.map