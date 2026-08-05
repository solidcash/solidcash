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
  networks: {
    mock: {
      type: 'mock',
      // Exercise the real BCH deployment ceilings while retaining the deterministic in-memory provider.
      consensus: { maximumInputBytes: 10_000, maximumNftCommitmentBytes: 128 },
    },
  },
  defaultNetwork: 'mock',
  typegen: {
    targets: [{ target: 'ethers5', layout: 'typechain', outDir: 'typechain-types' }],
  },
});
