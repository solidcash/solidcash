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
import { encodeEntryCommitment, keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A framed master whose entry writes a nested mapping, keyed by two values.
 *
 * `allowances[owner][spender] = amount` names one node under a composite slot: the slot is the masked hash of the
 * per-key hashes concatenated, which is the value the body's own key hash computes and the SDK's `keyToSlotMulti`
 * derives. The derivation is what this file drives — the target's slot has to be computed in script from the two
 * keys the body holds, and the record group the frame declares is the one node that slot names.
 *
 * The shipped path runs whole: the source through `compileString` with the framed convention, the program through
 * `deployMaster`, and the BCH-2026 machine is asked for a verdict on the master's own input. The controls below
 * pin the order the two keys hash in, the value the node carries, and the group the segment declares.
 */

const CATEGORY = seededCategory('composite key write framed');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** The two keys, in the order the write names them: the outer key first. */
const OWNER = new Uint8Array(20).fill(0x33);
const SPENDER = new Uint8Array(20).fill(0x44);
const AMOUNT = 42;
const VALUE_TAIL = new Uint8Array([AMOUNT]);
const EMPTY = new Uint8Array(0);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Allowances {'
  + '   mapping(address => mapping(address => uint)) allowances;'
  + '   function approve(address owner, address spender, uint amount) {'
  + '     allowances[owner][spender] = amount;'
  + '   }'
  + ' }';

/** The same composite target, written from the value it holds: the read has to name the same node. */
const READ_WRITE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Increase {'
  + '   mapping(address => mapping(address => uint)) allowances;'
  + '   function bump(address owner, address spender, uint amount) {'
  + '     allowances[owner][spender] = allowances[owner][spender] + amount;'
  + '   }'
  + ' }';

const MASTER_INDEX = 0;
const USER_INDEX = 1;
/** The head sentinel the insert relinks, kept in place beside the node it creates. */
const SENTINEL_INDEX = 2;
/** The created node's output index, which the entry slot's block offset fixes. */
const CREATED_INDEX = MASTER_INDEX + 1;

const artifact = compileString(SOURCE, { composition: 'framed' });
const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
verifyMasterDeployment(deployed, artifact, CATEGORY, VALIDATOR_PROGRAM);
const masterLock = encodeLockingBytecodeP2sh32(hash256(deployed.script));

/** The collection the nested mapping belongs to: one covenant address for both key levels. */
function entryLockOf(compiled: typeof artifact): Uint8Array {
  return scriptToLockingBytecode(
    buildEntryNftCovenantScript(
      CATEGORY,
      computeCollectionHash(compiled.stateLayout!.collections![0]!.signature),
    ),
    'p2sh32',
  );
}
const entryLock = entryLockOf(artifact);

const SLOT = keyToSlotMulti([OWNER, SPENDER]);
/** The same pair in the other order: a different slot, which no record of this write names. */
const SWAPPED_SLOT = keyToSlotMulti([SPENDER, OWNER]);
const ZERO_SLOT = new Uint8Array(32);
const SENTINEL_BEFORE = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);
const SENTINEL_AFTER = encodeEntryCommitment(ZERO_SLOT, SLOT);
const CREATED_NODE = encodeEntryCommitment(SLOT, ZERO_SLOT, VALUE_TAIL);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(capability: 'minting' | 'mutable', commitmentBytes: Uint8Array): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment: commitmentBytes } };
}

/** The insert's declaration: the relinked sentinel, then the created node. */
function insertRecords(): RecordEntry[] {
  return [
    { in: SENTINEL_INDEX, out: SENTINEL_INDEX, viewIn: SENTINEL_BEFORE, viewOut: SENTINEL_AFTER },
    { in: 0xffff, out: CREATED_INDEX, viewIn: EMPTY, viewOut: CREATED_NODE },
  ];
}

interface SpendOptions {
  readonly records?: RecordEntry[];
  readonly createdCommitment?: Uint8Array;
  readonly lockingBytecode?: (args: { readonly master: Uint8Array }) => Uint8Array;
}

