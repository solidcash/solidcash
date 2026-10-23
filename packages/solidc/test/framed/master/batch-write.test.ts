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
import { deployMaster, verifyMasterDeployment } from '../../../../solidcash/src/framed/deploy/index.js';
import {
  bytesToSlotValue, encodeEntryCommitment, keyToSlot,
} from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A framed master whose entry writes two targets of one verified mapping, deployed and spent on chain.
 *
 * The body writes `balances[a]` and `balances[b]` unconditionally, so its batch has two logical targets. A
 * framed master has no SDK batch plan, but its own witness block declares one record group per target in write
 * order. The derivation reads each target's group back, computing the slot in script from the target's key, and
 * leaves the per-target operands the general sorted-batch arm consumes: the slot, the proof input, the successor
 * the written node carries and `-1` for an update, plus the batch's distinct rewritten predecessors. The whole
 * shipped path runs: the source through `compileString` with the framed convention, the program through
 * `deployMaster`, and the BCH-2026 machine is asked for a verdict on the master's own input.
 */

const CATEGORY = seededCategory('batch write framed');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const TO_A = new Uint8Array(20).fill(0x33);
const TO_B = new Uint8Array(20).fill(0x44);
const AMOUNT = 42;
const VALUE_TAIL = new Uint8Array([AMOUNT]);
const EMPTY = new Uint8Array(0);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Balances {'
  + '   mapping(address => uint) balances;'
  + '   function set(address a, address b, uint amount) {'
  + '     balances[a] = amount;'
  + '     balances[b] = amount;'
  + '   }'
  + ' }';

/** The master sits at this input, so the block layout puts slot 0 at +1 and slot 1 at +2. */
const MASTER_INDEX = 1;
const USER_INDEX = 0;
const NODE_A_INDEX = MASTER_INDEX + 1;
const NODE_B_INDEX = MASTER_INDEX + 2;

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

const SLOT_A = keyToSlot(TO_A);
const SLOT_B = keyToSlot(TO_B);
/** The sorted list visits the smaller slot first, so each node carries the other as its successor or the tail. */
const SMALLER_IS_A = bytesToSlotValue(SLOT_A) < bytesToSlotValue(SLOT_B);
const NEXT_A = SMALLER_IS_A ? SLOT_B : new Uint8Array(32);
const NEXT_B = SMALLER_IS_A ? new Uint8Array(32) : SLOT_A;
const OLD_VALUE = new Uint8Array([7]);

const NODE_A_BEFORE = encodeEntryCommitment(SLOT_A, NEXT_A, OLD_VALUE);
const NODE_A_AFTER = encodeEntryCommitment(SLOT_A, NEXT_A, VALUE_TAIL);
const NODE_B_BEFORE = encodeEntryCommitment(SLOT_B, NEXT_B, OLD_VALUE);
const NODE_B_AFTER = encodeEntryCommitment(SLOT_B, NEXT_B, VALUE_TAIL);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(
  capability: 'minting' | 'mutable',
  commitmentBytes: Uint8Array,
): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment: commitmentBytes } };
}

/** The write is an update for each target, so each target's record is one node kept in place. */
function updateRecords(): RecordEntry[] {
  return [
    { in: NODE_A_INDEX, out: NODE_A_INDEX, viewIn: NODE_A_BEFORE, viewOut: NODE_A_AFTER },
    { in: NODE_B_INDEX, out: NODE_B_INDEX, viewIn: NODE_B_BEFORE, viewOut: NODE_B_AFTER },
  ];
}

interface SpendOptions {
  /** The records the first (only) segment declares; both targets' update declarations by default. */
  readonly records?: RecordEntry[];
  /** The commitment node A's output carries; the planned one by default. */
  readonly nodeACommitment?: Uint8Array;
  /** The commitment node B's output carries; the planned one by default. */
  readonly nodeBCommitment?: Uint8Array;
}

