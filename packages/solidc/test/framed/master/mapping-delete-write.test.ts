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
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A framed master whose entry removes a mapping entry, deployed and spent on chain.
 *
 * A sorted mapping's node is never spliced out by a source-level `delete`: the removal is the upsert of the value
 * type's default, so the published access is a write and the node stays in the list carrying the empty tail. The
 * entry's own code therefore closes against a written node, not a removed one, and the frame's record group is the
 * same write's: the node kept in place for an update, the relinked predecessor and the created node for an insert.
 * The whole shipped path runs — the source through `compileString` with the framed convention, the program
 * through `deployMaster`, and the BCH-2026 machine is asked for a verdict on the master's own input — in both the
 * present and the absent shape. A record that declares the node removed, as a splice would, is refused: the
 * derivation takes its successor from the written node and a removal's node carries no written view.
 */

const CATEGORY = seededCategory('mapping delete framed');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const TO = new Uint8Array(20).fill(0x33);
const OLD_VALUE = 7;
const EMPTY = new Uint8Array(0);

/** The removal the master is asked to perform. */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Balances {'
  + '   mapping(address => uint) balances;'
  + '   function clear(address to) {'
  + '     delete balances[to];'
  + '   }'
  + ' }';

/** The same entry writing the value type's default by hand, which the removal compiles to. */
const DEFAULT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Balances {'
  + '   mapping(address => uint) balances;'
  + '   function clear(address to) {'
  + '     balances[to] = uint(0);'
  + '   }'
  + ' }';

const artifact = compileString(SOURCE, { composition: 'framed' });
const defaultArtifact = compileString(DEFAULT_SOURCE, { composition: 'framed' });
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

const ZERO_SLOT = new Uint8Array(32);
const SLOT = keyToSlot(TO);
/** The default value's tail: `uint(0)` is the empty script number, so the node is its 64-byte slot//next header. */
const NODE_DEFAULT = encodeEntryCommitment(SLOT, ZERO_SLOT);
const NODE_BEFORE = encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([OLD_VALUE]));
const HEAD_BEFORE = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);
const HEAD_AFTER = encodeEntryCommitment(ZERO_SLOT, SLOT);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(capability: 'minting' | 'mutable', commitmentBytes: Uint8Array): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment: commitmentBytes } };
}

interface Input {
  outpointIndex: number; outpointTransactionHash: Uint8Array;
  sequenceNumber: number; unlockingBytecode: Uint8Array;
}
interface SourceOutput { lockingBytecode: Uint8Array; valueSatoshis: bigint; token?: VmOutput['token']; }

/** A state or filler input whose unlocking bytecode the master does not read. */
function plainInput(fill: number): Input {
  return {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(fill),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
}

/** The user's signed input, which a root frame reads the transaction's sender from. */
function callerInput(fill: number): Input {
  return {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(fill),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
}

/** The master's input, with its argument pushes and its witness block. */
function masterInput(block: WitnessBlock): Input {
  return {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    // Deepest parameter first: `to` is the only one, and it sits on top where the body reads it.
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(TO),
      ...encodeDataPush(deployed.script),
    ]),
  };
}

