import { describe, expect, it } from 'vitest';
import { Opcodes, encodeDataPush } from '@bitauth/libauth';
import {
  DYNAMIC_LEN_TYPE,
  INDEX_NONE,
  chunkCountForLength,
  computeCollectionHash,
  decodePushdataValue,
  dynamicChunkSignature,
  buildEntryNftCovenantScript,
  encodeInt,
  parseChunkCommitment,
  scriptToBytecode,
  type StateLayout,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { scriptToLockingBytecode } from '../../../src/utils.js';
import { seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';
import {
  chunkRecordId,
  dynamicValueRecords,
  layOutChunkRun,
  planChunkRun,
} from '../../../src/framed/composer/index.js';

/**
 * The chunk plan, read back through the shipped codecs it is built from.
 *
 * A dynamic value's records are the data NFT's length header and one chunk NFT per piece. Each commitment is asked
 * to decode back to what it was built for — the header through `decodePushdataValue`, a chunk through
 * `parseChunkCommitment` — so the plan is checked against the encoders rather than against a copy of their
 * arithmetic. The refusals below are the shapes the composer does not lay out yet.
 */

const CATEGORY = seededCategory('chunk plan');
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Named {'
  + '   string public name;'
  + '   function append() { this.name = string.concat(this.name, "!"); }'
  + ' }';

const artifacts = compileString(SOURCE, { composition: 'framed' });
const layout: StateLayout = artifacts.stateLayout!;

const utf8 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));
const SPENT = utf8('hello');
const WRITTEN = utf8('hello!');
/** A plain lock a removed chunk's satoshis are paid to; the planner only stores it. */
const REMOVED_LOCK = new Uint8Array([0x51, 0x52, 0x53]);

/** The byte length a header commitment carries, decoded by the shipped field decoder. */
function headerLength(header: Uint8Array): number {
  return Number(decodePushdataValue(header, 0, DYNAMIC_LEN_TYPE).value as bigint);
}

/** A chunk commitment decoded by the shipped chunk decoder. */
function chunkParts(commitment: Uint8Array): { chunkIndex: number; chunkData: Uint8Array } {
  return parseChunkCommitment(Buffer.from(commitment).toString('hex'));
}

/**
 * The collection covenant's lock for a variable, from the shipped builders: the collection's signature hash, the
 * covenant script, and its P2SH32 locking bytecode.
 */
function covenantLock(variable: string, category: Uint8Array = CATEGORY): Uint8Array {
  const covenant = buildEntryNftCovenantScript(
    category, computeCollectionHash(dynamicChunkSignature(variable, 'string')),
  );
  return scriptToLockingBytecode(covenant, 'p2sh32');
}

/** The chunk covenant's own unlocking: the writing master, the write-path flag, then the program as the last push. */
function chunkUnlocking(variable: string, writer: number, category: Uint8Array = CATEGORY): Uint8Array {
  const covenant = buildEntryNftCovenantScript(
    category, computeCollectionHash(dynamicChunkSignature(variable, 'string')),
  );
  return new Uint8Array([
    ...encodeDataPush(encodeInt(BigInt(writer))), Opcodes.OP_1, ...encodeDataPush(scriptToBytecode(covenant)),
  ]);
}

describe('the chunk plan', () => {
  it('reads a dynamic value back as the header length and the pieces it was built from', () => {
    const records = dynamicValueRecords(layout, 'name', SPENT);
    expect(headerLength(records.header)).toBe(SPENT.length);
    expect(records.chunks.length).toBe(chunkCountForLength(SPENT.length));
    expect(records.chunks.map(chunkParts)).toStrictEqual([{ chunkIndex: 0, chunkData: SPENT }]);
    expect(headerLength(dynamicValueRecords(layout, 'name', WRITTEN).header)).toBe(WRITTEN.length);
  });

  it('splits a value that spans several chunks into one record per piece', () => {
    // 200 bytes need two chunks, and the second is the shorter piece rather than padding.
    const long = new Uint8Array(200).map((_, index) => index);
    const records = dynamicValueRecords(layout, 'name', long);
    expect(records.chunks.length).toBe(chunkCountForLength(200));
    expect(records.chunks.length).toBe(2);
    expect(records.chunks.map(chunkParts)).toStrictEqual([
      { chunkIndex: 0, chunkData: long.slice(0, 120) },
      { chunkIndex: 1, chunkData: long.slice(120) },
    ]);
  });

  it('lays a kept run out at the band, locked by the value\'s own collection covenant', () => {
    const plan = planChunkRun({ layout, variable: 'name', spent: SPENT, written: WRITTEN });
    const run = layOutChunkRun({ plan, category: CATEGORY, base: 7, writer: 0, valueSatoshis: 1_000n });
    const lock = covenantLock('name');

    expect(run.records).toHaveLength(1);
    const record = run.records[0]!;
    expect(record.id).toBe(chunkRecordId('name', 7));
    expect(record.index).toBe(7);
    expect(record.entry).toStrictEqual({
      in: 7, out: 7, viewIn: plan.spent.chunks[0], viewOut: plan.written.chunks[0],
    });
    expect(record.input!.source.token).toStrictEqual({
      category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: plan.spent.chunks[0] },
    });
    expect(record.input!.output?.token?.nft?.commitment).toStrictEqual(plan.written.chunks[0]);
    expect(record.input!.source.lockingBytecode).toStrictEqual(lock);
    expect(record.input!.output?.lockingBytecode).toStrictEqual(lock);
    // The covenant's own unlocking bytecode names the writing master, then the flag that takes the write path,
    // then the program the spend is evaluated against.
    expect(record.input!.unlockingBytecode).toStrictEqual(chunkUnlocking('name', 0));
    expect(run.entries).toStrictEqual([record.entry]);
    expect(layOutChunkRun({ plan, category: CATEGORY, base: 7, writer: 3, valueSatoshis: 1_000n })
      .records[0]!.input!.unlockingBytecode).toStrictEqual(chunkUnlocking('name', 3));
  });

  it('keeps two variables\' collections apart', () => {
    const two = compileString(
      'pragma solidcash ^0.14.0; contract Two {'
      + ' string public a; string public b;'
      + ' function grow() { this.a = string.concat(this.a, "x"); this.b = string.concat(this.b, "y"); } }',
      { composition: 'framed' },
    );
    const twoLayout: StateLayout = two.stateLayout!;
    const lockOf = (variable: string): Uint8Array => {
      const plan = planChunkRun({ layout: twoLayout, variable, spent: SPENT, written: WRITTEN });
      return layOutChunkRun({ plan, category: CATEGORY, base: 2, writer: 0, valueSatoshis: 1_000n })
        .records[0]!.input!.source.lockingBytecode;
    };
    expect(lockOf('a')).toStrictEqual(covenantLock('a'));
    expect(lockOf('b')).toStrictEqual(covenantLock('b'));
    expect(lockOf('a')).not.toStrictEqual(lockOf('b'));
  });

  it('refuses a variable that is not dynamic, and one the layout does not declare', () => {
    const plain = compileString(
      'pragma solidcash ^0.14.0; contract Plain { int public n; function bump() { this.n = this.n + 1; } }',
      { composition: 'framed' },
    );
    expect(() => planChunkRun({ layout: plain.stateLayout, variable: 'n', spent: SPENT, written: WRITTEN }))
      .toThrowError(/FRAMED_CHUNK_UNPLANNABLE: the dynamic value "n" cannot be planned: the variable is declared int/);
    expect(() => planChunkRun({ layout, variable: 'missing', spent: SPENT, written: WRITTEN }))
      .toThrowError(/the state layout declares no such variable/);
    expect(() => planChunkRun({ layout: undefined, variable: 'name', spent: SPENT, written: WRITTEN }))
      .toThrowError(/the artifact publishes no state layout/);
  });

  it('plans a write that keeps its width even when every piece differs', () => {
    expect(planChunkRun({ layout, variable: 'name', spent: SPENT, written: WRITTEN }).written.chunks).toHaveLength(1);
  });

  it('lays a growing run out: the chunks both sides hold kept, the rest created with no input', () => {
    // 120 bytes fill one chunk and 121 need two, so the write creates the second chunk.
    const oneChunk = new Uint8Array(120).fill(0x61);
    const twoChunks = new Uint8Array(121).fill(0x61);
    const plan = planChunkRun({ layout, variable: 'name', spent: oneChunk, written: twoChunks });
    const run = layOutChunkRun({ plan, category: CATEGORY, base: 5, writer: 0, valueSatoshis: 1_000n });

    expect(run.records.map((record) => record.role)).toStrictEqual(['kept', 'created']);
    const [kept, created] = run.records;
    expect(kept!.index).toBe(5);
    expect(kept!.input?.source.token).toStrictEqual({
      category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: plan.spent.chunks[0] },
    });
    expect(created!.index).toBe(6);
    expect(created!.input).toBeUndefined();
    expect(created!.output?.token).toStrictEqual({
      category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: plan.written.chunks[1] },
    });
    expect(run.entries).toStrictEqual([
      { in: 5, out: 5, viewIn: plan.spent.chunks[0], viewOut: plan.written.chunks[0] },
      { in: INDEX_NONE, out: 6, viewIn: new Uint8Array(0), viewOut: plan.written.chunks[1] },
    ]);
  });

  it('lays a shrinking run out: the chunks both sides hold kept, the rest removed with no output', () => {
    const oneChunk = new Uint8Array(120).fill(0x61);
    const twoChunks = new Uint8Array(121).fill(0x61);
    const plan = planChunkRun({ layout, variable: 'name', spent: twoChunks, written: oneChunk });
    const run = layOutChunkRun({
      plan, category: CATEGORY, base: 5, writer: 0, valueSatoshis: 1_000n, removedLock: REMOVED_LOCK,
    });

    expect(run.records.map((record) => record.role)).toStrictEqual(['kept', 'removed']);
    const removed = run.records[1]!;
    expect(removed.index).toBe(6);
    expect(removed.output).toBeUndefined();
    expect(removed.input?.source.token).toStrictEqual({
      category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: plan.spent.chunks[1] },
    });
    // The removed chunk's input carries the write authorization but no record is written at its index: its
    // satoshis are paid to the caller's plain lock.
    expect(removed.input?.unlockingBytecode).toStrictEqual(chunkUnlocking('name', 0));
    expect(removed.input?.output).toStrictEqual({ lockingBytecode: REMOVED_LOCK, valueSatoshis: 1_000n });
    expect(run.entries).toStrictEqual([
      { in: 5, out: 5, viewIn: plan.spent.chunks[0], viewOut: plan.written.chunks[0] },
      { in: 6, out: INDEX_NONE, viewIn: plan.spent.chunks[1], viewOut: new Uint8Array(0) },
    ]);
  });

  it('refuses a shrinking write that names no lock for the removed chunks\' satoshis', () => {
    const oneChunk = new Uint8Array(120).fill(0x61);
    const twoChunks = new Uint8Array(121).fill(0x61);
    const plan = planChunkRun({ layout, variable: 'name', spent: twoChunks, written: oneChunk });
    expect(() => layOutChunkRun({ plan, category: CATEGORY, base: 5, writer: 0, valueSatoshis: 1_000n }))
      .toThrowError(/the write removes 1 chunk\(s\), so it needs the lock their satoshis are paid to/);
  });

  it('refuses a band that is not an index the layout can give', () => {
    const plan = planChunkRun({ layout, variable: 'name', spent: SPENT, written: WRITTEN });
    expect(() => layOutChunkRun({ plan, category: CATEGORY, base: -1, writer: 0, valueSatoshis: 1_000n }))
      .toThrowError(/the band starts at -1/);
    expect(() => layOutChunkRun({ plan, category: CATEGORY, base: 1.5, writer: 0, valueSatoshis: 1_000n }))
      .toThrowError(/the band starts at 1.5/);
  });
});
