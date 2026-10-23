import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  argsHash, asmToScript, buildPushdataCommitment, encodeIntegerValue, encodeResultList,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type RecordEntry,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { refusalMessageOf } from './refused-entry.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, dataRecordLock, seededCategory,
  validatorFacetPlacements, validatorSpend,
} from './validator-input.js';

/**
 * A call to an address the caller read from its own state.
 *
 * The caller holds the callee's address as a state field, so the address is not a compile-time constant: the
 * caller's own code reads it from the record it runs on and hands it to the site's check, exactly as a run-time
 * argument's digest is handed over. The record's `target` is then bound to the bytes the caller's own state
 * carries: a record that names another address is refused at the caller, whatever the callee it points at. When
 * the record is honest but the co-spent callee is a different contract, the validator's edge rule refuses the
 * composition.
 *
 * Everything is compiled through `compileStringMulti`, filled by deployment, and settled by the BCH-2026 machine's
 * own verdict.
 */

const CATEGORY_CALLER = seededCategory('runtime target caller');
const CATEGORY_CALLEE = seededCategory('runtime target callee');
const CATEGORY_IMPOSTOR = seededCategory('runtime target impostor');
/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const ADDRESS_IMPOSTOR = validatorAddress(CATEGORY_IMPOSTOR, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

/** The value the callee's own code returns, and the blob a static frame that returns it records. */
const ANSWER = 42n;
const ANSWER_RETVAL = encodeResultList([encodeIntegerValue(ANSWER)]);

/** Master input indices: the caller, its callee, the validator with its facet, the caller's record, then the user. */
const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const VALIDATOR_FACET_INDEX = VALIDATOR_INDEX + 1;
const STATE_RECORD_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;
const USER_INDEX = STATE_RECORD_INDEX + 1;

const scriptBytes = (artifact: { bytecode: string }): Uint8Array => scriptToBytecode(asmToScript(artifact.bytecode));

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  commitment: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment } });

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

/**
 * The caller's source: its state holds the callee's address, which it reads to name the callee of its call.
 *
 * The call is a static read, so its frame kind is the static one. The address is read from the caller's own record,
 * which is what the site hands to the check.
 */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IAnswer { function peek() returns (int); }'
  + ` contract Answer { function peek() returns (int) { return ${ANSWER}; } }`
  + ' contract Counter {'
  + '   address public target;'
  + '   int public counter;'
  + '   function bump() {'
  + '     this.counter = this.counter + 1;'
  + '     int r = IAnswer(this.target).peek.staticcall();'
  + `     require(r == ${ANSWER});`
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });

/** Fills one compiled contract's deployment slots, the way a deployment fills them. */
function deploy(name: string, category: Uint8Array, address: Uint8Array): Uint8Array {
  const artifact = artifacts[name]!;
  return fillPlaceholders(scriptBytes(artifact), artifact.composition!.placeholders, {
    category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
  });
}

const counterProgram = deploy('Counter', CATEGORY_CALLER, ADDRESS_CALLER);
const answerProgram = deploy('Answer', CATEGORY_CALLEE, ADDRESS_CALLEE);
/** A genuine `Answer` contract deployed at another address: the same entry, a different contract. */
const impostorProgram = deploy('Answer', CATEGORY_IMPOSTOR, ADDRESS_IMPOSTOR);

const selectorOf = (name: string, entry: string): Uint8Array =>
  new Uint8Array(Buffer.from(artifacts[name]!.abi.find((row) => row.name === entry)!.selector!, 'hex'));
const PEEK_SELECTOR = selectorOf('Answer', 'peek');

/** The caller's record commitment holding the callee's address and a counter, in the layout's field order. */
const stateCommitment = (counter: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(
    artifacts.Counter!.stateLayout!, { target: ADDRESS_CALLEE, counter }, 0,
  ), 'hex'));
const COUNTER_BEFORE = stateCommitment(5n);
const COUNTER_AFTER = stateCommitment(6n);

interface Composition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

/** Which contract the callee input actually runs. */
interface Callee {
  readonly category: Uint8Array;
  readonly address: Uint8Array;
  readonly program: Uint8Array;
}

const NAMED_CALLEE: Callee = {
  category: CATEGORY_CALLEE, address: ADDRESS_CALLEE, program: answerProgram,
};
const IMPOSTOR_CALLEE: Callee = {
  category: CATEGORY_IMPOSTOR, address: ADDRESS_IMPOSTOR, program: impostorProgram,
};

interface Options {
  /** The address the caller's record names, which the caller's own state names by default. */
  readonly recordedTarget?: Uint8Array;
  /** The contract the callee input runs, which is the one the caller named by default. */
  readonly callee?: Callee;
}

