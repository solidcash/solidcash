import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, computeFunctionSelector, computeFunctionSignature,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
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
 * Two contracts that call each other, both compiled as masters and co-spent with a validator.
 *
 * The compiler emits one master per contract, and each admits both a user's frame and a callee's: the test spends
 * them together, so the caller runs a root frame and the callee a message-call frame. The caller records the call
 * and the callee proves the frame it was entered through; the validator input is recognised by both from its
 * program hash. Everything the compiler produces is the shipped output: the sources are compiled through
 * `compileStringMulti`, the reserved slots are filled the way a deployment does, and the machine's own verdict is
 * the assertion.
 *
 * The controls are what make the accept meaningful: a call frame with no validator cannot stand alone, and a call
 * frame cannot borrow the root frame's facts, which the root arm checks as a P2PKH caller and a zero value.
 */

const CATEGORY_CALLER = seededCategory('composed compiled caller');
const CATEGORY_CALLEE = seededCategory('composed compiled callee');
/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

/** The callee entry's selector, which the caller records as the call's argument hash. */
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** The callee's address is baked into the caller as the target of its call. */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call(); require(true); }`
  + ' }';

const compile = (): ReturnType<typeof compileStringMulti> =>
  compileStringMulti(SOURCE, { composition: 'framed' });

/** The finished script as bytes: the artifact publishes it as ASM, deployment fills the slots in the bytes. */
const scriptBytes = (artifact: { bytecode: string }): Uint8Array => scriptToBytecode(asmToScript(artifact.bytecode));

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
  /** How the callee claims its frame was entered. */
  readonly calleeKind?: number;
  /** The callee's caller reference. */
  readonly calleeCallerRef?: number;
  /** The callee's origin reference. */
  readonly calleeOriginRef?: number;
  /** The callee's sender claim. */
  readonly calleeSender?: Uint8Array;
  /** The callee's value. */
  readonly calleeValue?: bigint;
  /** Remove the callee's validator reference. */
  readonly dropValidatorOnCallee?: boolean;
  /** Omit the callee's call-data selector push, as a user's frame to the callee does. */
  readonly omitCalleeSelector?: boolean;
}

interface Composition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

/** Builds the compiled caller, the compiled callee, a validator, and the transaction that co-spends them. */
function buildComposition(options: CompositionOptions = {}): Composition {
  const artifacts = compile();
  const fill = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(scriptBytes(artifact), artifact.composition!.placeholders, {
      category, contractAddress: address, templateHash: TEMPLATE_HASH,
    });
  };
  const callerProgram = fill('Caller', categorySlotValue(CATEGORY_CALLER), ADDRESS_CALLER);
  const calleeProgram = fill('Callee', categorySlotValue(CATEGORY_CALLEE), ADDRESS_CALLEE);

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
    kind: options.calleeKind ?? 1,
    callerRef: options.calleeCallerRef ?? CALLER_INDEX,
    originRef: options.calleeOriginRef ?? USER_INDEX,
    validatorRef: options.dropValidatorOnCallee === true ? 0xffff : VALIDATOR_INDEX,
    sender: options.calleeSender ?? ADDRESS_CALLER,
    self: ADDRESS_CALLEE,
    value: options.calleeValue ?? 0n,
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
        ...(options.omitCalleeSelector === true ? [] : [...encodeDataPush(CALLEE_SELECTOR)]),
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
      // The user's signed P2PKH input: a root frame reads its signature's hash type.
      unlockingBytecode: callerUnlockingBytecode(),
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

/** One input's verdict in the BCH-2026 machine. */
function accepted(options: CompositionOptions, inputIndex: number): boolean {
  const composition = buildComposition(options);
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs: composition.sourceOutputs, transaction: composition.transaction,
  })) === true;
}

describe('two compiled masters that call each other', () => {
  it('publishes a framed caller and callee, each with a validator program hash slot', () => {
    const artifacts = compile();
    expect(artifacts.Caller!.composition?.convention).toBe('framed');
    expect(artifacts.Callee!.composition?.convention).toBe('framed');
    // A callee has to recognise the validator that covers the call, so its master reserves the slot too.
    expect(artifacts.Callee!.composition!.placeholders.templateHashOffset).toBeTypeOf('number');
  });

  it('is accepted at every input when both masters are compiled into the transaction', () => {
    expect(accepted({}, CALLER_INDEX)).toBe(true);
    expect(accepted({}, CALLEE_INDEX)).toBe(true);
    expect(accepted({}, VALIDATOR_INDEX)).toBe(true);
  });

  it('is accepted when a user enters the compiled callee directly', () => {
    // The same compiled master also admits a user's frame: a selector-free unlocking bytecode, a P2PKH caller and
    // no validator to cover it.
    const rootEntry = {
      calleeKind: 0, calleeCallerRef: USER_INDEX, calleeOriginRef: USER_INDEX,
      calleeSender: USER_LOCK, dropValidatorOnCallee: true, omitCalleeSelector: true,
    };
    expect(accepted(rootEntry, CALLEE_INDEX)).toBe(true);
  });

  it('refuses a call frame that names no validator', () => {
    // A message-call frame's facts are the validator's to bind, so the frame cannot stand alone.
    expect(accepted({ dropValidatorOnCallee: true }, CALLEE_INDEX)).toBe(false);
    // The call names a master that no longer points here, so the validator refuses the same frame.
    expect(accepted({ dropValidatorOnCallee: true }, VALIDATOR_INDEX)).toBe(false);
  });

  it('refuses a call frame that claims the root frame\'s P2PKH caller', () => {
    // The callee was entered by another master, so claiming to be a user's frame fails the root arm's P2PKH check
    // on a caller that is itself a master.
    const rootClaim = { calleeKind: 0, calleeCallerRef: CALLER_INDEX, calleeOriginRef: CALLER_INDEX };
    expect(accepted(rootClaim, CALLEE_INDEX)).toBe(false);
    // The frame's kind is an edge rule, which the split runs in the facet at `head + 1`, so the facet is the
    // validator input that refuses a callee presenting itself as a root.
    expect(accepted(rootClaim, VALIDATOR_FACET_INDEX)).toBe(false);
  });

  it('refuses a call frame that claims the root frame\'s zero value', () => {
    // The root arm is the one that requires a value of zero; a frame entered by a call may not borrow it.
    const rootClaim = {
      calleeKind: 0, calleeCallerRef: USER_INDEX, calleeOriginRef: USER_INDEX,
      calleeSender: USER_LOCK, calleeValue: 1n,
    };
    expect(accepted(rootClaim, CALLEE_INDEX)).toBe(false);
    // The recorded value is bound by the same edge rule, in the facet, so a root claim of value one fails there.
    expect(accepted(rootClaim, VALIDATOR_FACET_INDEX)).toBe(false);
  });
});
