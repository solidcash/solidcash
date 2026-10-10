import { existsSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// The installed @noble/ciphers is v2, whose subpaths are the `*.js` files: the app's `@noble/ciphers/crypto`
// (randomBytes) and `/utils` both live in utils.js, as the lane harness also maps them.
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

/**
 * Mirror `source` under `target` as symlinks, creating directories as needed and leaving existing links alone.
 */
function linkTree(target: string, source: string): void {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) linkTree(to, from);
    else if (!existsSync(to)) symlinkSync(from, to);
  }
}

// The application's sources and its marketplace test are the sibling project's own files and are referenced, not
// copied: link them under `src/` and `test/` so the test's relative imports (../src/**) read the application's
// sources while (../typechain-types/**) read this project's generated bindings. Both links are gitignored, and
// `preserveSymlinks` below is what keeps those relative imports resolving here rather than at the sibling.
const sibling = path.join(effectiveAccelerationRoot(), 'contract');
linkTree(path.join(here, 'src'), path.join(sibling, 'src'));
// Only the one test the selection runs is linked; the application's other tests are not part of this project.
const marketplaceTest = path.join(here, 'test', 'marketplace.test.ts');
if (!existsSync(marketplaceTest)) symlinkSync(path.join(sibling, 'test', 'marketplace.test.ts'), marketplaceTest);

// The lane harness this project mirrors (`/Code/cashscript/vitest.marketplace.config.ts`): the SolidHat
// compatibility preset plus its hermetic offline runtime (the suite publishes through an IPFS service), the same
// worker heap, serialized files and 30-minute ceiling the largest titles need.
export default defineConfig(solidhatPreset(
  { hardhat: 2, ethers: 6 },
  {
    root: here,
    cacheDir: 'cache/vite',
    test: {
      include: [
        'test/marketplace.test.ts', 'test/decodeData.test.ts', 'test/encryption.test.ts', 'test/wagmiAbi.test.ts',
      ],
      testTimeout: 1_800_000,
      hookTimeout: 1_800_000,
      fileParallelism: false,
      execArgv: ['--max-old-space-size=8192'],
      reporters: ['verbose'],
    },
    resolve: {
      preserveSymlinks: true,
      // The preset supplies the Hardhat/ethers/chai drop-in aliases; this is the app's v1-era @noble/ciphers
      // subpath map onto the installed v2 build.
      alias: {
        '@noble/ciphers/chacha': cipher('chacha'),
        '@noble/ciphers/crypto': cipher('utils'),
        '@noble/ciphers/utils': cipher('utils'),
        '@noble/ciphers/webcrypto': cipher('utils'),
      },
    },
  },
  { offline: true },
));
