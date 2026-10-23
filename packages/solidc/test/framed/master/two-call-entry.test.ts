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
 * A caller whose one entry makes two external calls, each bound to its own record where the source makes it.
 *
 * The tail's call count is a fixed two, so the head walks past two call records and the per-site checks live where
 * the source makes each call: site 0 reads `calls[0]` and site 1 reads `calls[1]`. The two calls name different
 * methods of one interface, so the direct path's lowering also injects a per-slot selector operand — an operand
 * only the direct path's own call verification reads, which a composed body does not emit. A two-call entry
 * therefore exercises both the record positions and the fact that a composed body neither supplies nor reads that
 * operand.
 *
 * The two callees are head-built stand-ins, one per called method, each carrying its own selector push so the
 * caller's site check can hash the callee's own call data. Both callees and the caller point at one validator
 * input. Every input's script is evaluated: the machine's own accept/reject verdict is the assertion.
 */

const CATEGORY_A = seededCategory('two call entry caller');
const CATEGORY_B = seededCategory('two call entry callee B');
const CATEGORY_C = seededCategory('two call entry callee C');

/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);

/** The selectors the caller records, one per called method. */
const PING_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const PONG_SELECTOR = computeFunctionSelector(computeFunctionSignature('pong', []));

const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const ADDRESS_A = validatorAddress(CATEGORY_A, VALIDATOR_PROGRAM);
const ADDRESS_B = validatorAddress(CATEGORY_B, VALIDATOR_PROGRAM);
const ADDRESS_C = validatorAddress(CATEGORY_C, VALIDATOR_PROGRAM);

/** Master input indices: the caller, its two callees, the validator with its facet, then the user. */
const A_INDEX = 0;
const B_INDEX = 1;
const C_INDEX = 2;
const VALIDATOR_INDEX = 3;
const USER_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;

/**
 * The caller's source: one entry that makes two calls, to two code-baked addresses through one two-method
 * interface. Both address literals are compile-time values, so each call's target and selector are fixed where
 * the source writes the call.
 */
const CALLER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); function pong(); }'
  + ' contract Caller {'
  + '   function callIt() {'
  + `     ICallee(0x${Buffer.from(ADDRESS_B).toString('hex')}).ping.call();`
  + `     ICallee(0x${Buffer.from(ADDRESS_C).toString('hex')}).pong.call();`
  + '     require(true);'
  + '   }'
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
  /** Replace the two recorded targets, in call order. */
  readonly recordTargets?: readonly [Uint8Array, Uint8Array];
  /** Replace the two recorded callee references, in call order. */
  readonly recordCalleeRefs?: readonly [number, number];
  /** Replace the two recorded argument hashes, in call order. */
  readonly recordArgsHashes?: readonly [Uint8Array, Uint8Array];
  /** How many empty record segments the caller's block declares; the call count plus one by default. */
  readonly callerSegments?: number;
  /** How many call records the caller's block declares; the entry's two by default. */
  readonly recordCount?: number;
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
 * Builds the whole transaction: the caller, its two callees, the validator, a user, and one output per input.
 *
 * The caller's block carries two call records in execution order and the three segments their count fixes. Each
 * callee's block carries the selector of the method its caller's site calls, and no call of its own.
 */