/** Builds the master, both node inputs and the user's input, and evaluates the master's own input. */
function evaluate(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const records = options.records ?? updateRecords();
  const nodeACommitment = options.nodeACommitment ?? NODE_A_AFTER;
  const nodeBCommitment = options.nodeBCommitment ?? NODE_B_AFTER;
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
    // Deepest parameter first: `amount` is declared last, then `b`, then `a` on top where the body reads it.
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(VALUE_TAIL),
      ...encodeDataPush(TO_B),
      ...encodeDataPush(TO_A),
      ...encodeDataPush(deployed.script),
    ]),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const nodeAInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(5),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  const nodeBInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(6),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };

  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const masterOutput = {
    lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY),
  };
  const nodeAOutput = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', nodeACommitment),
  };
  const nodeBOutput = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', nodeBCommitment),
  };

  const transaction: VmTransaction = {
    version: 2,
    inputs: [userInput, masterInput, nodeAInput, nodeBInput],
    outputs: [userOutput, masterOutput, nodeAOutput, nodeBOutput],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', NODE_A_BEFORE) },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', NODE_B_BEFORE) },
  ];

  const vm = compositionMachine(true);
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose entry writes two verified-mapping targets', () => {
  it('publishes a framed master that derives every target from its own frame', () => {
    expect(artifact.composition?.convention).toBe('framed');
    expect(deployed.script.length).toBeGreaterThan(0);
    const declared = artifact.abi.find((entry) => entry.name === 'set');
    expect(declared?.inputs?.map((input) => input.name)).toStrictEqual(['a', 'b', 'amount']);
  });

  it('derives both targets and is accepted by the machine', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('is refused when the second target carries a value the code did not compute', () => {
    const tampered = encodeEntryCommitment(SLOT_B, NEXT_B, new Uint8Array([AMOUNT + 1]));
    expect(evaluate({ nodeBCommitment: tampered }).accepted).toBe(false);
    expect(evaluate({ nodeBCommitment: NODE_B_AFTER }).accepted).toBe(true);
  });

  it('is refused when the segment declares only the first target record', () => {
    // The second target has no record to read, so the derivation cannot hand the verification its operands.
    expect(evaluate({ records: [updateRecords()[0]!] }).accepted).toBe(false);
  });
  // A key the body does not hold where the derivation runs is refused in `mapping-write.test.ts`.
});

