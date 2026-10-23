import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256, hexToBin,
} from '@bitauth/libauth';
import {
  argsHash, asmToScript, buildPushdataCommitment, encodeArgumentList, encodeIntegerValue, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { isServed } from './refused-entry.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, dataRecordLock, seededCategory,
  validatorFacetPlacements, validatorSpend,
} from './validator-input.js';

/**
 * An entry that returns one scalar value, settled against the frame's witness `retval`.
 *
 * Under the framed convention the value an entry returns is not written to a return-event output: the frame's
 * witness block records it in `retval`, and the entry's own code compares the blob its `return` built against
 * that field. The callee is accepted when the two agree and refused when they do not; a caller that consumes the
 * call's value decodes the record's `result`, which the validator holds equal to the callee's `retval`.
 *
 * Everything is compiled through `compileStringMulti`, filled by deployment, and settled by the BCH-2026
 * machine's own verdict.
 */

const CATEGORY_CALLER = seededCategory('return value caller');
const CATEGORY_CALLEE = seededCategory('return value callee');
/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** The value the callee's own code computes. */
const ANSWER = 42n;
/** The value a frame that returns `ANSWER` records: the canonical push of its script number. */
const ANSWER_RETVAL = encodeArgumentList([encodeIntegerValue(ANSWER)]);
/** A different value, for a frame that records one the callee did not compute. */
const OTHER_RETVAL = encodeArgumentList([encodeIntegerValue(7n)]);

/**
 * The callee returns one value; the caller consumes it, so the callee's return is bound to the caller's record
 * of the call's result as well as to the callee's own computation.
 */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IAnswer { function answer() returns (int); }'
  + ` contract Answer { function answer() returns (int) { return ${ANSWER}; } }`
  + ' contract Caller {'
  + `   function ask() { int r = IAnswer(0x${toHex(ADDRESS_CALLEE)}).answer(); require(r == ${ANSWER}); require(true); }`
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
  commitment: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment } });

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
/** The callee's `answer()` selector, which the caller's interface resolves the site to. */
const SELECTOR = new Uint8Array(
  Buffer.from(artifacts.Answer!.abi.find((entry) => entry.name === 'answer')!.selector!, 'hex'),
);

interface CompositionOptions {
  /** The value the callee's frame records in `retval`. */
  readonly calleeRetval?: Uint8Array;
  /** The value the caller's record carries as the call's `result`. */
  readonly recordedResult?: Uint8Array;
}

interface Composition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

/** Builds the compiled caller, the compiled callee, a validator, and the transaction that co-spends them. */
function buildComposition(options: CompositionOptions = {}): Composition {
  const fill = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(scriptBytes(artifact), artifact.composition!.placeholders, {
      category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
    });
  };
  const callerProgram = fill('Caller', CATEGORY_CALLER, ADDRESS_CALLER);
  const calleeProgram = fill('Answer', CATEGORY_CALLEE, ADDRESS_CALLEE);

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
      argsHash: argsHash(SELECTOR, new Uint8Array(0)),
      result: options.recordedResult ?? ANSWER_RETVAL,
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
    retval: options.calleeRetval ?? ANSWER_RETVAL,
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
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
        ...encodeDataPush(SELECTOR),
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
function accepted(options: CompositionOptions, inputIndex: number): boolean {
  const composition = buildComposition(options);
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
  })) === true;
}

describe('an entry that returns one scalar value', () => {
  it('is accepted when the frame records the value the entry computed', () => {
    expect(accepted({}, CALLEE_INDEX)).toBe(true);
    expect(accepted({}, CALLER_INDEX)).toBe(true);
    expect(accepted({}, VALIDATOR_INDEX)).toBe(true);
  });

  it('is refused by its own code when the frame records another value', () => {
    expect(accepted({ calleeRetval: OTHER_RETVAL }, CALLEE_INDEX)).toBe(false);
    // The comparison is over the exact bytes: a non-canonical encoding of the same number is not the blob the
    // entry's own code computes.
    const nonCanonical = encodeArgumentList([new Uint8Array([0x2a, 0x00])]);
    expect(accepted({ calleeRetval: nonCanonical }, CALLEE_INDEX)).toBe(false);
    // The caller only binds its record, which still carries the computed value, and has no view of the callee's
    // own frame field; the retval rule is one the split runs in the facet at `head + 1`, so the facet refuses the
    // disagreement.
    expect(accepted({ calleeRetval: OTHER_RETVAL }, CALLER_INDEX)).toBe(true);
    expect(accepted({ calleeRetval: OTHER_RETVAL }, VALIDATOR_FACET_INDEX)).toBe(false);
  });

  it('reaches the caller with the value the callee computed', () => {
    // The caller's body requires the result to be the callee's answer, so a record of another value fails the
    // caller's own decode while the callee's frame still records what its code computed.
    expect(accepted({ calleeRetval: ANSWER_RETVAL, recordedResult: OTHER_RETVAL }, CALLER_INDEX)).toBe(false);
    expect(accepted({ calleeRetval: ANSWER_RETVAL, recordedResult: OTHER_RETVAL }, CALLEE_INDEX)).toBe(true);
  });
});

