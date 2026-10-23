import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  FrameKind, asmToScript, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { frameRevertReason } from '../../../../solidcash/src/framed/composer/refusal.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, seededCategory, validatorFacetPlacements,
  validatorSpend,
} from './validator-input.js';

/**
 * A call in an operand the code evaluates only on some paths: the right operand of `&&` or `||`, or an arm of a
 * conditional expression.
 *
 * The emitted code skips such a call when the rest of the expression decides its value, so the body makes zero or
 * one calls, as a call inside an `if` arm does. It carries how many calls it has made and pins that count where it
 * ends: a frame whose argument skips the call settles over the empty tail it declares, a frame that declares a
 * record the skipped operand did not make is refused, and a `require` the skipped operand leaves false refuses with
 * its own message. The whole composition - caller, callee and validator - is asked for its verdict.
 */

const CATEGORY_CALLER = seededCategory('short circuit call caller');
const CATEGORY_CALLEE = seededCategory('short circuit call callee');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, REAL_VALIDATOR_PROGRAM);
/** A 20-byte hash whose bytes vary and whose reverse is a different value. */
const USER_LOCK = encodeLockingBytecodeP2pkh(Uint8Array.from({ length: 20 }, (_unused, index) => 0x31 + index * 3));
const EMPTY = new Uint8Array(0);
/** The canonical push of `true`: what a callee returning it records, and the caller's record carries. */
const TRUE_RESULT = new Uint8Array([0x51]);
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** A 32-byte outpoint hash whose bytes vary and whose reverse is a different value. */
function outpoint(seed: number): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_unused, index) => (seed * 29 + index * 7 + 1) & 0xff);
}

const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;

const CALLEE = `IState(0x${toHex(ADDRESS_CALLEE)})`;
const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface IState { function add(int x) returns (bool); }',
  'contract Callee { function add(int x) returns (bool) { require(x > 0); return true; } }',
  'contract Caller {',
  `  function either(bool take) { require(!take || ${CALLEE}.add(1)); }`,
  `  function both(bool take) { require(take && ${CALLEE}.add(1), "both operands"); }`,
  `  function pick(bool take) { bool ok = take ? ${CALLEE}.add(1) : true; require(ok); }`,
  '}',
].join('\n');

const ARTIFACTS = compileStringMulti(SOURCE, { composition: 'framed' });
const ADD_SELECTOR = new Uint8Array(Buffer.from(
  ARTIFACTS.Callee!.abi.find((entry) => entry.name === 'add')!.selector!, 'hex',
));

/** The callee's call data for `add(argument)`, as the wire carries it. */
function callData(argument: number): Uint8Array {
  return new Uint8Array([...ADD_SELECTOR, ...encodeDataPush(new Uint8Array([argument]))]);
}

