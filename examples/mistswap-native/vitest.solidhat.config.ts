import { createRequire } from 'module';
import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';
import { defineConfig } from 'vitest/config';

// The MistSwap checkout stays byte-for-byte unchanged, so its tests live OUTSIDE this project and import
// `hardhat` / `ethers` / `chai` from ITS OWN node_modules. The preset's drop-in aliases point at bare
// specifiers, which Vite resolves relative to the importing file - and MistSwap's node_modules has no
// @solidcash/testing, so resolution falls back to the real Hardhat ("HH1: You are not inside a Hardhat
// project"). Re-point every alias at an absolute path resolved from THIS project instead.
const require = createRequire(import.meta.url);
const abs = (specifier: string): string => require.resolve(specifier);

const UPSTREAM = '/Code/mistswap/mistswap';

export default defineConfig(solidcashHardhatPreset({
  test: {
    include: [`${UPSTREAM}/test/**/*.test.ts`],
    // These suites deploy real split contracts in `before` hooks, which is far past Vitest's 10s hook default.
    // `test/SushiRoll.test.ts` is a 0-byte file upstream. Vitest treats "no suite found" as a failure, which
    // would report an empty upstream file as a MistSwap failure of ours.
    passWithNoTests: true,
    testTimeout: 120000,
    hookTimeout: 300000,
    server: { deps: { inline: [/mistswap\/mistswap/] } },
  },
  resolve: {
    alias: {
      hardhat: abs('@solidcash/testing'),
      'hardhat/config': abs('@solidcash/testing'),
      chai: abs('@solidcash/testing/chai'),
      ethers: abs('@solidcash/testing/ethers-shim'),
      '@nomiclabs/hardhat-ethers': abs('@solidcash/testing'),
      '@nomicfoundation/hardhat-ethers': abs('@solidcash/testing'),
      '@nomiclabs/hardhat-ethers/signers': abs('@solidcash/testing'),
      '@nomicfoundation/hardhat-ethers/signers': abs('@solidcash/testing'),
      '@nomicfoundation/hardhat-chai-matchers': abs('@solidcash/testing/chai'),
      '@nomicfoundation/hardhat-network-helpers': abs('@solidcash/testing/network-helpers'),
      '@nomicfoundation/hardhat-toolbox/network-helpers': abs('@solidcash/testing/network-helpers'),
    },
  },
}));
