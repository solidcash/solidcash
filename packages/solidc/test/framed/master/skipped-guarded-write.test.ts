import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeWitnessBlock, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { deployMaster, verifyMasterDeployment } from '../../../../solidcash/src/framed/deploy/index.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A framed master whose verified-mapping write a branch guards, asked about frames that declare the write taken and
 * skipped.
 *
 * The body runs the write only where `amount > 5`, and the entry access publishes that condition as its activation.
 * A frame that skips the write declares its group as one kept record: the key's own node when the list holds it, or
 * the predecessor that proves the key absent when it does not. The master accepts exactly the declaration of the path
 * the body takes: a skipped write that declares an insert would create a node no code wrote, whatever value it
 * carries, and a write that runs refuses a group declared skipped. The whole shipped path runs: the source through
 * `compileString` with the framed convention, the program through `deployMaster`, and the BCH-2026 machine.
 */

const CATEGORY = seededCategory('skipped guarded write framed');
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const TO = new Uint8Array(20).fill(0x33);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Balances {'
  + '   mapping(address => uint) balances;'
  + '   function set(address to, uint amount) {'
  + '     if (amount > 5) { require(amount < 1000); balances[to] = amount; }'
  + '   }'
  + ' }';

const artifact = compileString(SOURCE, { composition: 'framed' });
const deployed = deployMaster(artifact, CATEGORY, REAL_VALIDATOR_PROGRAM);
verifyMasterDeployment(deployed, artifact, CATEGORY, REAL_VALIDATOR_PROGRAM);
const masterLock = encodeLockingBytecodeP2sh32(hash256(deployed.script));
const entryLock = scriptToLockingBytecode(buildEntryNftCovenantScript(
  CATEGORY, computeCollectionHash(artifact.stateLayout!.collections![0]!.signature),
), 'p2sh32');

const SLOT = keyToSlot(TO);
const ZERO_SLOT = new Uint8Array(32);
const EMPTY = new Uint8Array(0);
/** The empty list's head, and the head relinked to the written key. */
const HEAD = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);
const HEAD_RELINKED = encodeEntryCommitment(ZERO_SLOT, SLOT);
/** The key's node as a list that holds it carries it. */
const HELD = encodeEntryCommitment(SLOT, ZERO_SLOT, Uint8Array.of(7));
/** The key's node carrying `value`, whose default is the empty tail. */
const node = (value: number): Uint8Array =>
  encodeEntryCommitment(SLOT, ZERO_SLOT, value === 0 ? EMPTY : Uint8Array.of(value));

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const token = (capability: 'minting' | 'mutable', commitment: Uint8Array): VmOutput['token'] =>
  ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });

const MASTER_INDEX = 0;
const USER_INDEX = 1;
/** The one node the frame spends, kept or rewritten in place: the head, or the key's own node. */
const NODE_INDEX = 2;
/** The output a created node is declared at, past the master's. */
const CREATED_INDEX = 1;

interface Spend {
  readonly amount: number;
  /** The commitment the spent node carries: the head of an empty list, or the key's own node. */
  readonly spent: Uint8Array;
  /** The records the frame's one segment declares. */
  readonly records: readonly RecordEntry[];
  /** The commitment the spent node is recreated with. */
  readonly recreated: Uint8Array;
  /** The node the transaction creates, when it creates one. */
  readonly created?: Uint8Array;
}

/** Builds the master, the node it spends and the user's input, and asks the machine about the master's input. */
function evaluate(spend: Spend): boolean {
  const block: WitnessBlock = {
    kind: 0, callerRef: USER_INDEX, originRef: USER_INDEX, validatorRef: 0xffff, sender: USER_LOCK,
    self: deployed.address, value: 0n, retval: EMPTY, calls: [], segments: [[...spend.records]], events: [], sends: [],
  };
  const inputs = [
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
      // Deepest parameter first: `amount` is declared after `to`, so `to` sits on top where the body reads it.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(block)), ...encodeDataPush(Uint8Array.of(spend.amount)),
        ...encodeDataPush(TO), ...encodeDataPush(deployed.script),
      ]),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
      unlockingBytecode: callerUnlockingBytecode(),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(5), sequenceNumber: 0xffffffff,
      unlockingBytecode: encodeDataPush(Uint8Array.of(1)),
    },
  ];
  const outputs: VmOutput[] = [
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    spend.created === undefined
      ? { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }
      : { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', spend.created) },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', spend.recreated) },
  ];
  const sourceOutputs = [
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', spend.spent) },
  ];
  const vm = compositionMachine(true);
  const state = vm.evaluate({
    inputIndex: MASTER_INDEX, sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 },
  });
  return vm.stateSuccess(state) === true;
}

/** An insert into the empty list: the head relinked to the key, and the created node carrying `value`. */
const insert = (amount: number, value: number): Spend => ({
  amount, spent: HEAD, recreated: HEAD_RELINKED, created: node(value),
  records: [
    { in: NODE_INDEX, out: NODE_INDEX, viewIn: HEAD, viewOut: HEAD_RELINKED },
    { in: 0xffff, out: CREATED_INDEX, viewIn: EMPTY, viewOut: node(value) },
  ],
});

/** The one record a skipped write declares: the node it spends, kept. */
const kept = (amount: number, spent: Uint8Array): Spend => ({
  amount, spent, recreated: spent, records: [{ in: NODE_INDEX, out: NODE_INDEX, viewIn: spent, viewOut: spent }],
});

/** The key's held node rewritten in place to carry `value`. */
const update = (amount: number, value: number): Spend => ({
  amount, spent: HELD, recreated: node(value),
  records: [{ in: NODE_INDEX, out: NODE_INDEX, viewIn: HELD, viewOut: node(value) }],
});

describe('a framed master whose verified-mapping write a branch guards', () => {
  it('publishes the condition the write runs under', () => {
    const access = artifact.abi.find((entry) => entry.name === 'set')?.entryAccesses?.[0];
    expect(access?.activation).toStrictEqual({
      kind: 'binary', operator: '>',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      right: { kind: 'literal', type: 'bigint', value: '5' },
    });
  });

  it('settles the write taken: the insert a key the list does not hold takes, and an update of one it holds', () => {
    expect(evaluate(insert(42, 42))).toBe(true);
    expect(evaluate(update(42, 42))).toBe(true);
  });

  it('settles the write skipped: the absent key\'s predecessor kept, or the held key\'s node kept', () => {
    expect(evaluate(kept(1, HEAD))).toBe(true);
    expect(evaluate(kept(1, HELD))).toBe(true);
  });

  it('refuses a skipped write declared as an insert, whatever the created node carries', () => {
    expect(evaluate(insert(1, 99))).toBe(false);
    expect(evaluate(insert(1, 0))).toBe(false);
    expect(evaluate(insert(1, 1))).toBe(false);
  });

  it('refuses a skipped write declared as an update of the node it keeps', () => {
    expect(evaluate(update(1, 1))).toBe(false);
  });

  it('refuses a write that runs declared as skipped', () => {
    expect(evaluate(kept(42, HEAD))).toBe(false);
    // The held node kept reads as an update the write did not make, which its own close refuses.
    expect(evaluate(kept(42, HELD))).toBe(false);
  });
});
