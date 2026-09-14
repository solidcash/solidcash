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
  compiler: {
    solidityImportCompat: true,
    messageBus: true,
    messageBusKernel: true,
    messageBusGraphContext: true,
    // SolidCash addresses are locking bytecode. Recover the native P2PKH identity so an imported Solidity
    // `ecrecover(...) == msg.sender` comparison stays in one address domain and needs no EVM-keccak sidecar.
    ecrecover: 'p2pkh',
    // Skip speculative external-handler fallback rungs in this large imported call graph during development.
    optimizeForCompilationSpeed: true,
    suppressWarnings: true,
    // The ten-root project compile spends ~1.0 s of its outline phase on two passes that recover only
    // 34-36 bytes per millisecond (the window-12 follow-up rounds and the nested compiler-helper pass).
    // Dropping them costs at most 5 % bytecode on any root and saves ~1.2 s of a 21.5 s compile.
    outlineThoroughness: 'speed',
  },
  typegen: {
    jsonArtifactModules: true,
    targets: [{
      target: 'ethers6',
      layout: 'typechain',
      outDir: '.marketplace/project/typechain-types',
      sourceDir: '.marketplace/contracts',
    }],
  },
  // Same mnemonic/path as the EffectiveAcceleration Hardhat project so getSigners() and
  // config.networks.hardhat.accounts.mnemonic stay aligned with marketplace.test.ts.
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0 },
  networks: {
    mock: {
      type: 'mock',
      consensus: {
        // Proxy __forward inspects the implementation INPUTBYTECODE (full p2sh32 redeem, ~3.8MB
        // for MarketplaceV1). That OP_SPLIT is charged to the 781-byte proxy input; 10_000/byte
        // is not enough. 1e6/byte covers the introspection without changing input/tx size caps.
        operationCostBudgetPerByte: 1_000_000,
        maximumInputBytes: 10_000_000,
        maximumTransactionBytes: 100_000_000,
        maximumStackItemBytes: 10_000_000,
        maximumNftCommitmentBytes: 10_000_000,
      },
    },
  },
  defaultNetwork: 'mock',
});
