import { describe, expect, it } from 'vitest';
import { bytesToHex, encodeIntegerValue, encodePushdataValue } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  chunkRecordLockingBytecode,
  deployMaster,
  entryRecordLockingBytecode,
  readFramedDeployment,
  stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { dynamicValueRecords, planMappingBatch } from '../../../src/framed/composer/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { headSentinelCommitment } from '../../../src/stateful/SortedList.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * A paged mapping read whose key is an element of a chunk-backed state array, asked for an index past the array.
 *
 * The entry walks `values[items[start + i]]` over a chunk-backed array, so its elements live in a run of chunk
 * records beside the entry slot's own node — a layout only one turn fits, and a page of no turns still has to hold
 * the entry slot's record where the emitted body addresses the run. A range guard refuses a start past the array;
 * that guard is the entry's own, so its reason is what a caller should read rather than a refusal of the read.
 */

/** A 32-byte id whose bytes vary and whose reverse is a different value. */
function id32(lead: string): string {
  return `${lead.repeat(31)}c4`;
}

const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

/** The getter's shape: a loop whose key indexes the chunk-backed array at `start + i`. */
function source(guard: boolean): string {
  return 'pragma solidity ^0.8.0;'
    + ' contract Registry {'
    + '   address[] items;'
    + '   mapping(address => uint256) public values;'
    + '   function get(uint256 start, uint256 count) public view returns (uint256[] memory) {'
    + '     uint256 total = items.length;'
    + (guard ? '     require(start < total, "index out of bounds");' : '')
    + '     uint256 length = total - start;'
    + '     if (count == 0) { count = length; }'
    + '     length = length > count ? count : length;'
    + '     uint256[] memory out = new uint256[](length);'
    + '     for (uint256 i = 0; i < length; i = i + 1) { out[i] = values[items[start + i]]; }'
    + '     return out;'
    + '   }'
    + ' }';
}

/** The getter that refuses a start past the array, and the one that computes an empty page for it. */
const GUARDED = {
  artifact: compileStringMulti(source(true), { composition: 'framed', evmCompat: true }).Registry!,
  category: seededCategory('chunk array guard read'),
};
const PLAIN = {
  artifact: compileStringMulti(source(false), { composition: 'framed', evmCompat: true }).Registry!,
  category: seededCategory('chunk array plain read'),
};

/** The addresses the array holds; element `k` is the key of the mapping value `1000 + k`. */
const ITEMS = Array.from({ length: 3 }, (_unused, index) => new Uint8Array(20).fill(0x40 + index));

interface Fixture {
  readonly artifact: typeof GUARDED.artifact;
  readonly category: Uint8Array;
  readonly categoryHex: string;
}

/** The mapping's live nodes, keyed by the array's elements. */
function mappingNodes(items: readonly Uint8Array[]): ReturnType<typeof planMappingBatch> {
  return planMappingBatch({
    writes: items.map((key, index) => ({ keys: [key], value: encodeIntegerValue(1000n + BigInt(index)) })),
    inventory: [headSentinelCommitment()],
    encodeValue: (encoded: Uint8Array) => encoded,
  });
}

const empty = new Uint8Array(0);

/** One live UTXO of a category, in the shape the providers index. */
function utxo(categoryHex: string, txid: string, satoshis: bigint, capability: 'minting' | 'mutable', value: Uint8Array): {
  txid: string; vout: number; satoshis: bigint;
  token: { category: string; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: string } };
} {
  return { txid, vout: 0, satoshis,
    token: { category: categoryHex, amount: 0n, nft: { capability, commitment: bytesToHex(value) } } };
}

/** The provider a read runs against: the master, the array's record and chunk run, and the mapping's nodes. */
async function chain(fixture: Fixture, items: readonly Uint8Array[]): Promise<MockNetworkProvider> {
  const { artifact, category, categoryHex } = fixture;
  const collection = artifact.stateLayout!.collections!.find((candidate) => candidate.name === 'values')!;
  const entryLock = bytesToHex(entryRecordLockingBytecode(categoryHex, collection.signature));
  const provider = new MockNetworkProvider();
  const deployed = deployMaster(artifact, category, VALIDATOR_PROGRAM);
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
    utxo(categoryHex, id32('11'), 20_000n, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address),
    utxo(categoryHex, id32('22'), 20_000n, 'mutable', empty));

  const records = dynamicValueRecords(
    artifact.stateLayout!, 'items', encodePushdataValue([...items], 'address[]'));
  await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(categoryHex)),
    utxo(categoryHex, id32('23'), 1_500n, 'mutable', records.header));
  const chunkLock = bytesToHex(chunkRecordLockingBytecode(categoryHex, 'items', 'address[]'));
  for (const [index, chunk] of records.chunks.entries()) {
    const txid = id32((0x60 + index).toString(16).padStart(2, '0'));
    await provider.addUtxo(chunkLock, utxo(categoryHex, txid, 1_000n, 'mutable', chunk));
  }
  for (const [index, node] of mappingNodes(items).written.entries()) {
    const txid = id32((0x33 + index).toString(16).padStart(2, '0'));
    await provider.addUtxo(entryLock, utxo(categoryHex, txid, 1_500n, 'mutable', node.after));
  }
  return provider;
}

function read(
  fixture: Fixture, provider: MockNetworkProvider, start: bigint, count: bigint,
): ReturnType<typeof readFramedEntry> {
  return readFramedEntry({
    provider, artifact: fixture.artifact, categoryId: fixture.categoryHex, functionName: 'get',
    args: [start, count], vm: compositionMachine(),
  });
}

const GUARDED_FIXTURE: Fixture = { artifact: GUARDED.artifact, category: GUARDED.category,
  categoryHex: bytesToHex(GUARDED.category) };
const PLAIN_FIXTURE: Fixture = { artifact: PLAIN.artifact, category: PLAIN.category,
  categoryHex: bytesToHex(PLAIN.category) };

describe('a paged read over a chunk-backed array asked past its live end', () => {
  it('serves a one-turn page whose start is inside the array', async () => {
    const provider = await chain(GUARDED_FIXTURE, ITEMS);
    // The deployment's classification finds the array's record and its chunk run.
    const deployment = await readFramedDeployment(provider, GUARDED_FIXTURE.categoryHex, GUARDED.artifact.stateLayout!);
    expect(deployment.records).toHaveLength(1);

    const result = await read(GUARDED_FIXTURE, provider, 1n, 1n);
    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual([1001n]);
  });

  it('reports the entry\'s own guard for a start past the array rather than refusing the read', async () => {
    const provider = await chain(GUARDED_FIXTURE, ITEMS);
    // `start` names no element, so the entry's own `require` refuses before the loop walks the array. The read
    // hands that reason back rather than refusing the composition over the array's chunk run.
    const result = await read(GUARDED_FIXTURE, provider, 3n, 0n);
    expect(result.accepted).toBe(false);
    expect(result.objection).toContain('index out of bounds');
    expect(result.objection).toContain('Registry.get()');
  });

  it('reads an empty page for a start past the array, which the entry computes itself', async () => {
    // The control for the guarded page: with no guard in the body, the same start computes a zero-length page. The
    // record the frame declares for the entry slot is one the body never reads, so the answer stays the entry's own.
    const provider = await chain(PLAIN_FIXTURE, ITEMS);
    const result = await read(PLAIN_FIXTURE, provider, 3n, 0n);
    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual([]);
  });
});
