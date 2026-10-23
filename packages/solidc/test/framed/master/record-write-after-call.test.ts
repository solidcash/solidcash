import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, computeFunctionSelector, computeFunctionSignature,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import {
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../../solidcash/src/framed/deploy/index.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * A compiled master whose entry writes its own data-NFT record after it has made an external call.
 *
 * A call closes the witness segment the code before it runs in, so the record write lands in the second segment of
 * the frame's two. The whole shipped path runs: the source through `compileStringMulti` with the framed
 * convention, the reserved slots filled the way a deployment fills them, and the machine's verdict on the caller's
 * own input is the assertion. The declaration the frame carries is the one a builder reads the artifact's
 * published write segment from — the record kept in the segments before the write, written from the write's own.
 */

const CATEGORY_CALLER = seededCategory('record write after call caller');
const CATEGORY_CALLEE = seededCategory('record write after call callee');
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
  + '   function set(address to, int amount) {'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     this.counter = amount;'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const callerArtifact = artifacts.Caller!;

type Program = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<Program['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];

const CALLER_INDEX = 0;
const USER_INDEX = 1;
const CALLEE_INDEX = 2;
const VALIDATOR_INDEX = 3;
const RECORD_INDEX = 4;
const VALUE = 20_000n;
const AMOUNT = 42;
const EM_PTY = new Uint8Array(0);

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  nftCommitment: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: nftCommitment } });

/** The commitment the record holds before the write, and the one the entry's own body computes for it. */
function commitment(counter: number): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(callerArtifact.stateLayout!, { counter: BigInt(counter) }, 0), 'hex'));
}

const RECORD_BEFORE = commitment(0);
const RECORD_AFTER = commitment(AMOUNT);

/** The declaration of a record the frame touches but does not write: one index, its view unchanged. */
const KEPT_RECORD: RecordEntry = {
  in: RECORD_INDEX, out: RECORD_INDEX, viewIn: RECORD_BEFORE, viewOut: RECORD_BEFORE,
};

interface Options {
  /** The records the write's own segment declares; the written record by default. */
  readonly writeSegment?: RecordEntry[];
  /** The records the segment before the write declares; the record kept by default. */
  readonly keptSegment?: RecordEntry[];
  /** The commitment the record's output carries; the one the entry computed by default. */
  readonly recordOutputCommitment?: Uint8Array;
}

function fill(name: 'Caller' | 'Callee'): Uint8Array {
  const artifact = artifacts[name]!;
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(name === 'Caller' ? CATEGORY_CALLER : CATEGORY_CALLEE),
    contractAddress: name === 'Caller' ? ADDRESS_CALLER : ADDRESS_CALLEE,
    templateHash: TEMPLATE_HASH,
  });
}

function build(options: Options = {}): Omit<Program, 'inputIndex'> {
  const callerProgram = fill('Caller');
  const calleeProgram = fill('Callee');
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const callerLock = encodeLockingBytecodeP2sh32(hash256(callerProgram));
  const calleeLock = encodeLockingBytecodeP2sh32(hash256(calleeProgram));
  const recordAfter = options.recordOutputCommitment ?? RECORD_AFTER;
  // The record is kept at the commitment the frame starts from until the segment its own write opens, which is the
  // second one: the call closes the segment the code before it runs in.
  const segments: RecordEntry[][] = [
    [...(options.keptSegment ?? [KEPT_RECORD])],
    [...(options.writeSegment ?? [
      { in: RECORD_INDEX, out: RECORD_INDEX, viewIn: RECORD_BEFORE, viewOut: recordAfter },
    ])],
  ];
  const callCount = segments.length - 1;

  const callerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: EM_PTY,
    calls: Array.from({ length: callCount }, () => ({
      kind: 1,
      target: ADDRESS_CALLEE,
      value: 0n,
      calleeRef: CALLEE_INDEX,
      argsHash: sha256(CALLEE_SELECTOR),
      result: EM_PTY,
    })),
    segments,
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
    retval: EM_PTY,
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };

  const recordLock = stateRecordLockingBytecode(toHex(CATEGORY_CALLER));
  const recordUnlock = stateRecordUnlockingBytecode(toHex(CATEGORY_CALLER), CALLER_INDEX, 1);
  const inputs: VmInput[] = [];
  inputs[CALLER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(callerBlock)),
      ...encodeDataPush(new Uint8Array([AMOUNT])),
      ...encodeDataPush(new Uint8Array(20).fill(0x33)),
      ...encodeDataPush(callerProgram),
    ]),
  };
  inputs[USER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  inputs[CALLEE_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(6), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
      ...encodeDataPush(CALLEE_SELECTOR),
      ...encodeDataPush(calleeProgram),
    ]),
  };
  inputs[VALIDATOR_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(7), sequenceNumber: 0xffffffff,
    unlockingBytecode: validator.unlockingBytecode,
  };
  inputs[RECORD_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(8), sequenceNumber: 0xffffffff,
    unlockingBytecode: recordUnlock,
  };

  const outputs: VmOutput[] = [];
  outputs[CALLER_INDEX] = {
    lockingBytecode: callerLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'minting'),
  };
  outputs[USER_INDEX] = { lockingBytecode: USER_LOCK, valueSatoshis: 99_000n };
  outputs[CALLEE_INDEX] = {
    lockingBytecode: calleeLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting'),
  };
  outputs[VALIDATOR_INDEX] = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };
  outputs[RECORD_INDEX] = {
    lockingBytecode: recordLock, valueSatoshis: VALUE,
    token: token(CATEGORY_CALLER, 'mutable', recordAfter),
  };

  const sourceOutputs: Program['sourceOutputs'] = [];
  sourceOutputs[CALLER_INDEX] = {
    lockingBytecode: callerLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'minting'),
  };
  sourceOutputs[USER_INDEX] = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  sourceOutputs[CALLEE_INDEX] = {
    lockingBytecode: calleeLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting'),
  };
  sourceOutputs[VALIDATOR_INDEX] = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };
  sourceOutputs[RECORD_INDEX] = {
    lockingBytecode: recordLock, valueSatoshis: VALUE,
    token: token(CATEGORY_CALLER, 'mutable', RECORD_BEFORE),
  };

  return { sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 } };
}

/** The caller input's verdict in the BCH-2026 machine, with the objection for a diagnosis. */
function verdict(options: Options = {}): { accepted: boolean; objection?: string } {
  const program = build(options);
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: CALLER_INDEX, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose entry writes its own record after an external call', () => {
  it('settles the record written in the segment the call opened', () => {
    const outcome = verdict();
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('refuses an output the entry\'s own code did not compute for the record', () => {
    const tampered = commitment(AMOUNT + 1);
    expect(verdict({ recordOutputCommitment: tampered }).accepted).toBe(false);
    expect(verdict({ recordOutputCommitment: RECORD_AFTER }).accepted).toBe(true);
  });

  it('refuses a frame that declares the record written in the segment before the write', () => {
    // The record is declared written from the frame's first segment, which its own code does not do: the body
    // computes the record unchanged there, so the segment's close refuses the declaration.
    const writtenEarly: RecordEntry = {
      in: RECORD_INDEX, out: RECORD_INDEX, viewIn: RECORD_BEFORE, viewOut: RECORD_AFTER,
    };
    expect(verdict({ keptSegment: [writtenEarly] }).accepted).toBe(false);
    expect(verdict({ keptSegment: [{ ...KEPT_RECORD, viewOut: RECORD_AFTER }] }).accepted).toBe(false);
  });
});