/** Builds the compiled caller and callee, a validator, and the transaction that co-spends them. */
function build(options: Options = {}): Composition {
  const callee = options.callee ?? NAMED_CALLEE;
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const facets = validatorFacetPlacements();
  const declaration: RecordEntry = {
    in: STATE_RECORD_INDEX, out: STATE_RECORD_INDEX, viewIn: COUNTER_BEFORE, viewOut: COUNTER_AFTER,
  };
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
      kind: 2,
      target: options.recordedTarget ?? ADDRESS_CALLEE,
      value: 0n,
      calleeRef: CALLEE_INDEX,
      argsHash: argsHash(PEEK_SELECTOR, new Uint8Array(0)),
      result: ANSWER_RETVAL,
    }],
    segments: [[declaration], []],
    events: [],
    sends: [],
  };
  const calleeBlock: WitnessBlock = {
    kind: 2,
    callerRef: CALLER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_CALLER,
    self: callee.address,
    value: 0n,
    retval: ANSWER_RETVAL,
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const callerLock = encodeLockingBytecodeP2sh32(hash256(counterProgram));
  const calleeLock = encodeLockingBytecodeP2sh32(hash256(callee.program));
  const masterValue = 20_000n;
  const inputs = [
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(counterProgram),
      ]),
    },
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
        ...encodeDataPush(PEEK_SELECTOR),
        ...encodeDataPush(callee.program),
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
    { lockingBytecode: callerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: calleeLock, valueSatoshis: masterValue, token: token(callee.category, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    ...facets.map((facet) => facet.output),
    {
      lockingBytecode: dataRecordLock(CATEGORY_CALLER), valueSatoshis: masterValue,
      token: token(CATEGORY_CALLER, 'mutable', COUNTER_AFTER),
    },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const sourceOutputs = [
    { lockingBytecode: callerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: calleeLock, valueSatoshis: masterValue, token: token(callee.category, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    ...facets.map((facet) => facet.output),
    {
      lockingBytecode: dataRecordLock(CATEGORY_CALLER), valueSatoshis: masterValue,
      token: token(CATEGORY_CALLER, 'mutable', COUNTER_BEFORE),
    },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  return { transaction: { version: 2, inputs, outputs, locktime: 0 }, sourceOutputs };
}

/** Every input's verdict, so a composition is accepted only when all of them are. */
function verdicts(options: Options = {}): Record<number, boolean> {
  const composition = build(options);
  const vm = compositionMachine();
  return Object.fromEntries([CALLER_INDEX, CALLEE_INDEX, VALIDATOR_INDEX, VALIDATOR_FACET_INDEX].map((index) => [
    index,
    vm.stateSuccess(vm.evaluate({
      inputIndex: index, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
    })) === true,
  ]));
}

describe('a call to an address the caller read from its own state', () => {
  it('is accepted at the caller, the callee and the validator', () => {
    expect(verdicts()).toStrictEqual({
      [CALLER_INDEX]: true, [CALLEE_INDEX]: true, [VALIDATOR_INDEX]: true, [VALIDATOR_FACET_INDEX]: true,
    });
  });

  it('is refused at the caller when the record names another address', () => {
    // The caller reads the address from its own record and hands it to the check, so a record that names another
    // address disagrees with the bytes the caller's code produced. The callee it points at is a genuine master, so
    // the caller's own check is what refuses. The edge rule that binds the callee's `self` to the target runs in
    // the facet at `head + 1`, so the facet is the validator input that refuses too.
    const results = verdicts({ recordedTarget: ADDRESS_CALLER });
    expect(results[CALLER_INDEX]).toBe(false);
    expect(results[CALLEE_INDEX]).toBe(true);
    expect(results[VALIDATOR_FACET_INDEX]).toBe(false);
  });

  it('is refused when the callee that runs is not the contract the caller named', () => {
    // The record names the address the caller read from its state, and the caller's own code accepts it, but the
    // master co-spent as the callee is another contract. The facet's edge rule binds that callee's `self` to the
    // recorded target and refuses the composition.
    const results = verdicts({ callee: IMPOSTOR_CALLEE });
    expect(results[CALLEE_INDEX]).toBe(true);
    expect(results[VALIDATOR_FACET_INDEX]).toBe(false);
  });
});

/** Compiles a source that must be refused, and reports the refusal text. */
/** The refusal the compile publishes for the one body these sources have, or '' when it serves it. */
const refusalOf = (source: string): string => refusalMessageOf(source);

describe('the target shapes a site admits and refuses', () => {
  it('compiles a call to an address the caller holds in a parameter', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface ICallee { function peek() returns (int); }'
      + ' contract Caller { function readIt(address target) {'
      + '   int r = ICallee(target).peek.staticcall(); require(r == 1); } }';
    expect(refusalOf(source)).toBe('');
  });

  it('compiles a call to an address the caller holds in a local', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface ICallee { function peek() returns (int); }'
      + ' contract Caller { address public stored; function readIt() {'
      + '   address target = this.stored;'
      + '   int r = ICallee(target).peek.staticcall(); require(r == 1); } }';
    expect(refusalOf(source)).toBe('');
  });

  it('compiles a call whose target and argument are both computed where it calls', () => {
    // The check parks the target above the digest, which it is emitted beneath, so the two are reached at the
    // fields they bind. The source is enough to show the pair composes; the runtime verdict for a computed target
    // is the composition above.
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface ICallee { function peek(int n) returns (int); }'
      + ' contract Caller { address public stored; function readIt() {'
      + '   int r = ICallee(this.stored).peek(tx.inputs.length); require(r == 1); } }';
    expect(refusalOf(source)).toBe('');
  });

  it('refuses a call whose target is the transaction\'s own sender, whose category must match the callee\'s', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface ICallee { function peek() returns (int); }'
      + ' contract Caller { function readIt() {'
      + '   int r = ICallee(msg.sender).peek.staticcall(); require(r == 1); } }';
    expect(refusalOf(source)).toContain("targets the transaction's own sender");
  });

  it('refuses a call whose target is a value the caller\'s own code does not hold as one value', () => {
    // `tx.origin` is transaction data rather than a parameter or a state field, so no one stack value the caller
    // computed names the callee.
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface ICallee { function peek() returns (int); }'
      + ' contract Caller { function readIt() {'
      + '   int r = ICallee(tx.origin).peek.staticcall(); require(r == 1); } }';
    expect(refusalOf(source)).toContain('does not hold as one value');
  });
});
