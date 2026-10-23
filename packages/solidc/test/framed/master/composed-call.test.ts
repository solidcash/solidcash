import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256, Opcodes,
} from '@bitauth/libauth';
import {
  asmToScript, computeFunctionSelector, computeFunctionSignature,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { buildMasterHeadScript, type MasterHeadOptions } from '../../../src/framed/master/master-head.js';
import { findPlaceholderOffsets } from '../../../src/framed/master/master-program.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { SIGHASH_ALL, callerUnlockingBytecode } from './caller-input.js';
import {
  ALTERNATE_ACCEPTING_PROGRAM, REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, seededCategory,
  validatorFacetPlacements, validatorSpend,
} from './validator-input.js';

/**
 * A composed transaction: one compiled master calls a stand-in master and a validator input covers both.
 *
 * The caller is compiled from source, so its call is bound where the call is made: the caller's own code reads the
 * witness block it carries, walks to the record its site names, and requires the record's kind, target, `argsHash`
 * and `calleeRef` to be the ones the source fixes. The `argsHash` is the digest of the source's own argument
 * values, so a record and a callee that agree with each other but not with the source are refused. The callee is a
 * head-built stand-in, and runs as a message-call frame where the validator binds the values a master cannot see —
 * its `msg.sender`, its `value` and its origin — while the master still checks the address it presents.
 *
 * Both masters point at the same validator input. That validator is recognised from its own redemption path: it
 * holds a mutable token of the category its redeem script pins, and the program after that pin hashes to the
 * constant every master carries. The transcript is skipped and never interpreted.
 *
 * Every input's script is evaluated: the machine's own accept/reject verdict is the assertion. The controls
 * matter as much as the accept, so each mutation is checked together with the validator's own acceptance, which
 * shows the composition is otherwise well formed and the refusal comes from the check under test.
 */

const CATEGORY_A = seededCategory('composed call caller');
const CATEGORY_B = seededCategory('composed call callee');
const OTHER_CATEGORY = seededCategory('composed call other');

/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);

/** The selector the caller records, which the interface's `ping()` resolves the site to. */
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
/** A second selector, for a mutated call record. */
const OTHER_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', ['bytes32']));

const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const ADDRESS_A = validatorAddress(CATEGORY_A, VALIDATOR_PROGRAM);
const ADDRESS_B = validatorAddress(CATEGORY_B, VALIDATOR_PROGRAM);

/** Input indices; two masters, the validator with its facet directly after it, then the user. */
const A_INDEX = 0;
const B_INDEX = 1;
const VALIDATOR_INDEX = 2;
const VALIDATOR_FACET_INDEX = VALIDATOR_INDEX + 1;
const USER_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;

/**
 * The caller's source: one entry that calls the callee at its code-baked address.
 *
 * The callee is named by a `hex` address literal so the call site's target is a compile-time value the compiled
 * body can require a record to carry. The interface declares `ping` with no parameters, which is the selector the
 * call site records.
 */
