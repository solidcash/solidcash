import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  decodeTransactionBch,
  encodeTransactionOutput,
} from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type {
  Output as LibauthOutput,
  TransactionCommon as Transaction,
} from '@bitauth/libauth/build/lib/message/transaction-types.js';
import type { Unlocker } from './interfaces.js';
import type { WcSourceOutput, WcTransactionObject } from './walletconnect-utils.js';

/**
 * Signing by a wallet the SDK holds no key for, over the wallet protocol `bch_signTransaction`
 * (https://github.com/mainnet-pat/wc2-bch-bcr): a WalletConnect session, a browser extension, or a key a page holds
 * behind the same interface.
 *
 * The SDK builds and judges a transaction with a placeholder in each of the wallet's inputs, then hands the wallet the
 * transaction with those inputs left empty, as the protocol asks, and broadcasts what the wallet returns. The
 * placeholder is what the wallet's signature will be in size and in its sighash byte: a 65-byte Schnorr signature
 * with SIGHASH_ALL | SIGHASH_FORKID and a 33-byte public key. A framed root frame reads its caller's sighash byte
 * (the head's caller check), and the transaction's size sets its fee, so neither changes when the wallet signs.
 */

/** A wallet that signs its inputs of a transaction: the protocol's `bch_signTransaction`. */
export interface ExternalTransactionSigner {
  signTransaction(request: WcTransactionObject): Promise<{ readonly signedTransaction: string } | undefined>;
}

/** An unlocker for a wallet's P2PKH coin, signed by the wallet when the transaction is broadcast. */
export interface ExternallySignedUnlocker extends Unlocker {
  readonly externalSigner: ExternalTransactionSigner;
  /** Shown by the wallet beside the transaction, as the protocol's `userPrompt`. */
  readonly userPrompt?: string;
}

/** SIGHASH_ALL | SIGHASH_FORKID: the type a wallet signs a P2PKH input with, and a framed root caller must carry. */
const SIGHASH_ALL_FORKID = 0x41;
const SCHNORR_SIGNATURE_BYTES = 64;
const COMPRESSED_PUBLIC_KEY_BYTES = 33;

/**
 * The unlocking bytecode a wallet's P2PKH signature replaces: `<65-byte signature> <33-byte public key>`, zeros but
 * for the signature's sighash byte and, when the wallet's key is known, the key itself.
 */
export function externalSignaturePlaceholder(publicKey?: Uint8Array): Uint8Array {
  const key = publicKey !== undefined && publicKey.length === COMPRESSED_PUBLIC_KEY_BYTES
    ? publicKey
    : Uint8Array.of(0x02, ...new Uint8Array(COMPRESSED_PUBLIC_KEY_BYTES - 1));
  const signature = new Uint8Array(SCHNORR_SIGNATURE_BYTES + 1);
  signature[SCHNORR_SIGNATURE_BYTES] = SIGHASH_ALL_FORKID;
  return Uint8Array.of(signature.length, ...signature, key.length, ...key);
}

/** An unlocker for a coin at `lockingBytecode` that `signer` signs at broadcast. */
export function externallySignedUnlocker(options: {
  readonly lockingBytecode: Uint8Array;
  readonly signer: ExternalTransactionSigner;
  readonly publicKey?: Uint8Array;
  readonly userPrompt?: string;
}): ExternallySignedUnlocker {
  const placeholder = externalSignaturePlaceholder(options.publicKey);
  return {
    generateLockingBytecode: () => options.lockingBytecode,
    generateUnlockingBytecode: () => placeholder,
    externalSigner: options.signer,
    ...(options.userPrompt === undefined ? {} : { userPrompt: options.userPrompt }),
  };
}

export function isExternallySignedUnlocker(unlocker: Unlocker | undefined): unlocker is ExternallySignedUnlocker {
  return unlocker !== undefined && 'externalSigner' in unlocker
    && typeof (unlocker as ExternallySignedUnlocker).externalSigner?.signTransaction === 'function';
}

export class ExternalSigningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalSigningError';
  }
}

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index]);

/**
 * `transaction` with each externally signed input signed by its wallet, or `transaction` itself when no input is.
 *
 * `unlockers[i]` and `sourceOutputs[i]` describe input `i`. Each wallet receives the transaction with every input's
 * unlocking bytecode empty: its own inputs for it to sign, as `bch_signTransaction` expects, and every other input
 * because no signature covers another input's unlocking bytecode. A BCH signature commits to the outpoints, sequence
 * numbers, outputs and (SIGHASH_UTXOS) every source output, and a wc2 wallet signs only the empty inputs at its own
 * lock. Covenant unlocking bytecode is most of a framed transaction, which reaches 107 kB, while the WalletConnect
 * relay refuses a wallet's answer over 106,496 bytes of encrypted, base64 envelope, about 39 kB of signed transaction.
 * The other inputs get their unlocking bytecode back here.
 *
 * What a wallet returns must be the transaction it received with only its own inputs filled in: a wallet that changes
 * an output, an outpoint, a sequence number, the locktime, fills another input, or leaves one of its inputs empty is
 * refused, so a broadcast never carries anything the SDK did not judge.
 */
