import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, encodeIntegerValue } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  entryRecordLockingBytecode,
  readFramedDeployment,
  stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { participant, planMappingBatch } from '../../../src/framed/composer/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * Reading a page over a mapping, off chain.
 *
 * The contract keeps one `mapping(uint256 => uint256)` and walks it by a key its own arguments and a loop counter
 * name: `cells[start + i]` for `i` up to the caller's count. The published key is `binop:+(id:start,id:i)`, and the
 * loop's counter `i` is a source local no parameter binds, so the read has to enumerate the turns the arguments fix
 * and resolve each turn's key itself: the node the first turn names is the record its entry slot's block opens
 * with, and the later turns' nodes are declared kept beside it. A page whose arguments name no turn declares no
 * record at all and reads nothing. Each node a read declares is recreated unchanged, so what the frame returns is
 * the entry's own answer and nothing it read has moved.
 *
 * A key of the same arithmetic shape whose anchor is the entry's own state rather than an argument stays refused:
 * the read holds the frame's arguments, not a value the entry itself stored, so that key is one the arguments do
 * not determine.
 */

const LABEL = 'page read cells';
const CATEGORY = seededCategory(LABEL);
const CATEGORY_HEX = bytesToHex(CATEGORY);
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Pages {'
  + '   mapping(uint256 => uint256) public cells;'
  + '   function page(uint256 start, uint256 count) public view returns (uint256[] memory) {'
  + '     uint256[] memory out = new uint256[](count);'
  + '     for (uint256 i = 0; i < count; i = i + 1) {'
  + '       out[i] = cells[start + i];'
  + '     }'
  + '     return out;'
  + '   }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true }).Pages!;
const COLLECTION = artifact.stateLayout!.collections!.find((collection) => collection.name === 'cells')!;
const ENTRY_LOCK = entryRecordLockingBytecode(CATEGORY_HEX, COLLECTION.signature);

/** The values the contract's own state holds, as the key-based sorted list a deployment leaves behind. */
const VALUES = Array.from({ length: 9 }, (_unused, key) => 1000n + BigInt(key));
const BATCH = planMappingBatch({
  writes: VALUES.map((value, key) => ({ keys: [encodeIntegerValue(BigInt(key))], value: encodeIntegerValue(value) })),
  inventory: [headSentinelCommitment()],
  encodeValue: (encoded: Uint8Array) => encoded,
});

/** The same walk with its anchor in the entry's own state, which no frame argument carries. */
const ANCHORED_HEX = bytesToHex(seededCategory('anchored page read cells'));
const ANCHORED_SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Anchored {'
  + '   uint256 public base;'
  + '   mapping(uint256 => uint256) public cells;'
  + '   function page(uint256 count) public view returns (uint256) {'
  + '     uint256 total = 0;'
  + '     for (uint256 i = 0; i < count; i = i + 1) { total = total + cells[base + i]; }'
  + '     return total;'
  + '   }'
  + ' }';

const anchored = compileStringMulti(ANCHORED_SOURCE, { composition: 'framed', evmCompat: true })
  .Anchored!;

const empty = new Uint8Array(0);

/** One live UTXO of a category, in the shape the providers index. */
function utxo(categoryHex: string, txid: string, satoshis: bigint, capability: 'minting' | 'mutable', value: Uint8Array): {
  txid: string; vout: number; satoshis: bigint;
  token: { category: string; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: string } };
} {
  return { txid, vout: 0, satoshis,
    token: { category: categoryHex, amount: 0n, nft: { capability, commitment: bytesToHex(value) } } };
}

/** The provider a read runs against: the master, a validator, and the list's live nodes. */
async function chain(provider: MockNetworkProvider): Promise<void> {
  const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
    utxo(CATEGORY_HEX, '11'.repeat(32), 20_000n, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address), utxo(CATEGORY_HEX, '22'.repeat(32), 20_000n, 'mutable', empty));
  for (const [index, node] of BATCH.written.entries()) {
    const txid = (0x33 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(bytesToHex(ENTRY_LOCK), utxo(CATEGORY_HEX, txid, 1_500n, 'mutable', node.after));
  }
}

/** The provider an anchored read plans against: the master, a validator, and the record its state holds. */
async function anchoredChain(provider: MockNetworkProvider): Promise<void> {
  const deployed = deployMaster(anchored, new Uint8Array(Buffer.from(ANCHORED_HEX, 'hex')), VALIDATOR_PROGRAM);
  const state = new Uint8Array(Buffer.from(buildPushdataCommitment(anchored.stateLayout!, { base: 0n }, 0), 'hex'));
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
    utxo(ANCHORED_HEX, '44'.repeat(32), 20_000n, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address), utxo(ANCHORED_HEX, '55'.repeat(32), 20_000n, 'mutable', empty));
  await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(ANCHORED_HEX)),
    utxo(ANCHORED_HEX, '66'.repeat(32), 20_000n, 'mutable', state));
}

