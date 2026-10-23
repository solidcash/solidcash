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
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A framed master whose entry reads a verified-mapping entry and writes it back.
 *
 * `balances[to] = balances[to] + amount` is one transition on one node: the read takes the value the spent node
 * carries and the write produces the node that value computes to. A framed master takes no SDK batch plan, so
 * the value the read sees has to come from the frame's own declaration of that node, and the same declaration is
 * what the write verification closes against. The whole shipped path runs: the source through `compileString` with
 * the framed convention, the program through `deployMaster`, and the BCH-2026 machine is asked for a verdict on
 * the master's own input.
 *
 * The accept below is what pins the read: the node the machine is shown carries the value the code computes from
 * the spent one, so an accept cannot be reached by reading a default or a value the transaction does not carry.
 */

const CATEGORY = seededCategory('mapping read write framed');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const TO = new Uint8Array(20).fill(0x33);
const OLD_VALUE = 7;
const AMOUNT = 42;
const NEW_VALUE = OLD_VALUE + AMOUNT;
/** A `uint` value's tail in a node commitment is its minimal pushdata encoding. */
const OLD_TAIL = new Uint8Array([OLD_VALUE]);
const NEW_TAIL = new Uint8Array([NEW_VALUE]);
const EMPTY = new Uint8Array(0);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Balances {'
  + '   mapping(address => uint) balances;'
  + '   function add(address to, uint amount) {'
  + '     balances[to] = balances[to] + amount;'
  + '   }'
  + ' }';

/** A second entry point, so the master dispatches and the entry is reached by its own selector. */
const TWO_ENTRY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Balances2 {'
  + '   mapping(address => uint) balances;'
  + '   function add(address to, uint amount) { balances[to] = balances[to] + amount; }'
  + '   function set(address to, uint amount) { balances[to] = amount; }'
  + ' }';

const MASTER_INDEX = 1;
const USER_INDEX = 0;
/** The target's node sits at the block layout's first state offset, kept in place by the write. */
const NODE_INDEX = MASTER_INDEX + 1;

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
const ZERO_SLOT = new Uint8Array(32);
/** The one node of the list: the target's slot, the `+inf` successor, and the value the read starts from. */
const NODE_BEFORE = encodeEntryCommitment(SLOT, ZERO_SLOT, OLD_TAIL);
const NODE_AFTER = encodeEntryCommitment(SLOT, ZERO_SLOT, NEW_TAIL);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(capability: 'minting' | 'mutable', commitmentBytes: Uint8Array): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment: commitmentBytes } };
}

/** The read and the write are one transition, so the segment declares the node kept in place. */
const SEGMENT: RecordEntry[] = [
  { in: NODE_INDEX, out: NODE_INDEX, viewIn: NODE_BEFORE, viewOut: NODE_AFTER },
];

interface SpendOptions {
  /** The records the first (only) segment declares; the target's one record by default. */
  readonly records?: RecordEntry[];
  /** The commitment the node's output carries; the one the code computes by default. */
  readonly nodeOutputCommitment?: Uint8Array;
  /** The commitment the node's input carries; the node the code read by default. */
  readonly nodeInputCommitment?: Uint8Array;
}

/** Builds the master, the node it reads and rewrites, and the user's input, and asks the machine. */
function evaluate(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const records = options.records ?? SEGMENT;
  const nodeOutputCommitment = options.nodeOutputCommitment ?? NODE_AFTER;
  const nodeInputCommitment = options.nodeInputCommitment ?? NODE_BEFORE;
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
    // Deepest parameter first: `amount` is declared last, then `to` on top where the body reads it.
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(new Uint8Array([AMOUNT])),
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
  const nodeInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(5),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };

  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const masterOutput = { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) };
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
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', nodeInputCommitment) },
  ];

  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose entry reads and rewrites one mapping entry', () => {
  it('publishes a framed master with the entry point it was asked for', () => {
    expect(artifact.composition?.convention).toBe('framed');
    expect(deployed.script.length).toBeGreaterThan(0);
    const declared = artifact.abi.find((entry) => entry.name === 'add');
    expect(declared?.inputs?.map((input) => input.name)).toStrictEqual(['to', 'amount']);
  });

  it('derives the target from its own frame and is accepted by the machine', () => {
    // The node the machine is shown carries `old + amount`, so the accept is only reachable by reading the value
    // the transaction spends.
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('refuses a node output carrying a value the read did not compute', () => {
    expect(evaluate({
      nodeOutputCommitment: encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([NEW_VALUE + 1])),
    }).accepted).toBe(false);
    // The control beside it: the value the code computes is accepted, so the refusal above is that difference.
    expect(evaluate({ nodeOutputCommitment: NODE_AFTER }).accepted).toBe(true);
  });

  it('refuses a value that was read from a node the transaction does not spend', () => {
    // The declaration says the read started from `7`; the transaction spends a node carrying `5`. The read's value
    // and the spent commitment disagree, so the transition the frame declares is not the one that ran.
    expect(evaluate({ nodeInputCommitment: encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([5])) }).accepted)
      .toBe(false);
  });

  // A segment that declares no record is refused in `mapping-write.test.ts`; the read does not reach that check.
  it('serves a read of one entry beside a write of another', () => {
    // The read's entry is not a target of the batch: the frame declares its node kept ahead of the batch's groups,
    // which fixes the value it saw.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Move {'
      + '   mapping(address => uint) balances;'
      + '   function move(address to, uint amount) {'
      + '     uint mine = balances[msg.sender];'
      + '     balances[to] = mine + amount;'
      + '   }'
      + ' }';
    expect(refusalMessageOf(source)).toBe('');
  });

  it('admits the read/write entry beside other entry points of the same master', () => {
    // The same admission holds when the program dispatches over several entries.
    const two = compileString(TWO_ENTRY_SOURCE, { composition: 'framed' });
    expect(two.composition?.convention).toBe('framed');
    expect(two.abi.filter((entry) => entry.inputs.length === 2).map((entry) => entry.name).sort())
      .toStrictEqual(['add', 'set']);
  });
});

