import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, computeFunctionSelector, computeFunctionSignature,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory, validatorSpend,
} from './validator-input.js';

/**
 * A compiled master whose execution is split at a call settles its record across both its segments.
 *
 * The caller's body reads and writes its state, calls a callee, and then reads and writes again. The compiler splits
 * that one execution at the call, so the master declares its record twice: once for the segment before the call and
 * once for the segment after it. The two declarations have to chain into one transition — the first begins at the
 * commitment the transaction spends, the second carries on from the first, and the last is the commitment the
 * transaction writes. The caller is its category's only master, so the settlement is the master's own rather than
 * its validator's, even though a validator covers the frame.
 *
 * The cases drive the shipped output: the sources are compiled through `compileStringMulti`, the reserved slots are
 * filled the way a deployment fills them, and the machine's verdict on the caller's own input is the assertion.
 * Each refusal mutates the accept it is paired with, so the refusal is the chain's check rather than a malformed
 * transaction.
 *
 * The record sits immediately after its master, which is where a compiled body reads it from: state is read as
 * `OP_INPUTINDEX + offset`, and reading it out of the segment views instead is not emitted yet.
 */

const CATEGORY_CALLER = seededCategory('cross segment caller');
const CATEGORY_CALLEE = seededCategory('cross segment callee');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   int public counter;'
  + '   function callIt() {'
  + '     this.counter = this.counter + 1;'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     this.counter = this.counter + 2;'
  + '     require(this.counter > 0);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const callerArtifact = artifacts.Caller!;

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  commitment: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment } });

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];

/** The record's index in the default layout (right after the caller's own input) and the caller's own index. */
const CALLER_INDEX = 0;
const STATE_INDEX = 1;
const VALUE = 20_000n;

/** A data-NFT commitment holding one integer, in the shipped encoder's form. */
const commitment = (counter: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(callerArtifact.stateLayout!, { counter }, 0), 'hex'));

const BEFORE = commitment(5n);
/** What the first segment's write leaves, which the second segment reads. */
const MIDDLE = commitment(6n);
const AFTER = commitment(8n);

interface Options {
  /** The first segment's declaration, defaulting to a declaration that chains from the spent commitment. */
  readonly first?: RecordEntry;
  /** The second segment's declaration, defaulting to one that carries on to the written commitment. */
  readonly second?: RecordEntry;
  /** The commitment the state output actually carries. */
  readonly outputCommitment?: Uint8Array;
  /** Spend a state UTXO the segments do not declare. */
  readonly undeclaredState?: boolean;
  /** The value the state output carries, against the floor the settlement checks. */
  readonly outputValue?: bigint;
  /** Put the record at the last index instead of right after its master. */
  readonly recordLast?: boolean;
}

/** The record at its own index, kept in place. */
const kept = (viewIn: Uint8Array, viewOut: Uint8Array, index = STATE_INDEX): RecordEntry =>
  ({ in: index, out: index, viewIn, viewOut });

