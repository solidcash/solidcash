import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  FrameKind, asmToScript, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { isServed } from './refused-entry.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * A call inside a branch: whether the arm runs decides whether the record exists.
 *
 * The body makes a run-time number of calls, zero or one here, so it cannot address its record by a position the
 * source fixes. It carries how many calls it has made instead: the site binds the record that number names,
 * increments it, and the body pins the count it ended at against the count the block declares. The same compiled
 * program is asked for a verdict over a frame whose argument takes the arm and one whose argument skips it, and a
 * tail that does not match the calls the frame's own argument produces is refused.
 *
 * The second entry reaches a fixed call after the conditional one, so the record a later call binds depends on
 * whether the skipped arm made a call: the position is the number of calls already made, not the descriptor's
 * place in the source.
 */

const CATEGORY_CALLER = seededCategory('conditional call caller');
const CATEGORY_CALLEE = seededCategory('conditional call callee');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const EMPTY = new Uint8Array(0);
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** Master input indices: the caller, its callee, the validator that covers both, then the user. */
const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = 3;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IState { function add(int x); }'
  + ' contract Callee { function add(int x) { require(x > 0); } }'
  + ' contract Caller {'
  + `   function once(bool take) { if (take) { IState(0x${toHex(ADDRESS_CALLEE)}).add(1); } require(true); }`
  + `   function after(bool take) { if (take) { IState(0x${toHex(ADDRESS_CALLEE)}).add(1); }`
  + `     IState(0x${toHex(ADDRESS_CALLEE)}).add(1); require(true); }`
  + ' }';

const ARTIFACTS = compileStringMulti(SOURCE, { composition: 'framed' });
/** The callee's own dispatcher selector, read from the compiler's ABI rather than spelled out here. */
const ADD_SELECTOR = new Uint8Array(Buffer.from(
  ARTIFACTS.Callee!.abi.find((entry) => entry.name === 'add')!.selector!, 'hex',
));
/** The argument the body passes: a literal, so the site's digest is the compiler's own. */
const CALL_ARGUMENT = new Uint8Array([1]);
/** The callee's call data: `add(1)` as the wire carries it. */
const CALLEE_CALL_DATA = new Uint8Array([...ADD_SELECTOR, ...encodeDataPush(CALL_ARGUMENT)]);

const token = (
  category: Uint8Array, capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

interface Spend {
  /** The boolean the frame's argument hands the branch. */
  readonly take: boolean;
  /** How many call records and segments the frame declares, one segment per declared record plus the tail. */
  readonly declaredCalls?: number;
  /** Replace the recorded argument hash, so it no longer carries the call's digest. */
  readonly recordArgsHash?: Uint8Array;
}

/** Evaluates one compiled entry's own input, and reports the machine's verdict. */
function verdictOf(
  artifacts: ReturnType<typeof compileStringMulti>,
  entry: string,
  spend: Spend,
  expectedCalls: number,
): { accepted: boolean; objection?: string; ip?: number } {
  const programFor = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(
      scriptToBytecode(asmToScript(artifact.bytecode)),
      artifact.composition!.placeholders,
      { category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH },
    );
  };
  const callerProgram = programFor('Caller', CATEGORY_CALLER, ADDRESS_CALLER);
  const calleeProgram = programFor('Callee', CATEGORY_CALLEE, ADDRESS_CALLEE);
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const declaredCalls = spend.declaredCalls ?? (spend.take ? expectedCalls : expectedCalls - 1);
  const callerBlock: WitnessBlock = {
    kind: FrameKind.ROOT,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: EMPTY,
    // One record per call the execution makes, each to the same callee: the co-spent input is the one the site's
    // check hashes against the recorded digest.
    calls: Array.from({ length: declaredCalls }, () => ({
      kind: FrameKind.CALL,
      target: ADDRESS_CALLEE,
      value: 0n,
      calleeRef: CALLEE_INDEX,
      argsHash: spend.recordArgsHash ?? sha256(CALLEE_CALL_DATA),
      result: EMPTY,
    })),
    segments: Array.from({ length: declaredCalls + 1 }, () => []),
    events: [],
    sends: [],
  };
  const calleeBlock: WitnessBlock = {
    kind: FrameKind.CALL,
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
  const sourceOutputs = [
    { lockingBytecode: encodeLockingBytecodeP2sh32(hash256(callerProgram)), valueSatoshis: 20_000n,
      token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: encodeLockingBytecodeP2sh32(hash256(calleeProgram)), valueSatoshis: 20_000n,
      token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_CALLER, 'mutable') },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const transaction = {
    version: 2,
    inputs: [
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(callerBlock)),
          ...encodeDataPush(new Uint8Array(Buffer.from(
            artifacts.Caller!.abi.find((e) => e.name === entry)!.selector!, 'hex',
          ))),
          ...encodeDataPush(spend.take ? new Uint8Array([1]) : EMPTY),
          ...encodeDataPush(callerProgram),
        ]) },
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
          ...encodeDataPush(ADD_SELECTOR),
          ...encodeDataPush(CALL_ARGUMENT),
          ...encodeDataPush(calleeProgram),
        ]) },
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(3), sequenceNumber: 0xffffffff,
        unlockingBytecode: validator.unlockingBytecode },
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode() },
    ],
    outputs: sourceOutputs,
    locktime: 0,
  };
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: CALLER_INDEX, sourceOutputs, transaction });
  const accepted = vm.stateSuccess(state) === true;
  return {
    accepted,
    objection: accepted ? undefined : String(state.error),
    ip: (state as unknown as { ip?: number }).ip ?? -1,
  };
}

