/**
 * The lock an `address` argument carries into a callee's call data when its caller holds the address as an identity.
 *
 * A Solidity ABI call result carries an address as its 20-byte identity, and a Solidity-compat body keeps a value it
 * reads back that way as the identity (DECISIONS D13): the HASH160 of a contract's own P2SH32 lock, or a key's
 * public key hash. Passed on as a call argument, the callee's call data carries the lock the identity names, which the
 * caller's call site binds to its identity (`callSiteCheckScript`), so the callee keys, pays and calls the address
 * by the same lock every other path holds it as: a contract's own address when one of the deployments has that
 * identity, the P2PKH lock of the hash otherwise, and address(0), the empty lock, for the zero identity.
 */

import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
;
;
;
import { bytesEqual } from '@solidcash/utils';
import { lockingBytecodeToSolidityAddressPayload } from '../../utils.js';

/** The lock a 20-byte identity names, given the addresses of the contracts the plan can reach. */
export function lockOfIdentity(identity: Uint8Array, contracts: Iterable<Uint8Array>): Uint8Array {
  if (identity.every((byte) => byte === 0)) return new Uint8Array(0);
  for (const address of contracts) {
    const projected = lockingBytecodeToSolidityAddressPayload(address);
    if (projected !== undefined && bytesEqual(projected, identity)) return address;
  }
  return encodeLockingBytecodeP2pkh(identity);
}
