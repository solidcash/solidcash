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
    evmCompat: true,
    ecrecover: 'p2pkh',
    // The port settles cross-contract state through the message bus: `KashiPairMock.accrueTwice` calls `accrue()`
    // twice and `accrue` inlines an `IBentoBoxV1.toAmount` state read, so one UTXO master would have to be spent
    // twice and the direct path refuses the shape. That repetition exists only after inlining, so automatic
    // selection cannot see it in the source (its diagnostic now says so); the app states the option.
    messageBus: true,
    // Pure / zero-state Solidity ports (ChainlinkOracleV2, library-like mocks) still need a master NFT +
    // blockLayout so view/pure returns emit returnEvent outputs and can be staticCall-derived. Without this
    // they compile as classic P2SH scripts with no returnEvent slot and StatefulContract pure-read fails.
    forceStateful: true,
  },
  // The mock harness re-funds signers from its own default HD branch, so the project must name the same branch:
  // with the harness's Hardhat branch instead, the identities the suites use are never funded and every
  // `token.deploy(...)` dies with "Signer ... has insufficient funds (0 sats) to fan out a genesis funding UTXO".
  accounts: { path: "m/44'/145'/0'/0", count: 20, satoshis: 100_000_000n },
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
