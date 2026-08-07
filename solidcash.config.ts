import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  paths: {
    contracts: '.marketplace/contracts',
    tests: '/Code/effectiveacceleration.ai/contract/test',
    artifacts: '.marketplace/artifacts',
    cache: '.marketplace/cache',
  },
  // This project composes graph-free ERC-20 leaves into caller-authenticated atomic routes. Explicitly request
  // leaf participant routes; no marketplace source or test changes are required.
  compiler: { solidityImportCompat: true, messageBus: true },
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
