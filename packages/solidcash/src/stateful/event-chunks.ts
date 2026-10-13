/**
 * Wide events: a payload wider than one NFT commitment continues in the outputs right after its event output, each
 * an own-category immutable NFT at the event's continuation covenant (`computeEventContinuationHash`).
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { buildEventNftCovenantScript, computeEventContinuationHash } from '@solidcash/utils';
import { scriptToLockingBytecode } from '../utils.js';

/** The P2SH32 lock a wide event's continuation chunks carry; the compiler builds the same lock. */
export function eventContinuationLockingBytecode(
  categoryId: string, eventSignature: string, anonymous = false,
): Uint8Array {
  const hash = computeEventContinuationHash(eventSignature, anonymous);
  return scriptToLockingBytecode(buildEventNftCovenantScript(hexToBin(categoryId), hash), 'p2sh32');
}

/**
 * The payload of the event whose first commitment is `head`: `head`, then the continuation commitment `next(1)`
 * names for the output after it, `next(2)` for the one after that, until one is absent.
 */
export function joinEventContinuations(head: string, next: (offset: number) => string | undefined): string {
  let payload = head;
  for (let offset = 1; ; offset += 1) {
    const chunk = next(offset);
    if (chunk === undefined || chunk === '') return payload;
    payload += chunk;
  }
}
