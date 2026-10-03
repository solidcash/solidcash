/**
 * The master prologue.
 *
 * A master is one UTXO per entry into a contract. Before an entry does any work, its script proves the two facts
 * that make the shape safe:
 *
 *   - it is spending a UTXO that carried the contract's own category with minting capability, so no plain BCH output
 *     addressed to a master lock can be consumed by anyone, and no other category can enter the contract;
 *   - the output at the input's own index recreates that UTXO unchanged in lock, category, capability and
 *     commitment, and is worth at least what the input was worth, so a master survives an entry and cannot be
 *     drained by it.
 *
 * The prologue consumes nothing and leaves nothing: it is a prefix, and the function body follows it.
 */

import { encodeDataPush, Opcodes } from '@bitauth/libauth';
import { categoryPin, chainCategory, TokenCapability } from '@solidcash/utils';

/** The capability a master's own token carries. */
export const MASTER_CAPABILITY = TokenCapability.MINTING;

/** The capability a contract's state carries. */
export const STATE_CAPABILITY = TokenCapability.MUTABLE;

const op = (...opcodes: number[]): Uint8Array => new Uint8Array(opcodes);

/**
 * Proves the spent UTXO carried this category with minting capability.
 *
 * `OP_UTXOTOKENCATEGORY` answers with the category followed by the capability, or with nothing at all when the
 * spent UTXO carried no token, so one comparison rejects both a foreign category and an unfunded plain output.
 */
export function categoryOwnershipCheck(category: Uint8Array, capability: number = MASTER_CAPABILITY): Uint8Array {
  return concatPinned(category, capability, Opcodes.OP_UTXOTOKENCATEGORY);
}

/** The same proof against the output side, used to require that the recreation carries the category too. */
export function categoryRecreationCheck(category: Uint8Array, capability: number = MASTER_CAPABILITY): Uint8Array {
  return concatPinned(category, capability, Opcodes.OP_OUTPUTTOKENCATEGORY);
}

function concatPinned(category: Uint8Array, capability: number, side: number): Uint8Array {
  // The category arrives in display order. The introspection opcodes answer in the chain's order.
  const pinned = categoryPin(chainCategory(category), capability);
  return new Uint8Array([
    pinned.length,
    ...pinned,
    Opcodes.OP_INPUTINDEX,
    side,
    Opcodes.OP_EQUALVERIFY,
  ]);
}

/**
 * Requires that the output at the input's own index recreates the spent UTXO: the same locking bytecode, the same
 * category and capability, an empty commitment, and at least the input's value.
 */
export function recreationInPlaceCheck(
  category: Uint8Array,
  capability: number = MASTER_CAPABILITY,
): Uint8Array {
  return concatScripts([
    // Same lock.
    op(Opcodes.OP_INPUTINDEX, Opcodes.OP_OUTPUTBYTECODE, Opcodes.OP_INPUTINDEX, Opcodes.OP_UTXOBYTECODE,
      Opcodes.OP_EQUALVERIFY),
    // Same category and capability.
    categoryRecreationCheck(category, capability),
    // Empty commitment: a spent master holds its token with nothing committed to it.
    op(Opcodes.OP_INPUTINDEX, Opcodes.OP_OUTPUTTOKENCOMMITMENT, Opcodes.OP_0, Opcodes.OP_EQUALVERIFY),
    // At least the input's value, so an entry cannot take value away from a master.
    op(Opcodes.OP_INPUTINDEX, Opcodes.OP_OUTPUTVALUE, Opcodes.OP_INPUTINDEX, Opcodes.OP_UTXOVALUE,
      Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY),
  ]);
}

/**
 * Proves the transaction is its category's genesis: input 0 spends `(category, 0)`, the category read off the
 * master's own token.
 *
 * A category is the txid of the vout-0 outpoint its genesis spends, so only the genesis spends it, and no transaction
 * that spends a live master can. A constructor arm opens with this: the deployment's genesis probe places that
 * outpoint at input 0, as the genesis transaction's own funding input is, and a replay on a live master is refused.
 * Both facts end in one `OP_VERIFY`, so a refusal is not an `OP_EQUALVERIFY` a learner would read as a record close.
 */
export function genesisSpendCheck(capability: number = MASTER_CAPABILITY): Uint8Array {
  return new Uint8Array([
    Opcodes.OP_0, Opcodes.OP_OUTPOINTTXHASH, ...encodeDataPush(Uint8Array.of(capability)), Opcodes.OP_CAT,
    Opcodes.OP_INPUTINDEX, Opcodes.OP_UTXOTOKENCATEGORY, Opcodes.OP_EQUAL,
    Opcodes.OP_0, Opcodes.OP_OUTPOINTINDEX, Opcodes.OP_NOT, Opcodes.OP_BOOLAND, Opcodes.OP_VERIFY,
  ]);
}

/** The whole prologue: ownership, then recreation in place. */
export function buildMasterPrologue(
  category: Uint8Array,
  capability: number = MASTER_CAPABILITY,
): Uint8Array {
  return concatScripts([
    categoryOwnershipCheck(category, capability),
    recreationInPlaceCheck(category, capability),
  ]);
}

/** The prologue followed by a function body. The body's result is the script's result. */
export function buildMasterScript(
  category: Uint8Array,
  body: Uint8Array,
  capability: number = MASTER_CAPABILITY,
): Uint8Array {
  return concatScripts([buildMasterPrologue(category, capability), body]);
}

function concatScripts(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