export async function applyExternalSignatures(
  unlockers: readonly (Unlocker | undefined)[],
  transaction: Transaction,
  sourceOutputs: readonly LibauthOutput[],
): Promise<Transaction> {
  const bySigner = new Map<ExternalTransactionSigner, { indices: number[]; prompts: string[] }>();
  unlockers.forEach((unlocker, index) => {
    if (!isExternallySignedUnlocker(unlocker)) return;
    const entry = bySigner.get(unlocker.externalSigner) ?? { indices: [], prompts: [] };
    entry.indices.push(index);
    if (unlocker.userPrompt !== undefined && !entry.prompts.includes(unlocker.userPrompt)) {
      entry.prompts.push(unlocker.userPrompt);
    }
    bySigner.set(unlocker.externalSigner, entry);
  });
  if (bySigner.size === 0) return transaction;
  if (sourceOutputs.length !== transaction.inputs.length) {
    throw new ExternalSigningError(
      `the transaction has ${transaction.inputs.length} inputs but ${sourceOutputs.length} source outputs`,
    );
  }

  let signed: Transaction = transaction;
  for (const [signer, { indices, prompts }] of bySigner) {
    const own = new Set(indices);
    const sent: Transaction = {
      ...signed,
      inputs: signed.inputs.map((input) => ({ ...input, unlockingBytecode: Uint8Array.of() })),
    };
    const wcSourceOutputs: WcSourceOutput[] = sent.inputs.map((input, index) => ({
      ...input, ...sourceOutputs[index]!,
    }));
    const response = await signer.signTransaction({
      transaction: sent,
      sourceOutputs: wcSourceOutputs,
      broadcast: false,
      ...(prompts.length === 0 ? {} : { userPrompt: prompts.join('\n') }),
    });
    if (response === undefined || typeof response.signedTransaction !== 'string') {
      throw new ExternalSigningError('the wallet did not sign the transaction');
    }
    const decoded = decodeTransactionBch(hexToBin(response.signedTransaction));
    if (typeof decoded === 'string') {
      throw new ExternalSigningError(`the wallet returned a transaction that does not decode: ${decoded}`);
    }
    signed = mergeWalletSignatures(signed, sent, decoded, own);
  }
  return signed;
}

/**
 * `full` with the unlocking bytecode `returned` gives the wallet's own inputs, once `returned` is `request`, what the
 * wallet received, with only those inputs filled in. Every other input keeps the unlocking bytecode `full` gives it.
 */
function mergeWalletSignatures(
  full: Transaction, request: Transaction, returned: Transaction, own: ReadonlySet<number>,
): Transaction {
  const refuse = (what: string): never => {
    throw new ExternalSigningError(`the wallet's signed transaction changed ${what}`);
  };
  if (returned.version !== request.version) refuse('the version');
  if (returned.locktime !== request.locktime) refuse('the locktime');
  if (returned.inputs.length !== request.inputs.length) refuse('the number of inputs');
  if (returned.outputs.length !== request.outputs.length) refuse('the number of outputs');
  request.outputs.forEach((output, index) => {
    if (!sameBytes(encodeTransactionOutput(output), encodeTransactionOutput(returned.outputs[index]!))) {
      refuse(`output ${index}`);
    }
  });
  const inputs = full.inputs.map((input, index) => {
    const answer = returned.inputs[index]!;
    const asked = request.inputs[index]!;
    if (answer.outpointIndex !== asked.outpointIndex
      || !sameBytes(answer.outpointTransactionHash, asked.outpointTransactionHash)) {
      refuse(`the outpoint of input ${index}`);
    }
    if (answer.sequenceNumber !== asked.sequenceNumber) refuse(`the sequence number of input ${index}`);
    if (own.has(index)) {
      if (answer.unlockingBytecode.length === 0) {
        throw new ExternalSigningError(`the wallet left its input ${index} unsigned`);
      }
      return { ...input, unlockingBytecode: answer.unlockingBytecode };
    }
    if (!sameBytes(answer.unlockingBytecode, asked.unlockingBytecode)) {
      refuse(`the unlocking bytecode of input ${index}, which is not the wallet's`);
    }
    return input;
  });
  return { ...full, inputs };
}
