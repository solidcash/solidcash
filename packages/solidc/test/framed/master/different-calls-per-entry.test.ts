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
  REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, seededCategory, validatorFacetPlacements,
  validatorSpend,
} from './validator-input.js';

/**
 * A caller whose two entries make different calls, each bound where its own source makes the call.
 *
 * The head is one prefix that fixes how many call records the tail holds, which is one here; the records are bound
 * in the entry bodies, so entry `a`'s site 0 must resolve to entry `a`'s own descriptors (the `ping` call) and
 * entry `b`'s site 0 to entry `b`'s (the `pong` call). A mutation of one entry's record, and a wiring of the two
 * entries' calls to each other, are refused at that entry's own caller.
 *
 * The two callees are head-built stand-ins, one per called method, each carrying its own selector push so the
 * caller's site check can hash the callee's own call data. Every input's script is evaluated: the machine's own
 * accept/reject verdict is the assertion.
 */

const CATEGORY_A = seededCategory('different calls per entry caller');
const CATEGORY_B = seededCategory('different calls per entry callee B');
const CATEGORY_C = seededCategory('different calls per entry callee C');

/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);

/** The selectors the two entries record, one per called method of the one interface. */
const PING_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const PONG_SELECTOR = computeFunctionSelector(computeFunctionSignature('pong', []));

const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const ADDRESS_A = validatorAddress(CATEGORY_A, VALIDATOR_PROGRAM);
const ADDRESS_B = validatorAddress(CATEGORY_B, VALIDATOR_PROGRAM);
const ADDRESS_C = validatorAddress(CATEGORY_C, VALIDATOR_PROGRAM);

/** Master input indices: the caller, its callee, the validator with its facet, then the user. */
const A_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;

/** Which entry the unlocking bytecode dispatches into, and the one call that entry makes. */
type Entry = 'a' | 'b';

interface EntryShape {
  readonly selector: Uint8Array;
  readonly calleeSelector: Uint8Array;
  readonly calleeCategory: Uint8Array;
  readonly calleeAddress: Uint8Array;
}

/**
 * The caller's source: two entries, each making one call to a different method at a different code-baked address.
 * Both address literals are compile-time values, so each call's target and selector are fixed where the source
 * writes the call.
 */
const CALLER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); function pong(); }'
  + ' contract Caller {'
  + `   function a() { ICallee(0x${Buffer.from(ADDRESS_B).toString('hex')}).ping.call(); require(true); }`
  + `   function b() { ICallee(0x${Buffer.from(ADDRESS_C).toString('hex')}).pong.call(); require(true); }`
  + ' }';

const COMPILED_CALLER_ARTIFACT = compileString(CALLER_SOURCE, { composition: 'framed' });

/** The finished script as bytes: the artifact publishes it as ASM, deployment fills the slots in the bytes. */
const COMPILED_CALLER_PROGRAM = fillPlaceholders(
  scriptToBytecode(asmToScript(COMPILED_CALLER_ARTIFACT.bytecode)),
  COMPILED_CALLER_ARTIFACT.composition!.placeholders,
  { category: categorySlotValue(CATEGORY_A), contractAddress: ADDRESS_A, templateHash: TEMPLATE_HASH },
);

/** A function's four-byte dispatcher selector, as the ABI publishes it. */
const selectorOf = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(COMPILED_CALLER_ARTIFACT.abi.find((entry) => entry.name === name)!.selector!, 'hex'));

const ENTRY: Record<Entry, EntryShape> = {
  a: {
    selector: selectorOf('a'),
    calleeSelector: PING_SELECTOR,
    calleeCategory: CATEGORY_B,
    calleeAddress: ADDRESS_B,
  },
  b: {
    selector: selectorOf('b'),
    calleeSelector: PONG_SELECTOR,
    calleeCategory: CATEGORY_C,
    calleeAddress: ADDRESS_C,
  },
};

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
  /** Replace the one recorded target, so it no longer names the callee its own entry calls. */
  readonly recordTarget?: Uint8Array;
  /** Replace the one recorded argument hash, so it no longer carries the entry's own call digest. */
  readonly recordArgsHash?: Uint8Array;
  /** Replace the one recorded callee reference. */
  readonly recordCalleeRef?: number;
  /** Replace the callee's own selector push, so its call data no longer hashes to the record. */
  readonly calleeSelector?: Uint8Array;
}

