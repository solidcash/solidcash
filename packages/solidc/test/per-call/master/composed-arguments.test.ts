import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  argsHash, asmToScript, computeFunctionSelector, computeFunctionSignature,
  encodeArgumentList, encodeIntegerValue, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * A call that passes an argument, between two compiled masters that one validator covers.
 *
 * The caller records the call and its argument hash in its witness block. The arguments themselves live in the
 * callee's own unlocking bytecode, between the selector's push and the redeem script, so the caller re-reads them
 * from there and recomputes `SHA256(selector || args)` instead of trusting a constant. That is what admits a call
 * with arguments at all, and it leaves the zero-argument shape identical: with no argument pushes the region is
 * empty and the hash is over the selector bytes alone.
 *
 * Everything is compiled through `compileStringMulti`, filled by deployment, and settled by the machine's own
 * verdict. Each refusal is shown together with the inputs it does not touch, so the refusal is the check under
 * test rather than a malformed composition.
 */

const CATEGORY_CALLER = seededCategory('composed arguments caller');
const CATEGORY_CALLEE = seededCategory('composed arguments callee');
/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** A selector that names a different function, for the callee's call data. */
const OTHER_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', ['bytes32']));

/** The argument `7`, in the one encoding the wire format allows: a minimal push of its script number. */
const ARGUMENT_PUSHES = encodeArgumentList([encodeIntegerValue(7n)]);
/** The same argument one value higher, so the callee still accepts but the recorded hash no longer matches. */
const OTHER_ARGUMENT_PUSHES = encodeArgumentList([encodeIntegerValue(8n)]);

/** Master input indices: the caller, its callee, the validator that covers both, then the user. */
const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = 3;

interface Variant {
  readonly withArgument: boolean;
}
const WITH_ARGUMENT: Variant = { withArgument: true };
const WITHOUT_ARGUMENT: Variant = { withArgument: false };

/** The compiled selector of the callee's `ping`, which the caller's interface resolves the site to as well. */
const calleeSelectorOf = (artifacts: ReturnType<typeof compileStringMulti>): Uint8Array =>
  new Uint8Array(Buffer.from(artifacts.Callee!.abi.find((entry) => entry.name === 'ping')!.selector!, 'hex'));

/** The two-contract source; the callee's entry takes the argument the caller passes when the variant says so. */
const callingSource = (variant: Variant): string => {
  const parameter = variant.withArgument ? 'int x' : '';
  const body = variant.withArgument ? 'require(x > 0);' : 'require(true);';
  const argument = variant.withArgument ? '7' : '';
  return 'pragma solidcash ^0.13.0;'
    + ` interface ICallee { function ping(${parameter}); }`
    + ` contract Callee { function ping(${parameter}) { ${body} } }`
    + ' contract Caller {'
    + `   function callIt() { ICallee(0x${toHex(ADDRESS_CALLEE)}).ping(${argument}); require(true); }`
    + ' }';
};

const compile = (variant: Variant): ReturnType<typeof compileStringMulti> =>
  compileStringMulti(callingSource(variant), { composition: 'per-call' });

/** The finished script as bytes: the artifact publishes it as ASM, deployment fills the slots in the bytes. */
const scriptBytes = (artifact: { bytecode: string }): Uint8Array => scriptToBytecode(asmToScript(artifact.bytecode));

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

interface CompositionOptions {
  /** The argument hash the caller's record carries. */
  readonly recordedArgsHash?: Uint8Array;
  /** The selector the callee's unlocking bytecode pushes, which the caller checks against its site. */
  readonly calleeSelector?: Uint8Array;
  /** The argument pushes the callee's unlocking bytecode carries. */
  readonly calleeArgumentPushes?: Uint8Array;
}

interface Composition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

