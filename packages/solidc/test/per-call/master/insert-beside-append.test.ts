import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256, hexToBin,
} from '@bitauth/libauth';
import {
  buildChunkCommitment, buildEntryNftCovenantScript, buildPushdataCommitment, computeCollectionHash,
  dynamicChunkSignature, encodePushdataValue, encodeWitnessBlock, scriptToBytecode,
  type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { deployMaster, verifyMasterDeployment } from '../../../../solidcash/src/per-call/deploy/index.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A per-call master whose entry inserts a mapping target the live list does not hold, beside a dynamic append.
 *
 * The segment's declared record list is the frame's own state record, then the batch's group, then the dynamic
 * value's run. An insert's group is two records — the relinked head sentinel and the created node — where an
 * update's is one. A read-modify-write append consumes the run the deployment already holds before it writes the
 * run it grew, so both the read and the write address the run's own record; a run the deployment holds nothing of
 * exercises only the write.
 */

const CATEGORY = seededCategory('insert beside append');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** The record's lock: the entry only requires the input and the output to agree, so any lock serves. */
const STATE_LOCK = encodeLockingBytecodeP2sh32(hash256(new Uint8Array([9, 9, 9])));
const TO = new Uint8Array(20).fill(0x33);
const IMPLEMENTATION = new Uint8Array(20).fill(0x55);
const AMOUNT = 42;
const VALUE_TAIL = new Uint8Array([AMOUNT]);
const EMPTY = new Uint8Array(0);
const ZERO_SLOT = new Uint8Array(32);

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   address[] public items;'
  + '   mapping(address => uint) public balances;'
  + '   function set(address who, uint amount) { this.balances[who] = amount; this.items.push(msg.sender); }'
  + ' }';

const MASTER_INDEX = 0;
const USER_INDEX = 1;
/** The frame's own state record, kept where the proxy reads it. */
const STATE_INDEX = 2;
/** The head sentinel the insert relinks; kept in place. */
const PRED_INDEX = 3;
/** The dynamic run's chunk, recreated where the deployment holds it. */
const CHUNK_INDEX = 4;
/** The created mapping node, a trailing output past the participant band. */
const CREATED_INDEX = 5;
/** The node an update keeps in place, and the run beside it. */
const UPDATE_NODE_INDEX = 3;
const UPDATE_CHUNK_INDEX = 4;

const artifact = compileString(SOURCE, { composition: 'per-call' });
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
const chunkLock = scriptToLockingBytecode(
  buildEntryNftCovenantScript(
    CATEGORY,
    computeCollectionHash(dynamicChunkSignature('items', 'address[]')),
  ),
  'p2sh32',
);

const SLOT = keyToSlot(TO);
const HEAD_BEFORE = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);
const HEAD_AFTER = encodeEntryCommitment(ZERO_SLOT, SLOT);
const NODE_COMMITMENT = encodeEntryCommitment(SLOT, ZERO_SLOT, VALUE_TAIL);
const NODE_BEFORE = encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([7]));

/** The arrays the entry reads and writes, as the body encodes them. */
const HELD = encodePushdataValue([USER_LOCK], 'address[]', artifact.structs);
const GROWN = encodePushdataValue([USER_LOCK, USER_LOCK], 'address[]', artifact.structs);
const CHUNK_HELD = hexToBin(buildChunkCommitment(0, HELD));
const CHUNK_GROWN = hexToBin(buildChunkCommitment(0, GROWN));

/**
 * The frame's state record: the implementation's lock and the array's A$len header, in the shipped encoding.
 *
 * A dynamic value's header is the byte length of the encoded value, not the packed element width: an `address`
 * element is encoded with its own length prefix, so one element is longer than its twenty raw bytes.
 */
const stateCommitment = (itemsLength: number): Uint8Array => hexToBin(
  buildPushdataCommitment(
    artifact.stateLayout!, { implementation: IMPLEMENTATION, 'items$len': BigInt(itemsLength) }, 0,
  ),
);
const STATE_EMPTY = stateCommitment(0);
const STATE_HELD = stateCommitment(HELD.length);
const STATE_GROWN = stateCommitment(GROWN.length);

const CHUNK_UNLOCKING_BYTECODE = new Uint8Array([0x00, 0x51]);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(
  capability: 'minting' | 'mutable', commitmentBytes: Uint8Array,
): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment: commitmentBytes } };
}

interface Shape {
  /** The state record the frame reads and writes. */
  readonly stateIn: Uint8Array;
  readonly stateOut: Uint8Array;
  /** The run the frame reads and the run it writes. */
  readonly chunkIn: Uint8Array;
  readonly chunkOut: Uint8Array;
  /** True when the frame spends the run the deployment holds, so the read loop runs. */
  readonly holdsRun: boolean;
}

const HELD_RUN: Shape = {
  stateIn: STATE_HELD, stateOut: STATE_GROWN, chunkIn: CHUNK_HELD, chunkOut: CHUNK_GROWN, holdsRun: true,
};
const EMPTY_RUN: Shape = {
  stateIn: STATE_EMPTY, stateOut: STATE_HELD, chunkIn: EMPTY, chunkOut: CHUNK_HELD, holdsRun: false,
};

interface SpendOptions {
  /** The records the first (only) segment declares; the insert declaration for the shape by default. */
  readonly records?: RecordEntry[];
  /** The commitment the created node output carries; the planned one by default. */
  readonly createdCommitment?: Uint8Array;
  /** The commitment the run's chunk output carries; the planned one by default. */
  readonly chunkCommitment?: Uint8Array;
}