const token = (
  category: Uint8Array, capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

function programFor(name: string, category: Uint8Array, address: Uint8Array): Uint8Array {
  const artifact = ARTIFACTS[name]!;
  return fillPlaceholders(
    scriptToBytecode(asmToScript(artifact.bytecode)),
    artifact.composition!.placeholders,
    { category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH },
  );
}

const CALLER_PROGRAM = programFor('Caller', CATEGORY_CALLER, ADDRESS_CALLER);
const CALLEE_PROGRAM = programFor('Callee', CATEGORY_CALLEE, ADDRESS_CALLEE);

interface Spend {
  readonly entry: string;
  /** The boolean the caller's argument hands the operand that decides whether the call runs. */
  readonly take: boolean;
  /** How many call records the caller's block declares. */
  readonly declaredCalls: number;
  /** The argument the callee is entered with, which the declared record's digest names. */
  readonly calleeArgument: number;
}

interface Verdict {
  readonly accepted: boolean;
  readonly ip?: number;
}

/** The machine's verdict on the caller, the callee and the validator of one composition. */
function verdicts(spend: Spend): { caller: Verdict; callee: Verdict; validator: Verdict } {
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const facets = validatorFacetPlacements();
  const callerBlock: WitnessBlock = {
    kind: FrameKind.ROOT, callerRef: USER_INDEX, originRef: USER_INDEX, validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK, self: ADDRESS_CALLER, value: 0n, retval: EMPTY,
    calls: Array.from({ length: spend.declaredCalls }, () => ({
      kind: FrameKind.CALL, target: ADDRESS_CALLEE, value: 0n, calleeRef: CALLEE_INDEX,
      argsHash: sha256(callData(spend.calleeArgument)), result: TRUE_RESULT,
    })),
    segments: Array.from({ length: spend.declaredCalls + 1 }, () => []),
    events: [], sends: [],
  };
  const calleeBlock: WitnessBlock = {
    kind: FrameKind.CALL, callerRef: CALLER_INDEX, originRef: USER_INDEX, validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_CALLER, self: ADDRESS_CALLEE, value: 0n, retval: TRUE_RESULT,
    calls: [], segments: [[]], events: [], sends: [],
  };
  const outputs = [
    { lockingBytecode: encodeLockingBytecodeP2sh32(hash256(CALLER_PROGRAM)), valueSatoshis: 20_000n,
      token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: encodeLockingBytecodeP2sh32(hash256(CALLEE_PROGRAM)), valueSatoshis: 20_000n,
      token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_CALLER, 'mutable') },
    ...facets.map((facet) => facet.output),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const selector = ARTIFACTS.Caller!.abi.find((entry) => entry.name === spend.entry)!.selector!;
  const transaction = {
    version: 2,
    inputs: [
      { outpointIndex: 0, outpointTransactionHash: outpoint(1), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(callerBlock)),
          ...encodeDataPush(new Uint8Array(Buffer.from(selector, 'hex'))),
          ...encodeDataPush(spend.take ? new Uint8Array([1]) : EMPTY),
          ...encodeDataPush(CALLER_PROGRAM),
        ]) },
      { outpointIndex: 0, outpointTransactionHash: outpoint(2), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
          ...encodeDataPush(ADD_SELECTOR),
          ...encodeDataPush(new Uint8Array([spend.calleeArgument])),
          ...encodeDataPush(CALLEE_PROGRAM),
        ]) },
      { outpointIndex: 0, outpointTransactionHash: outpoint(3), sequenceNumber: 0xffffffff,
        unlockingBytecode: validator.unlockingBytecode },
      ...facets.map((facet) => facet.input),
      { outpointIndex: 0, outpointTransactionHash: outpoint(4), sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode() },
    ],
    outputs,
    locktime: 0,
  };
  const vm = compositionMachine();
  const verdictAt = (inputIndex: number): Verdict => {
    const state = vm.evaluate({ inputIndex, sourceOutputs: outputs, transaction });
    return vm.stateSuccess(state) === true
      ? { accepted: true }
      : { accepted: false, ip: (state as { ip?: number }).ip };
  };
  return { caller: verdictAt(CALLER_INDEX), callee: verdictAt(CALLEE_INDEX), validator: verdictAt(VALIDATOR_INDEX) };
}

const ALL_ACCEPT = { caller: { accepted: true }, callee: { accepted: true }, validator: { accepted: true } };

describe.each([
  { entry: 'either', form: 'the right operand of `||`' },
  { entry: 'pick', form: 'an arm of a conditional expression' },
])('an entry whose call sits in $form', ({ entry }) => {
  // `either` makes the call when `take` holds; `pick` too.
  it('settles the path that makes the call over the one record it declares', () => {
    expect(verdicts({ entry, take: true, declaredCalls: 1, calleeArgument: 1 })).toStrictEqual(ALL_ACCEPT);
  });

  it('settles the path that skips the call over the empty tail it declares', () => {
    expect(verdicts({ entry, take: false, declaredCalls: 0, calleeArgument: 1 })).toStrictEqual(ALL_ACCEPT);
  });

  it('refuses a record the skipped call did not make, which would run the callee as if called', () => {
    // The record names `add(5)`, a call the source never makes: the callee and the validator accept it, so only
    // the caller's own count stands between the record and a callee frame run under the caller's identity.
    const forged = verdicts({ entry, take: false, declaredCalls: 1, calleeArgument: 5 });
    expect(forged.callee.accepted).toBe(true);
    expect(forged.validator.accepted).toBe(true);
    expect(forged.caller.accepted).toBe(false);
  });
});

describe('an entry whose `require` holds a call in the right operand of `&&`', () => {
  it('settles the path that makes the call over the one record it declares', () => {
    expect(verdicts({ entry: 'both', take: true, declaredCalls: 1, calleeArgument: 1 })).toStrictEqual(ALL_ACCEPT);
  });

  it('refuses the path that skips the call at its own `require`, which the reporter names', () => {
    // The frame declares no record, as the execution makes no call, so the body reaches the `require` the skipped
    // operand leaves false rather than stopping at a count the source fixed.
    const { caller } = verdicts({ entry: 'both', take: false, declaredCalls: 0, calleeArgument: 1 });
    expect(caller.accepted).toBe(false);
    expect(frameRevertReason(ARTIFACTS.Caller, CALLER_PROGRAM, caller.ip, 'Caller.both()'))
      .toStrictEqual({ line: 6, message: 'both operands' });
  });
});
