import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeWitnessBlock,
  type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { refusalMessageOf } from './refused-entry.js';
import { deployMaster, verifyMasterDeployment } from '../../../../solidcash/src/framed/deploy/index.js';
import {
  encodeEntryCommitment, keyToSlot,
} from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A framed master whose entry writes a verified mapping, deployed and spent on chain.
 *
 * The entry's sorted-batch operands are not supplied by any SDK: they are derived, in script, from the record
 * declarations the master's own witness block carries, and the existing batch verification then consumes them
 * unchanged. The five derived values are the target's masked slot, the proof record's input offset, the successor
 * the written node carries, the predecessor's recreated output and the created-record count.
 *
 * The whole shipped path runs: the source through `compileString` with the framed convention, the program
 * through `deployMaster`, and the BCH-2026 machine is asked for a verdict on the master's own input. The write is
 * an INSERT, so the segment declares the head sentinel as the predecessor (rewritten in place) and the created
 * node as a trailing output. A control that declares no records is refused, and one that writes a different value
 * than the code computed is refused.
 */

const CATEGORY = seededCategory('mapping write framed');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** Where the written key's value lands: the CREATED node, and the head sentinel recreated beside it. */
const TO = new Uint8Array(20).fill(0x33);
const AMOUNT = 42;
const VALUE_TAIL = new Uint8Array([AMOUNT]);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Balances {'
  + '   mapping(address => uint) balances;'
  + '   function set(address to, uint amount) {'
  + '     balances[to] = amount;'
  + '   }'
  + ' }';

const MASTER_INDEX = 0;
const USER_INDEX = 1;
/** The head sentinel's input and recreated output share one index; the record is kept in place. */
const PRED_INDEX = 2;
/** The created node's output index, which the compiler's block layout fixes at the entry slot's offset. */
const NODE_INDEX = 1;

const artifact = compileString(SOURCE, { composition: 'framed' });
const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
verifyMasterDeployment(deployed, artifact, CATEGORY, VALIDATOR_PROGRAM);
const masterLock = encodeLockingBytecodeP2sh32(hash256(deployed.script));
const entryLock = scriptToLockingBytecode(
  buildEntryNftCovenantScript(
    CATEGORY,
    computeCollectionHash(artifact.stateLayout!.collections![0]!.signature),
  ),
  'p2sh32',
);

const SLOT = keyToSlot(TO);
/** The head sentinel's slot: the all-zero slot a sorted list opens with. */
const ZERO_SLOT = new Uint8Array(32);
/** The head sentinel the transaction spends: slot 0, successor 0, no value. */
const HEAD_BEFORE = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);
/** The head sentinel relinked to the written key. */
const HEAD_AFTER = encodeEntryCommitment(ZERO_SLOT, SLOT);
/** The created node: the written key, the successor it takes over (the head's old `+inf`) and the value. */
const NODE_COMMITMENT = encodeEntryCommitment(SLOT, ZERO_SLOT, VALUE_TAIL);
const EMPTY = new Uint8Array(0);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(
  capability: 'minting' | 'mutable',
  commitmentBytes: Uint8Array,
): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment: commitmentBytes } };
}

const SEGMENT: RecordEntry[] = [
  { in: PRED_INDEX, out: PRED_INDEX, viewIn: HEAD_BEFORE, viewOut: HEAD_AFTER },
  { in: 0xffff, out: NODE_INDEX, viewIn: EMPTY, viewOut: NODE_COMMITMENT },
];

interface SpendOptions {
  /** The records the first (only) segment declares; the write's insert declaration by default. */
  readonly records?: RecordEntry[];
  /** The commitment the created node's output carries; the planned one by default. */
  readonly nodeOutputCommitment?: Uint8Array;
}

/** Builds the master, the sentinel it rewrites and the user's input, and evaluates the master's own input. */
function evaluate(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const records = options.records ?? SEGMENT;
  const nodeOutputCommitment = options.nodeOutputCommitment ?? NODE_COMMITMENT;
  const block: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: deployed.address,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [records],
    events: [],
    sends: [],
  };

  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    // The function's arguments are the pushes between the block and the redeem script, deepest parameter first:
    // `amount` is declared after `to`, so it is pushed first and `to` sits on top where the body reads it.
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(VALUE_TAIL),
      ...encodeDataPush(TO),
      ...encodeDataPush(deployed.script),
    ]),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const predInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(5),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };

  const masterOutput = {
    lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY),
  };
  const nodeOutput = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', nodeOutputCommitment),
  };
  const predOutput = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', HEAD_AFTER),
  };

  const transaction: VmTransaction = {
    version: 2,
    inputs: [masterInput, userInput, predInput],
    outputs: [masterOutput, nodeOutput, predOutput],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', HEAD_BEFORE) },
  ];

  const vm = compositionMachine(true);
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

