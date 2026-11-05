import { bigIntToVmNumber, encodeDataPush, flattenBinArray } from '@bitauth/libauth';

/**
 * A stand-in co-spent callee for loop-call fixtures. Its unlocking pushes what a SolidCash callee's does: the selector a
 * multi-method callee takes, the call's arguments with the last one first, then a redeem (here an `OP_NOP` stand-in,
 * which opens with no push). Its lock drops every push and succeeds. A caller checks the selector and the arguments it
 * names against those pushes.
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
