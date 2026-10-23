import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  TokenCapability, argsHash, asmToScript, buildPushdataCommitment, encodeArgumentList,
  encodeCallDataArguments, encodeIntegerValue, encodeResultList,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type RecordEntry,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { refusalMessageOf } from './refused-entry.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import {
  ValidatorReason, decideValidator, tokenShape,
  type FramedTransaction, type TokenShape,
} from '../../../src/framed/validator/index.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, dataRecordLock, seededCategory,
  validatorFacetPlacements, validatorSpend,
} from './validator-input.js';

/**
 * A read admitted under the framed convention: the caller records the call as a static frame, the callee runs
 * one, and the validator's static-frame rules cover both.
 *
 * The read is written two ways — an explicit `.staticcall()` and a plain `view` method read — and both compile to
 * the same shape: `calls[k].kind` is the static kind, so the caller's own code requires a record that names a
 * static callee, and the callee's head admits the static kind. The callee is compiled from source and runs a
 * read-only frame; the validator is the shipped program, which enforces that such a frame changes nothing.
 *
 * A static frame that would write its record is shown too: the callee's own code accepts the write (it settles its
 * own record when it is its contract's only master), and the validator refuses it, so the refusal is the static
 * frame's rule and not a coincidence of the transaction.
 */

const CATEGORY_CALLER = seededCategory('read-only frame caller');
const CATEGORY_CALLEE = seededCategory('read-only frame callee');
const CATEGORY_MUTANT = seededCategory('read-only frame mutant');
/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const ADDRESS_MUTANT = validatorAddress(CATEGORY_MUTANT, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** The value the callee's own code computes, and the blob a frame that returns it records. */
const ANSWER = 42n;
const ANSWER_RETVAL = encodeArgumentList([encodeIntegerValue(ANSWER)]);

/** Master input indices: the caller, its callee, the validator with its facet, then the user. */
const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const VALIDATOR_FACET_INDEX = VALIDATOR_INDEX + 1;
const USER_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;

const scriptBytes = (artifact: { bytecode: string }): Uint8Array => scriptToBytecode(asmToScript(artifact.bytecode));

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  commitment: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment } });

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

/** Fills one compiled contract's deployment slots, the way a deployment fills them. */
function deploy(
  artifacts: ReturnType<typeof compileStringMulti>,
  name: string,
  category: Uint8Array,
  address: Uint8Array,
): Uint8Array {
  const artifact = artifacts[name]!;
  return fillPlaceholders(scriptBytes(artifact), artifact.composition!.placeholders, {
    category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
  });
}

/** The selector an artifact publishes for an entry. */
function selectorOf(artifacts: ReturnType<typeof compileStringMulti>, name: string, entry: string): Uint8Array {
  return new Uint8Array(Buffer.from(artifacts[name]!.abi.find((row) => row.name === entry)!.selector!, 'hex'));
}

interface ReadComposition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

interface ReadOptions {
  /** The frame kind the caller records for its call; the static kind unless a test overrides it. */
  readonly recordedKind?: number;
  /** The argument pushes the callee's call data carries, when the read passes an argument. */
  readonly argumentPushes?: Uint8Array;
  /** The value the callee's own frame records as its return, when the callee returns something. */
  readonly calleeRetval?: Uint8Array;
}

/**
 * A caller and a stateless callee, both compiled from source, co-spent with the validator that covers both.
 *
 * `readerSource` picks how the read is written; the callee's source and the transaction are otherwise the same.
 */
function buildRead(
  readerProgram: Uint8Array,
  calleeProgram: Uint8Array,
  selector: Uint8Array,
  options: ReadOptions = {},
): ReadComposition {
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const facets = validatorFacetPlacements();
  const readerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [{
      kind: options.recordedKind ?? 2,
      target: ADDRESS_CALLEE,
      value: 0n,
      calleeRef: CALLEE_INDEX,
      argsHash: argsHash(selector, options.argumentPushes ?? new Uint8Array(0)),
      result: options.calleeRetval ?? ANSWER_RETVAL,
    }],
    segments: [[], []],
    events: [],
    sends: [],
  };
  const calleeBlock: WitnessBlock = {
    kind: 2,
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
  const readerLock = encodeLockingBytecodeP2sh32(hash256(readerProgram));
  const calleeLock = encodeLockingBytecodeP2sh32(hash256(calleeProgram));
  const masterValue = 20_000n;
  const inputs = [
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(readerBlock)), ...encodeDataPush(readerProgram),
      ]),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
        ...encodeDataPush(selector),
        ...(options.argumentPushes ?? new Uint8Array(0)),
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
    { lockingBytecode: readerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: calleeLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    ...facets.map((facet) => facet.output),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  return { transaction: { version: 2, inputs, outputs, locktime: 0 }, sourceOutputs: outputs };
}

