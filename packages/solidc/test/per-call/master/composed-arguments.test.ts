import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  argsHash, asmToScript, computeFunctionSelector, computeFunctionSignature,
  concatBytes, encodeArgumentList, encodeIntegerValue, encodePushdataValue, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { refusalMessageOf } from './refused-entry.js';
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
  const vm = compositionMachine();
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
    // A single-entry callee requires the selector it is entered with to be its own entry's, and the caller's site
    // requires the one its record hashes.
    expect(accepted(WITH_ARGUMENT, { calleeSelector: OTHER_SELECTOR }, CALLEE_INDEX)).toBe(false);
    expect(accepted(WITH_ARGUMENT, { calleeSelector: OTHER_SELECTOR }, CALLER_INDEX)).toBe(false);
  });
});

/**
 * A call that passes a run-time composite argument the caller's own code builds where it calls.
 *
 * A struct and an array reach the code as one item already: the struct's fields' pushes concatenated, and an
 * array's length prefix followed by its packed elements. The site frames that item as the push the wire carries
 * and hashes it beside the selector, exactly as it does for a scalar it holds, so the record and the callee are
 * both held to the bytes the caller computed. The value is what the callee's own body reads, not only a hash.
 *
 * The control is a call passing an external function pointer: it is an `(address, selector)` pair rather than one
 * item, so the site still refuses it. The whole composition is settled by the BCH-2026 machine's own verdict.
 */

/** The input count of the transaction these cases build, which the array source reads at run time. */
const INPUT_COUNT = 4;

/** The caller's entry argument `n`, in the one encoding the wire allows. */
const entryPush = (n: bigint): Uint8Array => encodeDataPush(encodeIntegerValue(n));

const STRUCT_N = 9n;
const STRUCT_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' struct Rec { string tag; int n; }'
  + ' interface ICallee { function put(Rec r); }'
  + ' contract Callee { function put(Rec r) { require(r.n > 0); } }'
  + ' contract Caller { function callIt(int n) {'
  + `   ICallee(0x${toHex(ADDRESS_CALLEE)}).put(Rec("hi", n)); require(true); } }`;

/** A struct value's flattened blob: each field's push in declaration order. */
const structBlob = (n: bigint): Uint8Array => concatBytes([
  encodePushdataValue('hi', 'string'),
  encodePushdataValue(n, 'bigint'),
]);
/** The struct argument's wire push: the blob under its own length. */
const structArgumentPushes = (n: bigint): Uint8Array => encodeArgumentList([structBlob(n)]);

const ARRAY_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function take(uint16[2] xs); }'
  + ' contract Callee { function take(uint16[2] xs) { require(xs[0] > 0); } }'
  + ' contract Caller { function callIt() {'
  + '   uint16[2] xs = [uint16(tx.inputs.length), uint16(7)];'
  + `   ICallee(0x${toHex(ADDRESS_CALLEE)}).take(xs); require(true); } }`;

/** A `uint16[2]` value's blob: its count prefix, then both elements packed at their width. */
const arrayBlob = (first: bigint): Uint8Array => encodePushdataValue([first, 7n], 'uint16[2]');
/** The array argument's wire push: the blob under its own length. */
const arrayArgumentPushes = (first: bigint): Uint8Array => encodeArgumentList([arrayBlob(first)]);

/** The same array built inline at the call site, so the literal itself is what the site encodes. */
const ARRAY_LITERAL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function take(uint16[2] xs); }'
  + ' contract Callee { function take(uint16[2] xs) { require(xs[0] > 0); } }'
  + ' contract Caller { function callIt() {'
  + `   ICallee(0x${toHex(ADDRESS_CALLEE)}).take([uint16(tx.inputs.length), uint16(7)]); require(true); } }`;

/** A call passing an external function pointer, which is a pair and not the one item a digest is computed from. */
const POINTER_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function use(function(int) external returns (int) cb); }'
  + ' contract Callee { function use(function(int) external returns (int) cb) { require(true); } }'
  + ' contract Caller { function callIt() {'
  + `   ICallee(0x${toHex(ADDRESS_CALLEE)}).use(cb); require(true); }`
  + '   function cb(int x) returns (int) { return x; } }';

/** The compiled selector of a named entry, which the caller's interface resolves its site to as well. */
const selectorOf = (artifacts: ReturnType<typeof compileStringMulti>, entry: string): Uint8Array =>
  new Uint8Array(Buffer.from(artifacts.Callee!.abi.find((candidate) => candidate.name === entry)!.selector!, 'hex'));

interface CompositeOptions {
  /** The argument hash the caller's record carries, over the pushes the caller computes by default. */
  readonly recordedArgsHash?: Uint8Array;
  /** The argument pushes the callee's unlocking bytecode actually carries. */
  readonly calleeArgumentPushes?: Uint8Array;
  /** The caller entry's own argument pushes, which supply its entry parameter. */
  readonly callerEntryPushes?: Uint8Array;
}