/** The read of `page(start, count)` through the shipped read module. */
function read(provider: MockNetworkProvider, start: bigint, count: bigint): ReturnType<typeof readFramedEntry> {
  return readFramedEntry({
    provider, artifact, categoryId: CATEGORY_HEX, functionName: 'page', args: [start, count],
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

/** The records the frame declares for the entry slot's own nodes, in declaration order. */
function entryRecords(result: Awaited<ReturnType<typeof readFramedEntry>>): readonly string[] {
  return result.draft.layout.participants
    .map((placed) => placed.id)
    .filter((id) => id.startsWith('read-entry-'));
}

describe('reading a page over a mapping', () => {
  it('reads the entry the page\'s first turn names, for the arguments the caller supplies', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);
    const deployment = await readFramedDeployment(provider, CATEGORY_HEX, artifact.stateLayout!);
    expect(deployment.nodesByCollection.get('cells')).toHaveLength(VALUES.length + 1);

    const result = await read(provider, 3n, 1n);
    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual([1003n]);
    // The page holds one turn, so the frame declares the one node that turn names and nothing else.
    const nodeIds = entryRecords(result);
    expect(nodeIds).toHaveLength(1);

    // The read resolved the key the sum names at the page's first turn and declared that node kept: the machine
    // accepts the read frame and the node, which is recreated unchanged.
    const program = result.draft.programFor('read');
    const nodeIndex = participant(result.draft.layout, nodeIds[0]!).index;
    expect(verdict(program, program.inputIndex)).toBe('accepted');
    expect(verdict(program, nodeIndex)).toBe('accepted');
    const source = program.sourceOutputs[nodeIndex]!.token!.nft!.commitment;
    const output = program.transaction.outputs[nodeIndex]!.token!.nft!.commitment;
    expect(source).toStrictEqual(output);
    expect(bytesToHex(decodeEntryCommitment(output).slot)).toBe(bytesToHex(keyToSlotMulti([encodeIntegerValue(3n)])));
  });

  it('reads a page whose arguments name no turn of as no entries, without declaring a node', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);

    const result = await read(provider, 0n, 0n);
    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual([]);
    // No turn runs, so the slot's key is never named and the frame declares no node for it.
    expect(entryRecords(result)).toStrictEqual([]);
  });

  it('reads a key the list does not hold beside its bracketing predecessor', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);

    // The list holds no node for this key, so the read resolves the node the key would be spliced beside and the
    // entry's own absence proof reads the type's default.
    const result = await read(provider, 20n, 1n);
    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual([0n]);
  });

  it('refuses a key of the same shape whose anchor is the entry\'s own state, not an argument', async () => {
    const provider = new MockNetworkProvider();
    await anchoredChain(provider);

    await expect(readFramedEntry({
      provider, artifact: anchored, categoryId: ANCHORED_HEX, functionName: 'page', args: [2n],
      vm: compositionMachine(),
    })).rejects.toThrow(/entry "page" touches mapping "cells" at a key the frame's arguments do not determine/);
  });
});