/** Compiles a reader source, deploys it and its callee, and assembles the co-spend. */
function readComposition(readerSource: string, options: ReadOptions = {}): ReadComposition {
  const artifacts = compileStringMulti(readerSource, { composition: 'framed' });
  const calleeProgram = deploy(artifacts, 'Answer', CATEGORY_CALLEE, ADDRESS_CALLEE);
  const readerProgram = deploy(artifacts, 'Reader', CATEGORY_CALLER, ADDRESS_CALLER);
  return buildRead(readerProgram, calleeProgram, selectorOf(artifacts, 'Answer', 'peek'), options);
}

/** Every input's verdict, so a composition is accepted only when all of them are. */
function readVerdicts(readerSource: string, options: ReadOptions = {}): Record<number, boolean> {
  const composition = readComposition(readerSource, options);
  const vm = compositionMachine();
  return Object.fromEntries([CALLER_INDEX, CALLEE_INDEX, VALIDATOR_INDEX].map((index) => [
    index,
    vm.stateSuccess(vm.evaluate({
      inputIndex: index, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
    })) === true,
  ]));
}

const EXPLICIT_READ = 'pragma solidcash ^0.14.0;'
  + ' interface IReader { function peek() returns (int); }'
  + ` contract Answer { function peek() returns (int) { return ${ANSWER}; } }`
  + ' contract Reader { function readIt() {'
  + `   int r = IReader(0x${toHex(ADDRESS_CALLEE)}).peek.staticcall(); require(r == ${ANSWER}); require(true); } }`;

const VIEW_READ = 'pragma solidcash ^0.14.0;'
  + ' interface IReader { function peek() view returns (int); }'
  + ` contract Answer { function peek() returns (int) { return ${ANSWER}; } }`
  + ' contract Reader { function readIt() {'
  + `   int r = IReader(0x${toHex(ADDRESS_CALLEE)}).peek(); require(r == ${ANSWER}); require(true); } }`;

describe('a read under the framed convention', () => {
  it('is accepted at the caller, the callee and the validator when written as a .staticcall', () => {
    expect(readVerdicts(EXPLICIT_READ)).toStrictEqual({
      [CALLER_INDEX]: true, [CALLEE_INDEX]: true, [VALIDATOR_INDEX]: true,
    });
  });

  it('is accepted at the caller, the callee and the validator when written as a view method read', () => {
    expect(readVerdicts(VIEW_READ)).toStrictEqual({
      [CALLER_INDEX]: true, [CALLEE_INDEX]: true, [VALIDATOR_INDEX]: true,
    });
  });

  it('records the static kind, so a record that names a message call is refused at the caller', () => {
    // The caller binds `calls[0].kind` to the kind its site recorded. A record that names a message call is not
    // the static frame the source wrote, so the caller refuses it where it makes the call.
    const verdicts = readVerdicts(EXPLICIT_READ, { recordedKind: 1 });
    expect(verdicts[CALLER_INDEX]).toBe(false);
    // The callee and the validator read their own witness, so the mutation refuses only the caller's own check.
    expect(verdicts[CALLEE_INDEX]).toBe(true);
  });
});

/**
 * A read whose callee would write its record.
 *
 * The callee is stateful and its entry increments the counter, so a frame that runs it changes the record. Entered
 * as a static frame, the callee's own code still settles the write — it is its contract's only master, so the
 * settlement walk is its own — and only the validator's static-frame rule refuses it. The refusal is therefore the
 * rule, not the callee's own shape checks.
 */