function buildComposition(options: CompositionOptions = {}): Composition {
  const validator = validatorSpend(CATEGORY_A, {
    roots: [A_INDEX], masters: [A_INDEX, B_INDEX, C_INDEX], settles: [],
  });
  const validatorLock = validator.lock;
  const facets = validatorFacetPlacements();

  const recordTargets = options.recordTargets ?? [ADDRESS_B, ADDRESS_C];
  const recordCalleeRefs = options.recordCalleeRefs ?? [B_INDEX, C_INDEX];
  const recordArgsHashes = options.recordArgsHashes ?? [sha256(PING_SELECTOR), sha256(PONG_SELECTOR)];
  const callerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_A,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [
      {
        kind: 1,
        target: recordTargets[0],
        value: 0n,
        calleeRef: recordCalleeRefs[0],
        argsHash: recordArgsHashes[0],
        result: new Uint8Array(0),
      },
      {
        kind: 1,
        target: recordTargets[1],
        value: 0n,
        calleeRef: recordCalleeRefs[1],
        argsHash: recordArgsHashes[1],
        result: new Uint8Array(0),
      },
    ].slice(0, options.recordCount ?? 2),
    // One segment per call plus one, as section 16 requires; a stateless caller declares no record in any.
    segments: Array.from({ length: options.callerSegments ?? 3 }, () => []),
    events: [],
    sends: [],
  };

  /** One callee's frame block: a message call by the caller, its own record untouched. */
  const calleeBlock = (sender: Uint8Array, self: Uint8Array): WitnessBlock => ({
    kind: 1,
    callerRef: A_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender,
    self,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  });

  const caller = { program: COMPILED_CALLER_PROGRAM, lock: encodeLockingBytecodeP2sh32(hash256(COMPILED_CALLER_PROGRAM)) };
  const dropFrameAndSelector = new Uint8Array([
    Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP,
    Opcodes.OP_DROP,
    Opcodes.OP_1,
  ]);
  const calleeB = masterProgram({
    category: CATEGORY_B,
    address: ADDRESS_B,
    options: { blockOnTop: false, frameKinds: [0, 1], reservesValidatorHashSlot: true, calls: [] },
    body: dropFrameAndSelector,
  });
  const calleeC = masterProgram({
    category: CATEGORY_C,
    address: ADDRESS_C,
    options: { blockOnTop: false, frameKinds: [0, 1], reservesValidatorHashSlot: true, calls: [] },
    body: dropFrameAndSelector,
  });

  const masterToken = (category: Uint8Array): ReturnType<typeof token> => token(category, 'minting');
  const validatorToken = token(CATEGORY_A, 'mutable');
  const masterValue = 20_000n;
  const validatorValue = 20_000n;
  const userValue = 100_000n;

  const inputs = [
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(1),
      sequenceNumber: 0xffffffff,
      // The caller takes no selector of its own: it is entered as a root frame.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)),
        ...encodeDataPush(caller.program),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(2),
      sequenceNumber: 0xffffffff,
      // The callee carries its own selector push, which is the call data the caller's own code hashes.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock(ADDRESS_A, ADDRESS_B))),
        ...encodeDataPush(PING_SELECTOR),
        ...encodeDataPush(calleeB.program),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(3),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock(ADDRESS_A, ADDRESS_C))),
        ...encodeDataPush(PONG_SELECTOR),
        ...encodeDataPush(calleeC.program),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(4),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: validator.unlockingBytecode,
    },
    ...facets.map((facet) => facet.input),
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(5),
      sequenceNumber: 0xffffffff,
      // The user's signed P2PKH input: the caller's root frame reads its signature's hash type.
      unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
    },
  ];

  const outputs = [
    { lockingBytecode: caller.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_A) },
    { lockingBytecode: calleeB.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_B) },
    { lockingBytecode: calleeC.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_C) },
    { lockingBytecode: validatorLock, valueSatoshis: validatorValue, token: validatorToken },
    ...facets.map((facet) => facet.output),
    { lockingBytecode: USER_LOCK, valueSatoshis: userValue },
  ];

  const sourceOutputs = [
    { lockingBytecode: caller.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_A) },
    { lockingBytecode: calleeB.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_B) },
    { lockingBytecode: calleeC.lock, valueSatoshis: masterValue, token: masterToken(CATEGORY_C) },
    { lockingBytecode: validatorLock, valueSatoshis: validatorValue, token: validatorToken },
    ...facets.map((facet) => facet.output),
    { lockingBytecode: USER_LOCK, valueSatoshis: userValue },
  ];

  return {
    transaction: { version: 2, inputs, outputs, locktime: 0 },
    sourceOutputs,
    order: [A_INDEX, B_INDEX, C_INDEX, VALIDATOR_INDEX],
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

describe('a caller whose one entry makes two calls', () => {
  it('is accepted by the virtual machine at the caller, both callees and the validator', () => {
    const results = verdicts();
    expect(results[A_INDEX]).toStrictEqual({ accepted: true });
    expect(results[B_INDEX]).toStrictEqual({ accepted: true });
    expect(results[C_INDEX]).toStrictEqual({ accepted: true });
    expect(results[VALIDATOR_INDEX]).toStrictEqual({ accepted: true });
  });

  it('refuses a first record that names the wrong target', () => {
    const results = verdicts({ recordTargets: [ADDRESS_C, ADDRESS_C] });
    expect(results[A_INDEX].accepted).toBe(false);
  });

  it('refuses a second record that names the wrong target', () => {
    const results = verdicts({ recordTargets: [ADDRESS_B, ADDRESS_A] });
    expect(results[A_INDEX].accepted).toBe(false);
  });

  it('refuses a second record that names the same target as the first', () => {
    const results = verdicts({ recordTargets: [ADDRESS_B, ADDRESS_B] });
    expect(results[A_INDEX].accepted).toBe(false);
  });

  it('checks each site at its own record position, so swapping the two targets is refused', () => {
    // Site 0 reads `calls[0]` and site 1 reads `calls[1]`; the swap makes each site disagree with its own record.
    const results = verdicts({ recordTargets: [ADDRESS_C, ADDRESS_B] });
    expect(results[A_INDEX].accepted).toBe(false);
  });

  it('refuses when the first record names the method the second call makes', () => {
    // `ping` and `pong` resolve to different selectors, so the first record's digest is the second call's.
    const results = verdicts({ recordArgsHashes: [sha256(PONG_SELECTOR), sha256(PONG_SELECTOR)] });
    expect(results[A_INDEX].accepted).toBe(false);
  });

  // A record whose callee reference is the caller itself is refused in `composed-call.test.ts`.
  it('refuses a block whose call count is not the entry\'s two', () => {
    // The block is internally consistent (one record, two segments) but declares one call where the entry's own
    // code fixes two, so the head's tail walk refuses it before any site check runs.
    const results = verdicts({ recordCount: 1, callerSegments: 2 });
    expect(results[A_INDEX].accepted).toBe(false);
  });
});
