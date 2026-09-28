import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import { encodeWitnessBlock, type RecordEntry, type WitnessBlock } from '@solidcash/utils';
import { declaredRecordOrdinalViewScript, declaredRecordViewScript } from '../../../src/per-call/master/declared-view.js';
import { compositionMachine } from '../machine.js';

/**
 * The walk a body uses to read its own segment's declared record view, driven on its own.
 *
 * Entry `[coordinate]`, exit `[view]`. The block is carried the way a master carries it — the first push of the
 * unlocking bytecode — and the script reads it back from there, so the test builds a real transaction and lets the
 * machine decide.
 */

const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** A 35-byte lock the census can tell apart; any address serves. */
const SELF = new Uint8Array(35).fill(0x33);
const MASTER_INDEX = 0;
const RECORD_INDEX = 3;
const USER_INDEX = 1;

const bytes = (fill: number, length = 40): Uint8Array => new Uint8Array(length).fill(fill);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];

function kept(index: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry {
  return { in: index, out: index, viewIn, viewOut };
}

/**
 * Runs one read: the program pushes `coordinate`, walks the block, and succeeds only when the view it leaves is
 * `expected`.
 */
function read(options: {
  readonly coordinate: number;
  readonly expected: Uint8Array;
  readonly segmentIndex: number;
  readonly callCount: number;
  readonly segments: readonly (readonly RecordEntry[])[];
  readonly side?: 'in' | 'out';
}): { accepted: boolean; objection?: string } {
  const block: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: SELF,
    value: 0n,
    retval: new Uint8Array(0),
    calls: Array.from({ length: Math.max(0, options.segments.length - 1) }, () => ({
      kind: 1,
      target: SELF,
      value: 0n,
      calleeRef: USER_INDEX,
      argsHash: new Uint8Array(32),
      result: new Uint8Array(0),
    })),
    segments: options.segments.map((segment) => [...segment]),
    events: [],
    sends: [],
  };
  const script = new Uint8Array([
    ...encodeDataPush(new Uint8Array([options.coordinate])),
    ...declaredRecordViewScript({
      segmentIndex: options.segmentIndex,
      callCount: options.callCount,
      side: options.side ?? 'in',
    }),
    // The inherited copy of the block goes, then the view is compared with what the test expects.
    0x77, // OP_NIP: drop the unlocking bytecode's own copy of the block
    ...encodeDataPush(options.expected),
    0x87, // OP_EQUAL
  ]);
  const lock = encodeLockingBytecodeP2sh32(hash256(script));
  const masterSource = { lockingBytecode: lock, valueSatoshis: 20_000n };
  const userSource = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(1),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeDataPush(script),
        ]),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(2),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
    ],
    outputs: [masterSource, userSource],
    locktime: 0,
  };
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: MASTER_INDEX,
    sourceOutputs: [masterSource, userSource],
    transaction,
  });
  if (vm.stateSuccess(state) !== true) console.error('objection:', String(state.error));
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

/**
 * Runs one ordinal read: the program pushes `ordinal`, walks the block by position, and succeeds only when the view
 * it leaves is `expected`.
 */