/** Builds the compiled caller, the compiled callee, a validator, and the transaction that co-spends them. */
function buildComposition(variant: Variant, options: CompositionOptions = {}): Composition {
  const artifacts = compile(variant);
  const fill = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(scriptBytes(artifact), artifact.composition!.placeholders, {
      category, contractAddress: address, templateHash: TEMPLATE_HASH,
    });
  };
  const callerProgram = fill('Caller', categorySlotValue(CATEGORY_CALLER), ADDRESS_CALLER);
  const calleeProgram = fill('Callee', categorySlotValue(CATEGORY_CALLEE), ADDRESS_CALLEE);

  const selector = calleeSelectorOf(artifacts);
  // The recorded hash is always over the argument the caller meant to pass; the mutation replaces what the callee
  // actually carries, so the two can disagree without the record moving with it.
  const recordedArgumentPushes = variant.withArgument ? ARGUMENT_PUSHES : new Uint8Array(0);
  const calleeArgumentPushes = options.calleeArgumentPushes ?? recordedArgumentPushes;
  const calleeSelector = options.calleeSelector ?? selector;

  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const validatorLock = validator.lock;

  const callerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [{
      kind: 1,
      target: ADDRESS_CALLEE,
      value: 0n,
      calleeRef: CALLEE_INDEX,
      argsHash: options.recordedArgsHash ?? argsHash(selector, recordedArgumentPushes),
      result: new Uint8Array(0),
    }],
    segments: [[], []],
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
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };

  const callerLock = encodeLockingBytecodeP2sh32(hash256(callerProgram));
  const calleeLock = encodeLockingBytecodeP2sh32(hash256(calleeProgram));
  const masterValue = 20_000n;

  const inputs = [
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(1),
      sequenceNumber: 0xffffffff,
      // The caller's own entry is entered by position: its unlocking bytecode carries no selector.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(callerProgram),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(2),
      sequenceNumber: 0xffffffff,
      // The callee's call data: the selector push, then the argument pushes, before the redeem script.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
        ...encodeDataPush(calleeSelector),
        ...calleeArgumentPushes,
        ...encodeDataPush(calleeProgram),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(3),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...validator.unlockingBytecode,
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(4),
      sequenceNumber: 0xffffffff,
      // The user's signed P2PKH input: a root frame reads its signature's hash type.
      unlockingBytecode: callerUnlockingBytecode(),
    },
  ];
  const outputs = [
    { lockingBytecode: callerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: calleeLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validatorLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const sourceOutputs = [
    { lockingBytecode: callerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: calleeLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validatorLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];

  return { transaction: { version: 2, inputs, outputs, locktime: 0 }, sourceOutputs };
}

/** One input's verdict in the BCH-2026 machine. */
function accepted(variant: Variant, options: CompositionOptions, inputIndex: number): boolean {
  const composition = buildComposition(variant, options);
  const vm = createVirtualMachineBch2026(false);
  return vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
  })) === true;
}

