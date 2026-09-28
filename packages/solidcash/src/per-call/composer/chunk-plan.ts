/**
 * The chunk plan.
 *
 * A dynamic value is not held in the data NFT that declares it: the NFT carries the value's byte length and the
 * bytes live in a run of fixed-size chunk UTXOs, one per piece, locked by the value's own collection covenant. An
 * execution that writes such a value touches the header and the chunks, and the emitted body addresses the run as a
 * band that begins one layout width past the record block its own frame declares.
 *
 * This module derives, from the value the transaction spends and the value the execution writes, the header and the
 * chunk commitments of both, and lays the run out as the records a block holds — some kept in place, some created as
 * trailing outputs, some removed — and the record entries a segment declares. Every byte it produces comes from the
 * shipped encoders (`buildPushdataCommitment`, `buildChunkCommitment`, `splitValueIntoChunks`,
 * `dynamicChunkSignature`, `computeCollectionHash`, `buildEntryNftCovenantScript`); the layout facts — where the band
 * sits, and which input authorizes the write — are the caller's, and a run that cannot be laid out is refused by
 * name.
 */

import { encodeDataPush, hexToBin, Opcodes } from '@bitauth/libauth';
import {
  INDEX_NONE,
  buildChunkCommitment,
  buildEntryNftCovenantScript,
  buildPushdataCommitment,
  computeCollectionHash,
  dynamicChunkSignature,
  encodeInt,
  scriptToBytecode,
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
 * The plan states both sides of the write, however their widths compare: a value whose byte length crosses a chunk
 * boundary creates or removes chunks, and the layout places those records beside the ones the write keeps.
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
  return { variable: options.variable, type: declared.type, spent, written };
}

/**
 * How a write treats one chunk of a run.
 *
 * A write that changes the run's width keeps every chunk both sides hold, and either creates the chunks only the
 * written value holds or removes the ones only the spent value holds. The two tails are disjoint, so no chunk is
 * both created and removed.
 */
export type ChunkRecordRole = 'kept' | 'created' | 'removed';

/** One chunk of a run: the record a segment declares, and what the transaction does with it. */
export interface ChunkRecordPlacement {
  /** The identity the layout and the plan's segments name it by. */
  readonly id: string;
  /** The index the chunk sits at: the input that spends it and the output that writes it, where each exists. */
  readonly index: number;
  readonly role: ChunkRecordRole;
  /** The commitment the chunk carries before the write; empty for a created chunk. */
  readonly viewIn: Uint8Array;
  /** The commitment the chunk carries after the write; empty for a removed chunk. */
  readonly viewOut: Uint8Array;
  /**
   * The input that spends the chunk, for a kept or a removed chunk. A removed chunk's input carries the write
   * authorization but names no chunk output: the transaction spends it and writes no record at its index.
   */
  readonly input?: DraftInput;
  /** The output the transaction writes at the chunk's index, for a kept or a created chunk. */
  readonly output?: DraftSourceOutput;
  /** The record entry a segment declares for this chunk. */
  readonly entry: RecordEntry;
}

/** A run laid out: the records it touches, and the entries one segment declares for them. */
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
 * The chunks are entry NFTs of the value's own collection, so every input and every output share the collection's
 * covenant lock, and an input's unlocking bytecode names the master whose write authorizes the run. A chunk both
 * sides hold is kept in place: its input recreates it at its index. A chunk only the written value holds is created:
 * its output sits at the chunk's index with no input at all, so the caller places it in the trailing region. A chunk
 * only the spent value holds is removed: its input is spent with the write authorization and no record is written at
 * its index, so the caller places its input among the funders and leaves its output to the funder region.
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
  /**
   * The lock a removed chunk's satoshis are paid to. Required when the write removes chunks: the body pins the
   * chunk address on exactly the chunks the written value holds, so a removed chunk's satoshis cannot be re-locked
   * at the collection address without reading as one more chunk.
   */
  readonly removedLock?: Uint8Array;
}): ChunkRunLayout {
  const { plan, category, base, writer, valueSatoshis, removedLock } = options;
  if (!Number.isInteger(base) || base < 0) throw chunkRunUnplannable(plan.variable, `the band starts at ${base}`);
  if (plan.spent.chunks.length > plan.written.chunks.length && removedLock === undefined) {
    throw chunkRunUnplannable(
      plan.variable,
      `the write removes ${plan.spent.chunks.length - plan.written.chunks.length} chunk(s), so it needs the lock `
      + 'their satoshis are paid to',
    );
  }
  const covenant = buildEntryNftCovenantScript(
    category, computeCollectionHash(dynamicChunkSignature(plan.variable, plan.type)),
  );
  const lock = scriptToLockingBytecode(covenant, 'p2sh32');
  // The covenant's own unlocking bytecode: the master the write belongs to, then the flag that takes the write path,
  // and then the program itself, because a P2SH spend reads its program from the last push of its own unlocking.
  const unlockingBytecode = new Uint8Array([
    ...encodeDataPush(encodeInt(BigInt(writer))), Opcodes.OP_1, ...encodeDataPush(scriptToBytecode(covenant)),
  ]);
  const chunkSource = (commitment: Uint8Array): DraftSourceOutput =>
    ({ lockingBytecode: lock, valueSatoshis, token: chunkToken(category, commitment) });
  const keptCount = Math.min(plan.spent.chunks.length, plan.written.chunks.length);

  const records: ChunkRecordPlacement[] = [];
  // Chunks both sides hold are kept in place, at their own index.
  for (let offset = 0; offset < keptCount; offset += 1) {
    const index = base + offset;
    const viewIn = plan.spent.chunks[offset]!;
    const viewOut = plan.written.chunks[offset]!;
    const source = chunkSource(viewIn);
    const output = chunkSource(viewOut);
    records.push({
      id: chunkRecordId(plan.variable, index),
      index,
      role: 'kept',
      viewIn,
      viewOut,
      input: { source, output, unlockingBytecode },
      output,
      entry: { in: index, out: index, viewIn, viewOut },
    });
  }
  // Chunks only the written value holds are created: an output at the index and no input.
  for (let offset = keptCount; offset < plan.written.chunks.length; offset += 1) {
    const index = base + offset;
    const viewOut = plan.written.chunks[offset]!;
    const output = chunkSource(viewOut);
    records.push({
      id: chunkRecordId(plan.variable, index),
      index,
      role: 'created',
      viewIn: new Uint8Array(0),
      viewOut,
      output,
      entry: { in: INDEX_NONE, out: index, viewIn: new Uint8Array(0), viewOut },
    });
  }
  // Chunks only the spent value holds are removed: an input at the index and no record written back. The chunk's
  // satoshis are paid to the caller's lock, so the input recreates no record.
  for (let offset = keptCount; offset < plan.spent.chunks.length; offset += 1) {
    const index = base + offset;
    const viewIn = plan.spent.chunks[offset]!;
    records.push({
      id: chunkRecordId(plan.variable, index),
      index,
      role: 'removed',
      viewIn,
      viewOut: new Uint8Array(0),
      input: {
        source: chunkSource(viewIn),
        output: { lockingBytecode: removedLock!, valueSatoshis },
        unlockingBytecode,
      },
      entry: { in: index, out: INDEX_NONE, viewIn, viewOut: new Uint8Array(0) },
    });
  }
  return { records, entries: records.map((record) => record.entry) };
}