describe('the return shapes a master can settle', () => {
  it('serves several return values, including a struct among them', () => {
    // A frame's `retval` is one byte string: a tuple's canonical encoding is the concatenation of its values'
    // encodings, so several values settle against it the way one scalar does, and a struct is one blob among them.
    const pair = 'pragma solidcash ^0.14.0;'
      + ' contract Pair { function pair() returns (int, int) { return (1, 2); } }';
    expect(isServed(pair)).toBe(true);
    const mixed = 'pragma solidcash ^0.14.0;'
      + ' contract Holder { struct Point { int x; int y; }'
      + '   function point() returns (int, Point) { return (1, Point(2, 3)); } }';
    expect(isServed(mixed)).toBe(true);
  });
});

/**
 * A master with one returning entry and one void entry: the head parks the frame's `retval` for the whole master,
 * so the returning body compares against it and the void body requires it empty.
 */
const MIXED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Mixed {'
  + `   function answer() returns (int) { return ${ANSWER}; }`
  + '   function ping() { require(true); }'
  + ' }';

const MIXED_CATEGORY = seededCategory('mixed return value');
const MIXED_ADDRESS = validatorAddress(MIXED_CATEGORY, VALIDATOR_PROGRAM);

const mixedArtifact = compileString(MIXED_SOURCE, { composition: 'framed' });
const mixedSelector = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(mixedArtifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));

/** Spends the standalone master with one selector and one `retval`, and asks the BCH-2026 machine. */
function acceptedStandalone(selector: Uint8Array, retval: Uint8Array): boolean {
  const filled = fillPlaceholders(scriptBytes(mixedArtifact), mixedArtifact.composition!.placeholders, {
    category: categorySlotValue(MIXED_CATEGORY), contractAddress: MIXED_ADDRESS, templateHash: TEMPLATE_HASH,
  });
  const lock = encodeLockingBytecodeP2sh32(hash256(filled));
  const block: WitnessBlock = {
    kind: 0,
    callerRef: 0,
    originRef: 0,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: MIXED_ADDRESS,
    value: 0n,
    retval,
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const sourceOutputs = [
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(MIXED_CATEGORY, 'minting') },
  ];
  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(7), sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(),
      },
      {
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeDataPush(selector),
          ...encodeDataPush(filled),
        ]),
      },
    ],
    outputs: [
      { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
      { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(MIXED_CATEGORY, 'minting') },
    ],
    locktime: 0,
  };
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({ inputIndex: 1, sourceOutputs, transaction })) === true;
}

describe('a master with a returning entry and a void entry', () => {
  it('settles each entry against the one `retval` field', () => {
    expect(acceptedStandalone(mixedSelector('answer'), ANSWER_RETVAL)).toBe(true);
    expect(acceptedStandalone(mixedSelector('answer'), OTHER_RETVAL)).toBe(false);
    expect(acceptedStandalone(mixedSelector('ping'), new Uint8Array(0))).toBe(true);
    // A void entry's frame records nothing, so a recorded value is refused even though the entry returns none.
    expect(acceptedStandalone(mixedSelector('ping'), ANSWER_RETVAL)).toBe(false);
  });
});

/**
 * A stateful view: the entry reads its record and returns the value it read. The record is kept in place, so the
 * transaction writes the commitment it spent, and the entry's return is settled against the frame's `retval`.
 */
const VIEW_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract View {'
  + '   int public counter;'
  + '   function get() returns (int) { return this.counter; }'
  + ' }';

const VIEW_CATEGORY = seededCategory('stateful view return');
const VIEW_ADDRESS = validatorAddress(VIEW_CATEGORY, VALIDATOR_PROGRAM);
/** A state record's lock: the entry only requires input and output to agree, so any lock serves. */
const VIEW_STATE_LOCK = dataRecordLock(VIEW_CATEGORY);
const VIEW_INDEX = { master: 0, state: 1, user: 2 } as const;

const viewArtifact = compileString(VIEW_SOURCE, { composition: 'framed' });
const viewProgram = fillPlaceholders(scriptBytes(viewArtifact), viewArtifact.composition!.placeholders, {
  category: categorySlotValue(VIEW_CATEGORY), contractAddress: VIEW_ADDRESS, templateHash: TEMPLATE_HASH,
});
const viewLock = encodeLockingBytecodeP2sh32(hash256(viewProgram));
const VIEW_COMMITMENT = hexToBin(buildPushdataCommitment(viewArtifact.stateLayout!, { counter: ANSWER }, 0));

/** Spends the compiled view with one `retval`; the record is read and kept in place. */
function acceptedView(retval: Uint8Array): boolean {
  const block: WitnessBlock = {
    kind: 0,
    callerRef: VIEW_INDEX.user,
    originRef: VIEW_INDEX.user,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: VIEW_ADDRESS,
    value: 0n,
    retval,
    calls: [],
    segments: [[{
      in: VIEW_INDEX.state,
      out: VIEW_INDEX.state,
      viewIn: VIEW_COMMITMENT,
      viewOut: VIEW_COMMITMENT,
    }]],
    events: [],
    sends: [],
  };
  const masterValue = 20_000n;
  const sourceOutputs = [
    { lockingBytecode: viewLock, valueSatoshis: masterValue, token: token(VIEW_CATEGORY, 'minting') },
    { lockingBytecode: VIEW_STATE_LOCK, valueSatoshis: masterValue, token: token(VIEW_CATEGORY, 'mutable', VIEW_COMMITMENT) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)), ...encodeDataPush(viewProgram),
        ]),
      },
      {
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      {
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(),
      },
    ],
    outputs: [...sourceOutputs],
    locktime: 0,
  };
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({
    inputIndex: VIEW_INDEX.master, sourceOutputs, transaction,
  })) === true;
}

