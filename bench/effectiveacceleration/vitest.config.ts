/**
 * The EffectiveAcceleration marketplace bench.
 *
 * It runs the application's own `test/marketplace.test.ts`, where it lives in
 * `../effectiveacceleration.ai/contract`, against the contracts this bench compiles. Nothing of the application is
 * copied, linked or shadowed here: the compile root is the application's `contract/contracts`
 * (`solidcash.config.ts`), the test is included by absolute path, and its `../typechain-types/**` resolves through
 * the alias below. The carried files are this config and `solidcash.config.ts`.
 *
 * Run it from this directory (there are no npm scripts):
 *   node ../../packages/testing/dist/cli.js compile   // writes artifacts/ and typechain-types/
 *   node ../../node_modules/vitest/vitest.mjs run     // the application's suite
 *
 * `artifacts/`, `cache/` and `typechain-types/` are build products of that compile, ignored by the repository's
 * root `.gitignore`.
 */
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
      // The application's own marketplace test, run from where it lives. Nothing of the application's tree is
      // copied or linked into this bench.
      include: [path.join(application, 'test', 'marketplace.test.ts')],
      testTimeout: 1_800_000,
      hookTimeout: 1_800_000,
      fileParallelism: false,
      execArgv: ['--max-old-space-size=8192'],
      reporters: ['verbose'],
    },
    resolve: {
      // The application's test resolves its sources beside itself, but its bindings are this bench's generated
      // ones, so `../typechain-types/**` points here.
      alias: [
        { find: /^\.\.\/typechain-types\//, replacement: `${path.join(here, 'typechain-types')}/` },
        { find: '@noble/ciphers/chacha', replacement: cipher('chacha') },
        { find: '@noble/ciphers/crypto', replacement: cipher('utils') },
        { find: '@noble/ciphers/utils', replacement: cipher('utils') },
        { find: '@noble/ciphers/webcrypto', replacement: cipher('utils') },
      ],
    },
  },
  { offline: true },
));
