/**
 * Transcript codec.
 *
 * One validator input per owning contract carries the transcript. It holds structure only — which masters it
 * covers, which of them users entered, and what it settles — so no fact exists in two places: the facts live in
 * each master's own witness block, which that master proves about itself.
 *
 * Wire layout (little-endian):
 *
 *     "PC7" 02
 *     rootCount:u8 root:u8[]
 *     masterCount:u8 master:u8[]
 *     settleCount:u8 { category:32 stateInputCount:u8 stateInput:u8[] createdCount:u8 created:u8[] }
 *
 * A settled contract names the state UTXOs the transaction spends and the records the transaction creates. A
 * created record has no input to name, so its commitment lives at a trailing output index, and the frames that
 * write it address it by that index; the list is what tells the validator that such an index is a created record
 * rather than an input. The transcript does not list segments: the order is derived from the call tree, so a
 * builder cannot choose an order the execution semantics could not produce.
 */

import {
  ByteReader,
  ByteWriter,
  FramedEncodingError,
  bytesEqual,
  bytesToHex,
  concatBytes,
} from './primitives.js';
import { decodeWitnessBlock, encodeWitnessBlock, type WitnessBlock } from './witness-block.js';

/** Magic and version of the transcript, frozen with the validator program. */
export const TRANSCRIPT_MAGIC = new Uint8Array([0x50, 0x43, 0x37]); // "PC7"
export const TRANSCRIPT_VERSION = 0x02;

/** Length of a state category. */
export const CATEGORY_LENGTH = 32;

/** A contract the transcript settles, and the state inputs it spends. */
export interface SettledContract {
  /** The contract's state category. */
  category: Uint8Array;
  /** Input indices of the contract's state UTXOs that this transaction spends. */
  stateInputs: number[];
  /**
   * Output indices of the records this transaction creates for the contract.
   *
   * A created record has no input, so the frames that write it name it by the trailing output it appears at. The
   * list is empty for a contract whose transaction creates no record.
   */
  createdOutputs?: readonly number[];
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
      throw new FramedEncodingError(
        `settled contract ${index} has a ${settled.category.length}-byte category, expected ${CATEGORY_LENGTH}`,
      );
    }
  }
  if (transcript.roots.length > 0xff) throw new FramedEncodingError('too many roots');
  if (transcript.masters.length > 0xff) throw new FramedEncodingError('too many masters');
  if (transcript.settles.length > 0xff) throw new FramedEncodingError('too many settled contracts');

  const writer = new ByteWriter()
    .pushBytes(TRANSCRIPT_MAGIC)
    .pushByte(TRANSCRIPT_VERSION)
    .pushByte(transcript.roots.length);
  for (const root of transcript.roots) writer.pushByte(root);
  writer.pushByte(transcript.masters.length);
  for (const master of transcript.masters) writer.pushByte(master);
  writer.pushByte(transcript.settles.length);
  for (const settled of transcript.settles) {
    const created = settled.createdOutputs ?? [];
    if (settled.stateInputs.length > 0xff) throw new FramedEncodingError('too many state inputs');
    if (created.length > 0xff) throw new FramedEncodingError('too many created records');
    writer.pushBytes(settled.category).pushByte(settled.stateInputs.length);
    for (const input of settled.stateInputs) writer.pushByte(input);
    writer.pushByte(created.length);
    for (const output of created) writer.pushByte(output);
  }
  return writer.finish();
}

/** Decodes a transcript, rejecting a bad magic, an unknown version, a truncated field, a bad category length and
 * any trailing byte. */
export function decodeTranscript(payload: Uint8Array): Transcript {
  const reader = new ByteReader(payload);
  const magic = reader.readBytes(3);
  if (!bytesEqual(magic, TRANSCRIPT_MAGIC)) {
    throw new FramedEncodingError(`not a transcript: magic ${bytesToHex(magic)}`);
  }
  const version = reader.readByte();
  if (version !== TRANSCRIPT_VERSION) {
    throw new FramedEncodingError(`unsupported transcript version: ${version}`);
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
    const createdCount = reader.readByte();
    const createdOutputs: number[] = [];
    for (let inner = 0; inner < createdCount; inner += 1) createdOutputs.push(reader.readByte());
    settles.push({ category, stateInputs, createdOutputs });
  }
  reader.assertEnd();
  return { roots, masters, settles };
}

/**
 * A covered master the transaction mints as an output, whose witness block the transcript carries inline.
 *
 * A master the transaction spends carries its witness block as the first push of its own unlocking bytecode; a
 * master the transaction creates has no unlocking bytecode, so the genesis-shape transcript embeds its block
 * instead. This is the wire representation SDKFRAMED-2 names: the proxy's root master is minted in the proxy
 * genesis, so its frame rides in the transcript rather than in a spent input.
 */
