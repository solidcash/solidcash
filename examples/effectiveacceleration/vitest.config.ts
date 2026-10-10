import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The sibling `effectiveacceleration.ai` checkout; `solidcash.config.ts` carries the same lookup and its reason. */
function effectiveAccelerationRoot(): string {
  const fromEnv = process.env.EACC_ROOT;
  if (fromEnv !== undefined && fromEnv !== '') return path.resolve(fromEnv);
  let dir = here;
  for (;;) {
    const candidate = path.join(dir, 'effectiveacceleration.ai');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('effectiveacceleration.ai was not found above this config; set EACC_ROOT to its checkout.');
    }
    dir = parent;
  }
}

// The marketplace test is the sibling project's own file and is referenced, not copied: link it under `test/` so
// its relative imports read this project's BCH-aware `src/` and generated `typechain-types/`. The link is
// gitignored, and `preserveSymlinks` below is what keeps those relative imports resolving here rather than at
// the sibling the link points into.
const marketplaceTest = path.join(here, 'test', 'marketplace.test.ts');
if (!existsSync(marketplaceTest)) {
  mkdirSync(path.dirname(marketplaceTest), { recursive: true });
  symlinkSync(path.join(effectiveAccelerationRoot(), 'contract', 'test', 'marketplace.test.ts'), marketplaceTest);
}

// The drop-in: the reusable @solidcash/testing preset supplies all the Hardhat/ethers/chai aliases + setup.
// This project only aliases the older @noble/ciphers subpaths to the installed v2 build.
export default defineConfig(solidcashHardhatPreset({
  test: {
    include: ['test/marketplace.test.ts', 'test/decodeData.test.ts', 'test/encryption.test.ts', 'test/wagmiAbi.test.ts'],
    testTimeout: 120000,
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@noble/ciphers/chacha': '@noble/ciphers/chacha.js',
      '@noble/ciphers/utils': '@noble/ciphers/utils.js',
    },
  },
}));
