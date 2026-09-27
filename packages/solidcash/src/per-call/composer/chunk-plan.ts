/**
 * The chunk plan.
 *
 * A dynamic value is not held in the data NFT that declares it: the NFT carries the value's byte length and the
 * bytes live in a run of fixed-size chunk UTXOs, one per piece, locked by the value's own collection covenant. An
 * execution that writes such a value touches the header and the chunks, and the emitted body addresses the run as a
 * band that begins one layout width past the record block its own frame declares.
 *
 * This module derives, from the value the transaction spends and the value the execution writes, the header and the
 * chunk commitments of both, and lays the run out as the participants a block holds and the record entries a
 * segment declares. Every byte it produces comes from the shipped encoders (`buildPushdataCommitment`,
 * `buildChunkCommitment`, `splitValueIntoChunks`, `dynamicChunkSignature`, `computeCollectionHash`,
 * `buildEntryNftCovenantScript`); the layout facts — where the band sits, and which input authorizes the write — are
 * the caller's, and a run that cannot be laid out is refused by name.
 */

import { encodeDataPush, hexToBin, Opcodes } from '@bitauth/libauth';
import {
  buildChunkCommitment,
  buildEntryNftCovenantScript,
  buildPushdataCommitment,
  computeCollectionHash,
  dynamicChunkSignature,
  encodeInt,
  splitValueIntoChunks,
  type RecordEntry,
  type StateLayout,
  type StateVariableInfo,
} from '@solidcash/utils';
import { scriptToLockingBytecode } from '../../utils.js';
import type { DraftInput, DraftSourceOutput, DraftToken } from './draft.js';
import { chunkRunUnplannable } from './refusals.js';

/** A dynamic value as the records that hold it. */
export interface DynamicValueRecords {
  /** The data NFT's commitment: the value's byte length, from the shipped header encoder. */
  readonly header: Uint8Array;
  /** One commitment per chunk, in index order, from the shipped chunk encoder. */
  readonly chunks: readonly Uint8Array[];
}

/** The dynamic variable a plan describes, as the layout declares it. */
function requireDynamicVariable(layout: StateLayout | undefined, variable: string): StateVariableInfo {
  if (layout === undefined) throw chunkRunUnplannable(variable, 'the artifact publishes no state layout');
  const declared = layout.variables.find((candidate) => candidate.name === variable);
  if (declared === undefined) throw chunkRunUnplannable(variable, 'the state layout declares no such variable');
  if (declared.dynamic !== true) {
    throw chunkRunUnplannable(variable, `the variable is declared ${declared.type}, which is not held in chunks`);
  }
  return declared;
}

/** The header and chunk commitments a dynamic variable holds for a value of this byte length. */
export function dynamicValueRecords(
  layout: StateLayout | undefined,
  variable: string,
  value: Uint8Array,
): DynamicValueRecords {
  const declared = requireDynamicVariable(layout, variable);
  return {
    header: hexToBin(buildPushdataCommitment(layout!, { [variable]: value }, declared.nftIndex)),
    chunks: splitValueIntoChunks(value).map((piece, index) => hexToBin(buildChunkCommitment(index, piece))),
  };
}

/** One write to a dynamic value: the value the transaction spends and the one the execution writes. */
export interface ChunkRunPlan {
  readonly variable: string;
  /** The variable's declared type, which the collection's covenant identity is derived from. */
  readonly type: string;
  readonly spent: DynamicValueRecords;
  readonly written: DynamicValueRecords;
}

/**
 * Plans one write to a dynamic value.
 *
 * The run keeps its width: a value whose byte length crosses a chunk boundary would create or delete chunks, which
 * is a band the plan does not lay out yet, so it is refused rather than spelled as a run that cannot be written.
 */