export interface MintedMaster {
  /** The output index of the minted master. */
  readonly output: number;
  /** The minted master's witness block, encoded and carried inline. */
  readonly block: WitnessBlock;
}

/** The transcript version that carries minted masters inline; later than {@link TRANSCRIPT_VERSION}. */
export const TRANSCRIPT_VERSION_MINTED = 0x03;

/** A transcript together with the minted masters it covers, as a genesis-shape validator reads it. */
export interface MintedTranscript {
  readonly roots: number[];
  readonly masters: number[];
  readonly mintedMasters: MintedMaster[];
  readonly settles: SettledContract[];
}

/**
 * Encodes the genesis-shape transcript: version {@link TRANSCRIPT_VERSION_MINTED}, with each minted master listed
 * between the masters and the settles as `{ output:u8 block:lp16 }[]`, its witness block carried inline.
 */
export function encodeMintedTranscript(transcript: MintedTranscript): Uint8Array {
  if (transcript.roots.length > 0xff) throw new FramedEncodingError('too many roots');
  if (transcript.masters.length > 0xff) throw new FramedEncodingError('too many masters');
  if (transcript.mintedMasters.length > 0xff) throw new FramedEncodingError('too many minted masters');
  if (transcript.settles.length > 0xff) throw new FramedEncodingError('too many settled contracts');

  const writer = new ByteWriter()
    .pushBytes(TRANSCRIPT_MAGIC)
    .pushByte(TRANSCRIPT_VERSION_MINTED)
    .pushByte(transcript.roots.length);
  for (const root of transcript.roots) writer.pushByte(root);
  writer.pushByte(transcript.masters.length);
  for (const master of transcript.masters) writer.pushByte(master);
  writer.pushByte(transcript.mintedMasters.length);
  for (const minted of transcript.mintedMasters) {
    if (minted.output > 0xff) throw new FramedEncodingError('minted master output index out of range');
    writer.pushByte(minted.output).pushLp16(encodeWitnessBlock(minted.block));
  }
  writer.pushByte(transcript.settles.length);
  for (const settled of transcript.settles) {
    if (settled.category.length !== CATEGORY_LENGTH) {
      throw new FramedEncodingError(
        `settled contract has a ${settled.category.length}-byte category, expected ${CATEGORY_LENGTH}`,
      );
    }
    const created = settled.createdOutputs ?? [];
    if (settled.stateInputs.length > 0xff) throw new FramedEncodingError('too many state inputs');
    if (created.length > 0xff) throw new FramedEncodingError('too many created records');
    writer.pushBytes(settled.category).pushByte(settled.stateInputs.length);
    for (const input of settled.stateInputs) writer.pushByte(input);
    writer.pushByte(created.length);
    for (const output of created) writer.pushByte(output);
  }
  return writer.finish();
}

/**
 * Decodes the genesis-shape transcript, rejecting a bad magic, a version other than
 * {@link TRANSCRIPT_VERSION_MINTED}, a malformed inline witness block, a truncated field, and any trailing byte.
 */
export function decodeMintedTranscript(payload: Uint8Array): MintedTranscript {
  const reader = new ByteReader(payload);
  const magic = reader.readBytes(3);
  if (!bytesEqual(magic, TRANSCRIPT_MAGIC)) {
    throw new FramedEncodingError(`not a transcript: magic ${bytesToHex(magic)}`);
  }
  const version = reader.readByte();
  if (version !== TRANSCRIPT_VERSION_MINTED) {
    throw new FramedEncodingError(`unsupported minted transcript version: ${version}`);
  }

  const rootCount = reader.readByte();
  const roots: number[] = [];
  for (let index = 0; index < rootCount; index += 1) roots.push(reader.readByte());

  const masterCount = reader.readByte();
  const masters: number[] = [];
  for (let index = 0; index < masterCount; index += 1) masters.push(reader.readByte());

  const mintedCount = reader.readByte();
  const mintedMasters: MintedMaster[] = [];
  for (let index = 0; index < mintedCount; index += 1) {
    const output = reader.readByte();
    mintedMasters.push({ output, block: decodeWitnessBlock(reader.readLp16()) });
  }

  const settleCount = reader.readByte();
  const settles: SettledContract[] = [];
  for (let index = 0; index < settleCount; index += 1) {
    const category = reader.readBytes(CATEGORY_LENGTH);
    const stateInputCount = reader.readByte();
    const stateInputs: number[] = [];
    for (let inner = 0; inner < stateInputCount; inner += 1) stateInputs.push(reader.readByte());
    const createdCount = reader.readByte();
    const createdOutputs: number[] = [];
    for (let inner = 0; inner < createdCount; inner += 1) createdOutputs.push(reader.readByte());
    settles.push({ category, stateInputs, createdOutputs });
  }
  reader.assertEnd();
  return { roots, masters, mintedMasters, settles };
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
