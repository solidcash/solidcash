/**
 * Transcript codec.
 *
 * One validator input per owning contract carries the transcript. It holds structure only — which masters it
 * covers, which of them users entered, and what it settles — so no fact exists in two places: the facts live in
 * each master's own witness block, which that master proves about itself.
 *
 * Wire layout (little-endian):
 *
 *     "PC7" 01
 *     rootCount:u8 root:u8[]
 *     masterCount:u8 master:u8[]
 *     settleCount:u8 { category:32 stateInputCount:u8 stateInput:u8[] }
 *
 * The transcript does not list segments: the order is derived from the call tree, so a builder cannot choose an
 * order the execution semantics could not produce.
 */

import {
  ByteReader,
  ByteWriter,
  PerCallEncodingError,
  bytesEqual,
  bytesToHex,
  concatBytes,
} from './primitives.js';

/** Magic and version of the transcript, frozen with the validator program. */
export const TRANSCRIPT_MAGIC = new Uint8Array([0x50, 0x43, 0x37]); // "PC7"
export const TRANSCRIPT_VERSION = 0x01;

/** Length of a state category. */
export const CATEGORY_LENGTH = 32;

/** A contract the transcript settles, and the state inputs it spends. */
export interface SettledContract {
  /** The contract's state category. */
  category: Uint8Array;
  /** Input indices of the contract's state UTXOs that this transaction spends. */
  stateInputs: number[];
}

/** The structure a validator authenticates before it checks any fact. */
export interface Transcript {
  /** Covered masters that a user entered, in execution order. */
  roots: number[];
  /** Every covered master. Equal to the set of inputs pointing at this validator. */
  masters: number[];
  /** Contracts this validator settles, with the state inputs each one spends. */
  settles: SettledContract[];
}

/**
 * Encodes a transcript.
 *
 * A settled contract's state-input list is the set of that contract's state UTXOs the transaction spends, so a
 * contract the transaction settles while spending none of its state — one with several covered masters and no
 * records of its own — is encoded with an empty list rather than refused. The list is what V7 compares the
 * transaction against, and an empty list says exactly that.
 */
export function encodeTranscript(transcript: Transcript): Uint8Array {
  for (const [index, settled] of transcript.settles.entries()) {
    if (settled.category.length !== CATEGORY_LENGTH) {
      throw new PerCallEncodingError(
        `settled contract ${index} has a ${settled.category.length}-byte category, expected ${CATEGORY_LENGTH}`,
      );
    }
  }
  if (transcript.roots.length > 0xff) throw new PerCallEncodingError('too many roots');
  if (transcript.masters.length > 0xff) throw new PerCallEncodingError('too many masters');
  if (transcript.settles.length > 0xff) throw new PerCallEncodingError('too many settled contracts');

  const writer = new ByteWriter()
    .pushBytes(TRANSCRIPT_MAGIC)
    .pushByte(TRANSCRIPT_VERSION)
    .pushByte(transcript.roots.length);
  for (const root of transcript.roots) writer.pushByte(root);
  writer.pushByte(transcript.masters.length);
  for (const master of transcript.masters) writer.pushByte(master);
  writer.pushByte(transcript.settles.length);
  for (const settled of transcript.settles) {
    writer.pushBytes(settled.category).pushByte(settled.stateInputs.length);
    for (const input of settled.stateInputs) writer.pushByte(input);
  }
  return writer.finish();
}

/** Decodes a transcript, rejecting a bad magic, an unknown version, a truncated field, a bad category length and
 * any trailing byte. */
export function decodeTranscript(payload: Uint8Array): Transcript {
  const reader = new ByteReader(payload);
  const magic = reader.readBytes(3);
  if (!bytesEqual(magic, TRANSCRIPT_MAGIC)) {
    throw new PerCallEncodingError(`not a transcript: magic ${bytesToHex(magic)}`);
  }
  const version = reader.readByte();
  if (version !== TRANSCRIPT_VERSION) {
    throw new PerCallEncodingError(`unsupported transcript version: ${version}`);
  }

  const rootCount = reader.readByte();
  const roots: number[] = [];
  for (let index = 0; index < rootCount; index += 1) roots.push(reader.readByte());

  const masterCount = reader.readByte();
  const masters: number[] = [];
  for (let index = 0; index < masterCount; index += 1) masters.push(reader.readByte());

  const settleCount = reader.readByte();
  const settles: SettledContract[] = [];
  for (let index = 0; index < settleCount; index += 1) {
    const category = reader.readBytes(CATEGORY_LENGTH);
    const stateInputCount = reader.readByte();
    const stateInputs: number[] = [];
    for (let inner = 0; inner < stateInputCount; inner += 1) stateInputs.push(reader.readByte());
    settles.push({ category, stateInputs });
  }
  reader.assertEnd();
  return { roots, masters, settles };
}

/** Encodes a transcript as the minimal push that introduces a validator's unlocking bytecode. */
export function encodeTranscriptPush(transcript: Transcript, minimalPush: (payload: Uint8Array) => Uint8Array): Uint8Array {
  return minimalPush(encodeTranscript(transcript));
}

/** Unlocking bytecode for a validator: the transcript push followed by the redeem script. */
export function buildValidatorUnlockingBytecode(
  transcript: Transcript,
  redeemScript: Uint8Array,
  minimalPush: (payload: Uint8Array) => Uint8Array,
): Uint8Array {
  return concatBytes([minimalPush(encodeTranscript(transcript)), minimalPush(redeemScript)]);
}
