import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { bytesToHex, encodeChunkableValueTail } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  entryRecordLockingBytecode,
  readPerCallDeployment,
} from '../../../src/per-call/deploy/index.js';
import { participant, planMappingBatch } from '../../../src/per-call/composer/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/per-call/master/validator-input.js';

/**
 * Reading a view whose state is a mapping, off chain.
 *
 * The contract holds one `mapping(string => string)`, so its state is not a data NFT but a chain of entry NFTs: the
 * view reads one node, the one its key names or the node the key is read beside. The read has to plan that node the
 * way a call plans a write — from the deployment layer's own classification — and the view returns the value its own
 * body read. The entry is compiled the way a Solidity-imported one is, so its returned tuple is ABI-encoded.
 */

const LABEL = 'mapping read tags';
const CATEGORY = seededCategory(LABEL);
const CATEGORY_HEX = bytesToHex(CATEGORY);
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const encoder = new TextEncoder();
const TAGS = [
  ['DA', 'DIGITAL_AUDIO'], ['DV', 'DIGITAL_VIDEO'], ['DT', 'DIGITAL_TEXT'],
].map(([key, value]) => ({ key: encoder.encode(key), value: encoder.encode(value) }));

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Registry {'
  + '   address public owner;'
  + '   mapping(string => string) public tags;'
  + '   function tag(string memory k) public view returns (string memory) {'
  + '     require(bytes(tags[k]).length != 0, "Invalid MECE tag");'
  + '     return tags[k];'
  + '   }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'per-call', solidityImportCompat: true }).Registry!;
const COLLECTION = artifact.stateLayout!.collections!.find((collection) => collection.name === 'tags')!;
const ENTRY_LOCK = entryRecordLockingBytecode(CATEGORY_HEX, COLLECTION.signature);

/** The live list the constructor's own writes leave: the relinked head and one node per tag. */
const BATCH = planMappingBatch({
  writes: TAGS.map(({ key, value }) => ({ keys: [key], value })),
  inventory: [headSentinelCommitment()],
  encodeValue: encodeChunkableValueTail,
});

const empty = new Uint8Array(0);

/** The provider a read runs against: the master, a validator, and the list's live nodes. */
async function chain(provider: MockNetworkProvider, withNodes = true): Promise<void> {
  const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
  const utxo = (txid: string, satoshis: bigint, capability: 'minting' | 'mutable', commitment: Uint8Array): {
    txid: string; vout: number; satoshis: bigint;
    token: { category: string; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: string } };
  } => ({ txid, vout: 0, satoshis,
    token: { category: CATEGORY_HEX, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } } });

  await provider.addUtxo(bytesToHex(deployed.lockingBytecode), utxo('11'.repeat(32), 20_000n, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address), utxo('22'.repeat(32), 20_000n, 'mutable', empty));
  if (!withNodes) return;
  for (const [index, node] of BATCH.written.entries()) {
    const txid = (0x33 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(bytesToHex(ENTRY_LOCK), utxo(txid, 1_500n, 'mutable', node.after));
  }
}

/** The read of `tag(k)` through the shipped read module. */
function read(provider: MockNetworkProvider, key: string): ReturnType<typeof readPerCallEntry> {
  return readPerCallEntry({
    provider, artifact, categoryId: CATEGORY_HEX, functionName: 'tag', args: [key], vm: compositionMachine(),
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

describe('reading a view whose state is a mapping', () => {
  it('returns the value the key names, from the node the deployment layer classifies', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);
    const deployment = await readPerCallDeployment(provider, CATEGORY_HEX, artifact.stateLayout!);
    expect(deployment.nodesByCollection.get('tags')).toHaveLength(TAGS.length + 1);

    const result = await read(provider, 'DV');
    expect(result.accepted).toBe(true);
    expect(result.value).toBe('DIGITAL_VIDEO');

    // The entry's own block slots name the mapping entry alone, so the frame declares that node and no data-NFT
    // record — the contract's `owner` record is not read.
    const ids = result.draft.layout.participants.map((placed) => placed.id);
    const nodeId = ids.find((id) => id.startsWith('read-entry-'));
    expect(nodeId).toBeDefined();
    expect(ids).not.toContain('record-0');

    // The read's frame and the node it spends are accepted, and the node is recreated unchanged at the key's slot.
    const program = result.draft.programFor('read');
    const nodeIndex = participant(result.draft.layout, nodeId!).index;
    expect(verdict(program, program.inputIndex)).toBe('accepted');
    expect(verdict(program, nodeIndex)).toBe('accepted');
    const source = program.sourceOutputs[nodeIndex]!.token!.nft!.commitment;
    const output = program.transaction.outputs[nodeIndex]!.token!.nft!.commitment;
    expect(source).toStrictEqual(output);
    expect(bytesToHex(decodeEntryCommitment(output).slot)).toBe(bytesToHex(keyToSlotMulti([encoder.encode('DV')])));
    expect(decodeEntryCommitment(output).value)
      .toStrictEqual(encodeChunkableValueTail(encoder.encode('DIGITAL_VIDEO')));
  });

  it('reads a key the list does not hold beside its bracketing node, so the entry\'s own require refuses it', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);

    const result = await read(provider, 'LOL');
    // The bracketing predecessor lets the body prove the key absent and read the type's default, which the entry's
    // own `require` refuses: the frame refused at its own comparison rather than at the read's planning.
    expect(result.accepted).toBe(false);
    expect(result.refusal?.innermost?.master).toBe('read');
    expect(result.values).toStrictEqual([]);
  });

  it('refuses by name a key whose live list holds neither the node nor its bracketing predecessor', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider, false);

    await expect(read(provider, 'DV')).rejects.toThrow(
      /holds no node of collection "tags" whose slot is the key's or the key's bracketing predecessor/,
    );
  });
});
