import type { NetworkProvider } from '../network/index.js';
import type { Utxo, Unlocker, Output } from '../interfaces.js';
import { poolSlotUnlockable } from './pool/reader.js';
import { selectPoolSlot } from './pool/select.js';

/**
 * Consumer-side resolver for blockhash(n). A read co-spends a ring slot of the reader's oracle pool and checks its
 * category, capability and flags, no lock; the slot's read path recreates it exactly at its own index. The read
 * also requires tx.time >= n.
 */
export interface BlockhashCoSpend {
  utxo: Utxo;
  unlocker: Unlocker;
  // The exact recreation; the caller places it at the co-spend input's own index.
  recreateOutput: Output;
  locktime: number; // tx.time floor the read requires (= n)
  /** The slot holds n; otherwise it holds a block of n's residue at least 256 newer, and n reads as zero. */
  exact: boolean;
}

/**
 * A live slot of pool `poolCategory` that answers block n, chosen by selectPoolSlot, or null when none does. A coin in
 * `exclude`, one the transaction already spends, is not chosen.
 */
export async function resolveBlockhashCoSpend(
  provider: NetworkProvider,
  poolCategory: string,
  n: bigint,
  exclude: readonly Pick<Utxo, 'txid' | 'vout'>[] = [],
): Promise<BlockhashCoSpend | null> {
  const slot = await selectPoolSlot(provider, poolCategory, n, exclude);
  if (slot === undefined) return null;
  const { unlocker, ...utxo } = poolSlotUnlockable(slot.utxo, poolCategory);
  return {
    utxo,
    unlocker,
    recreateOutput: { to: unlocker.generateLockingBytecode(), amount: utxo.satoshis, token: utxo.token },
    locktime: Number(n),
    exact: slot.exact,
  };
}
