import type { TransactionDetails } from './interfaces.js';
import type NetworkProvider from './network/NetworkProvider.js';

const POLL_INTERVAL_MS = 500;
const MAX_POLLS = 240; // ~2 minutes at 500ms

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Attach an ethers-style `wait()` to a transaction result. `wait()` resolves once the provider knows the tx
 * (mined / accepted); `wait(n)` additionally waits until the chain has advanced n-1 blocks. On MockNetworkProvider
 * the tx is mined on send, so the first poll succeeds immediately (no delay). Mutates and returns `details`.
 */
export function attachWait(details: TransactionDetails, provider: NetworkProvider): TransactionDetails {
  details.wait = async (confirmations = 1): Promise<TransactionDetails> => {
    let known = false;
    for (let i = 0; i < MAX_POLLS && !known; i++) {
      try {
        await provider.getRawTransaction(details.txid);
        known = true;
      } catch {
        await sleep(POLL_INTERVAL_MS);
      }
    }
    if (!known) throw new Error(`Transaction ${details.txid} was not confirmed within the wait timeout.`);

    if (confirmations > 1) {
      const start = await provider.getBlockHeight();
      for (let i = 0; i < MAX_POLLS; i++) {
        if (await provider.getBlockHeight() >= start + confirmations - 1) break;
        await sleep(POLL_INTERVAL_MS);
      }
    }
    return details;
  };
  return details;
}
