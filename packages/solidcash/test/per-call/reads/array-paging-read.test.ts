import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, encodeIntegerValue } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  entryRecordLockingBytecode,
  readPerCallDeployment,
  stateRecordLockingBytecode,
} from '../../../src/per-call/deploy/index.js';
import { participant, planMappingBatch } from '../../../src/per-call/composer/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/per-call/master/validator-input.js';

/**
 * Reading a page whose key is an element of a dynamic state array.
 *
 * The contract keeps one `address[] packed` array and one `mapping(address => uint256)`, and reads the mapping at
 * a key its own arguments and a loop counter name: `values[items[start + i]]` for `i` up to the caller's count.
 * The published key is `map:items(binop:+(id:start,id:i))`, a collection label over the computed index `start + i`.
 * The read has to enumerate the turns the arguments fix, resolve each turn's array element from the live record,
 * and locate the mapping node that element names. A page whose arguments name no turn declares no node at all, and
 * a page of several turns declares each turn's node, kept unchanged.
 */

const LABEL = 'array paging read';
const CATEGORY = seededCategory(LABEL);
const CATEGORY_HEX = bytesToHex(CATEGORY);
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Registry {'
  + '   address[] packed items;'
  + '   mapping(address => uint256) public values;'
  + '   function get(uint256 start, uint256 count) public view returns (uint256[] memory) {'
  + '     uint256[] memory out = new uint256[](count);'
  + '     for (uint256 i = 0; i < count; i = i + 1) { out[i] = values[items[start + i]]; }'
  + '     return out;'
  + '   }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'per-call', solidityImportCompat: true }).Registry!;
const COLLECTION = artifact.stateLayout!.collections!.find((collection) => collection.name === 'values')!;
const ENTRY_LOCK = entryRecordLockingBytecode(CATEGORY_HEX, COLLECTION.signature);

/** The addresses the array holds, each a distinct 20-byte locking bytecode. */
const ITEMS = Array.from({ length: 5 }, (_unused, index) => new Uint8Array(20).fill(0x40 + index));

/** The mapping's live value at each array element: key -> value, so a page's answer is `1000 + key`. */
const VALUES = ITEMS.map((_item, index) => ({ key: ITEMS[index]!, value: 1000n + BigInt(index) }));

const BATCH = planMappingBatch({
  writes: VALUES.map(({ key, value }) => ({ keys: [key], value: encodeIntegerValue(value) })),
  inventory: [headSentinelCommitment()],
  encodeValue: (encoded: Uint8Array) => encoded,
});

/** The record commitment the array's packed state makes, from the shipped encoder. */
const RECORD = new Uint8Array(Buffer.from(
  buildPushdataCommitment(artifact.stateLayout!, { items: ITEMS }, 0), 'hex',
));

const empty = new Uint8Array(0);

/** One live UTXO of a category, in the shape the providers index. */
function utxo(categoryHex: string, txid: string, satoshis: bigint, capability: 'minting' | 'mutable', value: Uint8Array): {
  txid: string; vout: number; satoshis: bigint;
  token: { category: string; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: string } };
} {
  return { txid, vout: 0, satoshis,
    token: { category: categoryHex, amount: 0n, nft: { capability, commitment: bytesToHex(value) } } };
}

/** The provider a read runs against: the master, a validator, the array's record and the list's live nodes. */
async function chain(provider: MockNetworkProvider): Promise<void> {
  const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
    utxo(CATEGORY_HEX, '11'.repeat(32), 20_000n, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address), utxo(CATEGORY_HEX, '22'.repeat(32), 20_000n, 'mutable', empty));
  await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(CATEGORY_HEX)),
    utxo(CATEGORY_HEX, '23'.repeat(32), 1_500n, 'mutable', RECORD));
  for (const [index, node] of BATCH.written.entries()) {
    const txid = (0x33 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(bytesToHex(ENTRY_LOCK), utxo(CATEGORY_HEX, txid, 1_500n, 'mutable', node.after));
  }
}

/** The read of `get(start, count)` through the shipped read module. */
function read(provider: MockNetworkProvider, start: bigint, count: bigint): ReturnType<typeof readPerCallEntry> {
  return readPerCallEntry({
    provider, artifact, categoryId: CATEGORY_HEX, functionName: 'get', args: [start, count],
    vm: compositionMachine(),
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
function entryRecords(result: Awaited<ReturnType<typeof readPerCallEntry>>): readonly string[] {
  return result.draft.layout.participants
    .map((placed) => placed.id)
    .filter((id) => id.startsWith('read-entry-'));
}

describe('reading a page whose key is an element of a dynamic array', () => {
  it('reads the page the arguments name, for a page of zero, one and several turns', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);

    const single = await read(provider, 2n, 1n);
    expect(single.accepted).toBe(true);
    expect(single.value).toStrictEqual([1002n]);

    const page = await read(provider, 1n, 3n);
    expect(page.accepted).toBe(true);
    expect(page.value).toStrictEqual([1001n, 1002n, 1003n]);
    expect(entryRecords(page)).toHaveLength(3);

    const emptyPage = await read(provider, 0n, 0n);
    expect(emptyPage.accepted).toBe(true);
    expect(emptyPage.value).toStrictEqual([]);
    expect(entryRecords(emptyPage)).toStrictEqual([]);
  });

  it('keeps the read frame and every node the page names accepted, each node recreated unchanged', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);

    const result = await read(provider, 2n, 3n);
    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual([1002n, 1003n, 1004n]);

    const program = result.draft.programFor('read');
    expect(verdict(program, program.inputIndex)).toBe('accepted');
    for (const node of entryRecords(result)) {
      const nodeIndex = participant(result.draft.layout, node).index;
      expect(verdict(program, nodeIndex)).toBe('accepted');
      expect(program.transaction.outputs[nodeIndex]!.token?.nft?.commitment)
        .toStrictEqual(program.sourceOutputs[nodeIndex]!.token?.nft?.commitment);
    }
  });

  it('resolves each turn key from the live array element the record holds', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);
    const deployment = await readPerCallDeployment(provider, CATEGORY_HEX, artifact.stateLayout!);
    expect(deployment.records).toHaveLength(1);

    const result = await read(provider, 2n, 2n);
    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual([1002n, 1003n]);

    // The declared nodes are the ones the keys `items[2]` and `items[3]` name, in turn order.
    const nodeIds = entryRecords(result);
    const slots = nodeIds.map((id) => {
      const index = participant(result.draft.layout, id).index;
      return bytesToHex(decodeEntryCommitment(
        result.draft.programFor('read').sourceOutputs[index]!.token!.nft!.commitment,
      ).slot);
    });
    expect(slots).toStrictEqual([
      bytesToHex(keyToSlotMulti([ITEMS[2]!])),
      bytesToHex(keyToSlotMulti([ITEMS[3]!])),
    ]);
  });
});
