import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256, Opcodes,
} from '@bitauth/libauth';
import {
  TokenCapability, categoryPin, encodeWitnessBlock, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { buildMasterHeadScript, type MasterHeadOptions } from '../../../src/per-call/master/master-head.js';
import { findPlaceholderOffsets } from '../../../src/per-call/master/master-program.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';

/**
 * A composed transaction: one master calls another and a validator input covers both.
 *
 * The caller records the call in its witness block and proves the shape of that record against the callee's own
 * unlocking bytecode: the callee is a different input, its call data carries the selector the caller names,
 * `SHA256(selector)` is the recorded argument hash, and the recorded target and kind are the ones the caller's
 * code fixes. The callee runs as a message-call frame, where the validator binds the values the master cannot see
 * — its `msg.sender`, its `value` and its origin — while the master still checks the address it presents.
 *
 * Both masters point at the same validator input. That validator is recognised from its own redemption path: it
 * holds a mutable token of the category its redeem script pins, and the program after that pin hashes to the
 * constant every master carries. The transcript is skipped and never interpreted.
 *
 * Every input's script is evaluated: the machine's own accept/reject verdict is the assertion. The controls
 * matter as much as the accept, so each mutation is checked together with the validator's own acceptance, which
 * shows the composition is otherwise well formed and the refusal comes from the check under test.
 */

const CATEGORY_A = new Uint8Array(32).fill(0x61); // `OP_NOP`, so the pin in front of the validator program is inert
const CATEGORY_B = new Uint8Array(32).fill(0x5c);
const OTHER_CATEGORY = new Uint8Array(32).fill(0x77);

/**
 * The validator program. Free and small; the masters only ever hash it.
 *
 * The frozen redeem script is `pin(c) || program`, and the pin's capability byte is itself a push opcode, so the
 * first program byte is consumed as data by the pin. The program drops the transcript the unlocking bytecode
 * pushed and the byte the capability consumed, then leaves one item, as a P2SH32 redeem script must.
 */
const VALIDATOR_PROGRAM = new Uint8Array([Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_1]);
const OTHER_VALIDATOR_PROGRAM = new Uint8Array([Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_2]);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);

/** The selector the caller records. */
const CALLEE_SELECTOR = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
/** A second selector, for a mutated call record. */
const OTHER_SELECTOR = new Uint8Array([0x87, 0x65, 0x43, 0x21]);

const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const ADDRESS_A = validatorAddress(CATEGORY_A, VALIDATOR_PROGRAM);
const ADDRESS_B = validatorAddress(CATEGORY_B, VALIDATOR_PROGRAM);

/** Master input indices; the caller and the validator sit after the two masters. */
const A_INDEX = 0;
const B_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = 3;

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
    { version: 1, ...findPlaceholderOffsets(head.script) },
    { category: shape.category, contractAddress: shape.address },
  );
  const program = new Uint8Array([...filled, ...(shape.body ?? new Uint8Array([Opcodes.OP_1]))]);
  return { program, lock: encodeLockingBytecodeP2sh32(hash256(program)) };
}

/** Builds the whole transaction: two masters, a validator, a user, and one output per input. */
function buildComposition(options: CompositionOptions = {}): Composition {
  const validatorProgram = options.validatorProgram ?? VALIDATOR_PROGRAM;
  // The validator's lock follows the program it runs; the masters hash `TEMPLATE_HASH`, the constant they carry.
  const validatorRedeem = new Uint8Array([
    ...categoryPin(CATEGORY_A, TokenCapability.MUTABLE),
    ...validatorProgram,
  ]);
  const validatorLock = encodeLockingBytecodeP2sh32(hash256(validatorRedeem));

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
      value: 0n,
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
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };

  const caller = masterProgram({
    category: CATEGORY_A,
    address: ADDRESS_A,
    options: {
      blockOnTop: true,
      frameKinds: [0, 1],
      validatorTemplateHash: TEMPLATE_HASH,
      calls: [{ kind: 1, selector: CALLEE_SELECTOR, target: ADDRESS_B }],
    },
    // The head leaves the four frame values; a P2SH32 redeem script must end with exactly one item.
    body: new Uint8Array([Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_1]),
  });
  // The callee carries its own selector push, which is the call data the caller hashes.
  const callee = masterProgram({
    category: CATEGORY_B,
    address: ADDRESS_B,
    options: { blockOnTop: false, frameKinds: [0, 1], validatorTemplateHash: TEMPLATE_HASH, calls: [] },
    // The head leaves the four frame values above the callee's own selector push.
    body: new Uint8Array([
      Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_1,
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
      // The transcript is the first push and is never read; the redeem script is the last.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(new Uint8Array([0x01, 0x02])),
        ...encodeDataPush(validatorRedeem),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(4),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array(0),
    },
  ];

  const outputs = [
    { lockingBytecode: caller.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_A) },
    { lockingBytecode: callee.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_B) },
    { lockingBytecode: validatorLock, valueSatoshis: validatorValue, token: validatorToken },
    { lockingBytecode: USER_LOCK, valueSatoshis: userValue },
  ];

  const sourceOutputs = [
    { lockingBytecode: caller.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_A) },
    { lockingBytecode: callee.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_B) },
    { lockingBytecode: validatorLock, valueSatoshis: validatorValue, token: validatorToken },
    { lockingBytecode: USER_LOCK, valueSatoshis: userValue },
  ];

  return {
    transaction: { version: 2, inputs, outputs, locktime: 0 },
    sourceOutputs,
    order: [A_INDEX, B_INDEX, VALIDATOR_INDEX],
  };
}

/** Evaluates one input's script; libauth decides one input at a time, so a composition is every input. */
function outcome(composition: Composition, inputIndex: number): { accepted: boolean; objection?: string } {
  const vm = createVirtualMachineBch2026(false);
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
function standaloneVerdicts(masterCount: number): readonly { accepted: boolean; objection?: string }[] {
  const master = masterProgram({
    category: CATEGORY_A,
    address: ADDRESS_A,
    options: { blockOnTop: true },
    body: new Uint8Array([Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_1]),
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
      unlockingBytecode: new Uint8Array(0),
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
  const vm = createVirtualMachineBch2026(false);
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
    // The validator is untouched, so the refusal is the caller's own check.
    expect(results[VALIDATOR_INDEX].accepted).toBe(true);
  });

  it('has a caller that fails when the recorded argument hash is another selector of the callee', () => {
    // A hash that is well formed but names a different function: only recomputing the hash from the callee's own
    // call data refuses it.
    const results = verdicts({ argsHash: sha256(OTHER_SELECTOR) });
    expect(results[A_INDEX].accepted).toBe(false);
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
    const results = verdicts({ validatorProgram: OTHER_VALIDATOR_PROGRAM });
    expect(results[A_INDEX].accepted).toBe(false);
    expect(results[B_INDEX].accepted).toBe(false);
    // The validator's own script still succeeds, so the refusal is the masters' program-hash check.
    expect(results[VALIDATOR_INDEX].accepted).toBe(true);
  });

  it('has a validator that fails when it holds a category its own pin does not name', () => {
    const results = verdicts({ validatorCategory: OTHER_CATEGORY });
    expect(results[A_INDEX].accepted).toBe(false);
    expect(results[B_INDEX].accepted).toBe(false);
    expect(results[VALIDATOR_INDEX].accepted).toBe(true);
  });
});
