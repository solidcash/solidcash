import { defineConfig } from '@solidcash/testing';

export default defineConfig({
  // The checked-in contract mirror is the worktree-local source of truth. `contracts-scash` is retained only as
  // historical fixture material; it is not part of the canonical compile or test path.
  paths: { contracts: 'contracts', artifacts: 'artifacts', tests: 'test' },
  solc: {
    evmCompat: true,
    // Keep the production state-partitioning layout while the mock VM relaxes execution ceilings.
    commitmentLimit: 128,
    maximumInputBytes: 10_000_000,
    // This compatibility run exercises authenticated multi-contract call DAGs. Graph-free leaf contracts (the
    // ERC-20 in particular) still need their route emitted because a routed parent can reach them repeatedly.
    messageBus: true,
    optimizeForCompilationSpeed: true,
    suppressWarnings: true,
    ecrecover: 'p2pkh',
    // Keep the Hardhat-compatible harness on the uniform fixed-entry backend.
    // Mocknet's relaxed limits remove the former need to selectively switch
    // large mappings to the vmap trailing-output protocol.
    sortedMappingsAll: false,
  },
  // Compile the framed composition convention: every entry point is a master program, so a transaction that
  // reaches one contract several times settles its state exactly once.
  composition: 'framed',
  typegen: {
    jsonArtifactModules: true,
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
        maximumInputBytes: 10_000_000,
        maximumStackItemBytes: 10_000_000,
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
