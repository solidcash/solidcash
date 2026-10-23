import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildEntryNftCovenantScript, computeCollectionHash, computeFunctionSelector, computeFunctionSignature,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type Artifact, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { refusalMessageOf } from './refused-entry.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * A compiled master whose entry writes a verified mapping after it has made an external call.
 *
 * A write that a call precedes lands in a later segment than the one the body begins in, so the sorted-batch
 * operands the write's verification consumes have to be derived from the write's own segment's declaration rather
 * than the body's first. The whole shipped path runs: the sources through `compileStringMulti` with the framed
 * convention, the reserved slots filled the way a deployment fills them, and the machine's verdict on the caller's
 * own input is the assertion. A write behind a call whose occurrence the source does not fix keeps its refusal
 * (`refused-entry-shapes.test.ts`).
 */

const CATEGORY_CALLER = seededCategory('write after call caller');
const CATEGORY_CALLEE = seededCategory('write after call callee');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   mapping(address => uint) balances;'
  + '   function set(address to, uint amount) {'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     balances[to] = amount;'
  + '   }'
  + ' }';

const TWO_CALL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   mapping(address => uint) balances;'
  + '   function set(address to, uint amount) {'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     balances[to] = amount;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const callerArtifact = artifacts.Caller!;
const twoCallArtifacts = compileStringMulti(TWO_CALL_SOURCE, { composition: 'framed' });

type Program = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<Program['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];

const CALLER_INDEX = 0;
const USER_INDEX = 1;
const PRED_INDEX = 2;
const CALLEE_INDEX = 3;
const VALIDATOR_INDEX = 4;
const NODE_INDEX = 1;
const VALUE = 20_000n;
const AMOUNT = 42;
const VALUE_TAIL = new Uint8Array([AMOUNT]);
const EMPTY = new Uint8Array(0);

const TO = new Uint8Array(20).fill(0x33);
const SLOT = keyToSlot(TO);
/** The head sentinel's slot: the all-zero slot a sorted list opens with. */
const ZERO_SLOT = new Uint8Array(32);
const HEAD_BEFORE = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);
const HEAD_AFTER = encodeEntryCommitment(ZERO_SLOT, SLOT);
const NODE_COMMITMENT = encodeEntryCommitment(SLOT, ZERO_SLOT, VALUE_TAIL);

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  commitment: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment } });

/** The insert the write runs: the sentinel is relinked in place, then the created node at the entry output. */
const SEGMENT: RecordEntry[] = [
  { in: PRED_INDEX, out: PRED_INDEX, viewIn: HEAD_BEFORE, viewOut: HEAD_AFTER },
  { in: 0xffff, out: NODE_INDEX, viewIn: EMPTY, viewOut: NODE_COMMITMENT },
];

interface Options {
  /** The declaration of the write's own segment, defaulting to the insert's two records. */
  readonly writeSegment?: RecordEntry[];
  /** The commitment the created node's output carries; the planned one by default. */
  readonly nodeOutputCommitment?: Uint8Array;
  /** How many external calls the entry makes before its write; the block declares that many plus one segments. */
  readonly calls?: number;
  /** The value the entry writes; the default amount by default, which the create's commitment follows. */
  readonly amount?: number;
  /** The compiled unit to take the caller from; the single-call unit by default. */
  readonly callerUnit?: Record<string, Artifact>;
}

function fill(unit: Record<string, Artifact>, name: 'Caller' | 'Callee'): Uint8Array {
  const artifact = unit[name]!;
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(name === 'Caller' ? CATEGORY_CALLER : CATEGORY_CALLEE),
    contractAddress: name === 'Caller' ? ADDRESS_CALLER : ADDRESS_CALLEE,
    templateHash: TEMPLATE_HASH,
  });
}

