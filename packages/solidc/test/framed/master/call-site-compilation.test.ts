import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256, Opcodes,
} from '@bitauth/libauth';
import {
  argsHash, asmToScript, computeFunctionSelector, computeFunctionSignature,
  encodeArgumentList, encodeIntegerValue, encodeResultList, encodeWitnessBlock, scriptToBytecode, sha256,
  splitFirstPush, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { buildMasterHeadScript } from '../../../src/framed/master/master-head.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { SIGHASH_ALL, callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * A compiled caller binds each external call to its own witness record where the call is made.
 *
 * The caller is compiled from source through the real entry point. Its body reads the witness block it carries,
 * walks to the record its site names, and binds the record to what the source says: the frame kind, the target,
 * the digest of the source's own argument values, and the callee's call data. The value the body uses for the call
 * is the record's `result`, so a call whose result the caller consumes is compiled, not refused.
 *
 * The callee is a head-built stand-in, because what is under test is the caller's own code. The validator input
 * runs the shipped program. Each refusal is shown next to the inputs it does not touch, so the verdict is the
 * check under test rather than a malformed composition.
 */

const CATEGORY_CALLER = seededCategory('call site caller');
const CATEGORY_CALLEE = seededCategory('call site callee');
/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/**
 * The two selectors the interfaces below resolve their call sites to.
 *
 * Solidity-compatible `int` is the 256-bit type, so an interface's `ping(int x)` resolves to the signature
 * `ping(int256)`. The compiler attributes the same signature to the call data the callee carries.
 */
const PING_WITH_ARGUMENT_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', ['int256']));
const PING_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));

/** The canonical argument pushes: `7` and `8` as minimal script numbers. */
const SEVEN = encodeArgumentList([encodeIntegerValue(7n)]);
const EIGHT = encodeArgumentList([encodeIntegerValue(8n)]);
/** The canonical result encoding: `42` and `43` as a minimal push of a minimal script number. */
const FORTY_TWO = encodeResultList([encodeIntegerValue(42n)]);
const FORTY_THREE = encodeResultList([encodeIntegerValue(43n)]);

/**
 * A caller that passes a compile-time argument and ignores the result. `7` is the source's own operand, so the
 * digest the site computes is `SHA256(selector || push(7))` and nothing else can satisfy it.
 */