/** A 32-byte little-endian slot value, for a middle node the test fabricates between two key slots. */
function slotBytes(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let rest = value;
  for (let index = 0; index < 32 && rest > 0n; index += 1) {
    out[index] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

/**
 * The INSERT batch: neither key exists yet, and each splices in through its own predecessor.
 *
 * One key lands between the head sentinel and an existing middle node; the other lands above that node. Each
 * target then declares two records: the relinked predecessor kept in place, then the created node at the target's
 * entry output. The derivation reads each target's group in turn and hands the verification the predecessor's
 * input, the predecessor's recreated output and the successor the created node carries.
 */
const A_KEY = new Uint8Array(20).fill(0x51);
const B_KEY = new Uint8Array(20).fill(0x62);
const SLOT_LOW = keyToSlot(A_KEY);
const SLOT_HIGH = keyToSlot(B_KEY);
const LOWER_KEY = bytesToSlotValue(SLOT_LOW) < bytesToSlotValue(SLOT_HIGH) ? A_KEY : B_KEY;
const UPPER_KEY = LOWER_KEY === A_KEY ? B_KEY : A_KEY;
const LOWER_SLOT = keyToSlot(LOWER_KEY);
const UPPER_SLOT = keyToSlot(UPPER_KEY);
/** The existing middle node sits strictly between the two inserts, so each has a distinct predecessor. */
const MIDDLE_SLOT = slotBytes((bytesToSlotValue(LOWER_SLOT) + bytesToSlotValue(UPPER_SLOT)) / 2n);
const MIDDLE_VALUE = new Uint8Array([9]);
const ZERO_SLOT = new Uint8Array(32);
const HEAD_BEFORE = encodeEntryCommitment(ZERO_SLOT, MIDDLE_SLOT);
const HEAD_AFTER = encodeEntryCommitment(ZERO_SLOT, LOWER_SLOT);
const MIDDLE_BEFORE = encodeEntryCommitment(MIDDLE_SLOT, ZERO_SLOT, MIDDLE_VALUE);
const MIDDLE_AFTER = encodeEntryCommitment(MIDDLE_SLOT, UPPER_SLOT, MIDDLE_VALUE);
const CREATED_LOW = encodeEntryCommitment(LOWER_SLOT, MIDDLE_SLOT, VALUE_TAIL);
const CREATED_HIGH = encodeEntryCommitment(UPPER_SLOT, ZERO_SLOT, VALUE_TAIL);

const HEAD_INDEX = 4;
const MIDDLE_INDEX = 5;
const CREATED_LOW_INDEX = MASTER_INDEX + 1;
const CREATED_HIGH_INDEX = MASTER_INDEX + 2;

/** The target the derivation sees first is the lower slot, because the test pushes the lower key as `a`. */
function insertRecords(): RecordEntry[] {
  return [
    { in: HEAD_INDEX, out: HEAD_INDEX, viewIn: HEAD_BEFORE, viewOut: HEAD_AFTER },
    { in: 0xffff, out: CREATED_LOW_INDEX, viewIn: EMPTY, viewOut: CREATED_LOW },
    { in: MIDDLE_INDEX, out: MIDDLE_INDEX, viewIn: MIDDLE_BEFORE, viewOut: MIDDLE_AFTER },
    { in: 0xffff, out: CREATED_HIGH_INDEX, viewIn: EMPTY, viewOut: CREATED_HIGH },
  ];
}

interface InsertOptions {
  readonly records?: RecordEntry[];
  readonly createdHighCommitment?: Uint8Array;
}

function evaluateInsert(options: InsertOptions = {}): { accepted: boolean; objection?: string } {
  const records = options.records ?? insertRecords();
  const createdHighCommitment = options.createdHighCommitment ?? CREATED_HIGH;
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

  const plain = (hashFill: number, outpointIndex = 0): {
    outpointIndex: number; outpointTransactionHash: Uint8Array;
    sequenceNumber: number; unlockingBytecode: Uint8Array;
  } => ({
    outpointIndex,
    outpointTransactionHash: new Uint8Array(32).fill(hashFill),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  });

  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    // `a` is the lower-slot key and sits on top, then `b`, then `amount`, matching the block layout.
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(VALUE_TAIL),
      ...encodeDataPush(UPPER_KEY),
      ...encodeDataPush(LOWER_KEY),
      ...encodeDataPush(deployed.script),
    ]),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };

  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const masterOutput = {
    lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY),
  };
  const entryOutput = (commitmentBytes: Uint8Array): VmOutput => ({
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', commitmentBytes),
  });

  const transaction: VmTransaction = {
    version: 2,
    inputs: [userInput, masterInput, plain(7, 0), plain(8, 0), plain(9, 0), plain(10, 0)],
    outputs: [
      userOutput,
      masterOutput,
      entryOutput(CREATED_LOW),
      entryOutput(createdHighCommitment),
      entryOutput(HEAD_AFTER),
      entryOutput(MIDDLE_AFTER),
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 20_000n },
    { lockingBytecode: USER_LOCK, valueSatoshis: 20_000n },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', HEAD_BEFORE) },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', MIDDLE_BEFORE) },
  ];

  const vm = compositionMachine(true);
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose entry inserts two verified-mapping targets', () => {
  it('derives each target through its own relinked predecessor and is accepted', () => {
    expect(bytesToSlotValue(LOWER_SLOT) < bytesToSlotValue(MIDDLE_SLOT)).toBe(true);
    expect(bytesToSlotValue(MIDDLE_SLOT) < bytesToSlotValue(UPPER_SLOT)).toBe(true);
    expect(evaluateInsert()).toStrictEqual({ accepted: true });
  });

  it('is refused when the second created node carries a value the code did not compute', () => {
    const tampered = encodeEntryCommitment(UPPER_SLOT, ZERO_SLOT, new Uint8Array([AMOUNT + 1]));
    expect(evaluateInsert({ createdHighCommitment: tampered }).accepted).toBe(false);
    expect(evaluateInsert({ createdHighCommitment: CREATED_HIGH }).accepted).toBe(true);
  });
});
