import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256, utf8ToBin,
} from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  buildEntryNftCovenantScript, buildPushdataCommitment, computeCollectionHash, encodeWitnessBlock,
  type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { refusalMessageOf } from './refused-entry.js';
import { deployMaster, verifyMasterDeployment } from '../../../../solidcash/src/framed/deploy/index.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, dataRecordLock, seededCategory } from './validator-input.js';

/**
 * A framed master whose entry writes a mapping keyed by a value the frame already holds.
 *
 * Two key forms the direct convention receives from its SDK are derived from the master's own frame here: the
 * caller (`msg.sender`), which the head leaves as the frame's sender, and a compile-time expression (`address(0)`,
 * the empty locking bytecode), which the body only computes at its start. The whole shipped path runs: the source
 * through `compileString` with the framed convention, the program through `deployMaster`, and the BCH-2026
 * machine is asked for a verdict on the master's own input. The write is an INSERT, so the segment declares the
 * head sentinel relocated in place and the created node as a trailing output. A control that declares no record is
 * refused, and one whose created node carries a value the code did not compute is refused.
 */

const CATEGORY = seededCategory('key forms write framed');
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

const SENDER_KEY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract SenderBalances {'
  + '   mapping(address => uint) balances;'
  + '   function set(uint amount) {'
  + '     balances[msg.sender] = amount;'
  + '   }'
  + ' }';

const EXPRESSION_KEY_SOURCE = 'pragma solidcash ^0.14.0;'
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
  const artifact = compileString(source, { composition: 'framed' });
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
function evaluateInsert(
  env: Env, args: Uint8Array[], keyBytes: Uint8Array, options: InsertOptions = {},
): { accepted: boolean; objection?: string } {
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

  const vm = compositionMachine(true);
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a framed master keyed by the frame sender', () => {
  const env = envFor(SENDER_KEY_SOURCE);

  it('publishes a framed master whose write witness is derived from the frame', () => {
    expect(env.artifact.composition?.convention).toBe('framed');
    expect(env.deployed.script.length).toBeGreaterThan(0);
    expect(env.artifact.abi.find((entry) => entry.name === 'set')?.inputs?.map((input) => input.name))
      .toStrictEqual(['amount']);
  });

  it('derives the key from the caller and is accepted by the machine', () => {
    expect(evaluateInsert(env, [VALUE_TAIL], USER_LOCK)).toStrictEqual({ accepted: true });
  });

  // A segment that declares no record is refused in `mapping-write.test.ts`; the key form does not reach that check.
  it('is refused when the created node carries a value the code did not compute', () => {
    const slot = keyToSlot(USER_LOCK);
    const tampered = encodeEntryCommitment(slot, new Uint8Array(32), new Uint8Array([AMOUNT + 1]));
    expect(evaluateInsert(env, [VALUE_TAIL], USER_LOCK, { nodeCommitment: tampered }).accepted).toBe(false);
  });
});

describe('a framed master keyed by a compile-time expression', () => {
  const env = envFor(EXPRESSION_KEY_SOURCE);
  /** `address(0)` casts an integer literal, and a cast to address is a no-op, so the key is the empty value. */
  const ZERO_KEY = EMPTY;

  it('publishes a framed master whose write witness is derived from the frame', () => {
    expect(env.artifact.composition?.convention).toBe('framed');
    expect(env.deployed.script.length).toBeGreaterThan(0);
  });

  it('derives the key from the compile-time expression and is accepted by the machine', () => {
    expect(evaluateInsert(env, [VALUE_TAIL], ZERO_KEY)).toStrictEqual({ accepted: true });
  });

  it('is refused when the created node carries a value the code did not compute', () => {
    const slot = keyToSlot(ZERO_KEY);
    const tampered = encodeEntryCommitment(slot, new Uint8Array(32), new Uint8Array([AMOUNT + 1]));
    expect(evaluateInsert(env, [VALUE_TAIL], ZERO_KEY, { nodeCommitment: tampered }).accepted).toBe(false);
  });
});

/**
 * A write keyed by a contract constant, and one keyed by a cast that widens a literal.
 *
 * Code generation inlines a constant wherever it is read, so the derivation emits the constant's value as the body's
 * own key does, and the artifact publishes the key as the bytes the body hashes: the folded hash a `bytes32`
 * constant holds, and the 32 bytes `bytes32(uint256(1))` widens the number to (`OP_NUM2BIN`, little-endian
 * natively) rather than the one-byte number an off-chain reader reads through the cast.
 */
