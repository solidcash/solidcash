import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import { encodeWitnessBlock, type RecordEntry, type WitnessBlock } from '@solidcash/utils';
import {
  declaredRecordOrdinalViewScript, declaredRecordViewScript,
} from '../../../src/per-call/master/declared-view.js';
import { compositionMachine } from '../machine.js';

/**
 * The run-time-count variant of the declared-view walk, driven on its own.
 *
 * Entry `[..., segmentIndex, coordinate]` (or `[..., segmentIndex, ordinal]`): the walk takes the segment index
 * from the stack and reads the block's own declared call count, so it resolves against whichever segment the
 * caller's run-time value names. The block is carried the way a master carries it — the first push of the input's
 * unlocking bytecode — and read back from there, so the test builds a real transaction and lets the machine decide.
 */

const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** A 35-byte lock the walk can tell apart; any address serves. */
const SELF = new Uint8Array(35).fill(0x33);
const MASTER_INDEX = 0;
const USER_INDEX = 1;
const RECORD_INDEX = 3;

const bytes = (fill: number, length = 40): Uint8Array => new Uint8Array(length).fill(fill);

/** A kept record: the transaction recreates it at the index that already holds it. */
function kept(index: number, viewIn: Uint8Array): RecordEntry {
  return { in: index, out: index, viewIn, viewOut: bytes(0xee) };
}

/** A push of a small VM number; zero is the empty push so the block's fields compare equal. */
function numberPush(value: number): Uint8Array {
  return value === 0 ? new Uint8Array(0) : new Uint8Array([value]);
}

/** A block whose call count and segment count agree, so the encoder accepts it. */
function blockWith(callCount: number, segments: readonly (readonly RecordEntry[])[]): WitnessBlock {
  return {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: SELF,
    value: 0n,
    retval: new Uint8Array(0),
    calls: Array.from({ length: callCount }, () => ({
      kind: 1,
      target: SELF,
      value: 0n,
      calleeRef: USER_INDEX,
      argsHash: new Uint8Array(32),
      result: new Uint8Array(0),
    })),
    segments: segments.map((segment) => [...segment]),
    events: [],
    sends: [],
  };
}

/**
 * Runs one walk: the program pushes `entry`, runs `walk`, and succeeds only when the view it leaves equals
 * `expected`.
 */
function run(options: {
  readonly block: WitnessBlock;
  readonly walk: Uint8Array;
  readonly entry: readonly Uint8Array[];
  readonly expected: Uint8Array;
}): { accepted: boolean; objection?: string } {
  const script = new Uint8Array([
    ...options.entry.flatMap((item) => [...encodeDataPush(item)]),
    ...options.walk,
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
          ...encodeDataPush(encodeWitnessBlock(options.block)),
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
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('the declared-view walk over the running execution\'s own counts', () => {
  // Three segments, two call records; each segment declares a different view at the same coordinate.
  const VIEWS = [bytes(0xa1), bytes(0xa2), bytes(0xa3)];
  const CALLS = 2;
  const SEGMENTS = VIEWS.map((view) => [kept(RECORD_INDEX, view)] as RecordEntry[]);

  it('resolves the view of the segment the run-time index names, by coordinate', () => {
    const block = blockWith(CALLS, SEGMENTS);
    const walk = declaredRecordViewScript({ side: 'in', runtimeCounts: true });
    const table = VIEWS.map((expected, segmentIndex) => ({ segmentIndex, expected }));
    for (const { segmentIndex, expected } of table) {
      expect(run({
        block, walk, entry: [numberPush(segmentIndex), numberPush(RECORD_INDEX)], expected,
      }).accepted).toBe(true);
    }
  });

  it('resolves the view of the segment the run-time index names, by ordinal', () => {
    const first = [bytes(0xb1), bytes(0xb2)];
    const second = [bytes(0xb3), bytes(0xb4)];
    const third = [bytes(0xb5), bytes(0xb6)];
    const segments = [first, second, third]
      .map((views) => [kept(RECORD_INDEX, views[0]!), kept(RECORD_INDEX + 1, views[1]!)] as RecordEntry[]);
    const block = blockWith(CALLS, segments);
    const walk = declaredRecordOrdinalViewScript({ side: 'in', runtimeCounts: true });
    const table = [first[1]!, second[1]!, third[1]!].map((expected, segmentIndex) => ({ segmentIndex, expected }));
    for (const { segmentIndex, expected } of table) {
      expect(run({
        block, walk, entry: [numberPush(segmentIndex), numberPush(1)], expected,
      }).accepted).toBe(true);
    }
  });

  it('refuses a run-time segment index past the declared segments', () => {
    const block = blockWith(CALLS, SEGMENTS);
    const walk = declaredRecordViewScript({ side: 'in', runtimeCounts: true });
    // Three segments exist at indices 0..2; index 3 names none.
    expect(run({
      block, walk, entry: [numberPush(3), numberPush(RECORD_INDEX)], expected: VIEWS[2]!,
    }).accepted).toBe(false);
  });

  it('refuses a coordinate no record in the named segment declares', () => {
    const block = blockWith(CALLS, SEGMENTS);
    const walk = declaredRecordViewScript({ side: 'in', runtimeCounts: true });
    expect(run({
      block, walk, entry: [numberPush(1), numberPush(9)], expected: VIEWS[1]!,
    }).accepted).toBe(false);
  });

  it('takes the segment index from the stack rather than a constant in the bytes', () => {
    const block = blockWith(CALLS, SEGMENTS);
    // One compiled walk, evaluated with two different run-time indices and one mismatch.
    const walk = declaredRecordViewScript({ side: 'in', runtimeCounts: true });
    expect(run({
      block, walk, entry: [numberPush(0), numberPush(RECORD_INDEX)], expected: VIEWS[0]!,
    }).accepted).toBe(true);
    expect(run({
      block, walk, entry: [numberPush(2), numberPush(RECORD_INDEX)], expected: VIEWS[2]!,
    }).accepted).toBe(true);
    expect(run({
      block, walk, entry: [numberPush(0), numberPush(RECORD_INDEX)], expected: VIEWS[2]!,
    }).accepted).toBe(false);
  });
});
