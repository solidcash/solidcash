/**
 * Recognizing identity outputs in transactions (CHIP-BCMR, "Zeroth-Descendant Transaction Chains").
 *
 * Output 0 of a transaction that creates a category, or that publishes a registry, is an identity output: whoever
 * spends it moves that identity's authority. Coin selection consults this so the SDK never spends one as an
 * ordinary coin, a rule that holds across sessions because it reads the coin's own transaction.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Transaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import { isPublicationBytecode } from './publication.js';

/** The categories `transaction` creates: the outpoint txid of each input spending an output 0 that an output carries. */
export function categoriesCreatedBy(transaction: Transaction): string[] {
  const carried = new Set(transaction.outputs.flatMap((output) => (
    output.token === undefined ? [] : [binToHex(output.token.category)])));
  return [...new Set(transaction.inputs
    .filter((input) => input.outpointIndex === 0)
    .map((input) => binToHex(input.outpointTransactionHash)))]
    .filter((category) => carried.has(category));
}

/** The locking bytecode of `transaction`'s publication: its first output with the publication prefix (R3). */
export function publicationOf(transaction: Transaction): Uint8Array | undefined {
  return transaction.outputs.find((output) => isPublicationBytecode(output.lockingBytecode))?.lockingBytecode;
}

/** True when `transaction` carries a publication output. */
export function publishesRegistry(transaction: Transaction): boolean {
  return publicationOf(transaction) !== undefined;
}

/**
 * Why output 0 of `transaction` must not be spent as an ordinary coin, or undefined when it may be: it is an identity
 * output when the transaction creates a category or publishes a registry, and only a metadata update spends one.
 */
export function identityOutputRefusal(transaction: Transaction, txid: string): string | undefined {
  const categories = categoriesCreatedBy(transaction);
  if (categories.length === 0 && !publishesRegistry(transaction)) return undefined;
  const holder = categories.length > 0 ? `category ${categories.join(', ')}` : 'the identity it publishes for';
  return `coin ${txid}:0 is the BCMR identity output of ${holder}; spending it would move that metadata authority, `
    + 'so only publishMetadata spends it';
}
