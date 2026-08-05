import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  paths: {
    contracts: '.marketplace/contracts',
    tests: '/Code/effectiveacceleration.ai/contract/test',
    artifacts: '.marketplace/artifacts',
    cache: '.marketplace/cache',
  },
  compiler: { solidityImportCompat: true },
  networks: {
    mock: {
      type: 'mock',
      consensus: {
        maximumInputBytes: 10_000_000,
        maximumTransactionBytes: 100_000_000,
        maximumStackItemBytes: 10_000_000,
        maximumNftCommitmentBytes: 10_000_000,
      },
      policy: { enforceDust: false },
    },
  },
  defaultNetwork: 'mock',
});