function build(options: Options = {}): Omit<VmProgram, 'inputIndex'> {
  // Which index each role takes. The record sits right after its master by default, and last when a case moves it
  // away from the master that reads it.
  const at = options.recordLast === true
    ? { caller: 0, validator: 1, user: 2, callee: 3, state: 4 }
    : { caller: 0, state: 1, validator: 2, user: 3, callee: 4 };
  const fill = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
      category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
    });
  };
  const callerProgram = fill('Caller', CATEGORY_CALLER, ADDRESS_CALLER);
  const calleeProgram = fill('Callee', CATEGORY_CALLEE, ADDRESS_CALLEE);
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [at.caller], masters: [at.caller, at.callee], settles: [],
  });
  const callerLock = encodeLockingBytecodeP2sh32(hash256(callerProgram));
  const calleeLock = encodeLockingBytecodeP2sh32(hash256(calleeProgram));

  const callerBlock: WitnessBlock = {
    kind: 0,
    callerRef: at.user,
    originRef: at.user,
    validatorRef: at.validator,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [{
      kind: 1,
      target: ADDRESS_CALLEE,
      value: 0n,
      calleeRef: at.callee,
      argsHash: sha256(CALLEE_SELECTOR),
      result: new Uint8Array(0),
    }],
    segments: [
      [options.first ?? kept(BEFORE, MIDDLE, at.state)],
      [options.second ?? kept(MIDDLE, AFTER, at.state)],
    ],
    events: [],
    sends: [],
  };
  const calleeBlock: WitnessBlock = {
    kind: 1,
    callerRef: at.caller,
    originRef: at.user,
    validatorRef: at.validator,
    sender: ADDRESS_CALLER,
    self: ADDRESS_CALLEE,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };

  const plainInput = (fillByte: number): VmInput => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(fillByte),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  });
  const callerInput: VmInput = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(callerProgram),
    ]),
  };
  const calleeInput: VmInput = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(5), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(calleeBlock)), ...encodeDataPush(CALLEE_SELECTOR),
      ...encodeDataPush(calleeProgram),
    ]),
  };
  const validatorInput: VmInput = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(3), sequenceNumber: 0xffffffff,
    unlockingBytecode: validator.unlockingBytecode,
  };
  const userInput: VmInput = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const callerOutput = { lockingBytecode: callerLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'minting') };
  const calleeOutput = { lockingBytecode: calleeLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting') };
  const validatorOutput = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };
  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const recordLock = dataRecordLock(CATEGORY_CALLER);
  const recordOutput = {
    lockingBytecode: recordLock,
    valueSatoshis: options.outputValue ?? VALUE,
    token: token(CATEGORY_CALLER, 'mutable', options.outputCommitment ?? AFTER),
  };
  const stateInput = {
    lockingBytecode: recordLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', BEFORE),
  };
  const spentState = options.undeclaredState === true
    ? { lockingBytecode: recordLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', MIDDLE) }
    : stateInput;

  const inputs: VmInput[] = [];
  const outputs: VmOutput[] = [];
  const sourceOutputs: VmProgram['sourceOutputs'] = [];
  inputs[at.caller] = callerInput; outputs[at.caller] = callerOutput; sourceOutputs[at.caller] = callerOutput;
  inputs[at.state] = plainInput(2); outputs[at.state] = recordOutput; sourceOutputs[at.state] = spentState;
  inputs[at.validator] = validatorInput;
  outputs[at.validator] = validatorOutput;
  sourceOutputs[at.validator] = validatorOutput;
  inputs[at.user] = userInput; outputs[at.user] = userOutput; sourceOutputs[at.user] = userOutput;
  inputs[at.callee] = calleeInput; outputs[at.callee] = calleeOutput; sourceOutputs[at.callee] = calleeOutput;

  return { sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 } };
}

/** The caller input's verdict in the BCH-2026 machine, with the refusal reason for a diagnosis. */
function verdict(options: Options = {}): { accepted: boolean; objection?: string } {
  const program = build(options);
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: CALLER_INDEX, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a compiled master whose execution is split at a call', () => {
  it('is accepted when the two declarations chain into the commitment the transaction writes', () => {
    expect(verdict()).toStrictEqual({ accepted: true });
  });

  it('is refused when the second declaration does not carry on from the first', () => {
    // The chain is broken: the second segment claims the record started where nothing left it.
    expect(verdict({ second: kept(BEFORE, AFTER) }).accepted).toBe(false);
    expect(verdict().accepted).toBe(true);
  });

  it('is refused when the first declaration is not the commitment the transaction spends', () => {
    expect(verdict({ first: kept(MIDDLE, AFTER), second: kept(AFTER, AFTER) }).accepted).toBe(false);
    expect(verdict().accepted).toBe(true);
  });

  it('is refused when the last declaration is not the commitment the transaction writes', () => {
    expect(verdict({ second: kept(MIDDLE, MIDDLE) }).accepted).toBe(false);
    expect(verdict().accepted).toBe(true);
  });

  it('is refused when the record ends with less value than it began with', () => {
    expect(verdict({ outputValue: VALUE - 1n }).accepted).toBe(false);
    expect(verdict({ outputValue: VALUE }).accepted).toBe(true);
  });

  it('is refused when a state UTXO is spent that no segment declares', () => {
    expect(verdict({ undeclaredState: true }).accepted).toBe(false);
    expect(verdict({ undeclaredState: false }).accepted).toBe(true);
  });

  it('is accepted when the layout puts the record away from its master', () => {
    // The body reads and writes its state through the index its own frame's segment declared, so the record does
    // not have to follow the master input: every segment claims it where the layout put it.
    expect(verdict({ recordLast: true })).toStrictEqual({ accepted: true });
  });
});
