import { computeEventNameHash, hash256 } from '@solidcash/utils';
import { categorySlotValue } from './validator-input.js';

/** The satoshi value a plan states for an event output. */
export const EVENT_VALUE = 1_000n;

/**
 * The lock an emitting body recomputes for an event: the category pin, the event signature hash and the relative
 * timelock, hashed into a P2SH32 lock.
 *
 * A plan that states an event output has to lock it the way the body checks it, so every plan that lays one out
 * builds the lock here rather than beside each case.
 */
export function eventCovenantLock(category: Uint8Array, signature: string): Uint8Array {
  const nameHash = computeEventNameHash(signature);
  const script = new Uint8Array([
    0xc0, 0xce, 0x01, 0x20, 0x7f, 0x7c, // OP_INPUTINDEX OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_SWAP
    0x20, ...categorySlotValue(category), // the category in the order introspection reports it
    0x88, 0x00,                         // OP_EQUALVERIFY, empty capability
    0x88, 0x14, ...nameHash,            // OP_EQUALVERIFY, the event signature hash
    0x75, 0x02, 0x90, 0x00, 0xb2, 0x75, // OP_DROP <144> OP_CHECKSEQUENCEVERIFY OP_DROP
    0x51,                               // OP_1
  ]);
  return new Uint8Array([0xaa, 0x20, ...hash256(script), 0x87]);
}

/** An event output: an immutable NFT of the contract's category carrying the emitted payload. */
export interface EventOutput {
  readonly lockingBytecode: Uint8Array;
  readonly valueSatoshis: bigint;
  readonly token: { category: Uint8Array; amount: bigint; nft: { capability: 'none'; commitment: Uint8Array } };
}

export function eventOutput(
  category: Uint8Array,
  signature: string,
  commitment: Uint8Array,
  valueSatoshis: bigint = EVENT_VALUE,
): EventOutput {
  return {
    lockingBytecode: eventCovenantLock(category, signature),
    valueSatoshis,
    token: { category, amount: 0n, nft: { capability: 'none', commitment } },
  };
}
