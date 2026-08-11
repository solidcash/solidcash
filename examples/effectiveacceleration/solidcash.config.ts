import { defineConfig } from '@solidcash/testing';

export default defineConfig({
  // The checked-in contract mirror is the worktree-local source of truth. `contracts-scash` is retained only as
  // historical fixture material; it is not part of the canonical compile or test path.
  paths: { contracts: 'contracts', artifacts: 'artifacts', tests: 'test' },
  solc: {
    solidityImportCompat: true,
    // Keep the production state-partitioning layout while the mock VM relaxes execution ceilings.
    commitmentLimit: 128,
    maximumInputBytes: 1_000_000,
    optimizeForCompilationSpeed: true,
    ecrecover: 'p2pkh',
    // Keep the Hardhat-compatible harness on the uniform fixed-entry backend.
    // Mocknet's relaxed limits remove the former need to selectively switch
    // large mappings to the vmap trailing-output protocol.
    sortedMappingsAll: false,
  },
  typegen: {
    targets: [{
      target: 'ethers6', layout: 'typechain', outDir: 'typechain-types', sourceDir: 'contracts',
    }],
  },
  // The largest Marketplace entry is still an indivisible ~75KB call closure,
  // so the strict splitter cannot produce a 10KB bundle. Keep the compatibility
  // network permissive while exercising the unmodified application contracts.
  networks: {
    mock: {
      type: 'mock',
      consensus: {
        maximumInputBytes: 1_000_000,
        maximumStackItemBytes: 1_000_000,
        maximumTransactionBytes: 10_000_000,
        maximumNftCommitmentBytes: 1_000_000,
        operationCostBudgetPerByte: 10_000_000,
        hashDigestIterationsPerByte: 10_000_000,
      },
    },
  },
  defaultNetwork: 'mock',
  // The EA hardhat.config mnemonic + Ethereum derivation path, so getSigners() matches the project.
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0 },
});
