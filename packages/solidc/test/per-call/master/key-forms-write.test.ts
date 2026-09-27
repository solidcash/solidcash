import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeWitnessBlock, scriptToBytecode,
  type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { deployMaster, verifyMasterDeployment } from '../../../../solidcash/src/per-call/deploy/index.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A per-call master whose entry writes a mapping keyed by a value the frame already holds.
 *
 * Two key forms the direct convention receives from its SDK are derived from the master's own frame here: the
 * caller (`msg.sender`), which the head leaves as the frame's sender, and a compile-time expression (`address(0)`,
 * the empty locking bytecode), which the body only computes at its start. The whole shipped path runs: the source
 * through `compileString` with the per-call convention, the program through `deployMaster`, and the BCH-2026
 * machine is asked for a verdict on the master's own input. The write is an INSERT, so the segment declares the
 * head sentinel relocated in place and the created node as a trailing output. A control that declares no record is
 * refused, and one whose created node carries a value the code did not compute is refused.
 */

const CATEGORY = seededCategory('key forms write per-call');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const AMOUNT = 42;
const VALUE_TAIL = new Uint8Array([AMOUNT]);
const EMPTY = new Uint8Array(0);

/** The master sits at input 0; the user's signed input is 1 and the head sentinel is 2. */
const MASTER_INDEX = 0;
const USER_INDEX = 1;
const PRED_INDEX = 2;
/** The created node's output index, which the compiler's block layout fixes at the entry slot's offset. */
const NODE_INDEX = 1;

const SENDER_KEY_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract SenderBalances {'
  + '   mapping(address => uint) balances;'
  + '   function set(uint amount) {'
  + '     balances[msg.sender] = amount;'
  + '   }'
  + ' }';

const EXPRESSION_KEY_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract ZeroBalances {'
  + '   mapping(address => uint) balances;'
  + '   function set(uint amount) {'
  + '     balances[address(0)] = amount;'
  + '   }'
  + ' }';

interface Env {
  readonly artifact: ReturnType<typeof compileString>;
  readonly deployed: ReturnType<typeof deployMaster>;
  readonly masterLock: Uint8Array;
  readonly entryLock: Uint8Array;
}

function envFor(source: string): Env {
  const artifact = compileString(source, { composition: 'per-call' });
  const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
  verifyMasterDeployment(deployed, artifact, CATEGORY, VALIDATOR_PROGRAM);
  return {
    artifact,
    deployed,
    masterLock: encodeLockingBytecodeP2sh32(hash256(deployed.script)),
    entryLock: scriptToLockingBytecode(
      buildEntryNftCovenantScript(
        CATEGORY,
        computeCollectionHash(artifact.stateLayout!.collections![0]!.signature),
      ),
      'p2sh32',
    ),
  };
}

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(capability: 'minting' | 'mutable', commitmentBytes: Uint8Array): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment: commitmentBytes } };
}

interface InsertOptions {
  /** The records the first (only) segment declares; the insert declaration by default. */
  readonly records?: RecordEntry[];
  /** The commitment the created node's output carries; the planned one by default. */
  readonly nodeCommitment?: Uint8Array;
}

/**
 * Evaluates the master's own input for an insert of `keyBytes` into a fresh list.
 *
 * The head sentinel is spent as slot 0 with no successor and relinked to the written key; the created node carries
 * the key's slot, the sentinel's old `+inf` successor and the argument's value tail.
 */
function evaluateInsert(env: Env, args: Uint8Array[], keyBytes: Uint8Array, options: InsertOptions = {}) {
  const slot = keyToSlot(keyBytes);
  const zeroSlot = new Uint8Array(32);
  const headBefore = encodeEntryCommitment(zeroSlot, zeroSlot);
  const headAfter = encodeEntryCommitment(zeroSlot, slot);
  const nodeCommitment = encodeEntryCommitment(slot, zeroSlot, VALUE_TAIL);
  const records = options.records ?? [
    { in: PRED_INDEX, out: PRED_INDEX, viewIn: headBefore, viewOut: headAfter },
    { in: 0xffff, out: NODE_INDEX, viewIn: EMPTY, viewOut: options.nodeCommitment ?? nodeCommitment },
  ];

  const block: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: env.deployed.address,
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
      ...args.flatMap((argument) => [...encodeDataPush(argument)]),
      ...encodeDataPush(env.deployed.script),
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

  const transaction: VmTransaction = {
    version: 2,
    inputs: [masterInput, userInput, predInput],
    outputs: [
      { lockingBytecode: env.masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
      {
        lockingBytecode: env.entryLock, valueSatoshis: 20_000n,
        token: token('mutable', options.nodeCommitment ?? nodeCommitment),
      },
      { lockingBytecode: env.entryLock, valueSatoshis: 20_000n, token: token('mutable', headAfter) },
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: env.masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: env.entryLock, valueSatoshis: 20_000n, token: token('mutable', headBefore) },
  ];

  const vm = createVirtualMachineBch2026(true);
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a per-call master keyed by the frame sender', () => {
  const env = envFor(SENDER_KEY_SOURCE);

  it('publishes a per-call master whose write witness is derived from the frame', () => {
    expect(env.artifact.composition?.convention).toBe('per-call');
    expect(scriptToBytecode(env.deployed.script).length).toBeGreaterThan(0);
    expect(env.artifact.abi.find((entry) => entry.name === 'set')?.inputs?.map((input) => input.name))
      .toStrictEqual(['amount']);
  });

  it('derives the key from the caller and is accepted by the machine', () => {
    expect(evaluateInsert(env, [VALUE_TAIL], USER_LOCK)).toStrictEqual({ accepted: true });
  });

  it('is refused when the segment declares no record at all', () => {
    expect(evaluateInsert(env, [VALUE_TAIL], USER_LOCK, { records: [] }).accepted).toBe(false);
  });

  it('is refused when the created node carries a value the code did not compute', () => {
    const slot = keyToSlot(USER_LOCK);
    const tampered = encodeEntryCommitment(slot, new Uint8Array(32), new Uint8Array([AMOUNT + 1]));
    expect(evaluateInsert(env, [VALUE_TAIL], USER_LOCK, { nodeCommitment: tampered }).accepted).toBe(false);
  });
});

describe('a per-call master keyed by a compile-time expression', () => {
  const env = envFor(EXPRESSION_KEY_SOURCE);
  /** `address(0)` casts an integer literal, and a cast to address is a no-op, so the key is the empty value. */
  const ZERO_KEY = EMPTY;

  it('publishes a per-call master whose write witness is derived from the frame', () => {
    expect(env.artifact.composition?.convention).toBe('per-call');
    expect(scriptToBytecode(env.deployed.script).length).toBeGreaterThan(0);
  });

  it('derives the key from the compile-time expression and is accepted by the machine', () => {
    expect(evaluateInsert(env, [VALUE_TAIL], ZERO_KEY)).toStrictEqual({ accepted: true });
  });

  it('is refused when the segment declares no record at all', () => {
    expect(evaluateInsert(env, [VALUE_TAIL], ZERO_KEY, { records: [] }).accepted).toBe(false);
  });

  it('is refused when the created node carries a value the code did not compute', () => {
    const slot = keyToSlot(ZERO_KEY);
    const tampered = encodeEntryCommitment(slot, new Uint8Array(32), new Uint8Array([AMOUNT + 1]));
    expect(evaluateInsert(env, [VALUE_TAIL], ZERO_KEY, { nodeCommitment: tampered }).accepted).toBe(false);
  });
});