export function planChunkRun(options: {
  readonly layout: StateLayout | undefined;
  readonly variable: string;
  readonly spent: Uint8Array;
  readonly written: Uint8Array;
}): ChunkRunPlan {
  const declared = requireDynamicVariable(options.layout, options.variable);
  const spent = dynamicValueRecords(options.layout, options.variable, options.spent);
  const written = dynamicValueRecords(options.layout, options.variable, options.written);
  if (spent.chunks.length !== written.chunks.length) {
    throw chunkRunUnplannable(
      options.variable,
      `the write changes the run's width, from ${spent.chunks.length} chunk(s) to ${written.chunks.length}, `
      + 'which no plan lays out yet',
    );
  }
  return { variable: options.variable, type: declared.type, spent, written };
}

/** One chunk of a run: the participant a block holds it as, and the record a segment declares. */
export interface ChunkRecordPlacement {
  /** The identity the layout and the plan's segments name it by. */
  readonly id: string;
  /** The index the chunk sits at, as an input and as the output that recreates it. */
  readonly index: number;
  readonly input: DraftInput;
  /** The record entry a segment declares for this chunk: kept in place, with both commitments. */
  readonly entry: RecordEntry;
}

/** A run laid out: the participants, and the record entries one segment declares for them. */
export interface ChunkRunLayout {
  readonly records: readonly ChunkRecordPlacement[];
  /** The entries of one segment that reads and writes the run, in index order. */
  readonly entries: readonly RecordEntry[];
}

/** The identity a run's chunk is named by, stable across a plan's segments and its block. */
export function chunkRecordId(variable: string, index: number): string {
  return `${variable}#${index}`;
}

/** A chunk's token: a mutable NFT of the contract's category carrying the commitment. */
function chunkToken(category: Uint8Array, commitment: Uint8Array): DraftToken {
  return { category, amount: 0n, nft: { capability: 'mutable', commitment } };
}

/**
 * Lays a run out at the index the layout gives its first chunk.
 *
 * The chunks are entry NFTs of the value's own collection, so the input and the output that recreates it share the
 * collection's covenant lock, and the input's unlocking bytecode names the master whose write authorizes the run.
 * The caller states the index the band starts at — one layout width past the frame's first declared record — because
 * that is where the emitted body reads the coordinate from.
 */
export function layOutChunkRun(options: {
  readonly plan: ChunkRunPlan;
  readonly category: Uint8Array;
  /** The index the run's first chunk sits at. */
  readonly base: number;
  /** The input index of the master whose write the chunks belong to, as the covenant checks it. */
  readonly writer: number;
  /** The satoshi value each chunk carries; a kept chunk's output keeps the input's value. */
  readonly valueSatoshis: bigint;
}): ChunkRunLayout {
  const { plan, category, base, writer, valueSatoshis } = options;
  if (!Number.isInteger(base) || base < 0) throw chunkRunUnplannable(plan.variable, `the band starts at ${base}`);
  const lock = scriptToLockingBytecode(
    buildEntryNftCovenantScript(category, computeCollectionHash(dynamicChunkSignature(plan.variable, plan.type))),
    'p2sh32',
  );
  // The covenant's own unlocking bytecode: the master the write belongs to, then the flag that takes the write path.
  const unlockingBytecode = new Uint8Array([...encodeDataPush(encodeInt(BigInt(writer))), Opcodes.OP_1]);

  const records = plan.spent.chunks.map((spent, offset): ChunkRecordPlacement => {
    const written = plan.written.chunks[offset] ?? new Uint8Array(0);
    const index = base + offset;
    const source: DraftSourceOutput = {
      lockingBytecode: lock, valueSatoshis, token: chunkToken(category, spent),
    };
    return {
      id: chunkRecordId(plan.variable, index),
      index,
      input: { source, output: { ...source, token: chunkToken(category, written) }, unlockingBytecode },
      entry: { in: index, out: index, viewIn: spent, viewOut: written },
    };
  });
  return { records, entries: records.map((record) => record.entry) };
}
