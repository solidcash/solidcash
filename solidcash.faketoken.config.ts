import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  paths: {
    contracts: '.marketplace/faketoken-contracts',
    artifacts: '.marketplace/faketoken-artifacts',
    cache: '.marketplace/faketoken-cache',
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