/** The verdict the machine gives the master's input. */
function verdict(master: number, sourceOutputs: SourceOutput[], transaction: VmTransaction): {
  accepted: boolean; objection?: string;
} {
  const vm = compositionMachine(true);
  const state = vm.evaluate({
    inputIndex: master,
    sourceOutputs: sourceOutputs as unknown as VmProgram['sourceOutputs'],
    transaction,
  });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

const USER_INDEX = 0;
const MASTER_INDEX = 1;
/** The target's node sits at the block layout's first state offset, spent and recreated in place. */
const NODE_INDEX = MASTER_INDEX + 1;

/** The UPDATE declaration: the target present, rewritten in place to the value type's default. */
const UPDATE_RECORDS: RecordEntry[] = [
  { in: NODE_INDEX, out: NODE_INDEX, viewIn: NODE_BEFORE, viewOut: NODE_DEFAULT },
];

/**
 * Builds the master, the target node it rewrites and the user's input, and evaluates the master's own input.
 *
 * The user's signed input is first and the master second, so the block layout puts the target at index 2 on both
 * sides; the node's output carries the default the entry's own write computed.
 */
function evaluateUpdate(records: RecordEntry[] = UPDATE_RECORDS): { accepted: boolean; objection?: string } {
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
  const transaction: VmTransaction = {
    version: 2,
    inputs: [callerInput(4), masterInput(block), plainInput(5)],
    outputs: [
      { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
      { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
      { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', NODE_DEFAULT) },
    ],
    locktime: 0,
  };
  const sourceOutputs: SourceOutput[] = [
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', NODE_BEFORE) },
  ];
  return verdict(MASTER_INDEX, sourceOutputs, transaction);
}

const INSERT_MASTER_INDEX = 0;
const INSERT_USER_INDEX = 1;
/** The head sentinel the insert rewrites, kept in place beside the node it creates. */
const SENTINEL_INDEX = 2;
/** The created node's output index, which the entry slot's block offset fixes. */
const CREATED_INDEX = 1;

/** The INSERT declaration: the key absent, so the sentinel is relinked and the node created at the default. */
const INSERT_RECORDS: RecordEntry[] = [
  { in: SENTINEL_INDEX, out: SENTINEL_INDEX, viewIn: HEAD_BEFORE, viewOut: HEAD_AFTER },
  { in: 0xffff, out: CREATED_INDEX, viewIn: EMPTY, viewOut: NODE_DEFAULT },
];

/** Builds the master, the sentinel it relinks and the user's input, and evaluates the master's own input. */
function evaluateInsert(records: RecordEntry[] = INSERT_RECORDS): { accepted: boolean; objection?: string } {
  const block: WitnessBlock = {
    kind: 0,
    callerRef: INSERT_USER_INDEX,
    originRef: INSERT_USER_INDEX,
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
  const transaction: VmTransaction = {
    version: 2,
    inputs: [masterInput(block), callerInput(4), plainInput(5)],
    outputs: [
      { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
      { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', NODE_DEFAULT) },
      { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', HEAD_AFTER) },
    ],
    locktime: 0,
  };
  const sourceOutputs: SourceOutput[] = [
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token('mutable', HEAD_BEFORE) },
  ];
  return verdict(INSERT_MASTER_INDEX, sourceOutputs, transaction);
}

/** The refusal the machine gives a declaration whose verification does not close, read off its own state. */
const OP_VERIFY_REFUSAL = { accepted: false, objection: 'Program failed an OP_VERIFY operation.' };

describe('a framed master whose entry removes a mapping entry', () => {
  it('publishes the removal as the default write, under the same layout and ABI as writing the default', () => {
    // The sorted list keeps the node and writes the default tail, so the published access is a write rather than a
    // delete, and the frame's slot offsets and stripped operands are the ones the default write publishes.
    expect(artifact.composition?.convention).toBe('framed');
    const entry = artifact.abi.find((candidate) => candidate.name === 'clear');
    expect(entry?.entryAccesses?.map((access) => access.operations)).toStrictEqual([['write']]);
    expect(entry?.inputs?.map((input) => input.name)).toStrictEqual(['to']);
    expect(artifact.stateLayout).toStrictEqual(defaultArtifact.stateLayout);
    expect(artifact.abi).toStrictEqual(defaultArtifact.abi);
  });

  it('rewrites the present node to the default and is accepted by the machine', () => {
    expect(evaluateUpdate()).toStrictEqual({ accepted: true });
  });

  it('creates the absent node at the default and is accepted by the machine', () => {
    expect(evaluateInsert()).toStrictEqual({ accepted: true });
  });

  it('refuses a segment that declares the target removed rather than written', () => {
    // A removal's node is declared with no output and the empty create view, the shape a splice writes for it. The
    // derivation reads a successor from the written node instead, so the removal declaration never closes.
    expect(evaluateUpdate([
      { in: NODE_INDEX, out: 0xffff, viewIn: NODE_BEFORE, viewOut: EMPTY },
    ])).toStrictEqual(OP_VERIFY_REFUSAL);
    expect(evaluateUpdate()).toStrictEqual({ accepted: true });
  });

  it('refuses a written node declared with the empty view a removal carries', () => {
    // Keeping the node in place under a removal's empty view is the same mismatch with the successor read.
    expect(evaluateUpdate([
      { in: NODE_INDEX, out: NODE_INDEX, viewIn: NODE_BEFORE, viewOut: EMPTY },
    ])).toStrictEqual(OP_VERIFY_REFUSAL);
    expect(evaluateUpdate()).toStrictEqual({ accepted: true });
  });
});