/**
 * The same read against an entry that does not exist yet.
 *
 * `balances[to] = balances[to] + amount` on a key no node holds reads the absent entry's default and writes the
 * created node, so the value it lands on is the amount alone. The frame is the insert's: the head sentinel
 * relinked in place, then the created node. A read of an absent entry is the case a minting entry point takes, and
 * the accept below is only reachable when the value the read saw was the default.
 */
const INSERT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Fresh {'
  + '   mapping(address => uint) balances;'
  + '   function add(address to, uint amount) {'
  + '     balances[to] = balances[to] + amount;'
  + '   }'
  + ' }';

const INSERT_MASTER_INDEX = 0;
const INSERT_USER_INDEX = 1;
/** The head sentinel the insert rewrites, kept in place beside the node it creates. */
const SENTINEL_INDEX = 2;
/** The created node's output index, which the entry slot's block offset fixes. */
const CREATED_INDEX = 1;

const insertArtifact = compileString(INSERT_SOURCE, { composition: 'framed' });
const insertDeployed = deployMaster(insertArtifact, CATEGORY, VALIDATOR_PROGRAM);
const insertMasterLock = encodeLockingBytecodeP2sh32(hash256(insertDeployed.script));
const insertEntryLock = scriptToLockingBytecode(
  buildEntryNftCovenantScript(
    CATEGORY,
    computeCollectionHash(insertArtifact.stateLayout!.collections![0]!.signature),
  ),
  'p2sh32',
);
const SENTINEL_BEFORE = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);
const SENTINEL_AFTER = encodeEntryCommitment(ZERO_SLOT, SLOT);
/** An absent entry reads as the default, so the created node carries the amount and nothing else. */
const CREATED_NODE = encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([AMOUNT]));

const INSERT_SEGMENT: RecordEntry[] = [
  { in: SENTINEL_INDEX, out: SENTINEL_INDEX, viewIn: SENTINEL_BEFORE, viewOut: SENTINEL_AFTER },
  { in: 0xffff, out: CREATED_INDEX, viewIn: EMPTY, viewOut: CREATED_NODE },
];

/** Builds the master, the sentinel it rewrites and the user's input, and evaluates the master's own input. */
function evaluateInsert(options: { readonly createdCommitment?: Uint8Array } = {}): {
  accepted: boolean;
  objection?: string;
} {
  const block: WitnessBlock = {
    kind: 0,
    callerRef: INSERT_USER_INDEX,
    originRef: INSERT_USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: insertDeployed.address,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [INSERT_SEGMENT],
    events: [],
    sends: [],
  };
  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(new Uint8Array([AMOUNT])),
      ...encodeDataPush(TO),
      ...encodeDataPush(insertDeployed.script),
    ]),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const sentinelInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(5),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  const masterOutput = {
    lockingBytecode: insertMasterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY),
  };
  const createdOutput = {
    lockingBytecode: insertEntryLock,
    valueSatoshis: 20_000n,
    token: token('mutable', options.createdCommitment ?? CREATED_NODE),
  };
  const sentinelOutput = {
    lockingBytecode: insertEntryLock, valueSatoshis: 20_000n, token: token('mutable', SENTINEL_AFTER),
  };
  const transaction: VmTransaction = {
    version: 2,
    inputs: [masterInput, userInput, sentinelInput],
    outputs: [masterOutput, createdOutput, sentinelOutput],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: insertMasterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: insertEntryLock, valueSatoshis: 20_000n, token: token('mutable', SENTINEL_BEFORE) },
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: INSERT_MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('the same read against an entry the list does not hold', () => {
  it('is accepted with the created node carrying the default the read saw', () => {
    expect(evaluateInsert()).toStrictEqual({ accepted: true });
  });

  it('refuses a created node carrying a value the read did not produce', () => {
    // The default is zero, so `0 + amount` is the only value this transition can land on.
    expect(evaluateInsert({ createdCommitment: encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([AMOUNT + 1])) })
      .accepted).toBe(false);
    expect(evaluateInsert({ createdCommitment: CREATED_NODE }).accepted).toBe(true);
  });
});
