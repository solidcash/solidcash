import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  FrameKind, asmToScript, buildPushdataCommitment, computeFunctionSelector, computeFunctionSignature,
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
 * A body whose calls repeat reads and writes its own record, and the segment each read resolves against is the
 * one the number of calls it has made names.
 *
 * The loop turns a run-time number of times and makes one call per turn, and each turn reads its own state and
 * writes it back. The compiler splits that execution into as many segments as the loop makes calls, and which
 * declaration a read resolves against is a fact only the running frame holds — so the read walks the block's
 * declared records and its own call count rather than a segment the source fixes. The cases drive the shipped
 * output: the sources go through `compileStringMulti`, the reserved slots are filled the way a deployment fills
 * them, and the machine's verdict on the caller's own input is the assertion. Each refusal mutates the accept it
 * is paired with, so the refusal is the chain's or the walk's own check rather than a malformed transaction.
 */

const CATEGORY_CALLER = seededCategory('looped state read caller');
const CATEGORY_CALLEE = seededCategory('looped state read callee');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   int public counter;'
  + '   function go(int n) {'
  + '     for (int i = 0; i < n; i = i + 1) {'
  + '       this.counter = this.counter + 1;'
  + `       ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     }'
  + '     require(this.counter >= 1);'
  + '     require(true);'
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

const CALLER_INDEX = 0;
const STATE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = 3;
const CALLEE_INDEX = 4;
const VALUE = 20_000n;
const BASE = 5n;

/** A data-NFT commitment holding one integer, in the shipped encoder's form. */
const commitment = (counter: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(callerArtifact.stateLayout!, { counter }, 0), 'hex'));

/** The record at its own index, kept in place. */
const kept = (viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
  ({ in: STATE_INDEX, out: STATE_INDEX, viewIn, viewOut });

interface Options {
  /** The trip count the frame's argument hands the loop, which is also the number of calls it makes. */
  readonly trips: number;
  /** How many call records the frame declares, defaulting to the calls the execution makes. */
  readonly declaredCalls?: number;
  /** One declaration per segment, overriding the chained default. */
  readonly segments?: readonly RecordEntry[][];
}

function build(options: Options): Omit<VmProgram, 'inputIndex'> {
  const declaredCalls = options.declaredCalls ?? options.trips;
  const fill = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
      category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
    });
  };
  const callerProgram = fill('Caller', CATEGORY_CALLER, ADDRESS_CALLER);
  const calleeProgram = fill('Callee', CATEGORY_CALLEE, ADDRESS_CALLEE);
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });

  // One segment per call plus the tail after the loop. Each turn reads the value the one before it left and writes
  // the next, and the tail reads what the last turn wrote.
  const chained = Array.from({ length: options.trips + 1 }, (_, segment) => [
    kept(commitment(BASE + BigInt(segment)), commitment(BASE + BigInt(segment) + 1n)),
  ]);
  const tail = [kept(commitment(BASE + BigInt(options.trips)), commitment(BASE + BigInt(options.trips)))];
  chained[options.trips] = tail;
  // A witness block declares one segment per call it declares, plus the tail.
  const segments = (options.segments ?? chained).slice(0, declaredCalls + 1);

  const callerBlock: WitnessBlock = {
    kind: FrameKind.ROOT,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: new Uint8Array(0),
    calls: Array.from({ length: declaredCalls }, () => ({
      kind: FrameKind.CALL,
      target: ADDRESS_CALLEE,
      value: 0n,
      calleeRef: CALLEE_INDEX,
      argsHash: sha256(CALLEE_SELECTOR),
      result: new Uint8Array(0),
    })),
    segments,
    events: [],
    sends: [],
  };
  const calleeBlock: WitnessBlock = {
    kind: FrameKind.CALL,
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
  const sourceOutputs: VmProgram['sourceOutputs'] = [];
  const outputs: VmOutput[] = [];
  const inputs: VmInput[] = [];

  const callerOutput = {
    lockingBytecode: callerLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'minting'),
  };
  inputs[CALLER_INDEX] = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(callerBlock)),
      ...encodeDataPush(options.trips === 0 ? new Uint8Array(0) : new Uint8Array([options.trips])),
      ...encodeDataPush(callerProgram),
    ]),
  };
  outputs[CALLER_INDEX] = callerOutput;
  sourceOutputs[CALLER_INDEX] = callerOutput;

  // The record sits right after its master, which is where the body reads it from.
  const recordLock = dataRecordLock(CATEGORY_CALLER);
  const spent = {
    lockingBytecode: recordLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', commitment(BASE)),
  };
  const written = {
    lockingBytecode: recordLock,
    valueSatoshis: VALUE,
    token: token(CATEGORY_CALLER, 'mutable', commitment(BASE + BigInt(options.trips))),
  };
  inputs[STATE_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  outputs[STATE_INDEX] = written;
  sourceOutputs[STATE_INDEX] = spent;

  const validatorOutput = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };
  inputs[VALIDATOR_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(3), sequenceNumber: 0xffffffff,
    unlockingBytecode: validator.unlockingBytecode,
  };
  outputs[VALIDATOR_INDEX] = validatorOutput;
  sourceOutputs[VALIDATOR_INDEX] = validatorOutput;

  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  inputs[USER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  outputs[USER_INDEX] = userOutput;
  sourceOutputs[USER_INDEX] = userOutput;

  const calleeOutput = {
    lockingBytecode: calleeLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting'),
  };
  inputs[CALLEE_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(5), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
      ...encodeDataPush(CALLEE_SELECTOR),
      ...encodeDataPush(calleeProgram),
    ]),
  };
  outputs[CALLEE_INDEX] = calleeOutput;
  sourceOutputs[CALLEE_INDEX] = calleeOutput;

  return { sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 } };
}

/** The caller input's verdict in the BCH-2026 machine, with the objection for a diagnosis. */
function verdict(options: Options): { accepted: boolean; objection?: string; ip?: number } {
  const program = build(options);
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: CALLER_INDEX, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
  });
  const ip = (state as unknown as { ip?: number }).ip;
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error), ip };
}

describe('a compiled master whose calls repeat reads its own record', () => {
  it('publishes the loop call as a repeated site and refuses no entry', () => {
    const composition = callerArtifact.composition!;
    const entry = composition.stopSites!.entries[0]!;
    expect(entry.functionName).toBe('Caller.go()');
    expect(entry.sites.sites.filter((site) => site.kind === 'call' && site.repeated === true)).toHaveLength(1);
    expect(composition.refusedEntries).toBeUndefined();
  });

  it('accepts one turn, over the declaration its own segment carries', () => {
    const outcome = verdict({ trips: 1 });
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('accepts two turns, reading each turn against the segment it runs in', () => {
    const outcome = verdict({ trips: 2 });
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('accepts three turns, so the walk follows the number of calls rather than one segment', () => {
    const outcome = verdict({ trips: 3 });
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('accepts a turn count of zero, where only the tail segment reads the record', () => {
    const outcome = verdict({ trips: 0 });
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('refuses a declaration that does not carry on from the segment before it', () => {
    // The second segment claims the record began where the first segment began, so the chain is broken even though
    // every segment declares the record.
    const shifted = [
      [kept(commitment(BASE), commitment(BASE + 1n))],
      [kept(commitment(BASE), commitment(BASE + 2n))],
      [kept(commitment(BASE + 2n), commitment(BASE + 2n))],
    ];
    expect(verdict({ trips: 2, segments: shifted }).accepted).toBe(false);
    expect(verdict({ trips: 2 }).accepted).toBe(true);
  });

  it('refuses a tail that declares fewer records than the execution makes', () => {
    expect(verdict({ trips: 2, declaredCalls: 1 }).accepted).toBe(false);
    expect(verdict({ trips: 2 }).accepted).toBe(true);
  });

  it('refuses a first declaration that is not the commitment the transaction spends', () => {
    const wrongStart = [
      [kept(commitment(BASE + 1n), commitment(BASE + 1n))],
      [kept(commitment(BASE + 1n), commitment(BASE + 2n))],
      [kept(commitment(BASE + 2n), commitment(BASE + 2n))],
    ];
    expect(verdict({ trips: 2, segments: wrongStart }).accepted).toBe(false);
  });
});
