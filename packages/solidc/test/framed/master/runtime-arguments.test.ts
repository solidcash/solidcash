import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  argsHash, asmToScript, encodeArgumentList, encodeCallDataArguments, encodeIntegerValue, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, seededCategory, validatorFacetPlacements,
  validatorSpend,
} from './validator-input.js';

/**
 * A call whose argument exists only when the code runs.
 *
 * The caller passes either the transaction's own input count or `tx.origin`, so the digest its record carries and
 * the call data its callee carries are both facts about the running execution: the site computes
 * `SHA256(selector || argument pushes)` from the value it holds when it calls, and turns that value into the push
 * the wire carries — a bounded number's minimal script number, whose small values are the `OP_1`-`OP_16`
 * opcodes, and raw bytes under their own length. The record and the callee are then both held to what the
 * caller's code computed.
 *
 * Everything is compiled through `compileStringMulti`, filled by deployment, and settled by the BCH-2026 machine's
 * own verdict. Each form is accepted when the record and the callee carry what the caller computed, and refused
 * when either carries other values.
 */

const CATEGORY_CALLER = seededCategory('runtime arguments caller');
const CATEGORY_CALLEE = seededCategory('runtime arguments callee');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** A lock this transaction does not spend, for an argument the caller did not pass. */
const FOREIGN_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x33));

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** The input count of the transaction these cases build: the caller, the callee, the validator with its facet and
 * the user. The numeric form passes it as its argument, so it tracks the validator's own layout. */
const INPUT_COUNT = 5;

/** The caller passes a bounded number only the running code counts. */
const NUMERIC_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function bump(int n); }'
  + ' contract Callee { function bump(int n) { require(n > 0); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(ADDRESS_CALLEE)}).bump(tx.inputs.length); require(true); }`
  + ' }';

/** The caller passes bytes only the running code has: the lock `tx.origin` answers with. */
const BYTES_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function take(bytes origin); }'
  + ' contract Callee { function take(bytes origin) { require(origin.length > 0); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(ADDRESS_CALLEE)}).take(tx.origin); require(true); }`
  + ' }';

/**
 * The caller passes both a number and bytes, so the two parameters cannot be told apart by a symmetric check:
 * the callee's own body names each parameter's value and length, and only one assignment of the two pushes
 * satisfies it.
 */
const PAIR_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(int x, bytes y); }'
  + ` contract Callee { function ping(int x, bytes y) { require(x == ${INPUT_COUNT}); `
  + `require(y.length == ${USER_LOCK.length}); } }`
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(ADDRESS_CALLEE)}).ping(tx.inputs.length, tx.origin); require(true); }`
  + ' }';

/**
 * The same two-parameter call with both arguments named in the source, so the digest is folded at compile time
 * rather than computed where the call runs. The two paths have to agree on the order the call data carries.
 */
const PAIR_CONSTANT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(int x, bytes y); }'
  + ' contract Callee { function ping(int x, bytes y) { require(x == 7); require(y.length == 2); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(ADDRESS_CALLEE)}).ping(7, hex"aabb"); require(true); }`
  + ' }';

/** Master input indices: the caller, its callee, the validator with its facet, then the user. */
const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const VALIDATOR_FACET_INDEX = VALIDATOR_INDEX + 1;
const USER_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;

/** The finished script as bytes: the artifact publishes it as ASM, deployment fills the slots in the bytes. */
const scriptBytes = (artifact: { bytecode: string }): Uint8Array => scriptToBytecode(asmToScript(artifact.bytecode));

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

interface Fixture {
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly selector: Uint8Array;
  /** The pushes the caller's own code computes, which the record and the callee have to carry. */
  readonly argumentPushes: Uint8Array;
}

const compiledFixtures = new Map<string, Fixture>();

/** Compiles one source and reads the callee's selector, which the caller's interface resolves its site to. */
function fixture(source: string, argumentPushes: Uint8Array): Fixture {
  const cached = compiledFixtures.get(source);
  if (cached !== undefined) return cached;
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  const entry = artifacts.Callee!.abi.find((candidate) => candidate.selector !== undefined)!;
  const selector = new Uint8Array(Buffer.from(entry.selector!, 'hex'));
  const built = { artifacts, selector, argumentPushes };
  compiledFixtures.set(source, built);
  return built;
}

interface CompositionOptions {
  /** The argument hash the caller's record carries, over the pushes the caller computes by default. */
  readonly recordedArgsHash?: Uint8Array;
  /** The argument pushes the callee's unlocking bytecode actually carries. */
  readonly calleeArgumentPushes?: Uint8Array;
}

interface Composition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