describe('a stateful view whose entry returns the value it read', () => {
  it('is accepted when the frame records the value the read produced', () => {
    expect(acceptedView(ANSWER_RETVAL)).toBe(true);
  });

  it('is refused when the frame records another value', () => {
    expect(acceptedView(OTHER_RETVAL)).toBe(false);
  });
});

/**
 * The entry writes state and returns the value it wrote.
 *
 * The read-only case above keeps the record in place; this one moves it, so the same frame that has to settle the
 * value it computed also has to settle the record it wrote. The commitment the record holds at the end is the one
 * the write produced, and the value the frame records is the new one.
 */
const WRITE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Counter {'
  + '   int public counter;'
  + '   function bump() returns (int) { this.counter = this.counter + 1; return this.counter; }'
  + ' }';

const WRITE_CATEGORY = seededCategory('stateful write return');
const WRITE_STATE_LOCK = dataRecordLock(WRITE_CATEGORY);
const WRITE_ADDRESS = validatorAddress(WRITE_CATEGORY, VALIDATOR_PROGRAM);
const writeArtifact = compileString(WRITE_SOURCE, { composition: 'framed' });
const writeProgram = fillPlaceholders(scriptBytes(writeArtifact), writeArtifact.composition!.placeholders, {
  category: categorySlotValue(WRITE_CATEGORY), contractAddress: WRITE_ADDRESS, templateHash: TEMPLATE_HASH,
});
const writeLock = encodeLockingBytecodeP2sh32(hash256(writeProgram));
/** The record as the write leaves it: the counter one higher, and the value the frame records is that one. */
const WRITTEN = ANSWER + 1n;
const WRITE_IN_COMMITMENT = hexToBin(buildPushdataCommitment(writeArtifact.stateLayout!, { counter: ANSWER }, 0));
const WRITE_OUT_COMMITMENT = hexToBin(buildPushdataCommitment(writeArtifact.stateLayout!, { counter: WRITTEN }, 0));
const WRITE_RETVAL = encodeArgumentList([encodeIntegerValue(WRITTEN)]);

/** Spends the compiled writer with `retval` and the record's two commitments given. */
function acceptedWrite(retval: Uint8Array, outCommitment: Uint8Array = WRITE_OUT_COMMITMENT): boolean {
  const block: WitnessBlock = {
    kind: 0, callerRef: 2, originRef: 2, validatorRef: 0xffff, sender: USER_LOCK, self: WRITE_ADDRESS, value: 0n,
    retval,
    calls: [],
    segments: [[{ in: 1, out: 1, viewIn: WRITE_IN_COMMITMENT, viewOut: outCommitment }]],
    events: [],
    sends: [],
  };
  const masterValue = 20_000n;
  const sourceOutputs = [
    { lockingBytecode: writeLock, valueSatoshis: masterValue, token: token(WRITE_CATEGORY, 'minting') },
    {
      lockingBytecode: WRITE_STATE_LOCK, valueSatoshis: masterValue,
      token: token(WRITE_CATEGORY, 'mutable', WRITE_IN_COMMITMENT),
    },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)), ...encodeDataPush(writeProgram),
        ]),
      },
      {
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      {
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(),
      },
    ],
    outputs: [
      { lockingBytecode: writeLock, valueSatoshis: masterValue, token: token(WRITE_CATEGORY, 'minting') },
      {
        lockingBytecode: WRITE_STATE_LOCK, valueSatoshis: masterValue,
        token: token(WRITE_CATEGORY, 'mutable', outCommitment),
      },
      { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    ],
    locktime: 0,
  };
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction })) === true;
}

describe('a stateful entry that writes the value it returns', () => {
  it('is accepted when the frame records the written value and the record carries the write', () => {
    expect(acceptedWrite(WRITE_RETVAL)).toBe(true);
  });

  it('is refused when the frame records another value', () => {
    expect(acceptedWrite(encodeArgumentList([encodeIntegerValue(ANSWER)]))).toBe(false);
  });
});
