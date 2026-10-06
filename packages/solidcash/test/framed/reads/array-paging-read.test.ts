import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, encodeIntegerValue, encodePushdataValue } from '@solidcash/utils';
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
import { dynamicValueRecords, participant, planMappingBatch } from '../../../src/framed/composer/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * Reading a page whose key is an element of a dynamic state array.
 *
 * The contract keeps one `address[]` array and one `mapping(address => uint256)`, and reads the mapping at a key
 * its own arguments and a loop counter name: `values[items[start + i]]` for `i` up to the caller's count, bounded
 * by the array's remaining length. The published key is `map:items(binop:+(id:start,id:i))`, a collection label
 * over the computed index `start + i`. The read enumerates the turns the array's live length fixes, resolves each
 * turn's element from the record (or the chunk run) the frame spends, and locates the mapping node that element
 * names.
 *
 * A chunk-backed array's bytes sit in a run of chunk records one layout width past the record block — the
 * coordinate the entry slot's own node occupies. The array's first turn must sit between the record and the run, so
 * exactly one turn can be composed over a chunk-backed array; a page of none or several is refused rather than
 * composed into a frame the machine rejects. An inline array has no chunk run, so a page of several turns composes
 * and is accepted.
 */

const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

/** The real getter's shape: the loop runs while the array has a remaining element, capped by the caller's count. */
function source(contract: string, items: string): string {
  return 'pragma solidity ^0.8.0;'
    + ` contract ${contract} {`
    + `   address[]${items} items;`
    + '   mapping(address => uint256) public values;'
    + '   function get(uint256 start, uint256 count) public view returns (uint256[] memory) {'
    + '     uint256 length = items.length - start;'
    + '     if (count == 0) { count = length; }'
    + '     length = length > count ? count : length;'
    + '     uint256[] memory out = new uint256[](length);'
    + '     for (uint256 i = 0; i < length; i = i + 1) { out[i] = values[items[start + i]]; }'
    + '     return out;'
    + '   }'
    + ' }';
}

const CHUNKED_LABEL = 'array paging read chunked';
const CHUNKED_CATEGORY = seededCategory(CHUNKED_LABEL);
const CHUNKED_ARTIFACT = compileStringMulti(source('Chunked', ''), {
  composition: 'framed', solidityImportCompat: true,
}).Chunked!;

const INLINE_LABEL = 'array paging read inline';
const INLINE_CATEGORY = seededCategory(INLINE_LABEL);
const INLINE_ARTIFACT = compileStringMulti(source('Inline', ' packed'), {
  composition: 'framed', solidityImportCompat: true,
}).Inline!;

/** The addresses the array holds; element `k` is the key of the mapping value `1000 + k`. */
const ITEMS = Array.from({ length: 5 }, (_unused, index) => new Uint8Array(20).fill(0x40 + index));

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

/**
 * The provider a read runs against: the master, a validator, the array's record (and its chunk run for a
 * chunk-backed array), and the list's live nodes.
 */
async function chain(options: {
  readonly category: Uint8Array;
  readonly categoryHex: string;
  readonly artifact: typeof CHUNKED_ARTIFACT;
  readonly items: readonly Uint8Array[];
  readonly chunked: boolean;
}): Promise<MockNetworkProvider> {
  const { category, categoryHex, artifact, items, chunked } = options;
  const collection = artifact.stateLayout!.collections!.find((candidate) => candidate.name === 'values')!;
  const entryLock = bytesToHex(entryRecordLockingBytecode(categoryHex, collection.signature));
  const provider = new MockNetworkProvider();
  const deployed = deployMaster(artifact, category, VALIDATOR_PROGRAM);
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
    utxo(categoryHex, '11'.repeat(32), 20_000n, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address), utxo(categoryHex, '22'.repeat(32), 20_000n, 'mutable', empty));

  let record: Uint8Array;
  let chunks: readonly Uint8Array[] = [];
  if (chunked) {
    const records = dynamicValueRecords(artifact.stateLayout, 'items', encodePushdataValue([...items], 'address[]'));
    record = records.header;
    chunks = records.chunks;
  } else {
    record = new Uint8Array(Buffer.from(buildPushdataCommitment(artifact.stateLayout!, { items: [...items] }, 0), 'hex'));
  }
  await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(categoryHex)),
    utxo(categoryHex, '23'.repeat(32), 1_500n, 'mutable', record));
  const chunkLock = bytesToHex(chunkRecordLockingBytecode(categoryHex, 'items', 'address[]'));
  for (const [index, chunk] of chunks.entries()) {
    const txid = (0x60 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(chunkLock, utxo(categoryHex, txid, 1_000n, 'mutable', chunk));
  }
  for (const [index, node] of mappingNodes(items).written.entries()) {
    const txid = (0x33 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(entryLock, utxo(categoryHex, txid, 1_500n, 'mutable', node.after));
  }
  return provider;
}

function read(
  provider: MockNetworkProvider, artifact: typeof CHUNKED_ARTIFACT, categoryHex: string,
  start: bigint, count: bigint,
): ReturnType<typeof readFramedEntry> {
  return readFramedEntry({
    provider, artifact, categoryId: categoryHex, functionName: 'get', args: [start, count], vm: compositionMachine(),
  });
}

/** The machine's verdict on one input of the composed read. */
function verdict(
  program: Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0], index: number,
): string {
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? 'accepted' : String((state as { error?: unknown }).error);
}

/** The records the frame declares for the entry slot's own turns, in declaration order. */
function entryRecords(result: Awaited<ReturnType<typeof readFramedEntry>>): readonly string[] {
  return result.draft.layout.participants.map((placed) => placed.id).filter((id) => id.startsWith('read-entry-'));
}