/** Builds the compiled caller, the compiled callee, a validator, and the transaction that co-spends them. */
function buildComposition(source: string, pushes: Uint8Array, options: CompositionOptions = {}): Composition {
  const { artifacts, selector } = fixture(source, pushes);
  const fill = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(scriptBytes(artifact), artifact.composition!.placeholders, {
      category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
    });
  };
  const callerProgram = fill('Caller', CATEGORY_CALLER, ADDRESS_CALLER);
  const calleeProgram = fill('Callee', CATEGORY_CALLEE, ADDRESS_CALLEE);

  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const facets = validatorFacetPlacements();

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
      argsHash: options.recordedArgsHash ?? argsHash(selector, pushes),
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
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(callerProgram),
      ]),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
      // The callee's call data: the selector push, then the argument pushes, before the redeem script.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
        ...encodeDataPush(selector),
        ...(options.calleeArgumentPushes ?? pushes),
        ...encodeDataPush(calleeProgram),
      ]),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(3), sequenceNumber: 0xffffffff,
      unlockingBytecode: validator.unlockingBytecode,
    },
    ...facets.map((facet) => facet.input),
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
      unlockingBytecode: callerUnlockingBytecode(),
    },
  ];
  const outputs = [
    { lockingBytecode: callerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: calleeLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    ...facets.map((facet) => facet.output),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const sourceOutputs = [...outputs];

  return { transaction: { version: 2, inputs, outputs, locktime: 0 }, sourceOutputs };
}

/** One input's verdict in the BCH-2026 machine. */
function accepted(
  source: string,
  pushes: Uint8Array,
  options: CompositionOptions,
  inputIndex: number,
): boolean {
  const composition = buildComposition(source, pushes, options);
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
  })) === true;
}

/** The push the caller's code computes for the input count: a minimal script number, `OP_4` here. */
const COUNT_PUSHES = encodeArgumentList([encodeIntegerValue(BigInt(INPUT_COUNT))]);
/** The push the caller's code computes for `tx.origin`: the origin lock under its own length. */
const ORIGIN_PUSHES = encodeArgumentList([USER_LOCK]);

describe('a call whose argument exists only when the code runs', () => {
  it('is accepted when a bounded number it computed is the one the record and the callee carry', () => {
    expect(accepted(NUMERIC_SOURCE, COUNT_PUSHES, {}, CALLER_INDEX)).toBe(true);
    expect(accepted(NUMERIC_SOURCE, COUNT_PUSHES, {}, CALLEE_INDEX)).toBe(true);
    expect(accepted(NUMERIC_SOURCE, COUNT_PUSHES, {}, VALIDATOR_INDEX)).toBe(true);
  });

  it('is accepted when bytes it computed are the ones the record and the callee carry', () => {
    expect(accepted(BYTES_SOURCE, ORIGIN_PUSHES, {}, CALLER_INDEX)).toBe(true);
    expect(accepted(BYTES_SOURCE, ORIGIN_PUSHES, {}, CALLEE_INDEX)).toBe(true);
    expect(accepted(BYTES_SOURCE, ORIGIN_PUSHES, {}, VALIDATOR_INDEX)).toBe(true);
  });

  it('is refused when the record carries the digest of another value', () => {
    // The caller recomputes the argument where it calls, so a record over another number or another lock is
    // refused: the disagreement cannot be absorbed by the record moving with the bytes it is compared against.
    const otherCount = encodeArgumentList([encodeIntegerValue(BigInt(INPUT_COUNT + 1))]);
    const otherOrigin = encodeArgumentList([FOREIGN_LOCK]);
    expect(accepted(NUMERIC_SOURCE, COUNT_PUSHES, {
      recordedArgsHash: argsHash(fixture(NUMERIC_SOURCE, COUNT_PUSHES).selector, otherCount),
    }, CALLER_INDEX)).toBe(false);
    expect(accepted(BYTES_SOURCE, ORIGIN_PUSHES, {
      recordedArgsHash: argsHash(fixture(BYTES_SOURCE, ORIGIN_PUSHES).selector, otherOrigin),
    }, CALLER_INDEX)).toBe(false);
    expect(accepted(NUMERIC_SOURCE, COUNT_PUSHES, {}, CALLER_INDEX)).toBe(true);
    expect(accepted(BYTES_SOURCE, ORIGIN_PUSHES, {}, CALLER_INDEX)).toBe(true);
  });

  it('is refused when the callee carries a value the caller did not compute', () => {
    expect(accepted(NUMERIC_SOURCE, COUNT_PUSHES, {
      calleeArgumentPushes: encodeArgumentList([encodeIntegerValue(BigInt(INPUT_COUNT + 1))]),
    }, CALLER_INDEX)).toBe(false);
    expect(accepted(BYTES_SOURCE, ORIGIN_PUSHES, {
      calleeArgumentPushes: encodeArgumentList([FOREIGN_LOCK]),
    }, CALLER_INDEX)).toBe(false);
    expect(accepted(NUMERIC_SOURCE, COUNT_PUSHES, {}, CALLER_INDEX)).toBe(true);
    expect(accepted(BYTES_SOURCE, ORIGIN_PUSHES, {}, CALLER_INDEX)).toBe(true);
  });

  it('reaches the callee body with the value the caller computed', () => {
    // A zero fails the callee's own `require(n > 0)`, so the number the caller computed reaches the callee's frame
    // and its body is not only agreeing about a hash.
    expect(accepted(NUMERIC_SOURCE, COUNT_PUSHES, {
      calleeArgumentPushes: encodeArgumentList([encodeIntegerValue(0n)]),
    }, CALLEE_INDEX)).toBe(false);
    expect(accepted(NUMERIC_SOURCE, COUNT_PUSHES, {}, CALLEE_INDEX)).toBe(true);
  });
});