const MUTANT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IMutant { function bump(); }'
  + ' contract Mutant {'
  + '   int public counter;'
  + '   function bump() { this.counter = this.counter + 1; require(this.counter > 0); }'
  + ' }'
  + ' contract Reader { function readIt() {'
  + `   IMutant(0x${toHex(ADDRESS_MUTANT)}).bump.staticcall(); require(true); } }`;

const mutantArtifacts = compileStringMulti(MUTANT_SOURCE, { composition: 'framed' });
const mutantProgram = deploy(mutantArtifacts, 'Mutant', CATEGORY_MUTANT, ADDRESS_MUTANT);
const mutantReaderProgram = deploy(mutantArtifacts, 'Reader', CATEGORY_CALLER, ADDRESS_CALLER);
const BUMP_SELECTOR = selectorOf(mutantArtifacts, 'Mutant', 'bump');
const commitment = (counter: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(mutantArtifacts.Mutant!.stateLayout!, { counter }, 0), 'hex'));
const BEFORE = commitment(5n);
const AFTER = commitment(6n);

/** Input indices for the stateful case: the record sits after the validator's facet, before the user. */
const RECORD_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;
const MUTANT_USER_INDEX = RECORD_INDEX + 1;

interface MutantComposition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

function buildMutant(): MutantComposition {
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const facets = validatorFacetPlacements();
  const declaration: RecordEntry = { in: RECORD_INDEX, out: RECORD_INDEX, viewIn: BEFORE, viewOut: AFTER };
  const readerBlock: WitnessBlock = {
    kind: 0,
    callerRef: MUTANT_USER_INDEX,
    originRef: MUTANT_USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [{
      kind: 2, target: ADDRESS_MUTANT, value: 0n, calleeRef: CALLEE_INDEX,
      argsHash: argsHash(BUMP_SELECTOR, new Uint8Array(0)), result: new Uint8Array(0),
    }],
    segments: [[], []],
    events: [],
    sends: [],
  };
  const mutantBlock: WitnessBlock = {
    kind: 2,
    callerRef: CALLER_INDEX,
    originRef: MUTANT_USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_CALLER,
    self: ADDRESS_MUTANT,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[declaration]],
    events: [],
    sends: [],
  };
  const readerLock = encodeLockingBytecodeP2sh32(hash256(mutantReaderProgram));
  const mutantLock = encodeLockingBytecodeP2sh32(hash256(mutantProgram));
  const masterValue = 20_000n;
  const inputs = [
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(readerBlock)), ...encodeDataPush(mutantReaderProgram),
      ]),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(mutantBlock)),
        ...encodeDataPush(BUMP_SELECTOR),
        ...encodeDataPush(mutantProgram),
      ]),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(3), sequenceNumber: 0xffffffff,
      unlockingBytecode: validator.unlockingBytecode,
    },
    ...facets.map((facet) => facet.input),
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
      unlockingBytecode: encodeDataPush(new Uint8Array([1])),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(5), sequenceNumber: 0xffffffff,
      unlockingBytecode: callerUnlockingBytecode(),
    },
  ];
  const outputs = [
    { lockingBytecode: readerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: mutantLock, valueSatoshis: masterValue, token: token(CATEGORY_MUTANT, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    ...facets.map((facet) => facet.output),
    {
      lockingBytecode: dataRecordLock(CATEGORY_MUTANT), valueSatoshis: masterValue,
      token: token(CATEGORY_MUTANT, 'mutable', AFTER),
    },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const sourceOutputs = [
    { lockingBytecode: readerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: mutantLock, valueSatoshis: masterValue, token: token(CATEGORY_MUTANT, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    ...facets.map((facet) => facet.output),
    {
      lockingBytecode: dataRecordLock(CATEGORY_MUTANT), valueSatoshis: masterValue,
      token: token(CATEGORY_MUTANT, 'mutable', BEFORE),
    },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  return { transaction: { version: 2, inputs, outputs, locktime: 0 }, sourceOutputs };
}
function mutantAccepted(inputIndex: number): boolean {
  const composition = buildMutant();
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
  })) === true;
}

/** The token facts of a VM UTXO or output, as the machine's own object carries them. */
interface VmToken {
  readonly category: Uint8Array;
  readonly amount: bigint;
  readonly nft?: { readonly capability: string; readonly commitment: Uint8Array };
}

/** The transaction as the validator derivation reads it, built from the same bytes the machine evaluates. */
function validatorModel(composition: MutantComposition): FramedTransaction {
  const shape = (held: { readonly token?: VmToken }): TokenShape => {
    const spent = held.token;
    if (spent === undefined) return tokenShape(new Uint8Array(0), TokenCapability.NONE, false);
    const nft = spent.nft!;
    const capability = nft.capability === 'minting' ? TokenCapability.MINTING
      : nft.capability === 'mutable' ? TokenCapability.MUTABLE : TokenCapability.NONE;
    return tokenShape(
      spent.category, capability, nft.capability !== 'none', nft.commitment, spent.amount,
    );
  };
  return {
    inputs: composition.transaction.inputs.map((input, index) => ({
      index,
      value: composition.sourceOutputs[index]!.valueSatoshis,
      lockingBytecode: composition.sourceOutputs[index]!.lockingBytecode,
      unlockingBytecode: input.unlockingBytecode,
      token: shape(composition.sourceOutputs[index]!),
      outpointTransactionHash: input.outpointTransactionHash,
      outpointIndex: input.outpointIndex,
    })),
    outputs: composition.transaction.outputs.map((output, index) => ({
      index,
      value: output.valueSatoshis,
      lockingBytecode: output.lockingBytecode,
      token: shape(output),
    })),
  };
}

describe('a static frame that would write its record', () => {
  it('is accepted by the callee\'s own code and refused by the validator, as the static-frame rule', () => {
    // The callee settles its own record: it is its contract's only master, so the write it computed is its own
    // business and its own code admits it. The read-only-frame rule is one the split runs in the facet at
    // `head + 1`, so the facet is the validator input that refuses a static frame changing a record.
    expect(mutantAccepted(CALLEE_INDEX)).toBe(true);
    expect(mutantAccepted(CALLER_INDEX)).toBe(true);
    expect(mutantAccepted(VALIDATOR_FACET_INDEX)).toBe(false);

    const decision = decideValidator(validatorModel(buildMutant()), {
      validatorTemplate: VALIDATOR_PROGRAM, validatorInputIndex: VALIDATOR_INDEX,
    });
    expect(decision.accepted).toBe(false);
    // The rule the rejection names is the one that a static frame may not change a record.
    expect(decision.rejection?.reason).toBe(ValidatorReason.V10_STATIC_RECORD_CHANGED);
  });
});

/**
 * A stateful caller that also makes a static read.
 *
 * A read-only call runs on the callee's records, not the caller's, so the caller still settles its own record when
 * it is its contract's only master. The chain its settlement checks is the record it writes, so a declaration that
 * does not begin at the commitment the transaction spends is refused by the caller's own code; the validator does
 * not check it, because a lone master needs no validator settlement.
 */
const STATEFUL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IAnswer { function peek() returns (int); }'
  + ` contract Answer { function peek() returns (int) { return ${ANSWER}; } }`
  + ' contract Counter {'
  + '   int public counter;'
  + '   function bump() {'
  + '     this.counter = this.counter + 1;'
  + '     require(this.counter > 0);'
  + `     int r = IAnswer(0x${toHex(ADDRESS_CALLEE)}).peek.staticcall();`
  + `     require(r == ${ANSWER});`
  + '   }'
  + ' }';

const CATEGORY_STATEFUL = seededCategory('read-only frame stateful caller');
const ADDRESS_STATEFUL = validatorAddress(CATEGORY_STATEFUL, VALIDATOR_PROGRAM);

const statefulArtifacts = compileStringMulti(STATEFUL_SOURCE, { composition: 'framed' });
const counterProgram = deploy(statefulArtifacts, 'Counter', CATEGORY_STATEFUL, ADDRESS_STATEFUL);
const answerProgram = deploy(statefulArtifacts, 'Answer', CATEGORY_CALLEE, ADDRESS_CALLEE);
const PEEK_SELECTOR = selectorOf(statefulArtifacts, 'Answer', 'peek');
const stateCommitment = (counter: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(statefulArtifacts.Counter!.stateLayout!, { counter }, 0), 'hex'));
const COUNTER_BEFORE = stateCommitment(5n);
const COUNTER_AFTER = stateCommitment(6n);

/** Input indices for the stateful caller: the record sits after the validator's facet, before the user. */
const STATE_RECORD_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;
const STATEFUL_USER_INDEX = STATE_RECORD_INDEX + 1;

interface StatefulComposition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

/** Builds the transaction, with the segment declaration's `viewIn` given so a case can break the chain. */
function buildStateful(viewIn: Uint8Array): StatefulComposition {
  const validator = validatorSpend(CATEGORY_STATEFUL, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const facets = validatorFacetPlacements();
  const declaration: RecordEntry = {
    in: STATE_RECORD_INDEX, out: STATE_RECORD_INDEX, viewIn, viewOut: COUNTER_AFTER,
  };
  const counterBlock: WitnessBlock = {
    kind: 0,
    callerRef: STATEFUL_USER_INDEX,
    originRef: STATEFUL_USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_STATEFUL,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [{
      kind: 2, target: ADDRESS_CALLEE, value: 0n, calleeRef: CALLEE_INDEX,
      argsHash: argsHash(PEEK_SELECTOR, new Uint8Array(0)), result: ANSWER_RETVAL,
    }],
    segments: [[declaration], []],
    events: [],
    sends: [],
  };
  const answerBlock: WitnessBlock = {
    kind: 2,
    callerRef: CALLER_INDEX,
    originRef: STATEFUL_USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_STATEFUL,
    self: ADDRESS_CALLEE,
    value: 0n,
    retval: ANSWER_RETVAL,
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const counterLock = encodeLockingBytecodeP2sh32(hash256(counterProgram));
  const answerLock = encodeLockingBytecodeP2sh32(hash256(answerProgram));
  const masterValue = 20_000n;
  const inputs = [
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(counterBlock)), ...encodeDataPush(counterProgram),
      ]),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(answerBlock)),
        ...encodeDataPush(PEEK_SELECTOR),
        ...encodeDataPush(answerProgram),
      ]),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(3), sequenceNumber: 0xffffffff,
      unlockingBytecode: validator.unlockingBytecode,
    },
    ...facets.map((facet) => facet.input),
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
      unlockingBytecode: encodeDataPush(new Uint8Array([1])),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(5), sequenceNumber: 0xffffffff,
      unlockingBytecode: callerUnlockingBytecode(),
    },
  ];
  const outputs = [
    { lockingBytecode: counterLock, valueSatoshis: masterValue, token: token(CATEGORY_STATEFUL, 'minting') },
    { lockingBytecode: answerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: masterValue, token: token(CATEGORY_STATEFUL, 'mutable') },
    ...facets.map((facet) => facet.output),
    {
      lockingBytecode: dataRecordLock(CATEGORY_STATEFUL), valueSatoshis: masterValue,
      token: token(CATEGORY_STATEFUL, 'mutable', COUNTER_AFTER),
    },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const sourceOutputs = [
    { lockingBytecode: counterLock, valueSatoshis: masterValue, token: token(CATEGORY_STATEFUL, 'minting') },
    { lockingBytecode: answerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: masterValue, token: token(CATEGORY_STATEFUL, 'mutable') },
    ...facets.map((facet) => facet.output),
    {
      lockingBytecode: dataRecordLock(CATEGORY_STATEFUL), valueSatoshis: masterValue,
      token: token(CATEGORY_STATEFUL, 'mutable', COUNTER_BEFORE),
    },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  return { transaction: { version: 2, inputs, outputs, locktime: 0 }, sourceOutputs };
}

/** The stateful caller's own verdict, with the segment declaration's `viewIn` given. */
function statefulAccepted(viewIn: Uint8Array = COUNTER_BEFORE): boolean {
  const composition = buildStateful(viewIn);
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({
    inputIndex: CALLER_INDEX, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
  })) === true;
}