const CHUNKED_HEX = bytesToHex(CHUNKED_CATEGORY);
const INLINE_HEX = bytesToHex(INLINE_CATEGORY);

describe('reading a page whose key is an element of a chunk-backed dynamic array', () => {
  it('reads the one turn the arguments leave, when the live array holds one element', async () => {
    const provider = await chain({
      category: CHUNKED_CATEGORY, categoryHex: CHUNKED_HEX, artifact: CHUNKED_ARTIFACT,
      items: [ITEMS[0]!], chunked: true,
    });
    const deployment = await readFramedDeployment(provider, CHUNKED_HEX, CHUNKED_ARTIFACT.stateLayout!);
    expect(deployment.records).toHaveLength(1);

    // `get(0, 5)` names five turns, but the array holds one element, so the loop the entry's own argument fixes
    // runs one turn. This is the real getter's shape: a limit larger than the array.
    const result = await read(provider, CHUNKED_ARTIFACT, CHUNKED_HEX, 0n, 5n);
    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual([1000n]);

    // The frame and every record it spends — the array's record, its chunk run and the mapping node — are accepted.
    const program = result.draft.programFor('read');
    expect(verdict(program, program.inputIndex)).toBe('accepted');
    for (const id of result.draft.layout.participants.map((placed) => placed.id)
      .filter((placedId) => placedId.startsWith('record-') || placedId.startsWith('read-entry-')
        || placedId.startsWith('read-chunk-'))) {
      expect(verdict(program, participant(result.draft.layout, id).index), id).toBe('accepted');
    }
  });

  it('reads each one-turn page, and the declared node is the one its key names', async () => {
    const provider = await chain({
      category: CHUNKED_CATEGORY, categoryHex: CHUNKED_HEX, artifact: CHUNKED_ARTIFACT, items: ITEMS, chunked: true,
    });

    const result = await read(provider, CHUNKED_ARTIFACT, CHUNKED_HEX, 4n, 1n);
    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual([1004n]);

    // The declared node is the one the key `items[4]` names.
    const nodeId = entryRecords(result)[0]!;
    const index = participant(result.draft.layout, nodeId).index;
    const slot = decodeEntryCommitment(
      result.draft.programFor('read').sourceOutputs[index]!.token!.nft!.commitment,
    ).slot;
    expect(bytesToHex(slot)).toBe(bytesToHex(keyToSlotMulti([ITEMS[4]!])));
  });

  it('refuses a page of several turns or none, which the chunk run and the entry node cannot share', async () => {
    const provider = await chain({
      category: CHUNKED_CATEGORY, categoryHex: CHUNKED_HEX, artifact: CHUNKED_ARTIFACT, items: ITEMS, chunked: true,
    });
    // Two turns name two entry nodes, and the second would land on the chunk run's first coordinate.
    await expect(read(provider, CHUNKED_ARTIFACT, CHUNKED_HEX, 3n, 2n)).rejects.toThrow(
      /chunk-backed array's chunk run shares the fixed record band with the entry slot's own turn/,
    );

    const emptyProvider = await chain({
      category: CHUNKED_CATEGORY, categoryHex: CHUNKED_HEX, artifact: CHUNKED_ARTIFACT, items: [], chunked: true,
    });
    // No turn names no entry node, which the run needs in the band before it, so the block cannot be laid out.
    await expect(read(emptyProvider, CHUNKED_ARTIFACT, CHUNKED_HEX, 0n, 5n)).rejects.toThrow(
      /reads "items" at 0 turn\(s\)/,
    );
  });
});

describe('reading a page over an inline dynamic array', () => {
  it('reads a page of several turns, each turn the node its own key names', async () => {
    const provider = await chain({
      category: INLINE_CATEGORY, categoryHex: INLINE_HEX, artifact: INLINE_ARTIFACT, items: ITEMS, chunked: false,
    });

    const result = await read(provider, INLINE_ARTIFACT, INLINE_HEX, 1n, 3n);
    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual([1001n, 1002n, 1003n]);
    expect(entryRecords(result)).toHaveLength(3);

    const program = result.draft.programFor('read');
    expect(verdict(program, program.inputIndex)).toBe('accepted');
    for (const id of entryRecords(result)) {
      const index = participant(result.draft.layout, id).index;
      expect(verdict(program, index)).toBe('accepted');
      expect(program.transaction.outputs[index]!.token?.nft?.commitment)
        .toStrictEqual(program.sourceOutputs[index]!.token?.nft?.commitment);
    }
  });

  it('reads the whole remaining array for a zero limit, and an empty page for an empty array', async () => {
    const provider = await chain({
      category: INLINE_CATEGORY, categoryHex: INLINE_HEX, artifact: INLINE_ARTIFACT, items: ITEMS, chunked: false,
    });
    const whole = await read(provider, INLINE_ARTIFACT, INLINE_HEX, 2n, 0n);
    expect(whole.accepted).toBe(true);
    expect(whole.value).toStrictEqual([1002n, 1003n, 1004n]);

    const emptyProvider = await chain({
      category: INLINE_CATEGORY, categoryHex: INLINE_HEX, artifact: INLINE_ARTIFACT, items: [], chunked: false,
    });
    const none = await read(emptyProvider, INLINE_ARTIFACT, INLINE_HEX, 0n, 5n);
    expect(none.accepted).toBe(true);
    expect(none.value).toStrictEqual([]);
    expect(entryRecords(none)).toStrictEqual([]);
  });
});