describe('an entry whose call runs only in one arm', () => {
  it('accepts the arm that calls, over the one record its execution declares', () => {
    const outcome = verdictOf(ARTIFACTS, 'once', { take: true, declaredCalls: 1 }, 1);
    expect({ accepted: outcome.accepted, objection: outcome.objection, ip: outcome.ip })
      .toMatchObject({ accepted: true });
  });

  it('accepts the arm that skips the call, over the empty tail its execution declares', () => {
    const outcome = verdictOf(ARTIFACTS, 'once', { take: false, declaredCalls: 0 }, 1);
    expect({ accepted: outcome.accepted, objection: outcome.objection, ip: outcome.ip })
      .toMatchObject({ accepted: true });
  });

  it('refuses a frame declaring a record the skipped arm did not make', () => {
    // The frame's argument takes the arm that skips the call, so a block that declares one record is refused
    // rather than settling a call the execution never made.
    expect(verdictOf(ARTIFACTS, 'once', { take: false, declaredCalls: 1 }, 1).accepted).toBe(false);
  });

  it('refuses a frame declaring none when the arm calls', () => {
    expect(verdictOf(ARTIFACTS, 'once', { take: true, declaredCalls: 0 }, 1).accepted).toBe(false);
  });

  it('refuses a record whose digest is not the call the arm makes', () => {
    expect(verdictOf(ARTIFACTS, 'once', { take: true, declaredCalls: 1, recordArgsHash: sha256(EMPTY) }, 1).accepted)
      .toBe(false);
  });
});

describe('an entry whose fixed call follows a conditional one', () => {
  it('accepts the unconditional call over the one record the skipped arm leaves', () => {
    // The skipped arm leaves the count where it was, so the fixed call binds record 0 rather than the descriptor's
    // place at 1 in the source.
    const outcome = verdictOf(ARTIFACTS, 'after', { take: false, declaredCalls: 1 }, 2);
    expect({ accepted: outcome.accepted, objection: outcome.objection, ip: outcome.ip })
      .toMatchObject({ accepted: true });
  });

  it('accepts both calls over the two records the taken arm makes', () => {
    expect(verdictOf(ARTIFACTS, 'after', { take: true, declaredCalls: 2 }, 2).accepted).toBe(true);
  });

  it('refuses a tail that declares two records when the arm was skipped', () => {
    expect(verdictOf(ARTIFACTS, 'after', { take: false, declaredCalls: 2 }, 2).accepted).toBe(false);
  });
});

/**
 * A conditional call whose target and argument the source does not fix.
 *
 * The target is the caller's own state and the argument is its own parameter, so the site hands both to the check
 * the way a fixed body does; only the record's position is the count the execution carries. This is a
 * parameter-checking helper's shape: a conditional call to an address the contract holds, with a run-time argument.
 */
const RUNTIME_OPERANDS_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IState { function add(int x); }'
  + ' contract Caller {'
  + '   address target;'
  + '   function go(bool take, int x) { if (take) { IState(this.target).add(x); } require(true); }'
  + ' }';

describe('an entry whose conditional call has a run-time target and argument', () => {
  it('is served, binding the record the count names to the values the running code holds', () => {
    expect(isServed(RUNTIME_OPERANDS_SOURCE)).toBe(true);
  });
});