interface EntryCompositionOptions extends CompositionOptions {
  /** Make the entry's block declare the record of the other entry, whose target and digest belong to that entry. */
  readonly recordOfOtherEntry?: boolean;
  /** Give the callee the other entry's selector and argument pushes. */
  readonly calleeOfOtherEntry?: boolean;
  /**
   * How many call records the caller's block declares. The entries make one call each, so a block that declares
   * anything else is what the body's own pin refuses.
   */
  readonly declaredCallCount?: number;
}

type Token = {
  category: Uint8Array;
  amount: bigint;
  nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array };
};

const token = (category: Uint8Array, capability: 'minting' | 'mutable' | 'none'): Token => ({
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

/**
 * Builds the whole transaction for one entry: the caller, the one callee the entry calls, the validator, a user,
 * and one output per input. The caller's block carries one call record and the two segments its count fixes.
 */
function buildComposition(entry: Entry, options: EntryCompositionOptions = {}): Composition {
  const shape = ENTRY[entry];
  const other = ENTRY[entry === 'a' ? 'b' : 'a'];
  const recorded = options.recordOfOtherEntry === true ? other : shape;
  const called = options.calleeOfOtherEntry === true ? other : shape;
  const recordTarget = options.recordTarget ?? recorded.calleeAddress;
  const recordCalleeRef = options.recordCalleeRef ?? CALLEE_INDEX;
  const recordArgsHash = options.recordArgsHash ?? sha256(recorded.calleeSelector);

  const validator = validatorSpend(CATEGORY_A, {
    roots: [A_INDEX], masters: [A_INDEX, CALLEE_INDEX], settles: [],
  });
  const facets = validatorFacetPlacements();

  const callerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_A,
    value: 0n,
    retval: new Uint8Array(0),
    calls: new Array<number>(options.declaredCallCount ?? 1).fill(0).map(() => ({
      kind: 1,
      target: recordTarget,
      value: 0n,
      calleeRef: recordCalleeRef,
      argsHash: recordArgsHash,
      result: new Uint8Array(0),
    })),
    // One segment per call plus one, as section 16 requires; a stateless caller declares no record in any of them.
    segments: new Array<number>((options.declaredCallCount ?? 1) + 1).fill(0).map(() => []),
    events: [],
    sends: [],
  };

  /** The callee's frame block: a message call by the caller, its own record untouched. */
  const calleeBlock: WitnessBlock = {
    kind: 1,
    callerRef: A_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_A,
    self: called.calleeAddress,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };

  const caller = {
    program: COMPILED_CALLER_PROGRAM,
    lock: encodeLockingBytecodeP2sh32(hash256(COMPILED_CALLER_PROGRAM)),
  };
  const dropFrameAndSelector = new Uint8Array([
    Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP,
    Opcodes.OP_DROP,
    Opcodes.OP_1,
  ]);
  const callee = masterProgram({
    category: called.calleeCategory,
    address: called.calleeAddress,
    options: { blockOnTop: false, frameKinds: [0, 1], reservesValidatorHashSlot: true, calls: [] },
    body: dropFrameAndSelector,
  });

  const masterValue = 20_000n;
  const validatorValue = 20_000n;
  const userValue = 100_000n;

  const inputs = [
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(1),
      sequenceNumber: 0xffffffff,
      // A master with several entries takes the selector the dispatcher reads as the leading call data.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)),
        ...encodeDataPush(shape.selector),
        ...encodeDataPush(caller.program),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(2),
      sequenceNumber: 0xffffffff,
      // The callee carries its own selector push, which is the call data the caller's own code hashes.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
        ...encodeDataPush(options.calleeSelector ?? called.calleeSelector),
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
      unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
    },
  ];

  const outputs = [
    { lockingBytecode: caller.lock, valueSatoshis: masterValue, token: token(CATEGORY_A, 'minting') },
    { lockingBytecode: callee.lock, valueSatoshis: masterValue, token: token(called.calleeCategory, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: validatorValue, token: token(CATEGORY_A, 'mutable') },
    ...facets.map((facet) => facet.output),
    { lockingBytecode: USER_LOCK, valueSatoshis: userValue },
  ];
  const sourceOutputs = [...outputs];

  return {
    transaction: { version: 2, inputs, outputs, locktime: 0 },
    sourceOutputs,
    order: [A_INDEX, CALLEE_INDEX, VALIDATOR_INDEX],
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
function verdicts(entry: Entry, options: EntryCompositionOptions = {}):
Record<number, { accepted: boolean; objection?: string }> {
  const composition = buildComposition(entry, options);
  return Object.fromEntries(composition.order.map((index) => [index, outcome(composition, index)]));
}

describe('a caller whose two entries make different calls', () => {
  it('accepts each entry at its own caller, its callee and the validator', () => {
    for (const entry of ['a', 'b'] as const) {
      const results = verdicts(entry);
      expect(results[A_INDEX]).toStrictEqual({ accepted: true });
      expect(results[CALLEE_INDEX]).toStrictEqual({ accepted: true });
      expect(results[VALIDATOR_INDEX]).toStrictEqual({ accepted: true });
    }
  });

  it('refuses each entry when its own record names the wrong target', () => {
    // Entry `a` records `ADDRESS_C` and entry `b` records `ADDRESS_B`: each site disagrees with its own record.
    expect(verdicts('a', { recordTarget: ADDRESS_C })[A_INDEX].accepted).toBe(false);
    expect(verdicts('b', { recordTarget: ADDRESS_B })[A_INDEX].accepted).toBe(false);
    // The unmutated record of the same entry still passes, so the refusal is the target alone.
    expect(verdicts('a')[A_INDEX].accepted).toBe(true);
    expect(verdicts('b')[A_INDEX].accepted).toBe(true);
  });

  it('refuses each entry when its own record carries the other entry\'s argument digest', () => {
    expect(verdicts('a', { recordArgsHash: sha256(PONG_SELECTOR) })[A_INDEX].accepted).toBe(false);
    expect(verdicts('b', { recordArgsHash: sha256(PING_SELECTOR) })[A_INDEX].accepted).toBe(false);
  });

  it('refuses each entry when the callee carries a selector its own site did not record', () => {
    expect(verdicts('a', { calleeSelector: PONG_SELECTOR })[A_INDEX].accepted).toBe(false);
    expect(verdicts('b', { calleeSelector: PING_SELECTOR })[A_INDEX].accepted).toBe(false);
  });

  // A record whose callee reference is the caller itself is refused in `composed-call.test.ts`.
  it('refuses a block that declares a call count its entry does not make', () => {
    // Each entry makes one call. A block that declares none leaves the entry's own site reading a record that is
    // not there, and one that declares two asks the entry to account for a call its source never makes; both are
    // refused at the caller, while the count the entry actually makes is accepted.
    expect(verdicts('a', { declaredCallCount: 0 })[A_INDEX].accepted).toBe(false);
    expect(verdicts('a', { declaredCallCount: 2 })[A_INDEX].accepted).toBe(false);
    expect(verdicts('b', { declaredCallCount: 0 })[A_INDEX].accepted).toBe(false);
    expect(verdicts('b', { declaredCallCount: 2 })[A_INDEX].accepted).toBe(false);
    expect(verdicts('a')[A_INDEX].accepted).toBe(true);
    expect(verdicts('b')[A_INDEX].accepted).toBe(true);
  });
});
