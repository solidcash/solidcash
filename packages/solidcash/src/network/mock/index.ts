/**
 * Mock network provider surface.
 *
 * Kept on its own subpath (`@solidcash/solidcash/network/mock`) so importing the package root does not load the mock
 * indexer/verifier stack (`@mem-cash/electrum`, `@mem-cash/validation`) or the HD signer.
 */

export {
  default as MockNetworkProvider,
  FailingMockNetworkProvider,
  onMockNetworkProviderReset,
  type TokenGenesisOutput,
  type SnapshotRestorer,
  MOCK_DEFAULT_BLOCK_TIME,
  MOCK_CONSENSUS_LIMITS,
  MOCK_RELAXED_OPERATION_COST,
} from '../MockNetworkProvider.js';