const ARGUMENT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(int x); }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(ADDRESS_CALLEE)}).ping(7); require(true); }`
  + ' }';

/** A caller that uses the value the call returns: `require` compares it with `42`. */
const RESULT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping() returns (int); }'
  + ' contract Caller {'
  + `   function callIt() { require(ICallee(0x${toHex(ADDRESS_CALLEE)}).ping() == 42); }`
  + ' }';

const scriptBytes = (artifact: { bytecode: string }): Uint8Array => scriptToBytecode(asmToScript(artifact.bytecode));

/** How many minimal pushes a call-data byte string holds. */
function pushCount(pushes: Uint8Array): number {
  let count = 0;
  let rest = pushes;
  while (rest.length > 0) {
    rest = splitFirstPush(rest).rest;
    count += 1;
  }
  return count;
}

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

/** Master input indices: the caller, its callee, the validator that covers both, then the user. */
const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = 3;

interface CompositionOptions {
  readonly source: string;
  /** The selector the call site records, which the interface's declaration resolves to. */
  readonly selector: Uint8Array;
  /** The argument pushes the callee's call data carries, after its selector push. */
  readonly calleeArgumentPushes?: Uint8Array;
  /** The argument hash the caller's record carries; the digest of the site's own values unless replaced. */
  readonly recordedArgsHash?: Uint8Array;
  /** The result the caller's record carries. */
  readonly recordedResult?: Uint8Array;
  /** Repoint the caller's recorded callee. */
  readonly calleeRef?: number;
  /** Replace the caller's recorded target. */
  readonly target?: Uint8Array;
}

interface Composition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

/** Compiled once per source: every case of a source spends the same caller, and compiling dominates the file. */
const compiledBySource = new Map<string, ReturnType<typeof compileString>>();
function compiled(source: string): ReturnType<typeof compileString> {
  let artifact = compiledBySource.get(source);
  if (artifact === undefined) {
    artifact = compileString(source, { composition: 'framed' });
    compiledBySource.set(source, artifact);
  }
  return artifact;
}

/** Builds the compiled caller, a callee stand-in, a validator, and the transaction that co-spends them. */
function buildComposition(options: CompositionOptions): Composition {
  const artifact = compiled(options.source);
  const callerProgram = fillPlaceholders(
    scriptBytes(artifact),
    artifact.composition!.placeholders,
    { category: categorySlotValue(CATEGORY_CALLER), contractAddress: ADDRESS_CALLER, templateHash: TEMPLATE_HASH },
  );

  const callArguments = options.calleeArgumentPushes ?? new Uint8Array(0);

  // The callee runs a message-call frame; the head builder admits it and a body that leaves the input truthy
  // stands in for a compiled entry.
  const calleeHead = buildMasterHeadScript({
    blockOnTop: false, frameKinds: [0, 1], reservesValidatorHashSlot: true,
  });
  const filledCallee = fillPlaceholders(
    calleeHead.script,
    {
      version: 1,
      categoryOffset: calleeHead.categorySlotOffset,
      addressOffset: calleeHead.addressSlotOffset,
      templateHashOffset: calleeHead.validatorHashSlotOffset,
    },
    { category: categorySlotValue(CATEGORY_CALLEE), contractAddress: ADDRESS_CALLEE, templateHash: TEMPLATE_HASH },
  );
  // The head drops the block copy, then leaves the four frame values, the category-owner index, the declared call
  // count and the callee's call data, which carries the selector and one push per argument the site passes.
  const calleeProgram = new Uint8Array([
    ...filledCallee,
    ...new Array<number>(4 + 1 + 1 + 1 + pushCount(callArguments)).fill(Opcodes.OP_DROP),
    Opcodes.OP_1,
  ]);

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
      target: options.target ?? ADDRESS_CALLEE,
      value: 0n,
      calleeRef: options.calleeRef ?? CALLEE_INDEX,
      argsHash: options.recordedArgsHash ?? argsHash(options.selector, callArguments),
      result: options.recordedResult ?? new Uint8Array(0),
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
        ...encodeDataPush(options.selector),
        ...callArguments,
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
      // The user's signed P2PKH input: the caller's root frame reads its signature's hash type.
      unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
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
function accepted(options: CompositionOptions, inputIndex: number): boolean {
  const composition = buildComposition(options);
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
  })) === true;
}

describe('a compiled call site binds the record the source names', () => {
  it('is accepted when the record carries the source\'s own argument digest and the callee\'s bytes', () => {
    expect(accepted({
      source: ARGUMENT_SOURCE, selector: PING_WITH_ARGUMENT_SELECTOR, calleeArgumentPushes: SEVEN,
    }, CALLER_INDEX)).toBe(true);
    expect(accepted({
      source: ARGUMENT_SOURCE, selector: PING_WITH_ARGUMENT_SELECTOR, calleeArgumentPushes: SEVEN,
    }, CALLEE_INDEX)).toBe(true);
  });

  it('refuses an argument and a recorded hash changed together', () => {
    // The forgery the call site exists to catch. The argument the callee carries and the hash the record carries
    // are both chosen by whoever builds the transaction, so a pair that agrees with itself satisfies every check
    // that reads only the record and the callee. The caller's code computes the digest from the source's own `7`,
    // so the pair is refused, while the callee stand-in accepts the callee's own input either way.
    expect(accepted({
      source: ARGUMENT_SOURCE, selector: PING_WITH_ARGUMENT_SELECTOR,
      calleeArgumentPushes: EIGHT, recordedArgsHash: argsHash(PING_WITH_ARGUMENT_SELECTOR, EIGHT),
    }, CALLER_INDEX)).toBe(false);
    expect(accepted({
      source: ARGUMENT_SOURCE, selector: PING_WITH_ARGUMENT_SELECTOR, calleeArgumentPushes: EIGHT,
    }, CALLEE_INDEX)).toBe(true);
  });

  it('refuses an argument the source did not pass', () => {
    expect(accepted({
      source: ARGUMENT_SOURCE, selector: PING_WITH_ARGUMENT_SELECTOR, calleeArgumentPushes: EIGHT,
    }, CALLER_INDEX)).toBe(false);
  });
});

describe('a compiled call whose result the caller uses', () => {
  it('is accepted, and the value it used is the recorded one', () => {
    // `require(ping() == 42)` reads `42` from the record, decodes it and compares. The callee's own program
    // publishes nothing: the record is the only source of the value.
    expect(accepted({
      source: RESULT_SOURCE, selector: PING_SELECTOR, recordedResult: FORTY_TWO,
    }, CALLER_INDEX)).toBe(true);
    expect(accepted({
      source: RESULT_SOURCE, selector: PING_SELECTOR, recordedResult: FORTY_TWO,
    }, CALLEE_INDEX)).toBe(true);
  });

  it('refuses a recorded result the caller\'s own comparison does not accept', () => {
    // The same call with a different recorded value fails the caller's `require`, so the value it used really came
    // from the record and not from the callee's bytes or from a constant.
    expect(accepted({
      source: RESULT_SOURCE, selector: PING_SELECTOR, recordedResult: FORTY_THREE,
    }, CALLER_INDEX)).toBe(false);
    expect(accepted({
      source: RESULT_SOURCE, selector: PING_SELECTOR, recordedResult: FORTY_THREE,
    }, CALLEE_INDEX)).toBe(true);
  });
});