function build(options: Options = {}): Omit<Program, 'inputIndex'> {
  const unit = options.callerUnit ?? artifacts;
  const callerProgram = fill(unit, 'Caller');
  const calleeProgram = fill(artifacts, 'Callee');
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const callerLock = encodeLockingBytecodeP2sh32(hash256(callerProgram));
  const calleeLock = encodeLockingBytecodeP2sh32(hash256(calleeProgram));

  const callCount = options.calls ?? 1;
  // The written value's tail and the create's commitment follow the amount the entry is handed, so a case that
  // varies it plans the node it actually writes.
  const valueTail = options.amount === undefined ? VALUE_TAIL : new Uint8Array([options.amount]);
  const nodeCommitment = options.nodeOutputCommitment
    ?? (options.amount === undefined ? NODE_COMMITMENT : encodeEntryCommitment(SLOT, ZERO_SLOT, valueTail));
  const writeSegment = options.writeSegment ?? (options.amount === undefined ? SEGMENT : [
    { in: PRED_INDEX, out: PRED_INDEX, viewIn: HEAD_BEFORE, viewOut: HEAD_AFTER },
    { in: 0xffff, out: NODE_INDEX, viewIn: EMPTY, viewOut: nodeCommitment },
  ]);
  // The call closes the segment the code before it runs in; the write's records are declared in the last one.
  const segments: RecordEntry[][] = Array.from({ length: callCount }, () => []);
  segments.push(writeSegment);
  const callerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: EMPTY,
    calls: Array.from({ length: callCount }, () => ({
      kind: 1,
      target: ADDRESS_CALLEE,
      value: 0n,
      calleeRef: CALLEE_INDEX,
      argsHash: sha256(CALLEE_SELECTOR),
      result: EMPTY,
    })),
    segments,
    events: [],
    sends: [],
  };
  const calleeBlock: WitnessBlock = {
    kind: 1,
    callerRef: CALLER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_CALLER,
    self: ADDRESS_CALLEE,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };

  const plainInput = (fillByte: number): VmInput => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(fillByte),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  });
  const inputs: VmInput[] = [];
  inputs[CALLER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(callerBlock)),
      ...encodeDataPush(valueTail),
      ...encodeDataPush(TO),
      ...encodeDataPush(callerProgram),
    ]),
  };
  inputs[USER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  inputs[PRED_INDEX] = plainInput(5);
  inputs[CALLEE_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(6), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
      ...encodeDataPush(CALLEE_SELECTOR),
      ...encodeDataPush(calleeProgram),
    ]),
  };
  inputs[VALIDATOR_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(7), sequenceNumber: 0xffffffff,
    unlockingBytecode: validator.unlockingBytecode,
  };

  const outputs: VmOutput[] = [];
  outputs[CALLER_INDEX] = {
    lockingBytecode: callerLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'minting'),
  };
  const entryLock = scriptToLockingBytecode(
    buildEntryNftCovenantScript(
      CATEGORY_CALLER,
      computeCollectionHash(callerArtifact.stateLayout!.collections![0]!.signature),
    ),
    'p2sh32',
  );
  outputs[NODE_INDEX] = {
    lockingBytecode: entryLock,
    valueSatoshis: VALUE,
    token: token(CATEGORY_CALLER, 'mutable', nodeCommitment),
  };
  outputs[PRED_INDEX] = {
    lockingBytecode: entryLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', HEAD_AFTER),
  };
  outputs[CALLEE_INDEX] = {
    lockingBytecode: calleeLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting'),
  };
  outputs[VALIDATOR_INDEX] = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };

  const sourceOutputs: Program['sourceOutputs'] = [];
  sourceOutputs[CALLER_INDEX] = {
    lockingBytecode: callerLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'minting'),
  };
  sourceOutputs[USER_INDEX] = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  sourceOutputs[PRED_INDEX] = {
    lockingBytecode: entryLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', HEAD_BEFORE),
  };
  sourceOutputs[CALLEE_INDEX] = {
    lockingBytecode: calleeLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting'),
  };
  sourceOutputs[VALIDATOR_INDEX] = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };

  return { sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 } };
}

/** The caller input's verdict in the BCH-2026 machine, with the objection for a diagnosis. */
function verdict(options: Options = {}): { accepted: boolean; objection?: string } {
  const program = build(options);
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: CALLER_INDEX, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose entry writes a verified mapping after an external call', () => {
  it('derives the write witness from the segment the write lands in and is accepted', () => {
    const outcome = verdict();
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('is refused when the created node carries a value the code did not compute', () => {
    const tampered = encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([AMOUNT + 1]));
    expect(verdict({ nodeOutputCommitment: tampered }).accepted).toBe(false);
    expect(verdict({ nodeOutputCommitment: NODE_COMMITMENT }).accepted).toBe(true);
  });

  it('serves a write after two calls, reading the segment the second call opened', () => {
    expect(refusalMessageOf(TWO_CALL_SOURCE)).toBe('');
    const outcome = verdict({ calls: 2, callerUnit: twoCallArtifacts });
    expect(outcome.accepted, outcome.objection).toBe(true);
  });
});

describe('a framed master whose entry deletes a mapping entry beside a call elsewhere', () => {
  const DELETE_SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface ICallee { function ping(); }'
    + ' contract Callee { function ping() { require(true); } }'
    + ' contract Caller {'
    + '   mapping(string => string) meceTags;'
    + '   function callIt() {'
    + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
    + '     require(true);'
    + '   }'
    + '   function removeMeceTag(string shortForm) {'
    + '     require(bytes(meceTags[shortForm]).length != 0);'
    + '     delete meceTags[shortForm];'
    + '   }'
    + ' }';

  it('serves the removal: its write precedes the contract\'s calls', () => {
    expect(refusalMessageOf(DELETE_SOURCE)).toBe('');
  });
});

/**
 * A write that precedes a call the source does not fix: `balances[to] = amount;` then `if (amount >= 0) ping`.
 * The write lands in the frame's opening segment whatever runs, and it settles there: the block declares it in
 * the first segment and the segment the call opens keeps it.
 */
