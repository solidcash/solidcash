import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { bytesEqual, bytesToHex, encodeChunkableValueTail, sha256 } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  entryRecordLockingBytecode,
  readPerCallDeployment,
} from '../../../src/per-call/deploy/index.js';
import { mappingValueChunkLock, planMappingBatch, participant } from '../../../src/per-call/composer/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/per-call/master/validator-input.js';

/**
 * Reading a view of a mapping node whose value the node's tail cannot hold.
 *
 * A value past the inline limit lives in the node only as its digest, with the bytes in continuation chunk records
 * at the value's own collection covenant. The view's body reads the value by witness, so the read has to fetch the
 * chunks the deployment holds, join them with the shipped decoder and state the value the body binds. A node whose
 * value is inline is read from its tail as before, and a deployment that holds the node but not its chunks is
 * refused by name.
 */

const LABEL = 'chunked read tags';
const CATEGORY = seededCategory(LABEL);
const CATEGORY_HEX = bytesToHex(CATEGORY);
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const encoder = new TextEncoder();
const key = (text: string): Uint8Array => encoder.encode(text);
/** Past the 60 bytes a node's tail holds inline, so the tail carries the value's digest instead. */
const LONG = 'a note long enough that the node keeps only its hash and the reader brings the value itself';
const SHORT = 'DIGITAL_AUDIO';

/** The two keys the list holds: one inline, one whose bytes sit past the node's head. */
const TAGS = [
  { key: key('DA'), value: key(SHORT) },
  { key: key('DL'), value: key(LONG) },
];

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

/** The list the constructor's own writes leave, with the long value's continuation chunks. */
const BATCH = planMappingBatch({
  writes: TAGS.map(({ key: tag, value }) => ({ keys: [tag], value })),
  inventory: [headSentinelCommitment()],
  encodeValue: encodeChunkableValueTail,
  chunkable: (value) => value,
});

const empty = new Uint8Array(0);

/** The provider a read runs against: the master, a validator, the list's nodes and, optionally, its chunks. */
async function chain(
  provider: MockNetworkProvider,
  options: { withNodes?: boolean; withChunks?: boolean } = {},
): Promise<void> {
  const { withNodes = true, withChunks = true } = options;
  const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
  const utxo = (txid: string, satoshis: bigint, capability: 'minting' | 'mutable', commitment: Uint8Array): {
    txid: string; vout: number; satoshis: bigint;
    token: { category: string; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: string } };
  } => ({
    txid, vout: 0, satoshis,
    token: { category: CATEGORY_HEX, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } },
  });

  await provider.addUtxo(bytesToHex(deployed.lockingBytecode), utxo('11'.repeat(32), 20_000n, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address), utxo('22'.repeat(32), 20_000n, 'mutable', empty));
  if (!withNodes) return;
  for (const [index, node] of BATCH.written.entries()) {
    const txid = (0x33 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(bytesToHex(ENTRY_LOCK), utxo(txid, 1_500n, 'mutable', node.after));
  }
  if (!withChunks) return;
  for (const [index, chunk] of BATCH.chunks.entries()) {
    const lock = mappingValueChunkLock(CATEGORY, COLLECTION.name, chunk);
    const txid = (0x55 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(bytesToHex(lock), utxo(txid, 1_000n, 'mutable', chunk.commitment));
  }
}

/** The read of `tag(k)` through the shipped read module. */
function read(provider: MockNetworkProvider, tag: string): ReturnType<typeof readPerCallEntry> {
  return readPerCallEntry({
    provider, artifact, categoryId: CATEGORY_HEX, functionName: 'tag', args: [tag], vm: compositionMachine(),
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

describe('reading a mapping node whose value lives in continuation chunks', () => {
  it('fetches the chunks the deployment holds and answers the value the node carries', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);
    // The node's tail holds the value's digest and not the value; the bytes are one continuation chunk.
    const slotDL = keyToSlotMulti([key('DL')]);
    const longNode = BATCH.written.find((node) => bytesEqual(node.slot, slotDL))!;
    const tail = decodeEntryCommitment(longNode.after).value;
    expect(BATCH.chunks).toHaveLength(1);
    expect(BATCH.chunks[0]!.slot).toStrictEqual(slotDL);
    expect(bytesToHex(tail)).toContain(bytesToHex(sha256(key(LONG))));
    expect(bytesToHex(tail)).not.toContain(bytesToHex(key(LONG)));

    const result = await read(provider, 'DL');
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(LONG);
    // The read states the whole value as the body's value witness, which is what its own hash check consumes.
    expect(result.draft.blockOf('read').values).toStrictEqual([key(LONG)]);

    // Every input of the composed read — the frame and the node it spends — is accepted.
    const program = result.draft.programFor('read');
    const nodeId = result.draft.layout.participants.map((placed) => placed.id).find((id) => id.startsWith('read-entry-'))!;
    expect(verdict(program, program.inputIndex)).toBe('accepted');
    expect(verdict(program, participant(result.draft.layout, nodeId).index)).toBe('accepted');
  });

  it('reads a node whose value is inline from its tail, listing no value witness', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);

    const result = await read(provider, 'DA');
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(SHORT);
    // The tail carries the value itself, so the body never asks for a witness and the frame lists none.
    expect(result.draft.blockOf('read').values).toBeUndefined();
  });

  it('refuses by name a node whose chunks the deployment does not hold, naming the width it declared', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider, { withChunks: false });

    await expect(read(provider, 'DL')).rejects.toThrow(
      new RegExp(`holds a ${key(LONG).length}-byte value whose bytes sit in chunk records that category `
        + `${CATEGORY_HEX} does not hold`),
    );
  });

  it('still refuses by name a key whose live list holds no node and no bracketing predecessor', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider, { withNodes: false });

    await expect(read(provider, 'DL')).rejects.toThrow(
      /holds no node of collection "tags" whose slot is the key's or the key's bracketing predecessor/,
    );
  });

  it('classifies the value chunks of a key no write recreated, beside the nodes', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);
    const deployment = await readPerCallDeployment(provider, CATEGORY_HEX, artifact.stateLayout!);
    // A mapping value's chunk sits at its own root-salted covenant, so it is filed beside the nodes, not among them.
    const chunkLock = mappingValueChunkLock(CATEGORY, COLLECTION.name, BATCH.chunks[0]!);
    const chunkHex = bytesToHex(chunkLock);
    const filed = deployment.collectionNodes.filter((utxo) => utxo.lockingBytecode !== undefined
      && bytesToHex(utxo.lockingBytecode) === chunkHex);
    expect(filed).toHaveLength(BATCH.chunks.length);
    expect(filed[0]!.token!.nft!.commitment).toBe(bytesToHex(BATCH.chunks[0]!.commitment));
    expect((deployment.nodesByCollection.get('tags') ?? [])
      .some((utxo) => utxo.lockingBytecode !== undefined && bytesToHex(utxo.lockingBytecode) === chunkHex))
      .toBe(false);
  });
});
