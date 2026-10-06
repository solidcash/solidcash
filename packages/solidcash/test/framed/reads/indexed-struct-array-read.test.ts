import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  bytesToHex, encodeChunkableValueTail, encodePushdataValue, sha256, type StateRecord,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployMaster, entryRecordLockingBytecode } from '../../../src/framed/deploy/index.js';
import { mappingValueChunkLock, planMappingBatch } from '../../../src/framed/composer/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { headSentinelCommitment } from '../../../src/stateful/SortedList.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../../src/utils.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * Reading one element of a mapping whose values are arrays of a struct (Solidity-compatible).
 *
 * A public `mapping(address => Note[])` publishes a getter that takes the key and then the element's index, and
 * returns that element's fields as separate outputs. The read assembles the named record from the element struct
 * the collection's value type names, as it does for a struct-valued mapping; before, it handed back the first field
 * alone, so a caller's `.toObject()` on the result found no method.
 */

const CATEGORY = seededCategory('indexed struct array read');
const CATEGORY_HEX = bytesToHex(CATEGORY);

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Board {'
  + '   struct Note { address author; uint256 ref; uint8 score; string text; uint32 at; }'
  + '   mapping(address => Note[]) public notes;'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'framed', solidityImportCompat: true }).Board!;
const COLLECTION = artifact.stateLayout!.collections!.find((collection) => collection.name === 'notes')!;
const STRUCTS = artifact.stateLayout!.structs;
const ENTRY_LOCK = entryRecordLockingBytecode(CATEGORY_HEX, COLLECTION.signature);

/** A 32-byte txid for a mock UTXO, neither one repeated byte nor a palindrome, taken from its label. */
const txidOf = (label: string): string => bytesToHex(sha256(utf8ToBin(`indexed struct array read ${label}`)));

const TARGET = encodeLockingBytecodeP2pkh(hexToBin('3a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d'));
const FIRST_AUTHOR = encodeLockingBytecodeP2pkh(hexToBin('0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c'));
const SECOND_AUTHOR = encodeLockingBytecodeP2pkh(hexToBin('c0d1e2f30415263748596a7b8c9dae0fc0d1e2f3'));
const NOTES = [
  { author: FIRST_AUTHOR, ref: 0n, score: 5n, text: 'Nice work!', at: 1_700_000_123n },
  { author: SECOND_AUTHOR, ref: 7n, score: 3n, text: 'fine', at: 1_700_000_456n },
];
const RAW = encodePushdataValue(NOTES, 'Note[]', STRUCTS)!;

/** The live list holding the one key, with its long value's continuation chunks. */
const BATCH = planMappingBatch({
  writes: [{ keys: [TARGET], value: RAW }],
  inventory: [headSentinelCommitment()],
  encodeValue: encodeChunkableValueTail,
  chunkable: (value) => value,
});

/** The provider a read runs against: the master, a validator, the list's nodes and the value's chunks. */
async function chain(provider: MockNetworkProvider): Promise<void> {
  const deployed = deployMaster(artifact, CATEGORY, REAL_VALIDATOR_PROGRAM);
  const utxo = (label: string, satoshis: bigint, capability: 'minting' | 'mutable', commitment: Uint8Array): {
    txid: string; vout: number; satoshis: bigint;
    token: { category: string; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: string } };
  } => ({
    txid: txidOf(label), vout: 0, satoshis,
    token: { category: CATEGORY_HEX, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } },
  });
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode), utxo('master', 20_000n, 'minting', new Uint8Array()));
  await provider.addUtxo(bytesToHex(deployed.address), utxo('validator', 20_000n, 'mutable', new Uint8Array()));
  for (const [index, node] of BATCH.written.entries()) {
    await provider.addUtxo(bytesToHex(ENTRY_LOCK), utxo(`node ${index}`, 1_500n, 'mutable', node.after));
  }
  for (const [index, chunk] of BATCH.chunks.entries()) {
    const lock = mappingValueChunkLock(CATEGORY, COLLECTION.name, chunk);
    await provider.addUtxo(bytesToHex(lock), utxo(`chunk ${index}`, 1_000n, 'mutable', chunk.commitment));
  }
}

type ReadRecord = StateRecord & { toObject: () => Record<string, unknown> };

describe('reading one element of a mapping whose values are arrays of a struct', () => {
  it('assembles the element\'s named record from the fields the getter returned', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider);
    // The getter takes the key and the index, and returns the element struct's fields as separate outputs.
    const getter = artifact.abi.find((row) => row.name === 'notes')!;
    expect(getter.inputs.map((input) => input.type)).toStrictEqual(['address', 'uint256']);
    expect(getter.outputs!.map((output) => output.type))
      .toStrictEqual(STRUCTS!.find((struct) => struct.name === 'Note')!.fields.map((field) => field.type));

    for (const [index, note] of NOTES.entries()) {
      const result = await readFramedEntry({
        provider, artifact, categoryId: CATEGORY_HEX, functionName: 'notes', args: [TARGET, BigInt(index)],
        vm: compositionMachine(),
      });
      expect(result.accepted).toBe(true);
      expect(result.values).toHaveLength(1);
      const record = result.value as ReadRecord;
      expect(Object.keys(record)).toStrictEqual(['author', 'ref', 'score', 'text', 'at']);
      expect(record.toObject()).toStrictEqual({
        ...note, author: lockingBytecodeToSolidityAddressPayload(note.author),
      });
    }
  });
});
