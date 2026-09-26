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
 * The caller's call site binds its record to the digest of the source's own argument, and the callee carries that
 * argument between its selector push and its redeem script. Only two compiled masters show the cases kept here: the
 * whole composition accepted with an argument, the argument reaching the compiled callee's body, and a foreign
 * selector in the callee's call data refused by the caller.
 *
 * The digest refusals are covered where they are decided: a mismatched or forged record and an argument the source
 * did not pass in `call-site-compilation.test.ts`, the callee's pushes against the record in the validator
 * program's suite. The zero-argument shape is `composed-compiled.test.ts`.
 *
 * Everything is compiled through `compileStringMulti`, filled by deployment, and settled by the machine's own
 * verdict.
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

/** Master input indices: the caller, its callee, the validator that covers both, then the user. */
const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = 3;

interface Variant {
  readonly withArgument: boolean;
}
const WITH_ARGUMENT: Variant = { withArgument: true };

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

/** Compiled once per variant: every case spends the same two masters, and compiling dominates the file's time. */
const compiled = new Map<boolean, ReturnType<typeof compileStringMulti>>();
const compile = (variant: Variant): ReturnType<typeof compileStringMulti> => {
  const cached = compiled.get(variant.withArgument);
  if (cached !== undefined) return cached;
  const artifacts = compileStringMulti(callingSource(variant), { composition: 'per-call' });
  compiled.set(variant.withArgument, artifacts);
  return artifacts;
};

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
  it('is accepted at every input when the callee carries the recorded argument', () => {
    expect(accepted(WITH_ARGUMENT, {}, CALLER_INDEX)).toBe(true);
    expect(accepted(WITH_ARGUMENT, {}, CALLEE_INDEX)).toBe(true);
    expect(accepted(WITH_ARGUMENT, {}, VALIDATOR_INDEX)).toBe(true);
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
