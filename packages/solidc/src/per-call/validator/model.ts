/**
 * The transaction shape the composition validator reasons over.
 *
 * The derivation is pure: it is given a parsed description of a transaction's inputs and outputs and the validator
 * program's own bytes, and decides checks V1-V11 without a VM, a network or a filesystem. Token facts are stated
 * explicitly (`hasNft`) because CashTokens distinguishes an empty-commitment NFT from a fungible-only token, and
 * identity never depends on a commitment.
 */

import { CATEGORY_LENGTH, P2PKH_LOCK_LENGTH, TokenCapability, bytesEqual, bytesToHex } from '@solidcash/utils';

/** The token facts of one input or output. `category` is empty when the UTXO holds no token. */
export interface TokenShape {
  readonly category: Uint8Array;
  /** `TokenCapability.NONE`, `MUTABLE` or `MINTING`. */
  readonly capability: number;
  /** Whether an NFT is present at all; a fungible-only token has `hasNft === false`. */
  readonly hasNft: boolean;
  readonly nftCommitment: Uint8Array;
  readonly amount: bigint;
}

/** A UTXO a transaction can spend. */
export interface InputView {
  readonly index: number;
  readonly value: bigint;
  readonly lockingBytecode: Uint8Array;
  readonly unlockingBytecode: Uint8Array;
  readonly token: TokenShape;
  readonly outpointTransactionHash: Uint8Array;
  readonly outpointIndex: number;
}

/** A UTXO a transaction can create. */
export interface OutputView {
  readonly index: number;
  readonly value: bigint;
  readonly lockingBytecode: Uint8Array;
  readonly token: TokenShape;
}

/** The transaction description the validator decides over. */
export interface PerCallTransaction {
  readonly inputs: readonly InputView[];
  readonly outputs: readonly OutputView[];
}

/** What the derivation is told about the validator program that is running. */
export interface ValidatorContext {
  /** `V_TEMPLATE`, the fixed program every validator runs. */
  readonly validatorTemplate: Uint8Array;
  /** The index of the input the validator program runs on (`OP_INPUTINDEX`). */
  readonly validatorInputIndex: number;
}

const EMPTY_BYTES = new Uint8Array(0);

/** The token facts of a UTXO that holds no token. */
export function noToken(): TokenShape {
  return { category: EMPTY_BYTES, capability: TokenCapability.NONE, hasNft: false, nftCommitment: EMPTY_BYTES, amount: 0n };
}

/** A token with a category: a fungible token, an NFT, or both. */
export function tokenShape(
  category: Uint8Array,
  capability: number,
  hasNft: boolean,
  nftCommitment: Uint8Array = EMPTY_BYTES,
  amount: bigint = 0n,
): TokenShape {
  return { category, capability, hasNft, nftCommitment, amount };
}

/** A UTXO carries a category, so it holds some token of it. */
export function hasCategory(token: TokenShape): boolean {
  return token.category.length === CATEGORY_LENGTH;
}

/**
 * A master is identified by its category with minting capability, and by nothing else: never by its locking
 * bytecode and never by its commitment (spec R8). The loader form of section 12 keeps working because of this.
 */
export function isMasterToken(token: TokenShape): boolean {
  return hasCategory(token) && token.capability === TokenCapability.MINTING;
}

/** A mutable NFT: the shape a state UTXO, a record, a container and a validator all take. */
export function isMutableNft(token: TokenShape): boolean {
  return hasCategory(token) && token.hasNft && token.capability === TokenCapability.MUTABLE;
}

/** An immutable NFT: the shape an event output takes. */
export function isImmutableNft(token: TokenShape): boolean {
  return hasCategory(token) && token.hasNft && token.capability === TokenCapability.NONE;
}

/** A minting NFT: the shape a master's token has (spec R2). */
export function isMintingNft(token: TokenShape): boolean {
  return hasCategory(token) && token.hasNft && token.capability === TokenCapability.MINTING;
}

/** A user address: a 25-byte P2PKH locking bytecode. */
export function isP2pkhLock(lockingBytecode: Uint8Array): boolean {
  return lockingBytecode.length === P2PKH_LOCK_LENGTH
    && lockingBytecode[0] === 0x76
    && lockingBytecode[1] === 0xa9
    && lockingBytecode[2] === 0x14
    && lockingBytecode[23] === 0x88
    && lockingBytecode[24] === 0xac;
}

/** A stable map key for a category. */
export function categoryKey(category: Uint8Array): string {
  return bytesToHex(category);
}

/** The same category, compared byte for byte. */
export function sameCategory(left: Uint8Array, right: Uint8Array): boolean {
  return bytesEqual(left, right);
}

/** Whether an input index names a real input. */
export function inputAt(transaction: PerCallTransaction, index: number): InputView | undefined {
  return index >= 0 && index < transaction.inputs.length ? transaction.inputs[index] : undefined;
}

/** Whether an output index names a real output. */
export function outputAt(transaction: PerCallTransaction, index: number): OutputView | undefined {
  return index >= 0 && index < transaction.outputs.length ? transaction.outputs[index] : undefined;
}