describe('a stateful caller that makes a static read', () => {
  it('settles its own record, so a declaration that does not begin at the spent commitment is refused', () => {
    // The read is on the callee's records, so the caller's own record is still the caller's to settle. A
    // declaration whose `viewIn` is not the commitment the transaction spends fails the chain the caller walks.
    expect(statefulAccepted()).toBe(true);
    expect(statefulAccepted(stateCommitment(9n))).toBe(false);
  });
});

/** Compiles a source that must be refused, and reports the refusal text. */
/** The refusal the compile publishes for the one body these sources have, or '' when it serves it. */
const refusalOf = (source: string): string => refusalMessageOf(source);

describe('the reads a master still cannot compile', () => {
  it('refuses a delegatecall, because the callee would run on its caller\'s records', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface ICallee { function peek(int x) returns (int); }'
      + ` contract Caller { function readIt() { int r = ICallee(0x${toHex(ADDRESS_CALLEE)}).peek.delegatecall(7); `
      + ' require(r == 1); } }';
    const refusal = refusalOf(source);
    expect(refusal).toContain("the call to 'peek' is a delegatecall");
    expect(refusal).toContain("runs on its caller's own records");
  });

  it('refuses a read whose target is the transaction\'s own sender', () => {
    // A parameter or a value the caller's own state carries is admitted, but the transaction's sender is not: the
    // site's own target check would have to bind the callee to a category of its own, which it does not.
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface ICallee { function peek() returns (int); }'
      + ' contract Caller { function readIt() {'
      + '   int r = ICallee(msg.sender).peek.staticcall(); require(r == 1); } }';
    const refusal = refusalOf(source);
    expect(refusal).toContain("the call to 'peek' targets the transaction's own sender");
  });
});