const WRITE_FIRST_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   mapping(address => uint) balances;'
  + '   function set(address to, uint amount) {'
  + '     balances[to] = amount;'
  + `     if (amount >= 0) { ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call(); }`
  + '   }'
  + ' }';

/** The same write with an unconditional call after it, so the entry carries no calls-made counter. */
const WRITE_FIRST_PLAIN_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   mapping(address => uint) balances;'
  + '   function set(address to, uint amount) {'
  + '     balances[to] = amount;'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '   }'
  + ' }';

describe('a framed master whose write precedes a call in the same body', () => {
  it('serves the entry, whose records are declared in the frame\'s opening segment', () => {
    expect(refusalMessageOf(WRITE_FIRST_SOURCE)).toBe('');
    expect(refusalMessageOf(WRITE_FIRST_PLAIN_SOURCE)).toBe('');
  });
});

/**
 * A branch whose arms make the same number of calls: `if (amount >= 0) ping else pong`, then the write. Every path
 * makes one call before the write, so the write lands in segment 1 and the master reads that segment.
 */
const SAME_CALL_BRANCH_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); function pong(); }'
  + ' contract Callee { function ping() { require(true); } function pong() { require(true); } }'
  + ' contract Caller {'
  + '   mapping(address => uint) balances;'
  + '   function set(address to, uint amount) {'
  + `     if (amount >= 0) { ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call(); }`
  + `     else { ICallee(0x${toHex(ADDRESS_CALLEE)}).pong.call(); }`
  + '     balances[to] = amount;'
  + '   }'
  + ' }';

const sameCallBranchArtifacts = compileStringMulti(SAME_CALL_BRANCH_SOURCE, { composition: 'framed' });

describe('a framed master whose write follows a branch whose arms call the same number of times', () => {
  it('serves the entry and settles in the machine', () => {
    expect(refusalMessageOf(SAME_CALL_BRANCH_SOURCE)).toBe('');
    const outcome = verdict({ calls: 1, callerUnit: sameCallBranchArtifacts });
    expect(outcome.accepted, outcome.objection).toBe(true);
  });
});

/**
 * A branch whose arms make a different number of calls — the write's segment the execution decides.
 *
 * `if (amount > 1) ping` then the write: the run makes one call or none, so the write lands in the segment the
 * block's own declared call count names rather than one a fixed index names. The same compiled program is asked
 * to settle over a frame that takes the arm (one record, the write in segment 1) and one that skips it (no
 * record, the write in segment 0), which is what shows the derivation followed the declared count.
 */
const VARYING_CALL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   mapping(address => uint) balances;'
  + '   function set(address to, uint amount) {'
  + `     if (amount > 1) { ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call(); }`
  + '     balances[to] = amount;'
  + '   }'
  + ' }';

const varyingCallArtifacts = compileStringMulti(VARYING_CALL_SOURCE, { composition: 'framed' });

describe('a framed master whose write follows a branch whose arms call a different number of times', () => {
  it('settles over the arm that made one call, reading the segment that call opened', () => {
    const outcome = verdict({ calls: 1, amount: 42, callerUnit: varyingCallArtifacts });
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('settles over the arm that made no call, reading the frame\'s opening segment', () => {
    const outcome = verdict({ calls: 0, amount: 1, callerUnit: varyingCallArtifacts });
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('refuses a frame that declares the call the skipped arm did not make', () => {
    expect(verdict({ calls: 1, amount: 1, callerUnit: varyingCallArtifacts }).accepted).toBe(false);
  });
});


/**
 * A removal of a mapping entry after the same body makes a call, so the removal's records are declared in the
 * segment the call opened. The removal's own body makes the call the write follows.
 */
const REMOVE_AFTER_CALL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   mapping(address => uint) tags;'
  + '   function callIt() {'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     require(true);'
  + '   }'
  + '   function removeTag(address t) {'
  + '     require(true);'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     delete tags[t];'
  + '   }'
  + ' }';

/**
 * A removal whose own body makes no call, in a contract whose other entry does. Its records are declared in the
 * frame's opening segment, the one segment the entry has.
 */
const REMOVE_ONLY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   mapping(address => uint) tags;'
  + '   function callIt() {'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     require(true);'
  + '   }'
  + '   function removeTag(address t) { delete tags[t]; require(true); }'
  + ' }';

describe('a framed master whose entry removes a mapping entry', () => {
  it('serves a removal the entry makes after its own call', () => {
    // The removal's write is a mapping write on the target node, so the walker sees it where the call precedes it.
    expect(refusalMessageOf(REMOVE_AFTER_CALL_SOURCE)).toBe('');
  });

  it('serves a removal that precedes every call the master makes', () => {
    expect(refusalMessageOf(REMOVE_ONLY_SOURCE)).toBe('');
  });
});
