/**
 * The transaction shape the reference model reads.
 *
 * This is a second, independent statement of the same input facts: the derivation in the compiler package and this
 * model are compared case by case, so neither may import the other. The two shapes are structurally identical, which
 * is what lets one transaction description be handed to both.
 */

import { CATEGORY_LENGTH, P2PKH_LOCK_LENGTH, TokenCapability, bytesEqual } from '@solidcash/utils';

/** The token facts of one input or output. `category` is empty when the UTXO holds no token. */
export interface ReferenceToken {
  readonly category: Uint8Array;
  readonly capability: number;
  readonly hasNft: boolean;
  readonly nftCommitment: Uint8Array;
  readonly amount: bigint;
}

/** A UTXO being spent. */
export interface ReferenceInput {
  readonly index: number;
  readonly value: bigint;
  readonly lockingBytecode: Uint8Array;
  readonly unlockingBytecode: Uint8Array;
  readonly token: ReferenceToken;
  readonly outpointTransactionHash: Uint8Array;
  readonly outpointIndex: number;
}

/** A UTXO being created. */
export interface ReferenceOutput {
  readonly index: number;
  readonly value: bigint;
  readonly lockingBytecode: Uint8Array;
  readonly token: ReferenceToken;
}

/** One transaction, as the reference model sees it. */
export interface ReferenceTransaction {
  readonly inputs: readonly ReferenceInput[];
  readonly outputs: readonly ReferenceOutput[];
}

/** The validator program the reference model is deciding for. */
export interface ReferenceContext {
  readonly validatorTemplate: Uint8Array;
  readonly validatorInputIndex: number;
}

/** A category identifies a contract; hex is a usable map key. */
export function keyOf(category: Uint8Array): string {
  let out = '';
  for (const byte of category) out += byte.toString(16).padStart(2, '0');
  return out;
}

/** Any token at all. */
export function carriesToken(token: ReferenceToken): boolean {
  return token.category.length === CATEGORY_LENGTH;
}

/** A master is a category with minting capability, and nothing else (spec R8). */
export function masterToken(token: ReferenceToken): boolean {
  return carriesToken(token) && token.capability === TokenCapability.MINTING;
}

export function mutableToken(token: ReferenceToken): boolean {
  return carriesToken(token) && token.hasNft && token.capability === TokenCapability.MUTABLE;
}

export function immutableToken(token: ReferenceToken): boolean {
  return carriesToken(token) && token.hasNft && token.capability === TokenCapability.NONE;
}

/** A user's address, as W1 sees one. */
export function userLock(lockingBytecode: Uint8Array): boolean {
  if (lockingBytecode.length !== P2PKH_LOCK_LENGTH) return false;
  const head = lockingBytecode[0] === 0x76 && lockingBytecode[1] === 0xa9 && lockingBytecode[2] === 0x14;
  const tail = lockingBytecode[23] === 0x88 && lockingBytecode[24] === 0xac;
  return head && tail;
}

export function eq(left: Uint8Array, right: Uint8Array): boolean {
  return bytesEqual(left, right);
}

export function inputByIndex(transaction: ReferenceTransaction, index: number): ReferenceInput | undefined {
  return index < 0 || index >= transaction.inputs.length ? undefined : transaction.inputs[index];
}

export function outputByIndex(transaction: ReferenceTransaction, index: number): ReferenceOutput | undefined {
  return index < 0 || index >= transaction.outputs.length ? undefined : transaction.outputs[index];
}