describe('a caller that passes an argument to its callee', () => {
  it('publishes both masters with a validator program hash slot', () => {
    const artifacts = compile(WITH_ARGUMENT);
    expect(artifacts.Caller!.composition?.convention).toBe('per-call');
    expect(artifacts.Callee!.composition?.convention).toBe('per-call');
    // A call is admitted with arguments now, so both masters publish the validator program hash slot.
    expect(artifacts.Caller!.composition!.placeholders.templateHashOffset).toBeTypeOf('number');
    expect(artifacts.Callee!.composition!.placeholders.templateHashOffset).toBeTypeOf('number');
  });

  it('is accepted at every input when the callee carries the recorded argument', () => {
    expect(accepted(WITH_ARGUMENT, {}, CALLER_INDEX)).toBe(true);
    expect(accepted(WITH_ARGUMENT, {}, CALLEE_INDEX)).toBe(true);
    expect(accepted(WITH_ARGUMENT, {}, VALIDATOR_INDEX)).toBe(true);
  });

  it('is refused when the caller records an argument hash that is not the callee\'s', () => {
    // A hash of the right shape over a different argument: only recomputing it from the callee refuses it.
    const mutated = new Uint8Array(argsHash(calleeSelectorOf(compile(WITH_ARGUMENT)), ARGUMENT_PUSHES));
    mutated[0] ^= 0xff;
    expect(accepted(WITH_ARGUMENT, { recordedArgsHash: mutated }, CALLER_INDEX)).toBe(false);
    // The callee and the validator are untouched, so the refusal is the caller's own check.
    expect(accepted(WITH_ARGUMENT, { recordedArgsHash: mutated }, CALLEE_INDEX)).toBe(true);
    expect(accepted(WITH_ARGUMENT, { recordedArgsHash: mutated }, VALIDATOR_INDEX)).toBe(true);
  });

  it('is refused when the argument and the recorded hash are changed together', () => {
    // The forgery this case exists to catch. The argument the callee carries and the hash the caller records are
    // both chosen by whoever builds the transaction, so a pair that agrees with itself satisfies every check the
    // caller makes — and the call runs with the caller's authority while carrying an argument the caller's source
    // never passed. Refusing it takes the caller computing the hash from its own argument rather than re-reading the
    // callee's.
    const forgedSelector = calleeSelectorOf(compile(WITH_ARGUMENT));
    const forgedRecord = new Uint8Array(argsHash(forgedSelector, OTHER_ARGUMENT_PUSHES));
    expect(accepted(
      WITH_ARGUMENT,
      { calleeArgumentPushes: OTHER_ARGUMENT_PUSHES, recordedArgsHash: forgedRecord },
      CALLER_INDEX,
    )).toBe(false);
  });

  it('is refused when one of the callee\'s argument pushes changes', () => {
    // The callee still accepts `8 > 0`, so only the caller's digest can refuse the composition.
    expect(accepted(WITH_ARGUMENT, { calleeArgumentPushes: OTHER_ARGUMENT_PUSHES }, CALLEE_INDEX)).toBe(true);
    expect(accepted(WITH_ARGUMENT, { calleeArgumentPushes: OTHER_ARGUMENT_PUSHES }, CALLER_INDEX)).toBe(false);
    // The recorded hash still names the original argument, so the callee's new push no longer hashes to it.
    expect(accepted(WITH_ARGUMENT, { calleeArgumentPushes: OTHER_ARGUMENT_PUSHES }, VALIDATOR_INDEX)).toBe(true);
  });

  it('runs the callee body with the argument it was entered with', () => {
    // A zero argument fails the callee's own `require(x > 0)`, so the value reaches its body and not only the hash.
    const zero = encodeArgumentList([encodeIntegerValue(0n)]);
    expect(accepted(WITH_ARGUMENT, { calleeArgumentPushes: zero }, CALLEE_INDEX)).toBe(false);
  });

  it('is refused when the callee\'s call data carries a different selector', () => {
    // A single-entry callee drops the selector it is entered with, so it accepts a foreign one; the caller's
    // site is what refuses it.
    expect(accepted(WITH_ARGUMENT, { calleeSelector: OTHER_SELECTOR }, CALLEE_INDEX)).toBe(true);
    expect(accepted(WITH_ARGUMENT, { calleeSelector: OTHER_SELECTOR }, CALLER_INDEX)).toBe(false);
  });
});

describe('a caller that passes no argument still works the same way', () => {
  it('is accepted at every input', () => {
    expect(accepted(WITHOUT_ARGUMENT, {}, CALLER_INDEX)).toBe(true);
    expect(accepted(WITHOUT_ARGUMENT, {}, CALLEE_INDEX)).toBe(true);
    expect(accepted(WITHOUT_ARGUMENT, {}, VALIDATOR_INDEX)).toBe(true);
  });

  it('records the hash of the selector alone, and refuses any other digest', () => {
    const mutated = new Uint8Array(sha256(calleeSelectorOf(compile(WITHOUT_ARGUMENT))));
    mutated[0] ^= 0xff;
    expect(accepted(WITHOUT_ARGUMENT, { recordedArgsHash: mutated }, CALLER_INDEX)).toBe(false);
    expect(accepted(WITHOUT_ARGUMENT, { recordedArgsHash: mutated }, VALIDATOR_INDEX)).toBe(true);
  });

  it('is refused when the callee carries an argument push the caller did not record', () => {
    // The extra push makes the callee's call data hash differently from the selector-alone digest.
    expect(accepted(WITHOUT_ARGUMENT, { calleeArgumentPushes: ARGUMENT_PUSHES }, CALLER_INDEX)).toBe(false);
  });
});