const CONSTANT_KEY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract RoleBalances {'
  + '   bytes32 constant ROLE = keccak256("ROLE");'
  + '   mapping(bytes32 => uint) balances;'
  + '   function set(uint amount) {'
  + '     balances[ROLE] = amount;'
  + '   }'
  + ' }';

const CAST_KEY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract WideBalances {'
  + '   mapping(bytes32 => uint) balances;'
  + '   function set(uint amount) {'
  + '     balances[bytes32(uint256(1))] = amount;'
  + '   }'
  + ' }';

describe.each([
  ['a contract constant', CONSTANT_KEY_SOURCE, keccak_256(utf8ToBin('ROLE')), utf8ToBin('ROLE')],
  ['a cast that widens a literal', CAST_KEY_SOURCE, Uint8Array.from([1, ...new Uint8Array(31)]), Uint8Array.of(1)],
])('a framed master keyed by %s', (_shape, source, key, misread) => {
  const env = envFor(source);

  it('publishes the key as the bytes the body hashes and refuses no entry', () => {
    expect(env.artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
    const access = env.artifact.abi.find((entry) => entry.name === 'set')?.entryAccesses?.[0];
    expect(access?.keySources?.[0]?.expressionLabel).toBe(`lit:0x${binToHex(key)}`);
  });

  it('derives the key from the compile-time value and is accepted by the machine', () => {
    expect(evaluateInsert(env, [VALUE_TAIL], key)).toStrictEqual({ accepted: true });
  });

  it('is refused when the node is planned at a key the body does not hash', () => {
    expect(evaluateInsert(env, [VALUE_TAIL], misread).accepted).toBe(false);
  });
});

/**
 * A ternary whose branches are both values the frame already holds at the top of the body.
 *
 * `(1 == 1) ? msg.sender : address(0)` takes the caller's lock, which the head leaves as the frame's sender, and
 * the other branch is a cast of a literal. The derivation emits the whole ternary there, so the slot is the one the
 * taken branch's value names rather than a constant.
 */
const TERNARY_SENDER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract TernaryBalances {'
  + '   mapping(address => uint) balances;'
  + '   function set(uint amount) {'
  + '     balances[(1 == 1) ? msg.sender : address(0)] = amount;'
  + '   }'
  + ' }';

describe('a framed master keyed by a ternary over the frame values', () => {
  const env = envFor(TERNARY_SENDER_SOURCE);

  it('publishes a framed master whose write witness is derived from the frame', () => {
    expect(env.artifact.composition?.convention).toBe('framed');
    expect(env.artifact.abi.find((entry) => entry.name === 'set')?.inputs?.map((input) => input.name))
      .toStrictEqual(['amount']);
  });

  it('derives the key from the taken branch and is accepted by the machine', () => {
    expect(evaluateInsert(env, [VALUE_TAIL], USER_LOCK)).toStrictEqual({ accepted: true });
  });

  it('is refused when the created node carries a value the code did not compute', () => {
    const slot = keyToSlot(USER_LOCK);
    const tampered = encodeEntryCommitment(slot, new Uint8Array(32), new Uint8Array([AMOUNT + 1]));
    expect(evaluateInsert(env, [VALUE_TAIL], USER_LOCK, { nodeCommitment: tampered }).accepted).toBe(false);
  });
});

/**
 * An entry keyed by a field the body reads out of its own state record.
 *
 * `escrows[next.value] = amount` carries no argument for the key: `next` is a struct in the data NFT, so the value
 * the slot is derived from is the record the frame declares for it. The derivation reads that record at the top of
 * the body, and the write is keyed by the field it holds.
 */
const STATE_FIELD_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Id { uint value; }'
  + ' contract Escrow {'
  + '   Id next;'
  + '   mapping(uint => uint) escrows;'
  + '   function open(uint amount) { escrows[next.value] = amount; }'
  + ' }';

const STATE_ARTIFACT = compileString(STATE_FIELD_SOURCE, { composition: 'framed' });
const STATE_DEPLOYED = deployMaster(STATE_ARTIFACT, CATEGORY, VALIDATOR_PROGRAM);
verifyMasterDeployment(STATE_DEPLOYED, STATE_ARTIFACT, CATEGORY, VALIDATOR_PROGRAM);
const STATE_MASTER_LOCK = encodeLockingBytecodeP2sh32(hash256(STATE_DEPLOYED.script));
const STATE_ENTRY_LOCK = scriptToLockingBytecode(
  buildEntryNftCovenantScript(
    CATEGORY,
    computeCollectionHash(STATE_ARTIFACT.stateLayout!.collections![0]!.signature),
  ),
  'p2sh32',
);

/** The field value the key hashes, and the value the entry stores against it. */
const STATE_FIELD_VALUE = 7;
const STATE_SLOT = keyToSlot(new Uint8Array([STATE_FIELD_VALUE]));
const STATE_NODE_VALUE = new Uint8Array([AMOUNT]);

/** The data NFT's commitment for a record whose `next` field holds `value`, as the shipped encoder writes it. */
const stateCommitment = (value: number): Uint8Array => new Uint8Array(Buffer.from(
  buildPushdataCommitment(STATE_ARTIFACT.stateLayout!, { next: { value: BigInt(value) } }, 0), 'hex',
));
const STATE_RECORD = stateCommitment(STATE_FIELD_VALUE);
/** The data record sits at the data-NFT covenant; its mapping nodes sit at the collection covenant. */
const STATE_RECORD_LOCK = dataRecordLock(CATEGORY);

const STATE_MASTER_INDEX = 0;
const STATE_USER_INDEX = 1;
const STATE_RECORD_INDEX = 2;
const STATE_SENTINEL_INDEX = 3;
/** The created node's output index, which the entry slot's block offset fixes. */
const STATE_NODE_INDEX = 1;

/** Evaluates the master's own input for an insert keyed by the state record's field. */
function evaluateStateKey(options: { readonly recordField?: number } = {}): {
  accepted: boolean;
  objection?: string;
} {
  const record = options.recordField === undefined ? STATE_RECORD : stateCommitment(options.recordField);
  const zeroSlot = new Uint8Array(32);
  const headBefore = encodeEntryCommitment(zeroSlot, zeroSlot);
  const headAfter = encodeEntryCommitment(zeroSlot, STATE_SLOT);
  const nodeCommitment = encodeEntryCommitment(STATE_SLOT, zeroSlot, STATE_NODE_VALUE);
  const block: WitnessBlock = {
    kind: 0,
    callerRef: STATE_USER_INDEX,
    originRef: STATE_USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: STATE_DEPLOYED.address,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [[
      { in: STATE_RECORD_INDEX, out: STATE_RECORD_INDEX, viewIn: record, viewOut: record },
      { in: STATE_SENTINEL_INDEX, out: STATE_SENTINEL_INDEX, viewIn: headBefore, viewOut: headAfter },
      { in: 0xffff, out: STATE_NODE_INDEX, viewIn: EMPTY, viewOut: nodeCommitment },
    ]],
    events: [],
    sends: [],
  };
  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(STATE_NODE_VALUE),
      ...encodeDataPush(STATE_DEPLOYED.script),
    ]),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const recordInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(6),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  const sentinelInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(5),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  const transaction: VmTransaction = {
    version: 2,
    inputs: [masterInput, userInput, recordInput, sentinelInput],
    outputs: [
      { lockingBytecode: STATE_MASTER_LOCK, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
      { lockingBytecode: STATE_ENTRY_LOCK, valueSatoshis: 20_000n, token: token('mutable', nodeCommitment) },
      { lockingBytecode: STATE_RECORD_LOCK, valueSatoshis: 20_000n, token: token('mutable', record) },
      { lockingBytecode: STATE_ENTRY_LOCK, valueSatoshis: 20_000n, token: token('mutable', headAfter) },
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: STATE_MASTER_LOCK, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: STATE_RECORD_LOCK, valueSatoshis: 20_000n, token: token('mutable', record) },
    { lockingBytecode: STATE_ENTRY_LOCK, valueSatoshis: 20_000n, token: token('mutable', headBefore) },
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: STATE_MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a framed master keyed by a field of its state record', () => {
  it('publishes a framed master with the entry point it was asked for', () => {
    expect(STATE_ARTIFACT.composition?.convention).toBe('framed');
    expect(STATE_ARTIFACT.abi.find((entry) => entry.name === 'open')?.inputs?.map((input) => input.name))
      .toStrictEqual(['amount']);
  });

  it('derives the slot from the field and is accepted by the machine', () => {
    expect(evaluateStateKey()).toStrictEqual({ accepted: true });
  });

  it('is refused when the record declares a field the write did not hash', () => {
    // The record the frame declares fixes the value the write is keyed by, so a record holding another value names
    // no node the segment's declaration reads.
    expect(evaluateStateKey({ recordField: STATE_FIELD_VALUE + 1 }).accepted).toBe(false);
    expect(evaluateStateKey({ recordField: STATE_FIELD_VALUE }).accepted).toBe(true);
  });
});

/**
 * The shape the harness kept refusing: a ternary over a field read through a collection, and a cast of a literal.
 *
 * `whitelistWorkers[jobId][(0 == 0) ? job.roles.worker : address(0)] = false` takes the field's value as the key,
 * and the field's base is the element the entry's own code writes: the derivation already holds that element where
 * the slot is computed, so the branch is a value the body holds at its start rather than one it computes later.
 */
const COLLECTION_FIELD_TERNARY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Roles { address worker; }'
  + ' struct JobPost { Roles roles; int state; }'
  + ' contract JobList {'
  + '   JobPost[] jobs;'
  + '   mapping(uint => mapping(address => bool)) whitelistWorkers;'
  + '   function refund(uint jobId) {'
  + '     JobPost storage job = jobs[jobId];'
  + '     whitelistWorkers[jobId][(0 == 0) ? job.roles.worker : address(0)] = false;'
  + '     job.state = 1;'
  + '   }'
  + ' }';

/** The refusals a framed compile publishes, or the empty list when it serves every body. */
function publishedRefusals(source: string, options: Record<string, unknown> = {}): string[] {
  const artifact = compileString(source, { composition: 'framed', ...options });
  return (artifact.composition?.refusedEntries ?? []).map((refused) => refused.reason);
}

describe('a framed master keyed by a ternary over a field read through a collection', () => {
  it('serves the write and publishes no refusal for the entry', () => {
    expect(publishedRefusals(COLLECTION_FIELD_TERNARY_SOURCE)).toStrictEqual([]);
    const artifact = compileString(COLLECTION_FIELD_TERNARY_SOURCE, { composition: 'framed' });
    expect(artifact.composition?.convention).toBe('framed');
    expect(artifact.abi.find((entry) => entry.name === 'refund')?.inputs?.map((input) => input.name))
      .toStrictEqual(['jobId']);
  });
});

describe('a framed master keyed by a ternary over another mapping\'s entry', () => {
  it('serves the write: the entry read in the key takes a slot, whose record the frame declares', () => {
    // The machine's verdict on a key read from another mapping's entry, bare and in a ternary, is in
    // `nested-entry-read.test.ts`.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Foreign {'
      + '   mapping(uint => address) owners;'
      + '   mapping(address => uint) balances;'
      + '   function set(uint id, uint amount) { balances[(1 == 1) ? owners[id] : address(0)] = amount; }'
      + ' }';
    expect(publishedRefusals(source)).toStrictEqual([]);
    const row = compileString(source, { composition: 'framed' }).abi.find((entry) => entry.name === 'set');
    expect(row?.entryAccesses?.map((access) => [access.collection, access.operations]))
      .toStrictEqual([['balances', ['write']], ['owners', ['read']]]);
  });
});

describe('a framed master keyed by a value the body does not hold where it derives the slot', () => {
  it('refuses a key the body computes with a call', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Hashed {'
      + '   mapping(bytes20 => uint) balances;'
      + '   function set(pubkey pk, uint amount) { balances[hash160(pk)] = amount; }'
      + ' }';
    expect(refusalMessageOf(source)).toContain("reads the value computed by 'hash160'");
  });

  it('refuses a bare environment value inside a ternary', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Times {'
      + '   mapping(int => uint) balances;'
      + '   function set(uint amount) { balances[(1 == 1) ? tx.locktime : 0] = amount; }'
      + ' }';
    expect(refusalMessageOf(source)).toContain('the tx.locktime value');
  });
});
