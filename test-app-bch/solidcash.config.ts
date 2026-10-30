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
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0, satoshis: 1_000_000_000n },
  networks: {
    // `npx solidcash node` from the app repository, which serves this port.
    localhost: { type: 'mem-cash', memCash: { url: process.env.SOLIDCASH_NODE_URL ?? 'http://127.0.0.1:8496' } },
    mock: {
      type: 'mock',
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
  defaultNetwork: 'mock',
});