function readOrdinal(options: {
  readonly ordinal: number;
  readonly expected: Uint8Array;
  readonly segmentIndex: number;
  readonly callCount: number;
  readonly segments: readonly (readonly RecordEntry[])[];
  readonly side?: 'in' | 'out';
}): { accepted: boolean; objection?: string } {
  const block: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: SELF,
    value: 0n,
    retval: new Uint8Array(0),
    calls: Array.from({ length: Math.max(0, options.segments.length - 1) }, () => ({
      kind: 1,
      target: SELF,
      value: 0n,
      calleeRef: USER_INDEX,
      argsHash: new Uint8Array(32),
      result: new Uint8Array(0),
    })),
    segments: options.segments.map((segment) => [...segment]),
    events: [],
    sends: [],
  };
  const script = new Uint8Array([
    ...encodeDataPush(options.ordinal === 0 ? new Uint8Array(0) : new Uint8Array([options.ordinal])),
    ...declaredRecordOrdinalViewScript({
      segmentIndex: options.segmentIndex,
      callCount: options.callCount,
      side: options.side ?? 'in',
    }),
    0x77, // OP_NIP: drop the unlocking bytecode's own copy of the block
    ...encodeDataPush(options.expected),
    0x87, // OP_EQUAL
  ]);
  const lock = encodeLockingBytecodeP2sh32(hash256(script));
  const masterSource = { lockingBytecode: lock, valueSatoshis: 20_000n };
  const userSource = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(1),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeDataPush(script),
        ]),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(2),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
    ],
    outputs: [masterSource, userSource],
    locktime: 0,
  };
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: MASTER_INDEX,
    sourceOutputs: [masterSource, userSource],
    transaction,
  });
  if (vm.stateSuccess(state) !== true) console.error('ordinal objection:', String(state.error));
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('the walk a body uses to read its segment\'s declared record view', () => {
  const BEFORE = bytes(0x11, 4);
  const MIDDLE = bytes(0x22, 4);
  const AFTER = bytes(0x33, 4);
  const RECORD = (viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
    kept(RECORD_INDEX, viewIn, viewOut);

  it('returns the first segment\'s declared viewIn', () => {
    expect(read({
      coordinate: RECORD_INDEX, expected: BEFORE, segmentIndex: 0, callCount: 0,
      segments: [[RECORD(BEFORE, AFTER)]],
    }).accepted).toBe(true);
  });

  it('returns a later segment\'s viewIn, not the first segment\'s viewOut', () => {
    expect(read({
      coordinate: RECORD_INDEX, expected: MIDDLE, segmentIndex: 1, callCount: 1,
      segments: [[RECORD(BEFORE, MIDDLE)], [RECORD(MIDDLE, AFTER)]],
    }).accepted).toBe(true);
    expect(read({
      coordinate: RECORD_INDEX, expected: BEFORE, segmentIndex: 1, callCount: 1,
      segments: [[RECORD(BEFORE, MIDDLE)], [RECORD(MIDDLE, AFTER)]],
    }).accepted).toBe(false);
  });

  it('skips segments that declare no record', () => {
    expect(read({
      coordinate: RECORD_INDEX, expected: MIDDLE, segmentIndex: 2, callCount: 2,
      segments: [[RECORD(BEFORE, MIDDLE)], [], [RECORD(MIDDLE, AFTER)]],
    }).accepted).toBe(true);
  });

  it('finds a record that is not the first its segment declares', () => {
    const other = kept(RECORD_INDEX + 1, AFTER, BEFORE);
    expect(read({
      coordinate: RECORD_INDEX, expected: AFTER, segmentIndex: 1, callCount: 1,
      segments: [[RECORD(BEFORE, AFTER)], [other, RECORD(AFTER, MIDDLE)]],
    }).accepted).toBe(true);
  });

  it('returns the declared viewOut when the output side is read', () => {
    expect(read({
      coordinate: RECORD_INDEX, expected: AFTER, segmentIndex: 1, callCount: 1,
      side: 'out', segments: [[RECORD(BEFORE, MIDDLE)], [RECORD(MIDDLE, AFTER)]],
    }).accepted).toBe(true);
  });

  it('returns the view of the record at an ordinal', () => {
    const first = kept(RECORD_INDEX, BEFORE, MIDDLE);
    const second = kept(RECORD_INDEX + 1, MIDDLE, AFTER);
    expect(readOrdinal({
      ordinal: 0, expected: BEFORE, segmentIndex: 0, callCount: 0, segments: [[first, second]],
    }).accepted).toBe(true);
    expect(readOrdinal({
      ordinal: 1, expected: MIDDLE, segmentIndex: 0, callCount: 0, segments: [[first, second]],
    }).accepted).toBe(true);
    expect(readOrdinal({
      ordinal: 1, expected: AFTER, segmentIndex: 0, callCount: 0, segments: [[first, second]], side: 'out',
    }).accepted).toBe(true);
    expect(readOrdinal({
      ordinal: 2, expected: AFTER, segmentIndex: 0, callCount: 0, segments: [[first, second]],
    }).accepted).toBe(false);
    const big = bytes(0x55, 130);
    const bigFirst = kept(RECORD_INDEX, big, big);
    const bigSecond = kept(RECORD_INDEX + 1, big, big);
    expect(readOrdinal({
      ordinal: 1, expected: big, segmentIndex: 0, callCount: 0, segments: [[bigFirst, bigSecond]],
    }).accepted).toBe(true);
  });
});