/** The node an update spends: the written key already present, carrying an earlier value. */
const NODE_BEFORE = encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([7]));
/** The node an update writes: the same key and successor, the argument's value. */
const NODE_UPDATE = encodeEntryCommitment(SLOT, ZERO_SLOT, VALUE_TAIL);
/** An update keeps the node in place, so its input and recreated output share the entry slot's index. */
const UPDATE_NODE_INDEX = 2;

/**
 * The UPDATE shape: the key is present, so the segment declares one record and the write rewrites it in place.
 *
 * The master sits at input 1 here, so the entry slot's block offset puts the node at index 2 on both sides; the
 * user's signed input is at 0. The derivation reads a one-record segment as an update, taking the successor from
 * the record's `viewOut` and the direct convention's `-1` for the predecessor output.
 */
function evaluateUpdate(options: {
  readonly nodeOutputCommitment?: Uint8Array;
} = {}): { accepted: boolean; objection?: string } {
  const nodeOutputCommitment = options.nodeOutputCommitment ?? NODE_UPDATE;
  const block: WitnessBlock = {
    kind: 0,
    callerRef: 0,
    originRef: 0,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: deployed.address,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [[{
      in: UPDATE_NODE_INDEX, out: UPDATE_NODE_INDEX, viewIn: NODE_BEFORE, viewOut: nodeOutputCommitment,
    }]],
    events: [],
    sends: [],
  };

  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(VALUE_TAIL),
      ...encodeDataPush(TO),
      ...encodeDataPush(deployed.script),
    ]),
  };
  const nodeInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(5),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };

  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const masterOutput = {
    lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY),
  };
  const nodeOutput = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', nodeOutputCommitment),
  };

  const transaction: VmTransaction = {
    version: 2,
    inputs: [userInput, masterInput, nodeInput],
    outputs: [userOutput, masterOutput, nodeOutput],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', NODE_BEFORE) },
  ];

  const vm = compositionMachine(true);
  const state = vm.evaluate({ inputIndex: 1, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose entry writes a verified mapping', () => {
  it('publishes a framed master that derives the write witness from its own frame', () => {
    expect(artifact.composition?.convention).toBe('framed');
    expect(deployed.script.length).toBeGreaterThan(0);
  });

  it('derives the slot from the runtime key and is accepted by the machine', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('is refused when the segment declares no record at all', () => {
    // The declaration is what the derivation reads; without it there is no operand to hand the verification.
    expect(evaluate({ records: [] }).accepted).toBe(false);
  });

  it('is refused when the created node carries a value the code did not compute', () => {
    // The node is pinned to `slot || next || amount`; a spent value that differs from the argument is refused.
    const tampered = encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([AMOUNT + 1]));
    expect(evaluate({ nodeOutputCommitment: tampered }).accepted).toBe(false);
    expect(evaluate({ nodeOutputCommitment: NODE_COMMITMENT }).accepted).toBe(true);
  });

  it('derives the update shape from a one-record segment and is accepted', () => {
    expect(evaluateUpdate()).toStrictEqual({ accepted: true });
  });

  it('is refused when the updated node carries a value the code did not compute', () => {
    const tampered = encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([AMOUNT + 1]));
    expect(evaluateUpdate({ nodeOutputCommitment: tampered }).accepted).toBe(false);
    expect(evaluateUpdate({ nodeOutputCommitment: NODE_UPDATE }).accepted).toBe(true);
  });

  it('refuses an entry whose mapping key the body does not hold where the derivation runs', () => {
    // A key read from state after an arm that may rewrite it is no one value the derivation can hash where the body
    // begins: the frame's record holds the value the arm started from, and no straight line names the other. The
    // shape is left refused rather than derived approximately; `key-forms-write.test.ts` runs the admitted sender,
    // expression and record keys through the machine.
    const stateKey = 'pragma solidcash ^0.14.0;'
      + ' contract ComputedKey {'
      + '   address owner;'
      + '   mapping(address => uint) balances;'
      + '   function set(uint amount, bool move) {'
      + '     if (move) { this.owner = msg.sender; }'
      + '     balances[this.owner] = amount;'
      + '   }'
      + ' }';
    expect(refusalMessageOf(stateKey)).toContain("reads the state value 'owner' after the body writes it");
    // The one-target shape compiles, so the refusal is the state key and nothing else.
    expect(artifact.composition?.convention).toBe('framed');
  });
});
