/**
 * Category pins and validator addresses.
 *
 * A stateful contract's script begins with a pin that proves which token category the spent UTXO belonged to, and
 * a contract's address is derived from its category and the validator program. Both are pure functions of the
 * category, so every party can compute them from the category alone.
 *
 *   pin(cat)    = <cat || capability>
 *   addrV(cat)  = P2SH32 lock over the redeem script `push(pin(cat)) || V_TEMPLATE`
 *
 * Because the validator program is part of every address, one program is shared by all contracts of a category and
 * a change to it moves every address. The program is therefore frozen once a real-chain deployment exists.
 */

import { Opcodes, encodeDataPush, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import { hash256, sha256 } from '../hash.js';
import { CATEGORY_LENGTH } from './transcript.js';
import { CONTRACT_LOCK_LENGTH, P2PKH_LOCK_LENGTH } from './canonical.js';
import { PerCallEncodingError, concatBytes } from './primitives.js';

/** A token capability: none, mutable, or minting. */
export const TokenCapability = { NONE: 0x00, MUTABLE: 0x01, MINTING: 0x02 } as const;

/** Length of a category pin that carries a capability byte. */
export const CATEGORY_PIN_LENGTH = CATEGORY_LENGTH + 1;

/**
 * The pinned category bytes an introspection comparison sees: the category followed by the capability.
 *
 * A UTXO whose token has no capability reports the category alone, so there is no capability byte to compare against
 * and the pin is the bare category. Comparing a trailing zero byte against a token that reports none never matches,
 * which is why the two forms are told apart here rather than at every call site.
 */
export function categoryPin(category: Uint8Array, capability: number): Uint8Array {
  if (category.length !== CATEGORY_LENGTH) {
    throw new PerCallEncodingError(`a category is ${CATEGORY_LENGTH} bytes: got ${category.length}`);
  }
  if (capability !== TokenCapability.NONE && capability !== TokenCapability.MUTABLE
    && capability !== TokenCapability.MINTING) {
    throw new PerCallEncodingError(`unknown token capability: ${capability}`);
  }
  if (capability === TokenCapability.NONE) return Uint8Array.from(category);
  return concatBytes([category, new Uint8Array([capability])]);
}

/** The length of a pin for a capability: the category alone, or the category and its capability byte. */
export function categoryPinLength(capability: number): number {
  return capability === TokenCapability.NONE ? CATEGORY_LENGTH : CATEGORY_PIN_LENGTH;
}

/**
 * The same category in the order the chain carries it.
 *
 * A category id crosses the compiler, the SDK and a deployment in the display order. What the machine's
 * `OP_UTXOTOKENCATEGORY` answers with is its reverse — libauth stores a token's category in display order and
 * pushes `token.category.slice().reverse()` (`bch-2023-tokens.js`) — and the state path applies the same reversal
 * before it builds a covenant (`packages/utils/src/state.ts`). Every pin compared with that answer is built from
 * this: a validator's redeem, a category-pin script, a master's prologue and the category slot deployment fills.
 */
export function chainCategory(category: Uint8Array): Uint8Array {
  return Uint8Array.from(category).reverse();
}

/**
 * The script prefix that proves the spent input carried this category with this capability: the pinned bytes, then
 * `OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_EQUALVERIFY`.
 */
export function categoryPinScript(category: Uint8Array, capability: number): Uint8Array {
  // The machine answers in chain order, so the bytes pushed here are the reverse of the display-order category.
  const pinned = categoryPin(chainCategory(category), capability);
  return concatBytes([
    new Uint8Array([pinned.length]),
    pinned,
    new Uint8Array([Opcodes.OP_INPUTINDEX, Opcodes.OP_UTXOTOKENCATEGORY, Opcodes.OP_EQUALVERIFY]),
  ]);
}

/** A category pin for an output, used where a rule compares the output side instead of the input side. */
export function categoryPinScriptOutput(category: Uint8Array, capability: number): Uint8Array {
  const pinned = categoryPin(chainCategory(category), capability);
  return concatBytes([
    new Uint8Array([pinned.length]),
    pinned,
    new Uint8Array([Opcodes.OP_INPUTINDEX, Opcodes.OP_OUTPUTTOKENCATEGORY, Opcodes.OP_EQUALVERIFY]),
  ]);
}

/** `H_V`: the hash of the validator program that a master carries as a constant and recognises through. */
export function validatorTemplateHash(validatorTemplate: Uint8Array): Uint8Array {
  return sha256(validatorTemplate);
}

/**
 * How many bytes the pin occupies in front of the program: its push prefix and the pinned category.
 *
 * The pin is data, not code: a validator's redeem script is the pin pushed and then the program. A bare category is
 * 32 arbitrary bytes, and executing them as opcodes would be a different script for every category, so the pin is
 * always pushed. The program reads its own bytes with `OP_ACTIVEBYTECODE` and skips exactly this many of them to
 * find itself, which is what lets one program derive every category's address.
 */
export const VALIDATOR_PIN_PUSH_LENGTH = 1 + CATEGORY_PIN_LENGTH;

/**
 * The redeem script of a validator: the pinned category, pushed, followed by the program.
 *
 * The pin is built in the chain's order, because the program compares it with the token the spent UTXO carries.
 */
export function validatorRedeemScript(category: Uint8Array, validatorTemplate: Uint8Array): Uint8Array {
  return concatBytes([
    encodeDataPush(categoryPin(chainCategory(category), TokenCapability.MUTABLE)), validatorTemplate,
  ]);
}

/**
 * A contract's address: the P2SH32 locking bytecode of the validator program for that category. Depends only on the
 * category, so it is known as soon as the category exists and is identical for every contract of that category.
 */
export function validatorAddress(category: Uint8Array, validatorTemplate: Uint8Array): Uint8Array {
  const lock = encodeLockingBytecodeP2sh32(hash256(validatorRedeemScript(category, validatorTemplate)));
  if (lock.length !== CONTRACT_LOCK_LENGTH) {
    throw new PerCallEncodingError(`a contract lock is ${CONTRACT_LOCK_LENGTH} bytes: got ${lock.length}`);
  }
  return lock;
}

/** True when a locking bytecode is a user address rather than a contract address. */
export function isUserAddress(lock: Uint8Array): boolean {
  return lock.length === P2PKH_LOCK_LENGTH;
}

/** True when a locking bytecode is the contract address derived from this category. */
export function isValidContractAddress(lock: Uint8Array, category: Uint8Array, validatorTemplate: Uint8Array): boolean {
  const expected = validatorAddress(category, validatorTemplate);
  if (lock.length !== expected.length) return false;
  for (let index = 0; index < lock.length; index += 1) {
    if (lock[index] !== expected[index]) return false;
  }
  return true;
}