/** Builds the compiled caller, the compiled callee, a validator, and the transaction that co-spends them. */
function buildComposite(
  source: string,
  entry: string,
  expectedPushes: Uint8Array,
  options: CompositeOptions = {},
): Composition {
  const artifacts = compileStringMulti(source, { composition: 'per-call' });
  const fill = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(scriptBytes(artifact), artifact.composition!.placeholders, {
      category, contractAddress: address, templateHash: TEMPLATE_HASH,
    });
  };
  const callerProgram = fill('Caller', categorySlotValue(CATEGORY_CALLER), ADDRESS_CALLER);
  const calleeProgram = fill('Callee', categorySlotValue(CATEGORY_CALLEE), ADDRESS_CALLEE);
  const selector = selectorOf(artifacts, entry);
  const calleeArgumentPushes = options.calleeArgumentPushes ?? expectedPushes;

  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });

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
      argsHash: options.recordedArgsHash ?? argsHash(selector, expectedPushes),
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
      // The caller's own entry is entered by position, its entry parameter pushed before the redeem script.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)),
        ...(options.callerEntryPushes ?? new Uint8Array(0)),
        ...encodeDataPush(callerProgram),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(2),
      sequenceNumber: 0xffffffff,
      // The callee's call data: the selector push, then the argument pushes, before the redeem script.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
        ...encodeDataPush(selector),
        ...calleeArgumentPushes,
        ...encodeDataPush(calleeProgram),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(3),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: validator.unlockingBytecode,
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(4),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: callerUnlockingBytecode(),
    },
  ];
  const outputs = [
    { lockingBytecode: callerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: calleeLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const sourceOutputs = [...outputs];
  return { transaction: { version: 2, inputs, outputs, locktime: 0 }, sourceOutputs };
}

/** One input's verdict for a compiled composite call in the BCH-2026 machine. */
function compositeAccepted(
  source: string,
  entry: string,
  expectedPushes: Uint8Array,
  options: CompositeOptions,
  inputIndex: number,
): boolean {
  const composition = buildComposite(source, entry, expectedPushes, options);
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
  })) === true;
}

describe('a call whose run-time argument is a composite the caller builds', () => {
  it('is accepted when the struct it built is the one the record and the callee carry', () => {
    const pushes = structArgumentPushes(STRUCT_N);
    const options = { callerEntryPushes: entryPush(STRUCT_N) };
    expect(compositeAccepted(STRUCT_SOURCE, 'put', pushes, options, CALLER_INDEX)).toBe(true);
    expect(compositeAccepted(STRUCT_SOURCE, 'put', pushes, options, CALLEE_INDEX)).toBe(true);
    expect(compositeAccepted(STRUCT_SOURCE, 'put', pushes, options, VALIDATOR_INDEX)).toBe(true);
  });

  it('reaches the callee body with the struct the caller built', () => {
    // A zero field fails the callee's own `require(r.n > 0)`, so the caller's value is what the callee's body
    // read, not only a hash the two agree on.
    const zeroPushes = structArgumentPushes(0n);
    const options = { callerEntryPushes: entryPush(0n) };
    expect(compositeAccepted(STRUCT_SOURCE, 'put', zeroPushes, options, CALLER_INDEX)).toBe(true);
    expect(compositeAccepted(STRUCT_SOURCE, 'put', zeroPushes, options, CALLEE_INDEX)).toBe(false);
  });

  it('is refused when the record carries the digest of another struct value', () => {
    const pushes = structArgumentPushes(STRUCT_N);
    const options = {
      callerEntryPushes: entryPush(STRUCT_N),
      recordedArgsHash: argsHash(selectorOf(compileStringMulti(STRUCT_SOURCE, { composition: 'per-call' }), 'put'),
        structArgumentPushes(STRUCT_N + 1n)),
    };
    expect(compositeAccepted(STRUCT_SOURCE, 'put', pushes, options, CALLER_INDEX)).toBe(false);
  });

  it('is accepted when the array it built is the one the record and the callee carry', () => {
    const pushes = arrayArgumentPushes(BigInt(INPUT_COUNT));
    expect(compositeAccepted(ARRAY_SOURCE, 'take', pushes, {}, CALLER_INDEX)).toBe(true);
    expect(compositeAccepted(ARRAY_SOURCE, 'take', pushes, {}, CALLEE_INDEX)).toBe(true);
    expect(compositeAccepted(ARRAY_SOURCE, 'take', pushes, {}, VALIDATOR_INDEX)).toBe(true);
  });

  it('is accepted when the array is a literal written at the call site', () => {
    // The literal's own value is the blob the wire carries, so the site encodes the literal rather than leaving
    // its elements loose on the stack.
    const pushes = arrayArgumentPushes(BigInt(INPUT_COUNT));
    expect(compositeAccepted(ARRAY_LITERAL_SOURCE, 'take', pushes, {}, CALLER_INDEX)).toBe(true);
    expect(compositeAccepted(ARRAY_LITERAL_SOURCE, 'take', pushes, {}, VALIDATOR_INDEX)).toBe(true);
  });

  it('is refused when the callee carries an array the caller did not build', () => {
    const pushes = arrayArgumentPushes(BigInt(INPUT_COUNT));
    expect(compositeAccepted(ARRAY_SOURCE, 'take', pushes, {
      calleeArgumentPushes: arrayArgumentPushes(BigInt(INPUT_COUNT + 1)),
    }, CALLER_INDEX)).toBe(false);
    expect(compositeAccepted(ARRAY_SOURCE, 'take', pushes, {}, CALLER_INDEX)).toBe(true);
  });

  it('still refuses a call passing an external function pointer, which is not one encodable item', () => {
    expect(refusalMessageOf(POINTER_SOURCE)).toContain('cannot encode into one push');
  });
});

