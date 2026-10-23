import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, computeFunctionSelector, computeFunctionSignature, encodeIntegerValue,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import {
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../../solidcash/src/framed/deploy/index.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * A record field a body writes before a call, which the call closes, past that call.
 *
 * The first entries make the same one call on each of their paths, so the record has two segments, and the field the
 * body writes before the call is the first one's. The caller is its contract's only master, so it settles its record
 * alone and its own segments chain: the second begins where the first ended, and a change a re-entering frame makes
 * between them cannot be declared here (the composed re-entry is `solidcash/test/framed/hostile/
 * closed-field-across-call.test.ts`). What the caller's own input decides is where its code takes the field from
 * past the call: an arm that does not write it reads it again where the other arm would have, an arm starts from the
 * set of closed fields at the branch point rather than from the other arm's, a loop's turns read the field it
 * writes from its slot, and a delete makes the field current. The declaration the body computes is accepted, and
 * the one an earlier walk computed is refused.
 *
 * The last entries make their call on some paths only, or in a loop, and then run a loop the walk of their fields
 * does not follow: a field the body wrote is current on the paths that made no call since and closed on the others,
 * which no position tells apart. Such a body decides the field itself: one its own sequence wrote where every path
 * had made the same calls is current exactly where the run has made no call since, one written anywhere else is
 * read again after each call, and a loop that writes the first kind reads it again before its turns. Its loop's
 * turns and its reads past the loop take the field's value on every path.
 */

const CATEGORY_CALLER = seededCategory('closed field across call caller');
const CATEGORY_CALLEE = seededCategory('closed field across call callee');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const PING = `ICallee(0x${toHex(ADDRESS_CALLEE)}).ping();`;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   int total;'
  + '   int mark;'
  + `   function setThenMark(int amount) { this.total = amount; ${PING} this.mark = 1; require(true); }`
  + `   function setThenRaiseIfHigh(int amount) { this.total = amount; ${PING}`
  + '     if (amount > 10) { this.total = amount + 1; } require(true); }'
  + '   function setThenCallEitherWay(int amount) { this.total = amount;'
  + `     if (amount > 10) { ${PING} } else { ${PING} this.total = amount + 1; } require(true); }`
  + `   function setThenCount(int amount) { this.total = amount; ${PING}`
  + '     for (int i = 0; i < amount - 40; i = i + 1) { this.total = this.total + 1; } require(true); }'
  + `   function setThenClear(int amount) { this.total = amount; ${PING}`
  + '     delete this.total; this.mark = this.total + 7; require(true); }'
  + `   function setThenGuardedCount(int amount) { this.total = amount; if (amount > 10) { ${PING} }`
  + '     for (int i = 0; i < 2; i = i + 1) { this.total = this.total + 1; } require(true); }'
  + '   function setThenLoopRead(int amount, int turns) { this.total = amount;'
  + `     for (int i = 0; i < turns; i = i + 1) { ${PING} } this.mark = this.total + 1; require(true); }`
  + `   function guardThenLoopRead(int amount, int turns) { if (amount > 10) { ${PING} } this.total = amount;`
  + `     for (int i = 0; i < turns; i = i + 1) { ${PING} } this.mark = this.total + 1; require(true); }`
  + `   function setCallThenGuardedCount(int amount) { this.total = amount; ${PING} if (amount > 10) { ${PING} }`
  + '     for (int i = 0; i < 2; i = i + 1) { this.total = this.total + 1; } require(true); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const callerArtifact = artifacts.Caller!;

type Program = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<Program['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];
type View = readonly [viewIn: Uint8Array, viewOut: Uint8Array];

const CALLER_INDEX = 0;
const USER_INDEX = 1;
const CALLEE_INDEX = 2;
const VALIDATOR_INDEX = 3;
const RECORD_INDEX = 4;
const VALUE = 20_000n;
const EMPTY = new Uint8Array(0);

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
  commitment: Uint8Array = EMPTY,
): VmOutput['token'] => ({ category, amount: 0n, nft: { capability, commitment } });

/** The record's commitment for its two fields. */
function record(total: bigint, mark = 0n): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(callerArtifact.stateLayout!, { total, mark }, 0), 'hex'));
}

const BEFORE = record(0n);