const CALLER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${Buffer.from(ADDRESS_B).toString('hex')}).ping.call(); require(true); }`
  + ' }';

/** The compiled caller program, with its deployment slots filled the way a deployment fills them. */
const COMPILED_CALLER_PROGRAM = ((): Uint8Array => {
  const artifact = compileString(CALLER_SOURCE, { composition: 'framed' });
  return fillPlaceholders(
    scriptToBytecode(asmToScript(artifact.bytecode)),
    artifact.composition!.placeholders,
    { category: categorySlotValue(CATEGORY_A), contractAddress: ADDRESS_A, templateHash: TEMPLATE_HASH },
  );
})();

interface MasterShape {
  readonly category: Uint8Array;
  readonly address: Uint8Array;
  readonly options: MasterHeadOptions;
  readonly body?: Uint8Array;
}

/** What the machine is asked to evaluate, so the fixtures need no cast at the call. */
type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

interface Composition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
  readonly order: readonly number[];
}

interface CompositionOptions {
  /** Replace the caller's recorded argument hash. */
  readonly argsHash?: Uint8Array;
  /** Repoint the caller's recorded callee. */
  readonly calleeRef?: number;
  /** Replace the caller's recorded target. */
  readonly target?: Uint8Array;
  /** Remove the caller's validator reference. */
  readonly dropValidatorOnCaller?: boolean;
  /** Replace the validator's program, so its hash is not the constant. */
  readonly validatorProgram?: Uint8Array;
  /** Change the category the validator UTXO carries, leaving its pin alone. */
  readonly validatorCategory?: Uint8Array;
  /** The value the caller's record and the callee's frame both carry. */
  readonly recordValue?: bigint;
}

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } => ({
  category,
  amount: 0n,
  nft: { capability, commitment: new Uint8Array(0) },
});

/** The filled program of one master: the head, then a body that leaves the input truthy. */
function masterProgram(shape: MasterShape): { program: Uint8Array; lock: Uint8Array } {
  const head = buildMasterHeadScript(shape.options);
  const filled = fillPlaceholders(
    head.script,
    { version: 1, ...findPlaceholderOffsets(head.script, head.validatorHashSlotOffset !== undefined) },
    {
      category: categorySlotValue(shape.category),
      contractAddress: shape.address,
      ...(head.validatorHashSlotOffset === undefined ? {} : { templateHash: TEMPLATE_HASH }),
    },
  );
  const program = new Uint8Array([...filled, ...(shape.body ?? new Uint8Array([Opcodes.OP_1]))]);
  return { program, lock: encodeLockingBytecodeP2sh32(hash256(program)) };
}

/** Builds the whole transaction: two masters, a validator, a user, and one output per input. */
function buildComposition(options: CompositionOptions = {}): Composition {
  const validatorProgram = options.validatorProgram ?? VALIDATOR_PROGRAM;
  // The masters hash `TEMPLATE_HASH`. A replaced program changes the redeem the input runs, not that constant.
  const validator = validatorSpend(CATEGORY_A, {
    roots: [A_INDEX], masters: [A_INDEX, B_INDEX], settles: [],
  }, validatorProgram);
  const validatorLock = validator.lock;
  const facets = validatorFacetPlacements();

  const callerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: options.dropValidatorOnCaller === true ? 0xffff : VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_A,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [{
      kind: 1,
      target: options.target ?? ADDRESS_B,
      value: options.recordValue ?? 0n,
      calleeRef: options.calleeRef ?? B_INDEX,
      argsHash: options.argsHash ?? sha256(CALLEE_SELECTOR),
      result: new Uint8Array(0),
    }],
    segments: [[], []],
    events: [],
    sends: [],
  };
  const calleeBlock: WitnessBlock = {
    kind: 1,
    callerRef: A_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_A,
    self: ADDRESS_B,
    value: options.recordValue ?? 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };

  const callerProgram = COMPILED_CALLER_PROGRAM;
  const caller = {
    program: callerProgram,
    lock: encodeLockingBytecodeP2sh32(hash256(callerProgram)),
  };
  // The callee carries its own selector push, which is the call data the caller hashes.
  const callee = masterProgram({
    category: CATEGORY_B,
    address: ADDRESS_B,
    options: { blockOnTop: false, frameKinds: [0, 1], reservesValidatorHashSlot: true, calls: [] },
    // The head leaves the four frame values, the category-owner index and the block's declared call count above
    // the callee's own selector push.
    body: new Uint8Array([
      Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP,
      Opcodes.OP_DROP, Opcodes.OP_1,
    ]),
  });

  const masterToken = (category: Uint8Array): ReturnType<typeof token> => token(category, 'minting');
  const validatorToken = token(options.validatorCategory ?? CATEGORY_A, 'mutable');
  const masterValue = 20_000n;
  const validatorValue = 20_000n;
  const userValue = 100_000n;

  const inputs = [
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(1),
      sequenceNumber: 0xffffffff,
      // The caller takes no selector: its own entry is the one the unlocking bytecode names by position.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)),
        ...encodeDataPush(caller.program),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(2),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
        ...encodeDataPush(CALLEE_SELECTOR),
        ...encodeDataPush(callee.program),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(3),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: validator.unlockingBytecode,
    },
    ...facets.map((facet) => facet.input),
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(4),
      sequenceNumber: 0xffffffff,
      // The user's signed P2PKH input: the caller's root frame reads its signature's hash type.
      unlockingBytecode: callerUnlockingBytecode(),
    },
  ];

  const outputs = [
    { lockingBytecode: caller.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_A) },
    { lockingBytecode: callee.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_B) },
    { lockingBytecode: validatorLock, valueSatoshis: validatorValue, token: validatorToken },
    ...facets.map((facet) => facet.output),
    { lockingBytecode: USER_LOCK, valueSatoshis: userValue },
  ];

  const sourceOutputs = [
    { lockingBytecode: caller.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_A) },
    { lockingBytecode: callee.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_B) },
    { lockingBytecode: validatorLock, valueSatoshis: validatorValue, token: validatorToken },
    ...facets.map((facet) => facet.output),
    { lockingBytecode: USER_LOCK, valueSatoshis: userValue },
  ];

  return {
    transaction: { version: 2, inputs, outputs, locktime: 0 },
    sourceOutputs,
    order: [A_INDEX, B_INDEX, VALIDATOR_INDEX, VALIDATOR_FACET_INDEX],
  };
}

/** Evaluates one input's script; libauth decides one input at a time, so a composition is every input. */
function outcome(composition: Composition, inputIndex: number): { accepted: boolean; objection?: string } {
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex,
    sourceOutputs: composition.sourceOutputs,
    transaction: composition.transaction,
  });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

/** Every input's verdict, so a composition is accepted only when all of them are. */
function verdicts(options: CompositionOptions = {}): Record<number, { accepted: boolean; objection?: string }> {
  const composition = buildComposition(options);
  return Object.fromEntries(composition.order.map((index) => [index, outcome(composition, index)]));
}

/**
 * Builds a transaction that spends `masterCount` copies of one standalone master and evaluates each of them.
 *
 * A standalone master is entered by a user and makes no call, so the only thing that can make it inadmissible is
 * how many masters of its own category the transaction spends. The masters share a program and differ only in
 * their outpoints, which is the same contract spent twice.
 */
function standaloneVerdicts(
  masterCount: number,
  callerHashType: number = SIGHASH_ALL,
): readonly { accepted: boolean; objection?: string }[] {
  const master = masterProgram({
    category: CATEGORY_A,
    address: ADDRESS_A,
    options: { blockOnTop: true },
    body: new Uint8Array([
      Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP,
      Opcodes.OP_1,
    ]),
  });
  const userIndex = masterCount;
  const block: WitnessBlock = {
    kind: 0,
    callerRef: userIndex,
    originRef: userIndex,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: ADDRESS_A,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const inputs = [
    ...new Array<number>(masterCount).fill(0).map((_, index) => ({
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(index + 1),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(block)),
        ...encodeDataPush(master.program),
      ]),
    })),
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(0xf0),
      sequenceNumber: 0xffffffff,
      // The user's signed P2PKH input: the standalone master's root frame reads its signature's hash type.
      unlockingBytecode: callerUnlockingBytecode(callerHashType),
    },
  ];
  const outputs: VmTransaction['outputs'] = [
    ...new Array<number>(masterCount).fill(0).map(() => ({
      lockingBytecode: master.lock, valueSatoshis: 20_000n, token: token(CATEGORY_A, 'minting'),
    })),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    ...new Array<number>(masterCount).fill(0).map(() => ({
      lockingBytecode: master.lock, valueSatoshis: 20_000n, token: token(CATEGORY_A, 'minting'),
    })),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  return new Array<number>(masterCount).fill(0).map((_, index) => {
    const state = vm.evaluate({ inputIndex: index, sourceOutputs, transaction });
    return vm.stateSuccess(state) === true
      ? { accepted: true }
      : { accepted: false, objection: String(state.error) };
  });
}

describe('a standalone master and how many masters its contract has', () => {
  it('is accepted when it is its contract\'s only master in the transaction', () => {
    expect(standaloneVerdicts(1)).toStrictEqual([{ accepted: true }]);
  });

  it('is refused when its contract has a second master in the transaction', () => {
    // It names no validator, so it stands alone only if it is the only master of its category; a scan of the
    // inputs is what refuses the second one.
    expect(standaloneVerdicts(2).every((result) => !result.accepted)).toBe(true);
  });
  // The standalone arm's hash-type refusal is `master-program.test.ts`'s, on a compiled master.
});

describe('a master that calls another master, covered by one validator', () => {
  it('is accepted by the virtual machine at every input', () => {
    const results = verdicts();
    expect(results[A_INDEX]).toStrictEqual({ accepted: true });
    expect(results[B_INDEX]).toStrictEqual({ accepted: true });
    expect(results[VALIDATOR_INDEX]).toStrictEqual({ accepted: true });
  });

  it('has a caller that fails when the recorded argument hash is not its selector', () => {
    const mutated = new Uint8Array(sha256(CALLEE_SELECTOR));
    mutated[0] ^= 0xff;
    const results = verdicts({ argsHash: mutated });
    expect(results[A_INDEX].accepted).toBe(false);
    // The digest is an edge rule, which the split runs in the facet at `head + 1` rather than in the head, so the
    // facet is the input that refuses the mismatched digest.
    expect(results[VALIDATOR_FACET_INDEX].accepted).toBe(false);
  });

  it('has a caller that fails when the recorded argument hash is another selector of the callee', () => {
    // A hash that is well formed but names a different function: only recomputing the hash from the callee's own
    // call data refuses it.
    const results = verdicts({ argsHash: sha256(OTHER_SELECTOR) });
    expect(results[A_INDEX].accepted).toBe(false);
  });

  it('has a caller that fails when its record passes value its source does not', () => {
    const results = verdicts({ recordValue: 1n });
    expect(results[A_INDEX].accepted).toBe(false);
    // The record and the callee's frame agree, so the validator's binding holds: the refusal is the site's.
    expect(results[VALIDATOR_INDEX]).toStrictEqual({ accepted: true });
  });

  it('has a caller that fails when the callee reference is the caller itself', () => {
    const results = verdicts({ calleeRef: A_INDEX });
    expect(results[A_INDEX].accepted).toBe(false);
  });

  it('has a caller that fails when the recorded target is not the callee address', () => {
    const results = verdicts({ target: ADDRESS_A });
    expect(results[A_INDEX].accepted).toBe(false);
  });

  it('has a caller that fails when it names no validator although it makes a call', () => {
    const results = verdicts({ dropValidatorOnCaller: true });
    expect(results[A_INDEX].accepted).toBe(false);
    // The callee still names its own validator, so only the caller is affected.
    expect(results[B_INDEX].accepted).toBe(true);
  });

  it('has a validator that fails when its program does not hash to the constant', () => {
    const results = verdicts({ validatorProgram: ALTERNATE_ACCEPTING_PROGRAM });
    expect(results[A_INDEX].accepted).toBe(false);
    expect(results[B_INDEX].accepted).toBe(false);
    // The replacement still leaves one truthy item, so the refusal is the masters' program-hash check.
    expect(results[VALIDATOR_INDEX].accepted).toBe(true);
  });

  it('has a validator that fails when it holds a category its own pin does not name', () => {
    const results = verdicts({ validatorCategory: OTHER_CATEGORY });
    expect(results[A_INDEX].accepted).toBe(false);
    expect(results[B_INDEX].accepted).toBe(false);
    // The program compares its pin with the token the spent UTXO carries, so the input itself is refused.
    expect(results[VALIDATOR_INDEX].accepted).toBe(false);
  });
});
