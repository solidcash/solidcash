import { defineConfig } from '@solidcash/solidhat/config';

// Keep the upstream MistSwap checkout byte-for-byte unchanged. All generated
// BCH artifacts and cache entries live beside this adapter in the SolidCash
// worktree.
export default defineConfig({
  paths: {
    contracts: process.env.MISTSWAP_CONTRACTS ?? '/Code/mistswap/mistswap/contracts',
    artifacts: process.env.MISTSWAP_ARTIFACTS ?? 'artifacts',
    cache: 'cache',
    tests: '/Code/mistswap/mistswap/test',
  },
  compiler: {
    solidityImportCompat: true,
    ecrecover: 'p2pkh',
    // Pure / zero-state Solidity ports (ChainlinkOracleV2, library-like mocks) still need a master NFT +
    // blockLayout so view/pure returns emit returnEvent outputs and can be staticCall-derived. Without this
    // they compile as classic P2SH scripts with no returnEvent slot and StatefulContract pure-read fails.
    forceStateful: true,
  },
  networks: {
    mock: {
      type: 'mock',
      // Relaxed ceilings so the suite exercises CONTRACT behaviour rather than the size frontier; the real
      // 10,000-byte input limit is a separate optimization track (KashiPair `cook` is 10,677, the Uniswap
      // factory `createPair` closure 26,702).
      //
      // CAVEAT: `maximumInputBytes > 10_000` also selects the SDK's sparse/observer state-derivation path
      // instead of the faithful full-trace path every real network takes, so green here is weaker evidence
      // than green at 10,000. Keep the NFT commitment at the real 128 bytes.
      consensus: {
        maximumInputBytes: 100_000,
        maximumTransactionBytes: 10_000_000,
        maximumNftCommitmentBytes: 128,
      },
    },
  },
  defaultNetwork: 'mock',
  typegen: {
    targets: [{ target: 'ethers5', layout: 'typechain', outDir: 'typechain-types' }],
  },
});