function fill(name: 'Caller' | 'Callee'): Uint8Array {
  const artifact = artifacts[name]!;
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(name === 'Caller' ? CATEGORY_CALLER : CATEGORY_CALLEE),
    contractAddress: name === 'Caller' ? ADDRESS_CALLER : ADDRESS_CALLEE,
    templateHash: TEMPLATE_HASH,
  });
}

/**
 * The caller input's verdict for `entry(...args)`, whose frame declares the record `[viewIn, viewOut]` in each of its
 * segments, around the one call between each two.
 */
function verdict(
  entry: string, args: bigint | readonly bigint[], segments: readonly View[],
): { accepted: boolean; objection?: string } {
  const callerProgram = fill('Caller');
  const calleeProgram = fill('Callee');
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const callerLock = encodeLockingBytecodeP2sh32(hash256(callerProgram));
  const calleeLock = encodeLockingBytecodeP2sh32(hash256(calleeProgram));
  const declared = segments.map(([viewIn, viewOut]): RecordEntry[] => [
    { in: RECORD_INDEX, out: RECORD_INDEX, viewIn, viewOut },
  ]);
  const callerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: EMPTY,
    calls: segments.slice(1).map(() => ({
      kind: 1, target: ADDRESS_CALLEE, value: 0n, calleeRef: CALLEE_INDEX, argsHash: sha256(CALLEE_SELECTOR), result: EMPTY,
    })),
    segments: declared,
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
  const selector = new Uint8Array(Buffer.from(callerArtifact.abi.find((row) => row.name === entry)!.selector!, 'hex'));
  const outpoint = (seed: number): Uint8Array => new Uint8Array(32).fill(seed);

  const inputs: VmInput[] = [];
  inputs[CALLER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: outpoint(1), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(callerBlock)),
      ...encodeDataPush(selector),
      // The deepest parameter is pushed first.
      ...[...(typeof args === 'bigint' ? [args] : args)].reverse().flatMap((arg) => [
        ...encodeDataPush(encodeIntegerValue(arg)),
      ]),
      ...encodeDataPush(callerProgram),
    ]),
  };
  inputs[USER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: outpoint(4), sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  inputs[CALLEE_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: outpoint(6), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
      ...encodeDataPush(CALLEE_SELECTOR),
      ...encodeDataPush(calleeProgram),
    ]),
  };
  inputs[VALIDATOR_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: outpoint(7), sequenceNumber: 0xffffffff,
    unlockingBytecode: validator.unlockingBytecode,
  };
  inputs[RECORD_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: outpoint(8), sequenceNumber: 0xffffffff,
    unlockingBytecode: stateRecordUnlockingBytecode(toHex(CATEGORY_CALLER), CALLER_INDEX, 1),
  };

  const recordLock = stateRecordLockingBytecode(toHex(CATEGORY_CALLER));
  const outputs: VmOutput[] = [];
  outputs[CALLER_INDEX] = { lockingBytecode: callerLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'minting') };
  outputs[USER_INDEX] = { lockingBytecode: USER_LOCK, valueSatoshis: 99_000n };
  outputs[CALLEE_INDEX] = { lockingBytecode: calleeLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting') };
  outputs[VALIDATOR_INDEX] = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };
  outputs[RECORD_INDEX] = {
    lockingBytecode: recordLock, valueSatoshis: VALUE,
    token: token(CATEGORY_CALLER, 'mutable', segments[segments.length - 1]![1]),
  };

  const sourceOutputs: Program['sourceOutputs'] = [];
  sourceOutputs[CALLER_INDEX] = {
    lockingBytecode: callerLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'minting'),
  };
  sourceOutputs[USER_INDEX] = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  sourceOutputs[CALLEE_INDEX] = {
    lockingBytecode: calleeLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting'),
  };
  sourceOutputs[VALIDATOR_INDEX] = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };
  sourceOutputs[RECORD_INDEX] = {
    lockingBytecode: recordLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', segments[0]![0]),
  };

  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: CALLER_INDEX, sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 },
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** Expects the declaration accepted, naming the machine's objection when it is not. */
function expectAccepted(entry: string, args: bigint | readonly bigint[], segments: readonly View[]): void {
  const outcome = verdict(entry, args, segments);
  expect(outcome.accepted, outcome.objection).toBe(true);
}

