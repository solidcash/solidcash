import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  paths: {
    contracts: '/Code/effectiveacceleration.ai/contract-noproxy/contracts',
    tests: '/Code/effectiveacceleration.ai/contract-noproxy/test',
    artifacts: '/Code/effectiveacceleration.ai/contract-noproxy/artifacts',
    cache: '/Code/effectiveacceleration.ai/contract-noproxy/cache',
  },
  // This project composes graph-free ERC-20 leaves into caller-authenticated atomic routes. Explicitly request
  // leaf participant routes; no marketplace source or test changes are required.
  compiler: {
    solidityImportCompat: true,
    commitmentLimit: 128,
    maximumInputBytes: 10_000_000,
    maximumStackItemBytes: 10_000,
    messageBus: true,
    messageBusGraphContext: true,
    messageBusHandlers: [
      'publishJobPost', 'updateJobPost', 'publishJobEvent', 'userRegistered', 'arbitratorRegistered', 'meceTags',
      'balanceOf', 'approve', 'transferFrom', 'transfer', 'pay', 'setArbitrator',
      'takeJob', 'eventsLength', 'getArbitratorFee',
    ],
    // SolidCash addresses are locking bytecode. Recover the native P2PKH identity so an imported Solidity
    // `ecrecover(...) == msg.sender` comparison stays in one address domain and needs no EVM-keccak sidecar.
    ecrecover: 'p2pkh',
    // Skip speculative external-handler fallback rungs in this large imported call graph during development.
    optimizeForCompilationSpeed: true,
    sortedMappingsAll: false,
  },
  // Same mnemonic/path as the EffectiveAcceleration Hardhat project so getSigners() and
  // config.networks.hardhat.accounts.mnemonic stay aligned with marketplace.test.ts.
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0 },
  networks: {
    mock: {
      type: 'mock',
      consensus: {
        // The compatibility run exercises the unmodified application on BCH-native covenant bytecode.
        // Its imported OZ call graph is intentionally larger than relayable production contracts.
        maximumInputBytes: 10_000_000,
        maximumStackItemBytes: 10_000_000,
        maximumTransactionBytes: 10_000_000,
        maximumNftCommitmentBytes: 1_000_000,
        operationCostBudgetPerByte: 10_000_000,
        hashDigestIterationsPerByte: 10_000_000,
      },
      policy: { enforceDust: false, enforceProductionInputLimit: false },
    },
  },
  defaultNetwork: 'mock',
});
