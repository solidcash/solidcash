import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import {
  buildPushdataCommitment, bytesToHex, encodeChunkableValueTail, encodePushdataValue, sha256, type StateRecord,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  entryRecordLockingBytecode,
  stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { mappingValueChunkLock, planMappingBatch } from '../../../src/framed/composer/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../../src/utils.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

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

const artifact = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true }).Registry!;
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
function read(provider: MockNetworkProvider): ReturnType<typeof readFramedEntry> {
  return readFramedEntry({
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
    expect(getter.outputs!.map((output) => output.type))
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
    expect((result.value as StateRecord & { toObject: () => unknown }).toObject()).toStrictEqual({
      holder: lockingBytecodeToSolidityAddressPayload(HOLDER_LOCK),
      up: 7n,
      down: 9n,
      payload: ENTRY.payload,
      note: NOTE,
    });
  });
});

/**
 * Reading a page over a struct-valued mapping.
 *
 * The contract keeps an inline `address[]` and a `mapping(address => Member)`, and its getter walks the mapping at
 * a key its own arguments and a loop counter name — `members[memberAddresses[i + index_]]` — so the read enumerates
 * the turns the array's live length fixes and locates each turn's struct-valued node. The getter returns the turns
 * as one `Member[]` output, so the value the caller reads is the list of records, one per turn, each carrying the
 * same accessor boundary the single-record getter's record does.
 */

const PAGED_LABEL = 'struct mapping page read';
const PAGED_CATEGORY = seededCategory(PAGED_LABEL);
const PAGED_CATEGORY_HEX = bytesToHex(PAGED_CATEGORY);

const PAGED_SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Directory {'
  + '   struct Member { address holder; uint16 score; bool active; }'
  + '   address[] packed memberAddresses;'
  + '   mapping(address => Member) public members;'
  + '   function getMembers(uint256 index_, uint256 limit_) public view returns (Member[] memory) {'
  + '     uint256 length = memberAddresses.length - index_;'
  + '     if (limit_ == 0) { limit_ = length; }'
  + '     length = length > limit_ ? limit_ : length;'
  + '     Member[] memory out = new Member[](length);'
  + '     for (uint256 i = 0; i < length; i = i + 1) { out[i] = members[memberAddresses[i + index_]]; }'
  + '     return out;'
  + '   }'
  + ' }';

const pagedArtifact = compileStringMulti(PAGED_SOURCE, {
  composition: 'framed', evmCompat: true,
}).Directory!;
const PAGED_COLLECTION = pagedArtifact.stateLayout!.collections!.find((candidate) => candidate.name === 'members')!;
const PAGED_STRUCTS = pagedArtifact.stateLayout!.structs;
const PAGED_ENTRY_LOCK = entryRecordLockingBytecode(PAGED_CATEGORY_HEX, PAGED_COLLECTION.signature);

/** The addresses the state array holds; element `k` is the key of the member the mapping holds at that key. */
const PAGED_ADDRESSES = Array.from({ length: 3 }, (_unused, index) => new Uint8Array(20).fill(0x50 + index));
const PAGED_MEMBERS = PAGED_ADDRESSES.map((holder, index) => ({
  holder, score: BigInt(100 + index), active: index !== 1,
}));

const PAGED_BATCH = planMappingBatch({
  writes: PAGED_ADDRESSES.map((slotKey, index) => ({
    keys: [slotKey], value: encodePushdataValue(PAGED_MEMBERS[index]!, 'Member', PAGED_STRUCTS)!,
  })),
  inventory: [headSentinelCommitment()],
  encodeValue: encodeChunkableValueTail,
  chunkable: (value) => value,
});

/** The provider a paged read runs against: the master, a validator, the array's record and the list's live nodes. */
async function pagedChain(provider: MockNetworkProvider): Promise<void> {
  const deployed = deployMaster(pagedArtifact, PAGED_CATEGORY, VALIDATOR_PROGRAM);
  const utxo = (txid: string, satoshis: bigint, capability: 'minting' | 'mutable', commitment: Uint8Array): {
    txid: string; vout: number; satoshis: bigint;
    token: { category: string; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: string } };
  } => ({
    txid, vout: 0, satoshis,
    token: { category: PAGED_CATEGORY_HEX, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } },
  });

  await provider.addUtxo(bytesToHex(deployed.lockingBytecode), utxo('11'.repeat(32), 20_000n, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address), utxo('22'.repeat(32), 20_000n, 'mutable', empty));
  const arrayRecord = new Uint8Array(Buffer.from(
    buildPushdataCommitment(pagedArtifact.stateLayout!, { memberAddresses: [...PAGED_ADDRESSES] }, 0), 'hex'));
  await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(PAGED_CATEGORY_HEX)),
    utxo('23'.repeat(32), 1_500n, 'mutable', arrayRecord));
  for (const [index, node] of PAGED_BATCH.written.entries()) {
    const txid = (0x33 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(bytesToHex(PAGED_ENTRY_LOCK), utxo(txid, 1_500n, 'mutable', node.after));
  }
}

/** The read of `getMembers(index_, limit_)` through the shipped read module. */
function readPaged(
  provider: MockNetworkProvider, index: bigint, limit: bigint,
): ReturnType<typeof readFramedEntry> {
  return readFramedEntry({
    provider, artifact: pagedArtifact, categoryId: PAGED_CATEGORY_HEX, functionName: 'getMembers',
    args: [index, limit], vm: compositionMachine(),
  });
}

/** One decoded record of a page, as the accessor boundary it carries is read. */
type ReadRecord = StateRecord & { toObject: () => Record<string, unknown> };

describe('reading a page over a struct-valued mapping', () => {
  it('returns every turn\'s record in turn order, each carrying the accessor boundary', async () => {
    const provider = new MockNetworkProvider();
    await pagedChain(provider);

    // A zero limit names the whole remaining array, so the page walks all three turns in order.
    const result = await readPaged(provider, 0n, 0n);
    expect(result.accepted).toBe(true);

    // The getter declares one `Member[]` output, so the read's value is the list of records, one per turn.
    expect(result.values).toHaveLength(1);
    const page = result.value as ReadRecord[];
    expect(Array.isArray(page)).toBe(true);
    expect(page).toHaveLength(PAGED_MEMBERS.length);

    PAGED_MEMBERS.forEach((member, turn) => {
      const record = page[turn]!;
      // The accessor boundary is non-enumerable, so the record's own fields are exactly the struct's.
      expect(Object.keys(record)).toStrictEqual(['holder', 'score', 'active']);
      expect(record.holder).toStrictEqual(member.holder);
      expect(record.score).toBe(member.score);
      expect(record.active).toBe(member.active);
      expect(typeof record.toObject).toBe('function');
      expect(record.toObject()).toStrictEqual(member);
    });

    // The caller reads the page exactly the way the getter's caller does.
    expect(page.map((record) => record.toObject())).toStrictEqual(PAGED_MEMBERS);
  });

  it('reads the turns the index and limit name, so the records come back in turn order', async () => {
    const provider = new MockNetworkProvider();
    await pagedChain(provider);

    // `getMembers(1, 1)` names the single turn at index 1, whose record is the second the array names.
    const page = (await readPaged(provider, 1n, 1n)).value as ReadRecord[];
    expect(page).toHaveLength(1);
    expect(page[0]!.toObject()).toStrictEqual(PAGED_MEMBERS[1]);
  });
});
