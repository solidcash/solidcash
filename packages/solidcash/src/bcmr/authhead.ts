/**
 * The authhead contract (docs/bcmr/DESIGN.md, 4.2): the identity output of every category the SDK creates.
 *
 * A fixed P2SH32 script salted by its category C holds a mutable NFT of C whose commitment is the owner's locking
 * bytecode: the address names the category, the commitment names the owner, and neither lives in a contract's state.
 * A spend has exactly two inputs, the contract and a token-free coin at the owner's lock, and output 0 carries the
 * NFT, with no fungible tokens, to one of:
 *
 * - the contract again: an update, or a transfer when the owner writes a new commitment;
 * - P2SH32 of `OP_RETURN`: frozen, the spending transaction stays the authhead for good;
 * - `OP_RETURN`: burned, the identity ends and the NFT is destroyed.
 *
 * With no other token input, the spend can create no other NFT of C, so the covenant decides every move of the NFT.
 * A contract path that mints NFTs of C where its caller chooses can still put a look-alike at the contract's address
 * (docs/bcmr/DESIGN.md, 4.4), so the identity is the one whose authchain leads back to the genesis.
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { AUTHHEAD_BODY, hash256 } from '@solidcash/utils';
import type { Output, TokenDetails, Unlocker } from '../interfaces.js';
import { satoshisAtLeastDust } from '../framed/composer/dust.js';
import { BcmrError } from './publication.js';

const OP_RETURN = 0x6a;

/** The authhead body, shared with the compiler's check of a child's authhead (`@solidcash/utils`). */
export { AUTHHEAD_BODY };

/** The lock of a frozen identity: P2SH32 of `OP_RETURN`. Anyone holding the redeem script `6a` can check it. */
export const FROZEN_LOCKING_BYTECODE = encodeLockingBytecodeP2sh32(hash256(Uint8Array.of(OP_RETURN)));

/** The lock of a burned identity: a data carrier, which ends the authchain. */
export const BURNED_LOCKING_BYTECODE = Uint8Array.of(OP_RETURN);

/** Where an identity stands: active at its authhead contract, frozen, or burned. */
export type IdentityStatus = 'active' | 'frozen' | 'burned';

function assertCategory(category: string): void {
  if (!/^[0-9a-f]{64}$/.test(category)) throw new BcmrError(`a category is 64 lowercase hex characters, got "${category}"`);
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, i) => byte === right[i]);
}

/** The authhead redeem script of `category`. */
export function authheadRedeemScript(category: string): Uint8Array {
  assertCategory(category);
  // OP_OUTPUTTOKENCATEGORY answers in the VM's byte order, the reverse of a category's hex, then the capability.
  const mutableCategory = Uint8Array.from([...hexToBin(category).reverse(), 0x01]);
  const push = encodeDataPush(mutableCategory);
  const script = new Uint8Array(push.length + AUTHHEAD_BODY.length);
  script.set(push, 0);
  script.set(AUTHHEAD_BODY, push.length);
  return script;
}

/** The P2SH32 lock of the authhead contract of `category`, unique to it. */
export function authheadLockingBytecode(category: string): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(authheadRedeemScript(category)));
}

/** The status an identity output's lock gives it, or undefined for a lock that holds no identity of `category`. */
export function identityStatusOf(category: string, lockingBytecode: Uint8Array): IdentityStatus | undefined {
  if (equal(lockingBytecode, authheadLockingBytecode(category))) return 'active';
  if (equal(lockingBytecode, FROZEN_LOCKING_BYTECODE)) return 'frozen';
  if (equal(lockingBytecode, BURNED_LOCKING_BYTECODE)) return 'burned';
  return undefined;
}

/**
 * Why `owner` cannot own the identity of `category`, or undefined when it can. An owner is a lock some input can
 * spend: P2PKH, P2SH20 or P2SH32. The authhead contract itself and the frozen lock are refused, since neither leaves
 * the owner in control.
 */
export function ownerLockRefusal(category: string, owner: Uint8Array): string | undefined {
  const p2pkh = owner.length === 25 && owner[0] === 0x76 && owner[1] === 0xa9 && owner[2] === 0x14
    && owner[23] === 0x88 && owner[24] === 0xac;
  const p2sh20 = owner.length === 23 && owner[0] === 0xa9 && owner[1] === 0x14 && owner[22] === 0x87;
  const p2sh32 = owner.length === 35 && owner[0] === 0xaa && owner[1] === 0x20 && owner[34] === 0x87;
  if (!p2pkh && !p2sh20 && !p2sh32) {
    return `an identity owner is a P2PKH, P2SH20 or P2SH32 lock, got ${binToHex(owner) || 'an empty lock'}`;
  }
  if (equal(owner, authheadLockingBytecode(category))) return 'the authhead contract cannot own its own identity';
  if (equal(owner, FROZEN_LOCKING_BYTECODE)) return 'the frozen lock owns nothing: freeze the identity instead';
  return undefined;
}

function assertOwner(category: string, owner: Uint8Array): void {
  const refusal = ownerLockRefusal(category, owner);
  if (refusal !== undefined) throw new BcmrError(refusal);
}

/** The NFT the authhead contract of `category` holds for `owner`. */
export function authheadToken(category: string, owner: Uint8Array): TokenDetails {
  assertOwner(category, owner);
  return { category, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(owner) } };
}

/**
 * Output 0 of an identity of `category` owned by `owner`: the authhead contract while `status` is active, otherwise
 * the frozen or burned lock, each holding the NFT. `amount` is raised to the output's dust threshold.
 */
export function authheadOutput(
  category: string, owner: Uint8Array, status: IdentityStatus = 'active', amount = 0n,
): Output {
  const token = authheadToken(category, owner);
  if (status === 'burned') return { to: BURNED_LOCKING_BYTECODE, amount: 0n, token };
  const to = status === 'frozen' ? FROZEN_LOCKING_BYTECODE : authheadLockingBytecode(category);
  return { to, amount: satoshisAtLeastDust(amount, { to, token }), token };
}

/** Spends the authhead contract of `category`, beside the owner's coin as the transaction's other input. */
export function authheadUnlocker(category: string): Unlocker {
  const unlocking = encodeDataPush(authheadRedeemScript(category));
  return {
    generateLockingBytecode: () => authheadLockingBytecode(category),
    generateUnlockingBytecode: () => unlocking,
  };
}