/** Builds the master, the sentinel it rewrites and the user's input, and evaluates the master's own input. */
function evaluate(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
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
    segments: [options.records ?? insertRecords()],
    events: [],
    sends: [],
  };
  // The deep frame's pushes, deepest parameter first: `amount`, then the inner key `spender`, then the outer key
  // `owner` on top, which is the order the body reads its parameters in.
  const args = new Uint8Array([
    ...encodeDataPush(new Uint8Array([AMOUNT])),
    ...encodeDataPush(SPENDER),
    ...encodeDataPush(OWNER),
  ]);
  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: options.lockingBytecode === undefined
      ? new Uint8Array([...encodeDataPush(encodeWitnessBlock(block)), ...args, ...encodeDataPush(deployed.script)])
      : options.lockingBytecode({ master: deployed.script }),
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
  const masterOutput = { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) };
  const createdOutput = {
    lockingBytecode: entryLock,
    valueSatoshis: 20_000n,
    token: token('mutable', options.createdCommitment ?? CREATED_NODE),
  };
  const sentinelOutput = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', SENTINEL_AFTER),
  };
  const transaction: VmTransaction = {
    version: 2,
    inputs: [masterInput, userInput, sentinelInput],
    outputs: [masterOutput, createdOutput, sentinelOutput],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', SENTINEL_BEFORE) },
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose entry writes a two-key mapping target', () => {
  it('publishes a framed master carrying both keys as parameters', () => {
    expect(artifact.composition?.convention).toBe('framed');
    const declared = artifact.abi.find((entry) => entry.name === 'approve');
    expect(declared?.inputs?.map((input) => input.name)).toStrictEqual(['owner', 'spender', 'amount']);
  });

  it('derives the composite slot from both keys and is accepted by the machine', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('refuses a node whose slot hashes the keys in the other order', () => {
    // The slot is one value of the pair, not of the set: swapping the keys hashes to a different node, so the
    // group the segment declares names no record the derivation's slot reads.
    expect(evaluate({
      createdCommitment: encodeEntryCommitment(SWAPPED_SLOT, ZERO_SLOT, VALUE_TAIL),
    }).accepted).toBe(false);
    // The control beside it: the slot the keys hash to in source order is the one accepted.
    expect(evaluate({ createdCommitment: CREATED_NODE }).accepted).toBe(true);
  });

  it('refuses a created node carrying another value', () => {
    expect(evaluate({
      createdCommitment: encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([AMOUNT + 1])),
    }).accepted).toBe(false);
  });

  it('refuses a segment that declares no record for the composite target', () => {
    expect(evaluate({ records: [] }).accepted).toBe(false);
    expect(evaluate({ records: [insertRecords()[0]!] }).accepted).toBe(false);
  });

  it('refuses a key the body does not hold where the derivation runs', () => {
    // A key read from state after an arm that may rewrite it is not a value the master holds where it derives the
    // slot, for either key level: the record names the value the arm started from.
    const computed = 'pragma solidcash ^0.14.0;'
      + ' contract ComputedKey {'
      + '   address owner;'
      + '   mapping(address => mapping(address => uint)) allowances;'
      + '   function approve(address spender, uint amount, bool move) {'
      + '     if (move) { this.owner = spender; }'
      + '     allowances[this.owner][spender] = amount;'
      + '   }'
      + ' }';
    expect(refusalMessageOf(computed)).toContain("reads the state value 'owner' after the body writes it");
  });
});

/**
 * One composite target rewritten in place.
 *
 * The layout is the one a root frame needs: the user's signed input first, then the master, then the node the
 * record declares, so an update keeps the node at the entry slot's block offset past the master.
 */
const UPDATE_USER_INDEX = 0;
const UPDATE_MASTER_INDEX = 1;
const UPDATE_NODE_INDEX = UPDATE_MASTER_INDEX + 1;

