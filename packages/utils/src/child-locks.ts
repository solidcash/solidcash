/**
 * The master locks a creator's category check names for the child it mints (docs/framed/CREATE2_IDENTITY.md).
 *
 * A master's lock depends on the block oracle the deployment binds, so it exists only at deployment: the compiler
 * reserves a fixed number of placeholder pushes and the deployment replaces each with the child's entry lock.
 */

/**
 * How many master locks a creator's check names: the shipped SushiSwap pair's 23 entries, with room for the internal
 * helpers a bundle cuts. A creator whose child has more entries cannot name them all and is refused at deployment by
 * name.
 */
export const CHILD_LOCK_CAPACITY = 26;

/** The 35-byte placeholder push a creator reserves for the child's `index`-th master lock. */
export function childLockSentinel(index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index >= CHILD_LOCK_CAPACITY) {
    throw new Error(`a child lock sentinel is 0..${CHILD_LOCK_CAPACITY - 1}: got ${index}`);
  }
  const bytes = new Uint8Array(35);
  bytes[0] = 0xaa;
  bytes[1] = 0x20;
  bytes[2] = 0xc1;
  bytes[3] = index;
  for (let at = 4; at < 34; at += 1) bytes[at] = (0x5a + index * 0x11 + at * 7) & 0xff;
  bytes[34] = 0x87;
  return bytes;
}

/** The lock an unused slot is filled with: a P2SH32 of the zero hash, which no output of the child's carries. */
export function childLockFiller(): Uint8Array {
  return Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32), 0x87]);
}

/**
 * The placeholder push a creator reserves for the number of outputs of the child's category its genesis mints.
 *
 * The count depends on the child's entry locks, pool and records, which a creating contract's compile unit does not
 * know; the deployment fills it beside the master locks.
 */
export const CHILD_OUTPUT_COUNT_SENTINEL = 0x2dc1;

/** The 3-byte push a creator reserves for the child's category-output count. */
export function childOutputCountSentinel(): Uint8Array {
  return Uint8Array.from([0x02, CHILD_OUTPUT_COUNT_SENTINEL & 0xff, CHILD_OUTPUT_COUNT_SENTINEL >> 8]);
}

/** Raised when a creator's artifact does not reserve a category-output count. */
export class ChildOutputCountError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ChildOutputCountError';
  }
}

/**
 * Fills the creator's reserved count with the number of outputs of the child's category its genesis mints.
 *
 * The check counts those outputs and requires exactly this number, so a creating transaction that adds one — a
 * record, a master or an event it should not have — is refused.
 */
export function patchChildOutputCount(script: Uint8Array, count: number): Uint8Array {
  if (!Number.isInteger(count) || count < 0 || count > 0xffff) {
    throw new ChildOutputCountError(`a child's category-output count is 0..65535: got ${count}`);
  }
  const sentinel = childOutputCountSentinel();
  const patched = Uint8Array.from(script);
  let found = -1;
  for (let at = 0; at + sentinel.length <= patched.length; at += 1) {
    if (sentinel.every((byte, offset) => patched[at + offset] === byte)) {
      if (found >= 0) {
        throw new ChildOutputCountError('the artifact reserves more than one category-output count');
      }
      found = at;
    }
  }
  if (found < 0) throw new ChildOutputCountError('the artifact reserves no category-output count');
  patched[found + 1] = count & 0xff;
  patched[found + 2] = (count >> 8) & 0xff;
  return patched;
}
