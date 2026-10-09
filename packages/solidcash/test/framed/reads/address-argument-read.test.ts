import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex, encodeIntegerValue } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  entryRecordLockingBytecode,
  readFramedDeployment,
} from '../../../src/framed/deploy/index.js';
import { participant, planMappingBatch } from '../../../src/framed/composer/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * Reading a mapping keyed by an `address`, however the caller writes that address.
 *
 * The compiler's `address` is a locking bytecode, which is what a contract stores when it keys a mapping by one —
 * an element of an `address[]`, a `msg.sender`, an argument the body wrote. A caller may name the same address as a
 * locking bytecode, as a CashAddress, or as the 20-byte payload an EVM ABI carries, and all three name one key: the
 * read has to locate the node the lock names whichever form its own arguments use, or it proves the key absent. The
 * payload's hex spelling is widened by the same shipped encoder, which `Argument.test.ts` pins.
 */

const LABEL = 'address argument read';
const CATEGORY = seededCategory(LABEL);
const CATEGORY_HEX = bytesToHex(CATEGORY);
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Balances {'
  + '   mapping(address => uint256) public held;'
  + '   function heldAt(address who) public view returns (uint256) { return held[who]; }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true }).Balances!;
const COLLECTION = artifact.stateLayout!.collections!.find((collection) => collection.name === 'held')!;
const ENTRY_LOCK = entryRecordLockingBytecode(CATEGORY_HEX, COLLECTION.signature);

/** The hash the account is identified by, and the lock the contract keys its mapping by. */
const PAYLOAD = new Uint8Array(20).fill(0x5a);
const LOCK = encodeLockingBytecodeP2pkh(PAYLOAD);
const HELD = 77n;

/** The live list the body's own write leaves: the head, and one node at the lock's slot holding the value. */
const BATCH = planMappingBatch({
  writes: [{ keys: [LOCK], value: encodeIntegerValue(HELD) }],
  inventory: [headSentinelCommitment()],
  encodeValue: (encoded: Uint8Array) => encoded,
});

const empty = new Uint8Array(0);

/** The provider a read runs against: the master, a validator, and the list's live nodes. */
async function chain(): Promise<MockNetworkProvider> {
  const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
  const utxo = (txid: string, satoshis: bigint, capability: 'minting' | 'mutable', commitment: Uint8Array): {
    txid: string; vout: number; satoshis: bigint;
    token: { category: string; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: string } };
  } => ({ txid, vout: 0, satoshis,
    token: { category: CATEGORY_HEX, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } } });

  const provider = new MockNetworkProvider();
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode), utxo('11'.repeat(32), 20_000n, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address), utxo('22'.repeat(32), 20_000n, 'mutable', empty));
  for (const [index, node] of BATCH.written.entries()) {
    const txid = (0x33 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(bytesToHex(ENTRY_LOCK), utxo(txid, 1_500n, 'mutable', node.after));
  }
  return provider;
}

/** The read of `heldAt(account)` through the shipped read module. */
function read(provider: MockNetworkProvider, account: Uint8Array): ReturnType<typeof readFramedEntry> {
  return readFramedEntry({
    provider, artifact, categoryId: CATEGORY_HEX, functionName: 'heldAt', args: [account], vm: compositionMachine(),
  });
}

/** The node the frame spends, as the record its own slot names. */
function spentNodeSlot(
  result: Awaited<ReturnType<typeof readFramedEntry>>,
): string {
  const id = result.draft.layout.participants.map((placed) => placed.id)
    .find((candidate) => candidate.startsWith('read-entry-'))!;
  const index = participant(result.draft.layout, id).index;
  return bytesToHex(decodeEntryCommitment(
    result.draft.programFor('read').sourceOutputs[index]!.token!.nft!.commitment,
  ).slot);
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

describe('reading a mapping keyed by an address', () => {
  it('reads the value the lock names from the same account written as a 20-byte payload', async () => {
    const provider = await chain();
    expect((await readFramedDeployment(provider, CATEGORY_HEX, artifact.stateLayout!))
      .nodesByCollection.get('held')).toHaveLength(2);

    // The caller names the account the way an EVM ABI carries it; the contract keys the mapping by the lock.
    const result = await read(provider, PAYLOAD);
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(HELD);

    // The node the frame declares is the one the lock's slot names, not the payload's own bytes.
    expect(spentNodeSlot(result)).toBe(bytesToHex(keyToSlotMulti([LOCK])));
    const program = result.draft.programFor('read');
    expect(verdict(program, program.inputIndex)).toBe('accepted');
  });

  it('reads the same node when the account is written as its locking bytecode', async () => {
    const provider = await chain();

    const result = await read(provider, LOCK);
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(HELD);
    expect(spentNodeSlot(result)).toBe(bytesToHex(keyToSlotMulti([LOCK])));
  });

  it('reads a key the list does not hold as the absent value the body proves', async () => {
    const provider = await chain();

    // A payload no node of the list holds is read beside the node that brackets it, and the body answers with the
    // value type's default.
    const other = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x07));
    const result = await read(provider, other);
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(0n);
  });
});
