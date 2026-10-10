import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// The installed @noble/ciphers is v2, whose subpaths are the `*.js` files: the application's
// `@noble/ciphers/crypto` (randomBytes) and `/utils` both live in utils.js, as the lane harness also maps them.
const cipher = (entry: string): string => require.resolve(`@noble/ciphers/${entry}.js`);

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

const application = path.join(effectiveAccelerationRoot(), 'contract');

// The lane harness this project mirrors (`/Code/cashscript/vitest.marketplace.config.ts`): the SolidHat
// compatibility preset plus its hermetic offline runtime (the suite publishes through an IPFS service), the same
// worker heap, serialized files and 30-minute ceiling the largest titles need.
export default defineConfig(solidhatPreset(
  { hardhat: 2, ethers: 6 },
  {
    root: here,
    cacheDir: 'cache/vite',
    test: {
      // The application's own marketplace test, run from where it lives, plus this project's own cases. Nothing
      // of the application's tree is copied or linked into this project.
      include: [path.join(application, 'test', 'marketplace.test.ts'), 'test/*.test.ts'],
      testTimeout: 1_800_000,
      hookTimeout: 1_800_000,
      fileParallelism: false,
      execArgv: ['--max-old-space-size=8192'],
      reporters: ['verbose'],
    },
    resolve: {
      // The application's test resolves its sources beside itself, but its bindings are this project's generated
      // ones: `../typechain-types/**` points here while `../src/**` keeps reading the application's own sources,
      // which a case of ours also imports from this project.
      alias: [
        { find: /^\.\.\/typechain-types\//, replacement: `${path.join(here, 'typechain-types')}/` },
        { find: /^\.\.\/src\//, replacement: `${path.join(application, 'src')}/` },
        { find: '@noble/ciphers/chacha', replacement: cipher('chacha') },
        { find: '@noble/ciphers/crypto', replacement: cipher('utils') },
        { find: '@noble/ciphers/utils', replacement: cipher('utils') },
        { find: '@noble/ciphers/webcrypto', replacement: cipher('utils') },
      ],
    },
  },
  { offline: true },
));