/** The two pushes the caller computes, in the order a callee's call data carries them. */
const PAIR_PUSHES = encodeCallDataArguments([encodeIntegerValue(BigInt(INPUT_COUNT)), USER_LOCK]);
/** The same two pushes in parameter order, which is not the order the call data carries. */
const PAIR_PUSHES_BY_PARAMETER = encodeArgumentList([encodeIntegerValue(BigInt(INPUT_COUNT)), USER_LOCK]);

describe('a call that passes more than one argument', () => {
  it('is accepted at every input when both pushes are the ones the caller computed', () => {
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, {}, CALLER_INDEX)).toBe(true);
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, {}, CALLEE_INDEX)).toBe(true);
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, {}, VALIDATOR_INDEX)).toBe(true);
  });

  it('refuses a call whose data carries the parameters in the order the source names them', () => {
    // Both pushes are present and both values are the ones the caller computed; only their order differs, and the
    // callee's own body is what says the order is wrong: it reads the first parameter from the top of the stack.
    const options = { calleeArgumentPushes: PAIR_PUSHES_BY_PARAMETER };
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, options, CALLEE_INDEX)).toBe(false);
    // The caller hashes the callee's call data itself, so it refuses the same call data without the callee's help.
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, options, CALLER_INDEX)).toBe(false);
    // The digest of the callee's pushes against the record is an edge rule, which the split runs in the facet at
    // `head + 1`, so the facet is the third refusal.
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, options, VALIDATOR_FACET_INDEX)).toBe(false);
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, {}, CALLER_INDEX)).toBe(true);
  });

  it('refuses a record whose digest is over the parameters in the order the source names them', () => {
    const options = {
      recordedArgsHash: argsHash(fixture(PAIR_SOURCE, PAIR_PUSHES).selector, PAIR_PUSHES_BY_PARAMETER),
    };
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, options, CALLER_INDEX)).toBe(false);
    // The record's digest is the same edge rule, so the facet is the validator input that refuses it too.
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, options, VALIDATOR_FACET_INDEX)).toBe(false);
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, {}, CALLER_INDEX)).toBe(true);
  });

  it('reaches each callee parameter with its own value', () => {
    // The callee's `x` must be the count and its `y` the lock; a transposed call data fails the callee's own body
    // rather than only a digest, so the wires are read at the depths the compiled body reads them at.
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, {
      calleeArgumentPushes: encodeCallDataArguments([encodeIntegerValue(0n), USER_LOCK]),
    }, CALLEE_INDEX)).toBe(false);
    // A lock of another length is the mismatch the second parameter's own `require` names, so the order is not the
    // only thing the callee's body is holding the call data to.
    const otherLengthLock = encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(0x44));
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, {
      calleeArgumentPushes: encodeCallDataArguments([encodeIntegerValue(BigInt(INPUT_COUNT)), otherLengthLock]),
    }, CALLEE_INDEX)).toBe(false);
    expect(accepted(PAIR_SOURCE, PAIR_PUSHES, {}, CALLEE_INDEX)).toBe(true);
  });

  it('orders a call whose arguments the source names the same way', () => {
    // The other path to the same digest: the compiler folds the pushes of two compile-time values. It has to fold
    // them in the order the call data carries, or a call the body would accept is refused by its own caller.
    const named = encodeCallDataArguments([encodeIntegerValue(7n), new Uint8Array([0xaa, 0xbb])]);
    expect(accepted(PAIR_CONSTANT_SOURCE, named, {}, CALLER_INDEX)).toBe(true);
    expect(accepted(PAIR_CONSTANT_SOURCE, named, {}, CALLEE_INDEX)).toBe(true);
    expect(accepted(PAIR_CONSTANT_SOURCE, named, {}, VALIDATOR_INDEX)).toBe(true);
    const namedByParameter = encodeArgumentList([encodeIntegerValue(7n), new Uint8Array([0xaa, 0xbb])]);
    expect(accepted(PAIR_CONSTANT_SOURCE, named, {
      calleeArgumentPushes: namedByParameter,
    }, CALLER_INDEX)).toBe(false);
    expect(accepted(PAIR_CONSTANT_SOURCE, named, {}, CALLER_INDEX)).toBe(true);
  });
});