/**
 * A read whose argument only the running code knows.
 *
 * The value the read passes is the transaction's own input count, so the caller's digest is folded from a value it
 * holds when it reads, and the callee answers with the value it received — so the same frame settles both the
 * argument the caller computed and the return the callee computed.
 */
const ARGUMENT_READ_ENTRY_COUNT = USER_INDEX + 1;
const ARGUMENT_READ = 'pragma solidcash ^0.14.0;'
  + ' interface IReader { function peek(int n) returns (int); }'
  + ' contract Answer { function peek(int n) view returns (int) { return n; } }'
  + ' contract Reader { function readIt() {'
  + `   int r = IReader(0x${toHex(ADDRESS_CALLEE)}).peek.staticcall(tx.inputs.length); `
  + `require(r == ${ARGUMENT_READ_ENTRY_COUNT}); require(true); } }`;

/** The push the caller computes for the argument: the input count's minimal script number, `OP_5` here. */
const ARGUMENT_PUSHES = encodeCallDataArguments([encodeIntegerValue(BigInt(ARGUMENT_READ_ENTRY_COUNT))]);
/** What the callee's own code returns: the value it received. */
const ARGUMENT_RETVAL = encodeResultList([encodeIntegerValue(BigInt(ARGUMENT_READ_ENTRY_COUNT))]);

