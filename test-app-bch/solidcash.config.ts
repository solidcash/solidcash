import { defineConfig } from '@solidcash/solidhat/config';

/**
 * The SushiSwap app's contracts as the BCH build runs them (the same sources `hardhat.config.ts` compiles for EVM).
 *
 * The project compiles `/Code/sushi-port/contracts` in place: the app repository is the source of truth, and this
 * directory holds only the BCH test project. The framed composition places one entry per master (`split: 'func'`),
 * which is what lets one transaction reach a contract through several entries.
 *
 * `SOLIDCASH_APP_CONTRACTS` overrides the path when the two checkouts are not siblings.
 */
export default defineConfig({
  paths: {
    contracts: process.env.SOLIDCASH_APP_CONTRACTS
      ?? new URL('../../../../sushi-port/contracts', import.meta.url).pathname,
    artifacts: 'artifacts',
    cache: 'cache',
    tests: 'test',
  },
  compiler: {
    evmCompat: true,
    // The app's own form (sushi-port's solidcash.config.ts): an address is its exact locking bytecode, stored,
    // compared and returned whole (DECISIONS D56).
    addressForm: 'bytecode',
    messageBus: true,
    messageBusKernel: true,
    messageBusGraphContext: true,
    tagSingletonDataNfts: true,
    allowUnsafeOperations: true,
    forceStateful: true,
    commitmentLimit: 128,
    suppressWarnings: true,
    split: 'func',
  },
  composition: 'framed',
  mnemonic: 'custom true energy limb excuse attend mail pudding since sugar device ten',
  accounts: { path: "m/44'/145'/0'/0", count: 20, initialIndex: 0, satoshis: 1_000_000_000n },
  networks: {
    // The app's `solidcash node`, which serves this port. Its production profile is the mainnet one.
    localhost: {
      type: 'mem-cash',
      memCash: { url: process.env.SOLIDCASH_NODE_URL ?? 'http://127.0.0.1:8496' },
      consensus: {
        maximumInputBytes: 10_000,
        maximumStackItemBytes: 10_000,
        maximumTransactionBytes: 1_000_000,
        maximumNftCommitmentBytes: 128,
        operationCostBudgetPerByte: 800,
        hashDigestIterationsPerByte: 0.5,
        maximumMoney: 2_100_000_000_000_000n,
      },
      policy: { enforceDust: true },
    },
    mock: {
      type: 'mock',
      // Test-only: contracts that deliberately exceed mainnet's limits use this network explicitly.
      consensus: {
        operationCostBudgetPerByte: 1_000_000,
        maximumInputBytes: 10_000_000,
        maximumStackItemBytes: 10_000_000,
        maximumNftCommitmentBytes: 128,
        maximumTransactionBytes: 100_000_000,
      },
      policy: { enforceDust: false },
    },
  },
  defaultNetwork: 'localhost',
});
