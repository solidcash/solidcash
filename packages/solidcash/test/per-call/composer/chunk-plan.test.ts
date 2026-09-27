import { describe, expect, it } from 'vitest';
import {
  DYNAMIC_LEN_TYPE,
  chunkCountForLength,
  computeCollectionHash,
  decodePushdataValue,
  dynamicChunkSignature,
  buildEntryNftCovenantScript,
  parseChunkCommitment,
  type StateLayout,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { scriptToLockingBytecode } from '../../../src/utils.js';
import { seededCategory } from '../../../../solidc/test/per-call/master/validator-input.js';
import {
  chunkRecordId,
  dynamicValueRecords,
  layOutChunkRun,
  planChunkRun,
} from '../../../src/per-call/composer/index.js';

/**
 * The chunk plan, read back through the shipped codecs it is built from.
 *
 * A dynamic value's records are the data NFT's length header and one chunk NFT per piece. Each commitment is asked
 * to decode back to what it was built for — the header through `decodePushdataValue`, a chunk through
 * `parseChunkCommitment` — so the plan is checked against the encoders rather than against a copy of their
 * arithmetic. The refusals below are the shapes the composer does not lay out yet.
 */

const CATEGORY = seededCategory('chunk plan');
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Named {'
  + '   string public name;'
  + '   function append() { this.name = string.concat(this.name, "!"); }'
  + ' }';

const artifacts = compileString(SOURCE, { composition: 'per-call' });
const layout: StateLayout = artifacts.stateLayout!;

const utf8 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));
const SPENT = utf8('hello');
const WRITTEN = utf8('hello!');

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
    expect(record.input.source.token).toStrictEqual({
      category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: plan.spent.chunks[0] },
    });
    expect(record.input.output?.token?.nft?.commitment).toStrictEqual(plan.written.chunks[0]);
    expect(record.input.source.lockingBytecode).toStrictEqual(lock);
    expect(record.input.output?.lockingBytecode).toStrictEqual(lock);
    // The covenant's own unlocking bytecode names the writing master, then the flag that takes the write path.
    expect(record.input.unlockingBytecode).toStrictEqual(new Uint8Array([0x00, 0x51]));
    expect(run.entries).toStrictEqual([record.entry]);
    expect(layOutChunkRun({ plan, category: CATEGORY, base: 7, writer: 3, valueSatoshis: 1_000n })
      .records[0]!.input.unlockingBytecode).toStrictEqual(new Uint8Array([0x53, 0x51]));
  });

  it('keeps two variables\' collections apart', () => {
    const two = compileString(
      'pragma solidcash ^0.13.0; contract Two {'
      + ' string public a; string public b;'
      + ' function grow() { this.a = string.concat(this.a, "x"); this.b = string.concat(this.b, "y"); } }',
      { composition: 'per-call' },
    );
    const twoLayout: StateLayout = two.stateLayout!;
    const lockOf = (variable: string): Uint8Array => {
      const plan = planChunkRun({ layout: twoLayout, variable, spent: SPENT, written: WRITTEN });
      return layOutChunkRun({ plan, category: CATEGORY, base: 2, writer: 0, valueSatoshis: 1_000n })
        .records[0]!.input.source.lockingBytecode;
    };
    expect(lockOf('a')).toStrictEqual(covenantLock('a'));
    expect(lockOf('b')).toStrictEqual(covenantLock('b'));
    expect(lockOf('a')).not.toStrictEqual(lockOf('b'));
  });

  it('refuses a variable that is not dynamic, and one the layout does not declare', () => {
    const plain = compileString(
      'pragma solidcash ^0.13.0; contract Plain { int public n; function bump() { this.n = this.n + 1; } }',
      { composition: 'per-call' },
    );
    expect(() => planChunkRun({ layout: plain.stateLayout, variable: 'n', spent: SPENT, written: WRITTEN }))
      .toThrowError(/PER_CALL_CHUNK_UNPLANNABLE: the dynamic value "n" cannot be planned: the variable is declared int/);
    expect(() => planChunkRun({ layout, variable: 'missing', spent: SPENT, written: WRITTEN }))
      .toThrowError(/the state layout declares no such variable/);
    expect(() => planChunkRun({ layout: undefined, variable: 'name', spent: SPENT, written: WRITTEN }))
      .toThrowError(/the artifact publishes no state layout/);
  });

  it('refuses a write that changes the run\'s width', () => {
    // 120 bytes fill one chunk and 121 need two, so the write would create a chunk the plan cannot lay out yet.
    const oneChunk = new Uint8Array(120).fill(0x61);
    const twoChunks = new Uint8Array(121).fill(0x61);
    expect(() => planChunkRun({ layout, variable: 'name', spent: oneChunk, written: twoChunks }))
      .toThrowError(/changes the run's width, from 1 chunk\(s\) to 2/);
    expect(() => planChunkRun({ layout, variable: 'name', spent: twoChunks, written: oneChunk }))
      .toThrowError(/from 2 chunk\(s\) to 1/);
    // A value that keeps its width is planned even when every piece differs.
    expect(planChunkRun({ layout, variable: 'name', spent: SPENT, written: WRITTEN }).written.chunks).toHaveLength(1);
  });

  it('refuses a band that is not an index the layout can give', () => {
    const plan = planChunkRun({ layout, variable: 'name', spent: SPENT, written: WRITTEN });
    expect(() => layOutChunkRun({ plan, category: CATEGORY, base: -1, writer: 0, valueSatoshis: 1_000n }))
      .toThrowError(/the band starts at -1/);
    expect(() => layOutChunkRun({ plan, category: CATEGORY, base: 1.5, writer: 0, valueSatoshis: 1_000n }))
      .toThrowError(/the band starts at 1.5/);
  });
});