describe('a read whose argument exists only when the code runs', () => {
  it('is accepted at the caller, the callee and the validator', () => {
    const verdicts = readVerdicts(ARGUMENT_READ, { argumentPushes: ARGUMENT_PUSHES, calleeRetval: ARGUMENT_RETVAL });
    expect(verdicts[CALLER_INDEX]).toBe(true);
    expect(verdicts[CALLEE_INDEX]).toBe(true);
    expect(verdicts[VALIDATOR_INDEX]).toBe(true);
  });

  it('is refused when the call data carries another argument', () => {
    const other = encodeCallDataArguments([encodeIntegerValue(BigInt(ARGUMENT_READ_ENTRY_COUNT + 1))]);
    const verdicts = readVerdicts(ARGUMENT_READ, { argumentPushes: other, calleeRetval: ARGUMENT_RETVAL });
    expect(verdicts[CALLER_INDEX]).toBe(false);
  });

  it('is refused when the callee records another return value', () => {
    const verdicts = readVerdicts(ARGUMENT_READ, {
      argumentPushes: ARGUMENT_PUSHES,
      calleeRetval: encodeResultList([encodeIntegerValue(BigInt(ARGUMENT_READ_ENTRY_COUNT + 1))]),
    });
    expect(verdicts[CALLEE_INDEX]).toBe(false);
  });
});