/** Builds the master, the state record, the sentinel and the run, and evaluates the master's own input. */
function evaluate(shape: Shape, options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const records = options.records ?? [
    { in: STATE_INDEX, out: STATE_INDEX, viewIn: shape.stateIn, viewOut: shape.stateOut },
    { in: PRED_INDEX, out: PRED_INDEX, viewIn: HEAD_BEFORE, viewOut: HEAD_AFTER },
    { in: 0xffff, out: CREATED_INDEX, viewIn: EMPTY, viewOut: NODE_COMMITMENT },
    { in: CHUNK_INDEX, out: CHUNK_INDEX, viewIn: shape.chunkIn, viewOut: shape.chunkOut },
  ];
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

  const plain = (hashFill: number): VmTransaction['inputs'][number] => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(hashFill),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  });

  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    // `amount` is declared after `who`, so it is pushed first and `who` sits on top where the body reads it.
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
  const runInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(6),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: CHUNK_UNLOCKING_BYTECODE,
  };

  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const masterOutput = {
    lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY),
  };
  const stateOutput = {
    lockingBytecode: STATE_LOCK, valueSatoshis: 20_000n, token: token('mutable', shape.stateOut),
  };
  const predOutput = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', HEAD_AFTER),
  };
  const createdOutput = {
    lockingBytecode: entryLock,
    valueSatoshis: 20_000n,
    token: token('mutable', options.createdCommitment ?? NODE_COMMITMENT),
  };
  const runOutput = {
    lockingBytecode: chunkLock,
    valueSatoshis: 20_000n,
    token: token('mutable', options.chunkCommitment ?? shape.chunkOut),
  };

  const inputs: VmTransaction['inputs'] = [masterInput, userInput, plain(2), plain(3)];
  if (shape.holdsRun) inputs.push(runInput);

  const transaction: VmTransaction = {
    version: 2,
    inputs,
    outputs:
      [masterOutput, userOutput, stateOutput, predOutput, runOutput, createdOutput],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: STATE_LOCK, valueSatoshis: 20_000n, token: token('mutable', shape.stateIn) },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', HEAD_BEFORE) },
    {
      lockingBytecode: chunkLock,
      valueSatoshis: 20_000n,
      token: token('mutable', shape.holdsRun ? shape.chunkIn : EMPTY),
    },
  ];

  const vm = compositionMachine(true);
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

/** The control: the target the live list holds, so the group is one record and the node is kept in place. */
function evaluateUpdate(): { accepted: boolean; objection?: string } {
  const records: RecordEntry[] = [
    { in: STATE_INDEX, out: STATE_INDEX, viewIn: STATE_HELD, viewOut: STATE_GROWN },
    { in: UPDATE_NODE_INDEX, out: UPDATE_NODE_INDEX, viewIn: NODE_BEFORE, viewOut: NODE_COMMITMENT },
    { in: UPDATE_CHUNK_INDEX, out: UPDATE_CHUNK_INDEX, viewIn: CHUNK_HELD, viewOut: CHUNK_GROWN },
  ];
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
  const plain = (hashFill: number, fill: number): VmTransaction['inputs'][number] => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(hashFill),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([fill])),
  });

  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const masterOutput = {
    lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY),
  };
  const stateOutput = {
    lockingBytecode: STATE_LOCK, valueSatoshis: 20_000n, token: token('mutable', STATE_GROWN),
  };
  const nodeOutput = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', NODE_COMMITMENT),
  };
  const runOutput = {
    lockingBytecode: chunkLock, valueSatoshis: 20_000n, token: token('mutable', CHUNK_GROWN),
  };

  const transaction: VmTransaction = {
    version: 2,
    inputs: [masterInput, userInput, plain(2, 1), plain(3, 1), plain(6, 1)],
    outputs: [masterOutput, userOutput, stateOutput, nodeOutput, runOutput],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: STATE_LOCK, valueSatoshis: 20_000n, token: token('mutable', STATE_HELD) },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', NODE_BEFORE) },
    { lockingBytecode: chunkLock, valueSatoshis: 20_000n, token: token('mutable', CHUNK_HELD) },
  ];

  const vm = compositionMachine(true);
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a per-call master whose entry inserts a mapping target beside a dynamic append', () => {
  it('publishes a per-call master whose layout puts the dynamic run past the batch group', () => {
    expect(artifact.composition?.convention).toBe('per-call');
    expect(scriptToBytecode(deployed.script).length).toBeGreaterThan(0);
  });

  it('settles the insert beside an append that grows a run the deployment holds', () => {
    expect(evaluate(HELD_RUN)).toStrictEqual({ accepted: true });
  });

  it('settles the insert beside an append that creates the run from nothing', () => {
    expect(evaluate(EMPTY_RUN)).toStrictEqual({ accepted: true });
  });

  it('settles the update beside the append, the control the same body already carried', () => {
    expect(evaluateUpdate()).toStrictEqual({ accepted: true });
  });

  it('is refused when the created node carries a value the code did not compute', () => {
    const tampered = encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([AMOUNT + 1]));
    expect(evaluate(HELD_RUN, { createdCommitment: tampered }).accepted).toBe(false);
    expect(evaluate(HELD_RUN, { createdCommitment: NODE_COMMITMENT }).accepted).toBe(true);
  });

  it('is refused when the run carries a commitment the body did not compute', () => {
    expect(evaluate(HELD_RUN, { chunkCommitment: hexToBin(buildChunkCommitment(0, EMPTY)) }).accepted)
      .toBe(false);
    expect(evaluate(HELD_RUN, { chunkCommitment: CHUNK_GROWN }).accepted).toBe(true);
  });
});
