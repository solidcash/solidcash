import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  paths: {
    contracts: 'contracts',
    tests: 'test',
    artifacts: 'artifacts',
    cache: 'cache',
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
  },
  composition: 'direct',
  typegen: { jsonArtifactModules: true, targets: [{ target: 'ethers6', layout: 'typechain', outDir: 'typechain-types', sourceDir: 'contracts' }] },
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0, satoshis: 100_000_000n },
  networks: { mock: { type: 'mock', consensus: { operationCostBudgetPerByte: 1_000_000, maximumInputBytes: 10_000_000, maximumNftCommitmentBytes: 128, maximumTransactionBytes: 100_000_000 }, policy: { enforceDust: false } } },
  defaultNetwork: 'mock',
});