function expectRefused(entry: string, args: bigint | readonly bigint[], segments: readonly View[]): void {
  expect(verdict(entry, args, segments).accepted).toBe(false);
}

describe('a record field a call closed, past the call that closed it', () => {
  it('settles beside a field written past the call, and on both paths of an arm that writes it there', () => {
    expectAccepted('setThenMark', 42n, [[BEFORE, record(42n)], [record(42n), record(42n, 1n)]]);
    expectAccepted('setThenRaiseIfHigh', 5n, [[BEFORE, record(5n)], [record(5n), record(5n)]]);
    expectAccepted('setThenRaiseIfHigh', 42n, [[BEFORE, record(42n)], [record(42n), record(43n)]]);
  });

  it('starts the else arm from the branch point, so its call closes the field the body wrote before the branch', () => {
    expectAccepted('setThenCallEitherWay', 5n, [[BEFORE, record(5n)], [record(5n), record(6n)]]);
    expectAccepted('setThenCallEitherWay', 42n, [[BEFORE, record(42n)], [record(42n), record(42n)]]);
    // The else arm's call closes the segment its write before the branch is in: the record is not kept there.
    expectRefused('setThenCallEitherWay', 5n, [[BEFORE, BEFORE], [BEFORE, record(6n)]]);
  });

  it('reads a field a loop writes past the call from its slot on every turn', () => {
    expectAccepted('setThenCount', 42n, [[BEFORE, record(42n)], [record(42n), record(44n)]]);
    expectRefused('setThenCount', 42n, [[BEFORE, record(42n)], [record(42n), record(43n)]]);
    expectAccepted('setThenCount', 40n, [[BEFORE, record(40n)], [record(40n), record(40n)]]);
  });

  it('reads the value a delete past the call left', () => {
    expectAccepted('setThenClear', 42n, [[BEFORE, record(42n)], [record(42n), record(0n, 7n)]]);
    expectRefused('setThenClear', 42n, [[BEFORE, record(42n)], [record(42n), record(0n, 49n)]]);
  });
});

describe('a record field past a loop the walk does not follow, in a body whose calls vary', () => {
  it('reads a field a loop writes past a guarded call from its slot on every turn, on both paths', () => {
    expectAccepted('setThenGuardedCount', 5n, [[BEFORE, record(7n)]]);
    expectRefused('setThenGuardedCount', 5n, [[BEFORE, record(1n)]]);
    expectAccepted('setThenGuardedCount', 42n, [[BEFORE, record(42n)], [record(42n), record(44n)]]);
    expectRefused('setThenGuardedCount', 42n, [[BEFORE, record(42n)], [record(42n), record(43n)]]);
  });

  it('reads a field written before a loop of calls from its slot where the loop made none', () => {
    expectAccepted('setThenLoopRead', [42n, 0n], [[BEFORE, record(42n, 43n)]]);
    expectRefused('setThenLoopRead', [42n, 0n], [[BEFORE, record(42n, 1n)]]);
    expectAccepted('setThenLoopRead', [42n, 1n], [[BEFORE, record(42n)], [record(42n), record(42n, 43n)]]);
  });

  it('reads again after a loop\'s call a field written past a guarded call, and before a loop that writes it', () => {
    expectAccepted('guardThenLoopRead', [42n, 0n], [[BEFORE, BEFORE], [BEFORE, record(42n, 43n)]]);
    expectRefused('guardThenLoopRead', [42n, 0n], [[BEFORE, BEFORE], [BEFORE, record(42n, 1n)]]);
    expectAccepted('guardThenLoopRead', [42n, 1n],
      [[BEFORE, BEFORE], [BEFORE, record(42n)], [record(42n), record(42n, 43n)]]);
    expectAccepted('setCallThenGuardedCount', 5n, [[BEFORE, record(5n)], [record(5n), record(7n)]]);
    expectRefused('setCallThenGuardedCount', 5n, [[BEFORE, record(5n)], [record(5n), record(6n)]]);
    expectAccepted('setCallThenGuardedCount', 42n,
      [[BEFORE, record(42n)], [record(42n), record(42n)], [record(42n), record(44n)]]);
  });
});
