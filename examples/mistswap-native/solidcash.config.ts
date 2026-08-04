import { defineConfig } from '@solidcash/solidhat/config';

// Keep the upstream MistSwap checkout byte-for-byte unchanged. All generated
// BCH artifacts and cache entries live beside this adapter in the SolidCash
// worktree.
export default defineConfig({
  paths: {
    contracts: '/Code/mistswap/mistswap/contracts',
    artifacts: 'artifacts',
    cache: 'cache',
    tests: '/Code/mistswap/mistswap/test',
  },
  compiler: {
    solidityImportCompat: true,
    ecrecover: 'p2pkh',
  },
  networks: { mock: { type: 'mock' } },
  defaultNetwork: 'mock',
  typegen: {
    targets: [{ target: 'ethers5', layout: 'typechain', outDir: 'typechain-types' }],
  },
});
