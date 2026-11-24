import { bigIntToVmNumber, binToHex, encodeDataPush, flattenBinArray } from '@bitauth/libauth';
import { callRecordDigest } from '../src/stateful/call-record.js';

/**
 * A stand-in co-spent callee for loop-call fixtures. Its unlocking pushes what a SolidCash callee's does: the selector a
 * multi-method callee takes, the call's arguments with the last one first, then a redeem (here an `OP_NOP` stand-in,
 * which opens with no push). Its lock drops every push and succeeds. A caller that reads no record checks the selector
 * and the arguments it names against those pushes; one that reads a record reads the one the spend lays out for the
 * stand-in (standInVoidRecord), on a carrier of the category of the minting token its coin holds (standInToken).
 */
export function trivialCallee(
  args: readonly (bigint | Uint8Array)[], selector?: Uint8Array,
): { lock: Uint8Array; unlocking: Uint8Array; unlocker: never } {
  const pushes = [
    ...(selector ? [selector] : []),
    ...[...args].reverse().map((arg) => (typeof arg === 'bigint' ? bigIntToVmNumber(arg) : arg)),
    Uint8Array.of(0x61),
  ];
  const lock = Uint8Array.from([...pushes.map(() => 0x75), 0x51]);
  const unlocking = flattenBinArray(pushes.map((push) => encodeDataPush(push)));
  return {
    lock,
    unlocking,
    unlocker: {
      generateLockingBytecode: (): Uint8Array => lock,
      generateUnlockingBytecode: (): Uint8Array => unlocking,
    } as never,
  };
}

/** The category of the minting token a stand-in callee's coin holds, so the records laid out for it carry it. */
export const STAND_IN_CATEGORY = 'ab'.repeat(32);

type StandInToken<Capability> = { category: string; amount: bigint; nft: { capability: Capability; commitment: string } };

/** The minting token of a stand-in callee's coin, and of the output that re-creates it. */
export const standInToken = (): StandInToken<'minting'> => ({
  category: STAND_IN_CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: '' },
});

/** The void record, `digest || 01`, a SolidCash callee settles for its method `selector` run on the numbers `args`. */
export function standInVoidRecordCommitment(selector: Uint8Array, args: readonly bigint[], reader = 0): Uint8Array {
  const digest = callRecordDigest({
    inputs: args.map((_, index) => ({ name: `a${index}`, type: 'int' })), selector: binToHex(selector),
  }, [...args], { namesReader: true }, 0, reader)!;
  return Uint8Array.of(...digest, 0x01);
}

/**
 * That void record read by input `reader`, which a stand-in settles none of, on an `OP_TRUE` carrier of the stand-in
 * category.
 */
export function standInVoidRecord(
  selector: Uint8Array, args: readonly bigint[], reader = 0,
): { to: Uint8Array; amount: bigint; token: StandInToken<'none'> } {
  const commitment = binToHex(standInVoidRecordCommitment(selector, args, reader));
  return {
    to: Uint8Array.of(0x51), amount: 1000n,
    token: { category: STAND_IN_CATEGORY, amount: 0n, nft: { capability: 'none', commitment } },
  };
}
