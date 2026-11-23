/**
 * A direct call whose `{value:}` rides its record pays no output of its caller's: the caller takes the value from its
 * satoshi container, and the callee's record digests what its own satoshi container received. The builder pays the
 * value into the callee's container, past every block, where the callee's msg.value counts it.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Output } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';
import { getSatoshiContainerAddress } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

/** Appends one deposit per value-carrying group, once: a rebuild that kept the tail reuses the outputs it finds. */
export function appendCallValueDeposits(
  groups: readonly ExternalCallUtxoGroup[], builder: { outputs: Output[] },
): void {
  const claimed = new Set<number>();
  for (const group of groups) {
    const value = group.callValue ?? 0n;
    if (value === 0n) continue;
    const lock = addressToLockScript(getSatoshiContainerAddress(group.externalContract.inner, group.categoryId));
    const lockHex = binToHex(lock);
    const existing = builder.outputs.findIndex((output, index) => !claimed.has(index) && output.token === undefined
      && output.amount === value && binToHex(output.to instanceof Uint8Array ? output.to
      : addressToLockScript(output.to)) === lockHex);
    if (existing >= 0) {
      claimed.add(existing);
      continue;
    }
    claimed.add(builder.outputs.length);
    builder.outputs.push({ to: lock, amount: value });
  }
}