/** Asks the machine about an update of one composite node, with the node's written commitment overrideable. */
function evaluateUpdateOf(options: {
  readonly compiled: ReturnType<typeof compileString>;
  readonly program: Uint8Array;
  readonly lock: Uint8Array;
  readonly entryLock: Uint8Array;
  readonly nodeBefore: Uint8Array;
  readonly nodeAfter: Uint8Array;
  /** The lock the master presents as its own, which the block's `self` has to match. */
  readonly self: Uint8Array;
  readonly nodeOutputCommitment?: Uint8Array;
  readonly args: readonly Uint8Array[];
}): { accepted: boolean; objection?: string } {
  const block: WitnessBlock = {
    kind: 0,
    callerRef: UPDATE_USER_INDEX,
    originRef: UPDATE_USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: options.self,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [[{
      in: UPDATE_NODE_INDEX, out: UPDATE_NODE_INDEX, viewIn: options.nodeBefore, viewOut: options.nodeAfter,
    }]],
    events: [],
    sends: [],
  };
  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...options.args.flatMap((arg) => [...encodeDataPush(arg)]),
      ...encodeDataPush(options.program),
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
  const masterOutput = {
    lockingBytecode: options.lock, valueSatoshis: 20_000n, token: token('minting', EMPTY),
  };
  const nodeOutput = {
    lockingBytecode: options.entryLock,
    valueSatoshis: 20_000n,
    token: token('mutable', options.nodeOutputCommitment ?? options.nodeAfter),
  };
  const transaction: VmTransaction = {
    version: 2,
    inputs: [userInput, masterInput, nodeInput],
    outputs: [{ lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, masterOutput, nodeOutput],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: options.lock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: options.entryLock, valueSatoshis: 20_000n, token: token('mutable', options.nodeBefore) },
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: UPDATE_MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('the composite target rewritten in place by a plain write', () => {
  const OLD_TAIL = new Uint8Array([7]);
  const NODE_BEFORE = encodeEntryCommitment(SLOT, ZERO_SLOT, OLD_TAIL);
  const NODE_AFTER = encodeEntryCommitment(SLOT, ZERO_SLOT, VALUE_TAIL);

  it('is accepted with the node carrying the argument', () => {
    expect(evaluateUpdateOf({
      compiled: artifact, program: deployed.script, lock: masterLock, entryLock, self: deployed.address,
      nodeBefore: NODE_BEFORE, nodeAfter: NODE_AFTER,
      args: [new Uint8Array([AMOUNT]), SPENDER, OWNER],
    })).toStrictEqual({ accepted: true });
  });

  it('refuses a node carrying a value the write did not compute', () => {
    expect(evaluateUpdateOf({
      compiled: artifact, program: deployed.script, lock: masterLock, entryLock, self: deployed.address,
      nodeBefore: NODE_BEFORE, nodeAfter: NODE_AFTER,
      args: [new Uint8Array([AMOUNT]), SPENDER, OWNER],
      nodeOutputCommitment: encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([AMOUNT + 1])),
    }).accepted).toBe(false);
  });
});

describe('the composite target written from the value it holds', () => {
  const readWrite = compileString(READ_WRITE_SOURCE, { composition: 'framed' });
  const readWriteDeployed = deployMaster(readWrite, CATEGORY, VALIDATOR_PROGRAM);
  const readWriteLock = encodeLockingBytecodeP2sh32(hash256(readWriteDeployed.script));
  const readWriteEntryLock = entryLockOf(readWrite);
  const OLD_TAIL = new Uint8Array([7]);
  const NEW_TAIL = new Uint8Array([OLD_TAIL[0]! + AMOUNT]);
  const NODE_BEFORE = encodeEntryCommitment(SLOT, ZERO_SLOT, OLD_TAIL);
  const NODE_AFTER = encodeEntryCommitment(SLOT, ZERO_SLOT, NEW_TAIL);

  it('is accepted with the node carrying the value the composite read produced', () => {
    expect(evaluateUpdateOf({
      compiled: readWrite, program: readWriteDeployed.script, lock: readWriteLock,
      entryLock: readWriteEntryLock, self: readWriteDeployed.address,
      nodeBefore: NODE_BEFORE, nodeAfter: NODE_AFTER,
      args: [new Uint8Array([AMOUNT]), SPENDER, OWNER],
    })).toStrictEqual({ accepted: true });
  });

  it('refuses a node carrying a value the read did not produce', () => {
    // The read of the composite target starts from the value the node carries, so `7 + amount` is the only value
    // this transition can land on.
    expect(evaluateUpdateOf({
      compiled: readWrite, program: readWriteDeployed.script, lock: readWriteLock,
      entryLock: readWriteEntryLock, self: readWriteDeployed.address,
      nodeBefore: NODE_BEFORE, nodeAfter: NODE_AFTER,
      args: [new Uint8Array([AMOUNT]), SPENDER, OWNER],
      nodeOutputCommitment: encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([NEW_TAIL[0]! + 1])),
    }).accepted).toBe(false);
  });
});
