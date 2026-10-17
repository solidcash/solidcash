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
    // Proxy-owned pointer records need the same tagged header as a singleton implementation's shared record.
    tagSingletonDataNfts: true,
    evmCompat: true,
    messageBus: true,
    messageBusKernel: true,
    messageBusGraphContext: true,
    // SolidCash addresses are locking bytecode. Recover the native P2PKH identity so an imported Solidity
    // `ecrecover(...) == msg.sender` comparison stays in one address domain and needs no EVM-keccak sidecar.
    ecrecover: 'p2pkh',
    // Skip speculative external-handler fallback rungs in this large imported call graph during development.
    optimizeForCompilationSpeed: true,
    suppressWarnings: true,
  },
  // Compile the framed composition convention: every entry point is a master program, so a transaction that
  // reaches one contract several times settles its state exactly once.
  composition: 'framed',
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
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0, satoshis: 100_000_000n },
  networks: {
    mock: {
      type: 'mock',
      consensus: {
        // Proxy __forward inspects the implementation INPUTBYTECODE (full p2sh32 redeem, ~3.8MB
        // for MarketplaceV1). That OP_SPLIT is charged to the 781-byte proxy input; 10_000/byte
        // is not enough. 1e6/byte covers the introspection without changing input/tx caps.
        operationCostBudgetPerByte: 1_000_000,
        maximumInputBytes: 10_000_000,
        maximumTransactionBytes: 100_000_000,
        maximumStackItemBytes: 10_000_000,
        maximumNftCommitmentBytes: 10_000_000,
      },
    },
    // The same limits are configured on the patched BCHN container (docker-compose.marketplace.yml).
    // They are published here so the SDK preflight accepts the transactions it builds.
    regtest: {
      type: 'regtest',
      rpc: {
        url: process.env.REGTEST_RPC_URL ?? 'http://127.0.0.1:18443',
        user: process.env.REGTEST_RPC_USER ?? 'user',
        password: process.env.REGTEST_RPC_PASSWORD ?? 'password',
      },
      consensus: {
        operationCostBudgetPerByte: 1_000_000,
        maximumInputBytes: 10_000_000,
        maximumTransactionBytes: 100_000_000,
        maximumStackItemBytes: 10_000_000,
        maximumNftCommitmentBytes: 10_000_000,
        hashDigestIterationsPerByte: 10_000_000,
      },
      policy: { enforceDust: false },
    },
  },
  defaultNetwork: process.env.SOLIDCASH_MARKETPLACE_NETWORK === 'regtest' ? 'regtest' : 'mock',
});
