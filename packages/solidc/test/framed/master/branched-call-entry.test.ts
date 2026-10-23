import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  FrameKind, asmToScript, computeFunctionSelector, computeFunctionSignature,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * An entry whose body branches around its call: the program has to accept the tail its own execution declares.
 *
 * A body whose arms each call names one descriptor per arm — a call at record 0 on either arm — while its
 * execution makes one call and closes two segments. The head keeps the count an execution declares, so the shape
 * compiles only when that count is the execution's rather than the descriptor list's; the machine is what settles
 * it, because a program emitted for the wrong count refuses a spend the body itself performed.
 *
 * The caller's frame declares one call record and its two segments, the callee is co-spent at its own index with
 * the selector push the site's check hashes, and the validator input covers both. Every case asks the BCH-2026
 * machine for its own verdict on the caller's input.
 */

const CATEGORY_CALLER = seededCategory('branched call caller');
const CATEGORY_CALLEE = seededCategory('branched call callee');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const EMPTY = new Uint8Array(0);
const SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** Master input indices: the caller, its callee, the validator that covers both, then the user. */
const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = 3;

const CALL = `ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`;

/** A caller whose entry is the given body, over a callee that answers `ping()`. */
function source(signature: string, body: string): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface ICallee { function ping(); }'
    + ' contract Callee { function ping() { require(true); } }'
    + ` contract Caller { function callIt(${signature}) { ${body} } }`;
}

const token = (
  category: Uint8Array, capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

interface Spend {
  /** The selector the dispatcher reads, for a master with more than one entry; absent for a single-entry one. */
  readonly selector?: Uint8Array;
  /** The argument pushes the frame entered with, above the block and below the redeem script. */
  readonly argument?: Uint8Array;
  /** How many call records and segments the frame declares, one segment per declared record plus the tail. */
  readonly declaredCalls?: number;
}

/**
 * The caller's source, for a unit whose `Caller` has the given entries.
 *
 * An entry is named by the selector the dispatcher reads, so a master with more than one carries the selector of
 * the entry the frame reaches in its own unlocking bytecode while a single-entry master reads none.
 */
function multiEntrySource(entries: readonly string[]): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface ICallee { function ping(); }'
    + ' contract Callee { function ping() { require(true); } }'
    + ` contract Caller { ${entries.join(' ')} }`;
}

/** Evaluates the compiled caller's own input, and reports the machine's verdict. */
function verdictOf(sourceText: string, spend: Spend): { accepted: boolean; objection?: string; ip?: number } {
  const artifacts = compileStringMulti(sourceText, { composition: 'framed' });
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
  const declaredCalls = spend.declaredCalls ?? 1;
  const callerBlock: WitnessBlock = {
    kind: FrameKind.ROOT,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: EMPTY,
    // The record the execution makes: one call to the callee, whichever arm the frame's own code reaches.
    calls: Array.from({ length: declaredCalls }, () => ({
      kind: FrameKind.CALL,
      target: ADDRESS_CALLEE,
      value: 0n,
      calleeRef: CALLEE_INDEX,
      argsHash: sha256(SELECTOR),
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
          ...(spend.selector === undefined ? [] : [...encodeDataPush(spend.selector)]),
          ...(spend.argument === undefined ? [] : [...encodeDataPush(spend.argument)]),
          ...encodeDataPush(callerProgram),
        ]) },
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
          ...encodeDataPush(SELECTOR),
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

/** Evaluates the entry of a one-entry `Caller`, which reads no selector. */
function verdict(
  signature: string,
  body: string,
  spend: Spend = {},
): { accepted: boolean; objection?: string; ip?: number } {
  return verdictOf(source(signature, body), spend);
}

describe('an entry whose arms each make the same call', () => {
  const BOTH_ARMS = `if (true) { ${CALL} } else { ${CALL} } require(true);`;

  it('accepts the spend, over the one record and two segments its execution declares', () => {
    // The two arms name two descriptors and one record: the head's count is what one execution declares, and the
    // frame's tail is that execution's, so the program accepts what the body did.
    expect(verdict('', BOTH_ARMS)).toMatchObject({ accepted: true });
  });

  it('accepts it when the branch reads the frame\'s argument', () => {
    // The same shape with the boolean read from the unlocking bytecode: the head drops the block below the
    // argument, the body branches on the argument, and the tail is still the execution's own.
    expect(verdict('bool take', `if (take) { ${CALL} } else { ${CALL} } require(true);`, {
      argument: new Uint8Array([1]),
    })).toMatchObject({ accepted: true });
  });

  it('refuses a frame declaring the descriptor list\'s count instead of the execution\'s', () => {
    // The control: a tail with one record per descriptor is not a tail this execution made, so the program
    // refuses it rather than settling records no body wrote.
    const outcome = verdict('', BOTH_ARMS, { declaredCalls: 2 });
    expect(outcome.accepted).toBe(false);
  });
});

describe('a master with two entries, one that calls and one that does not', () => {
  const SOURCE = multiEntrySource([
    `function call() { ${CALL} require(true); }`,
    'function quiet() { require(true); }',
  ]);
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  const selectorOf = (name: string): Uint8Array =>
    new Uint8Array(Buffer.from(artifacts.Caller!.abi.find((entry) => entry.name === name)!.selector!, 'hex'));

  it('accepts the entry that calls, over the one record its execution declares', () => {
    expect(verdictOf(SOURCE, { selector: selectorOf('call'), declaredCalls: 1 }))
      .toMatchObject({ accepted: true });
  });

  it('accepts the entry that makes no call, over the empty tail its execution declares', () => {
    // The head serves both bodies: the count the block declares is each body's own, and the body that made no
    // call pins it to zero.
    expect(verdictOf(SOURCE, { selector: selectorOf('quiet'), declaredCalls: 0 }))
      .toMatchObject({ accepted: true });
  });

  it('refuses the entry that makes no call when its block declares a record', () => {
    const outcome = verdictOf(SOURCE, { selector: selectorOf('quiet'), declaredCalls: 1 });
    expect(outcome.accepted).toBe(false);
  });
});
