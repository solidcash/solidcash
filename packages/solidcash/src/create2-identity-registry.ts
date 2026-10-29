/**
 * The 20-byte EVM identities CREATE2 children present as their address.
 *
 * A framed contract created with `new C{salt: s}()` presents `keccak256(0xff ++ creator ++ s ++ keccak256(code))[12:]`
 * as `address(this)`, and every contract that names it carries those 20 bytes: its creator stores them, a caller
 * computes them (`UniswapV2Library.pairFor`), and the child keys its own reads by them. An address argument that
 * names such a child is therefore those 20 bytes, not the P2PKH lock a 20-byte payload names for a user. The table is
 * kept under a process-wide symbol so two copies of this module agree.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';

const IDENTITIES = Symbol.for('@solidcash/create2-child-identities');

function identities(): Set<string> {
  const holder = globalThis as unknown as Record<symbol, Set<string> | undefined>;
  holder[IDENTITIES] ??= new Set();
  return holder[IDENTITIES]!;
}

/** Records that `identity` is the address a CREATE2 child presents. */
export function markCreate2ChildIdentity(identity: Uint8Array): void {
  identities().add(binToHex(identity));
}

/** True when `bytes` is the 20-byte address a CREATE2 child presents. */
export function isCreate2ChildIdentity(bytes: Uint8Array): boolean {
  return bytes.length === 20 && identities().has(binToHex(bytes));
}
