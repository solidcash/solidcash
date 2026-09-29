import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { bytesToHex, encodeChunkableValueTail, encodePushdataValue, sha256 } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  entryRecordLockingBytecode,
} from '../../../src/per-call/deploy/index.js';
import { mappingValueChunkLock, planMappingBatch } from '../../../src/per-call/composer/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../../src/utils.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/per-call/master/validator-input.js';

/**
 * Reading a mapping entry whose value is a struct the node's tail cannot hold.
 *
 * The value past the inline limit lives in the node only as its digest, with the bytes in continuation chunk
 * records at the value's own collection covenant. The entry that a public mapping publishes reads the node and
 * returns the struct, which the compiler lowers to one output per field; the read therefore assembles the named
 * record from the artifact's own layout rather than handing back the first field alone.
 */

const LABEL = 'struct mapping read';
const CATEGORY = seededCategory(LABEL);
const CATEGORY_HEX = bytesToHex(CATEGORY);
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const encoder = new TextEncoder();
const key = (text: string): Uint8Array => encoder.encode(text);

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Registry {'
  + '   struct Entry { address holder; uint16 up; uint16 down; bytes payload; string note; }'
  + '   mapping(string => Entry) public entries;'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'per-call', solidityImportCompat: true }).Registry!;
const COLLECTION = artifact.stateLayout!.collections!.find((collection) => collection.name === 'entries')!;
const STRUCTS = artifact.stateLayout!.structs;
const ENTRY_LOCK = entryRecordLockingBytecode(CATEGORY_HEX, COLLECTION.signature);

/** A P2PKH locking bytecode the stored address field carries; the record reads back as its 20-byte payload. */
const HOLDER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x33), 0x88, 0xac]);
/** Past the inline limit, so the node keeps only the value's digest and the reader brings the value itself. */
const NOTE = 'a note long enough that the node keeps only its hash and the reader brings the value itself';
const ENTRY = { holder: HOLDER_LOCK, up: 7n, down: 9n, payload: new Uint8Array([0xde, 0xad, 0xbe, 0xef]), note: NOTE };
const RAW = encodePushdataValue(ENTRY, 'Entry', STRUCTS)!;
const KEY = key('k1');

/** The live list the write leaves, with the long value's continuation chunks. */
const BATCH = planMappingBatch({
  writes: [{ keys: [KEY], value: RAW }],
  inventory: [headSentinelCommitment()],
  encodeValue: encodeChunkableValueTail,
  chunkable: (value) => value,
});

const empty = new Uint8Array(0);

/** The provider a read runs against: the master, a validator, the list's node and its value chunks. */
async function chain(provider: MockNetworkProvider): Promise<void> {
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
  for (const [index, node] of BATCH.written.entries()) {
    await provider.addUtxo(bytesToHex(ENTRY_LOCK), utxo((0x33 + index).toString(16).padStart(2, '0').repeat(32),
      1_500n, 'mutable', node.after));
  }
  for (const [index, chunk] of BATCH.chunks.entries()) {
    const lock = mappingValueChunkLock(CATEGORY, COLLECTION.name, chunk);
    await provider.addUtxo(bytesToHex(lock), utxo((0x55 + index).toString(16).padStart(2, '0').repeat(32),
      1_000n, 'mutable', chunk.commitment));
  }
}

/** The read of the mapping entry through the shipped read module. */
function read(provider: MockNetworkProvider): ReturnType<typeof readPerCallEntry> {
  return readPerCallEntry({
    provider, artifact, categoryId: CATEGORY_HEX, functionName: 'entries', args: ['k1'], vm: compositionMachine(),
  });
}

const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

describe('reading a mapping entry whose struct value lives in continuation chunks', () => {
  it('assembles the named record from every field the getter returned across the joined chunks', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);

    // The value crosses the inline limit, so the node's tail holds the digest and the bytes sit in one chunk.
    const slot = keyToSlotMulti([KEY]);
    const node = BATCH.written.find((candidate) => bytesToHex(candidate.slot) === bytesToHex(slot))!;
    const tail = decodeEntryCommitment(node.after).value;
    expect(BATCH.chunks).toHaveLength(1);
    expect(bytesToHex(tail)).toContain(bytesToHex(sha256(RAW)));
    expect(bytesToHex(tail)).not.toContain(bytesToHex(key(NOTE)));

    const result = await read(provider);
    expect(result.accepted).toBe(true);

    // The getter publishes the struct's fields as separate outputs; the read hands back the named record.
    const getter = artifact.abi.find((row) => row.name === 'entries')!;
    expect(getter.outputs.map((output) => output.type))
      .toStrictEqual(STRUCTS!.find((struct) => struct.name === 'Entry')!.fields.map((field) => field.type));

    const entry = asRecord(result.value);
    expect(Object.keys(entry)).toStrictEqual(['holder', 'up', 'down', 'payload', 'note']);
    expect(binToHex(entry.holder as Uint8Array)).toBe(binToHex(lockingBytecodeToSolidityAddressPayload(HOLDER_LOCK)!));
    expect(entry.up).toBe(7n);
    expect(entry.down).toBe(9n);
    expect(entry.payload).toStrictEqual(ENTRY.payload);
    expect(entry.note).toBe(NOTE);

    // The record is the one value the read returned, and it carries the typechain-style accessor boundary.
    expect(result.values).toHaveLength(1);
    expect(result.values[0]).toBe(result.value);
    expect((result.value as { toObject: () => unknown }).toObject()).toStrictEqual({
      holder: lockingBytecodeToSolidityAddressPayload(HOLDER_LOCK),
      up: 7n,
      down: 9n,
      payload: ENTRY.payload,
      note: NOTE,
    });
  });
});
