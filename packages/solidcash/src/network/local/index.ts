/**
 * Devnet (`solidhat node`) network provider surface.
 *
 * Kept on its own subpath (`@solidcash/solidcash/network/local`) so importing the package root does not load the
 * Electrum client, the WebSocket wrapper, or the HD signer.
 */

export {
  default as MemCashNetworkProvider,
  MEM_CASH_DEFAULT_MNEMONIC,
  type MemCashProviderOptions,
  type SignerOptions,
  type SnapshotRestorer,
} from '../MemCashNetworkProvider.js';
export { TokenWebSocket, type TokenWebSocketOptions } from '../TokenWebSocket.js';
