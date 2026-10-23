import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256, Opcodes,
} from '@bitauth/libauth';
import {
  asmToScript, computeFunctionSelector, computeFunctionSignature,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { buildMasterHeadScript } from '../../../src/framed/master/master-head.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { SIGHASH_ALL, callerUnlockingBytecode } from './caller-input.js';
import {
  ALTERNATE_ACCEPTING_PROGRAM, REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, seededCategory,
  validatorFacetPlacements, validatorSpend,
} from './validator-input.js';

/**
 * A compiled caller and the composition it is entered through.
 *
 * The contract is compiled from a source where one contract's entry calls another, through the real entry point
 * (`compileString`), because the compiled master is what has to reserve and read the validator's program hash. A
 * master that makes a call is reached through one, so it has to recognise the validator its frame names by the
 * program's hash, which exists only once the validator is deployed: the artifact reserves a third slot for it and
 * publishes where it sits, and deployment fills the category, the address and that hash.
 *
 * The VM half spends that compiled master together with its callee and a covering validator, filling the slots the
 * descriptor names. The callee is built from the head builder as a small stand-in rather than compiled: this test
 * is about the compiled caller, and the head builder lets the callee's body be a single accepting item. Every
 * input's script is evaluated, because only the machine settles whether the reserved hash is load-bearing.
 */

const CATEGORY_CALLER = seededCategory('compiled caller');
const CATEGORY_CALLEE = seededCategory('compiled caller callee');
/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

/** The callee entry's dispatcher selector, which the caller records as its argument hash. */
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/**
 * A two-contract source whose second contract's entry calls the first. The call target is a code-baked address
 * literal, which is the shape whose callee address the head can compare a witness call record against.
 */
const callingSource = (target: Uint8Array): string => 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(target)}).ping.call(); require(true); }`
  + ' }';

const compile = (target: Uint8Array = ADDRESS_CALLEE): ReturnType<typeof compileString> =>
  compileString(callingSource(target), { composition: 'framed' });

/** The finished script as bytes: the artifact publishes it as ASM, deployment fills the slots in the bytes. */
const scriptBytes = (artifact: ReturnType<typeof compileString>): Uint8Array =>
  scriptToBytecode(asmToScript(artifact.bytecode));

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

/** Master input indices: the caller, its callee, the validator with its facet, then the user. */
const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const VALIDATOR_FACET_INDEX = VALIDATOR_INDEX + 1;
const USER_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;

interface CompositionOptions {
  /** The hash the caller's reserved slot is filled with, so a wrong value can be refused. */
  readonly templateHash?: Uint8Array;
  /** The hash type the user's signature ends in. */
  readonly callerHashType?: number;
}

interface Composition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

/** Builds the compiled caller, a callee master, a validator, and the transaction that co-spends them. */
function buildComposition(options: CompositionOptions = {}): Composition {
  const artifact = compile();
  const templateHash = options.templateHash ?? TEMPLATE_HASH;
  const callerProgram = fillPlaceholders(
    scriptBytes(artifact),
    artifact.composition!.placeholders,
    { category: categorySlotValue(CATEGORY_CALLER), contractAddress: ADDRESS_CALLER, templateHash },
  );

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
    { category: categorySlotValue(CATEGORY_CALLEE), contractAddress: ADDRESS_CALLEE, templateHash },
  );
  // The head drops the block copy, then leaves four frame values, the category-owner index and the declared call
  // count above the callee's selector push.
  const calleeProgram = new Uint8Array([
    ...filledCallee,
    Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP,
    Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP,
    Opcodes.OP_1,
  ]);

  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const validatorLock = validator.lock;
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
      argsHash: sha256(CALLEE_SELECTOR),
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
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(callerProgram),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(2),
      sequenceNumber: 0xffffffff,
      // The callee's selector is its call data, which the caller's head reads and hashes.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
        ...encodeDataPush(CALLEE_SELECTOR),
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
    ...facets.map((facet) => facet.input),
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(4),
      sequenceNumber: 0xffffffff,
      // The user's signed P2PKH input: the caller's root frame reads its signature's hash type.
      unlockingBytecode: callerUnlockingBytecode(options.callerHashType ?? SIGHASH_ALL),
    },
  ];
  const outputs = [
    { lockingBytecode: callerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: calleeLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validatorLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    ...facets.map((facet) => facet.output),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const sourceOutputs = [
    { lockingBytecode: callerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: calleeLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validatorLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    ...facets.map((facet) => facet.output),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];

  return { transaction: { version: 2, inputs, outputs, locktime: 0 }, sourceOutputs };
}

/** Every input's verdict, so a composition is accepted only when all of them are. */
function verdicts(options: CompositionOptions = {}): Record<number, boolean> {
  const composition = buildComposition(options);
  const vm = compositionMachine();
  return Object.fromEntries([CALLER_INDEX, CALLEE_INDEX, VALIDATOR_INDEX, VALIDATOR_FACET_INDEX].map((index) => [
    index,
    vm.stateSuccess(vm.evaluate({
      inputIndex: index, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
    })) === true,
  ]));
}

describe('a caller, its callee and a validator evaluated in the BCH-2026 virtual machine', () => {
  it('is accepted at every input when the reserved hash is the validator program\'s', () => {
    expect(verdicts()).toStrictEqual({
      [CALLER_INDEX]: true, [CALLEE_INDEX]: true, [VALIDATOR_INDEX]: true, [VALIDATOR_FACET_INDEX]: true,
    });
  });

  it('has a caller that fails when its reserved hash is not the validator program\'s', () => {
    const results = verdicts({ templateHash: sha256(ALTERNATE_ACCEPTING_PROGRAM) });
    expect(results[CALLER_INDEX]).toBe(false);
    expect(results[CALLEE_INDEX]).toBe(false);
    // The validator's own script still succeeds, so the refusal is the masters' program-hash check.
    expect(results[VALIDATOR_INDEX]).toBe(true);
  });

  it('has a caller refused for a hash type other than SIGHASH_ALL, while the callee is unaffected', () => {
    // Only the root frame reads its caller's signature; the callee runs a message-call frame entered by another
    // master, so the co-spent callee still accepts when the user's signature does not commit as SIGHASH_ALL.
    expect(verdicts({ callerHashType: SIGHASH_ALL })[CALLER_INDEX]).toBe(true);
    const results = verdicts({ callerHashType: 0x03 });
    expect(results[CALLER_INDEX]).toBe(false);
    expect(results[CALLEE_INDEX]).toBe(true);
    expect(results[VALIDATOR_INDEX]).toBe(true);
  });
});
