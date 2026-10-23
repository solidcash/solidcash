import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  FrameKind, asmToScript, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * A call inside a loop: how many records the execution declares is the trip count's business.
 *
 * The body makes a run-time number of calls, so it cannot address its records by a position the source fixes. It
 * carries how many calls it has made instead: the site binds the record that number names, increments it, and the
 * body pins the count it ended at against the count the block declares. The machine is what settles it: the same
 * compiled program is asked for a verdict over tails of zero, one, two and three records, and a tail that does not
 * match the number of calls the frame's own argument produces is refused.
 */

const CATEGORY_CALLER = seededCategory('looped call caller');
const CATEGORY_CALLEE = seededCategory('looped call callee');
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
  + `   function go(int n) { for (int i = 0; i < n; i = i + 1) { IState(0x${toHex(ADDRESS_CALLEE)}).add(1); }`
  + '     require(true); }'
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
  /** The trip count the frame's argument hands the loop. */
  readonly trips: number;
  /** How many call records and segments the frame declares, one segment per declared record plus the tail. */
  readonly declaredCalls?: number;
}

/** Evaluates the compiled caller's own input, and reports the machine's verdict. */
function verdict(spend: Spend): { accepted: boolean; objection?: string; ip?: number } {
  const artifacts = ARTIFACTS;
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
  const declaredCalls = spend.declaredCalls ?? spend.trips;
  const callerBlock: WitnessBlock = {
    kind: FrameKind.ROOT,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: EMPTY,
    // One record per call the loop makes, each to the same callee: the co-spent input is the one the site's check
    // hashes against the recorded digest.
    calls: Array.from({ length: declaredCalls }, () => ({
      kind: FrameKind.CALL,
      target: ADDRESS_CALLEE,
      value: 0n,
      calleeRef: CALLEE_INDEX,
      argsHash: sha256(CALLEE_CALL_DATA),
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
          ...encodeDataPush(spend.trips === 0 ? EMPTY : new Uint8Array([spend.trips])),
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

describe('an entry whose call runs inside a loop, behind an arm that skips it', () => {
  /** A loop whose first iteration is skipped by the arm, so the records do not start at the first iteration. */
  const SOURCE_WITH_ARM = 'pragma solidcash ^0.14.0;'
    + ' interface IState { function add(int x); }'
    + ' contract Callee { function add(int x) { require(x > 0); } }'
    + ' contract Caller {'
    + `   function go(int n) { for (int i = 0; i < n; i = i + 1) { if (i > 0) { IState(0x${toHex(ADDRESS_CALLEE)}).add(1); } }`
    + '     require(true); }'
    + ' }';

  const artifact = compileStringMulti(SOURCE_WITH_ARM, { composition: 'framed' }).Caller!;
  const selector = new Uint8Array(
    Buffer.from(compileStringMulti(SOURCE_WITH_ARM, { composition: 'framed' }).Callee!.abi[0]!.selector!, 'hex'),
  );

  it('accepts the calls the arm let run, over a tail declaring exactly those', () => {
    // `n` iterations reach the arm, and the first is skipped: `n - 1` calls. The body counts them, so the tail is
    // the count the execution made rather than the number of times the loop turned.
    const program = fillPlaceholders(
      scriptToBytecode(asmToScript(artifact.bytecode)),
      artifact.composition!.placeholders,
      {
        category: categorySlotValue(CATEGORY_CALLER),
        contractAddress: ADDRESS_CALLER,
        templateHash: TEMPLATE_HASH,
      },
    );
    const calleeProgram = fillPlaceholders(
      scriptToBytecode(asmToScript(
        compileStringMulti(SOURCE_WITH_ARM, { composition: 'framed' }).Callee!.bytecode,
      )),
      compileStringMulti(SOURCE_WITH_ARM, { composition: 'framed' }).Callee!.composition!.placeholders,
      {
        category: categorySlotValue(CATEGORY_CALLEE),
        contractAddress: ADDRESS_CALLEE,
        templateHash: TEMPLATE_HASH,
      },
    );
    const validator = validatorSpend(CATEGORY_CALLER, {
      roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
    });
    const spend = (trips: number, declaredCalls: number): boolean => {
      const callerBlock: WitnessBlock = {
        kind: FrameKind.ROOT,
        callerRef: USER_INDEX,
        originRef: USER_INDEX,
        validatorRef: VALIDATOR_INDEX,
        sender: USER_LOCK,
        self: ADDRESS_CALLER,
        value: 0n,
        retval: EMPTY,
        calls: Array.from({ length: declaredCalls }, () => ({
          kind: FrameKind.CALL,
          target: ADDRESS_CALLEE,
          value: 0n,
          calleeRef: CALLEE_INDEX,
          argsHash: sha256(new Uint8Array([...selector, ...encodeDataPush(CALL_ARGUMENT)])),
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
        { lockingBytecode: encodeLockingBytecodeP2sh32(hash256(program)), valueSatoshis: 20_000n,
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
              ...encodeDataPush(trips === 0 ? EMPTY : new Uint8Array([trips])),
              ...encodeDataPush(program),
            ]) },
          { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
            unlockingBytecode: new Uint8Array([
              ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
              ...encodeDataPush(selector),
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
      return vm.stateSuccess(vm.evaluate({ inputIndex: CALLER_INDEX, sourceOutputs, transaction })) === true;
    };
    expect(spend(3, 2)).toBe(true);
    expect(spend(1, 0)).toBe(true);
    expect(spend(3, 3)).toBe(false);
  });
});

describe('an entry whose call runs inside a loop', () => {
  it('accepts an execution that makes no call, over a tail declaring none', () => {
    const outcome = verdict({ trips: 0 });
    expect({ accepted: outcome.accepted, objection: outcome.objection, ip: outcome.ip })
      .toMatchObject({ accepted: true });
  });

  it('accepts one call, over a tail declaring one record', () => {
    const outcome = verdict({ trips: 1 });
    expect({ accepted: outcome.accepted, objection: outcome.objection, ip: outcome.ip })
      .toMatchObject({ accepted: true });
  });

  it('accepts two calls, over a tail declaring two records', () => {
    expect(verdict({ trips: 2 }).accepted).toBe(true);
  });

  it('accepts three calls, over a tail declaring three records', () => {
    // Each iteration binds the record the number of calls already made names, so the record section is walked at
    // run time rather than by a position the source fixed.
    const outcome = verdict({ trips: 3 });
    expect({ accepted: outcome.accepted, objection: outcome.objection, ip: outcome.ip })
      .toMatchObject({ accepted: true });
  });

  it('refuses a tail that declares fewer records than the execution makes', () => {
    // The body pins the count it ended at against the block's, so a frame declaring one record for three calls is
    // refused rather than reading a record the execution never made.
    expect(verdict({ trips: 3, declaredCalls: 1 }).accepted).toBe(false);
  });

  it('refuses a tail that declares more records than the execution makes', () => {
    expect(verdict({ trips: 1, declaredCalls: 3 }).accepted).toBe(false);
  });
});
