/**
 * The master locks a creator's category check names for the child it mints (docs/framed/CREATE2_IDENTITY.md).
 *
 * A master's lock depends on the block oracle the deployment binds, so it exists only at deployment: the compiler
 * reserves a fixed number of placeholder pushes and the deployment replaces each with the child's entry lock.
 */

/** How many master locks a creator's check names. */
export const CHILD_LOCK_CAPACITY = 8;

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
