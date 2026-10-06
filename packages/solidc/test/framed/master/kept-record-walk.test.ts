import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import { encodeWitnessBlock, type RecordEntry, type WitnessBlock } from '@solidcash/utils';
import {
  declaredRecordFirstViewByNameScript, declaredRecordViewScript, declaredRecordsKeptScript,
} from '../../../src/per-call/master/declared-view.js';
import { compositionMachine } from '../machine.js';

/**
 * The declared-record walks over a block whose calls the run makes, driven on their own.
 *
 * A body whose source names calls the execution may skip reads its own block by the counts the block declares, so a
 * block holding one record per call the run made and one segment per call plus the tail is the shape the walks must
 * accept. Each walk leaves the block where it found it and is judged by the machine alone: a walk that resolves
 * every coordinate it is handed reaches the end of the script, and one that does not fails its own verify.
 */

const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** A 35-byte lock the walks can tell apart; any address serves. */
const SELF = new Uint8Array(35).fill(0x33);
const MASTER_INDEX = 0;
const USER_INDEX = 1;
const RECORD_INDEX = 3;
const VIEW = new Uint8Array(37).fill(0xa1);

/** A kept record: the transaction recreates it at the index that already holds it. */
function kept(index: number, viewIn: Uint8Array): RecordEntry {
  return { in: index, out: index, viewIn, viewOut: viewIn };
}

/** A push of a small VM number; zero is the empty push, and a negative names a created record. */
function numberPush(value: number): Uint8Array {
  if (value === 0) return new Uint8Array(0);
  const negative = value < 0;
  let rest = Math.abs(value);
  const bytes: number[] = [];
  while (rest > 0) {
    bytes.push(rest & 0xff);
    rest = Math.floor(rest / 256);
  }
  const top = bytes.length - 1;
  if ((bytes[top]! & 0x80) !== 0) bytes.push(negative ? 0x80 : 0x00);
  else if (negative) bytes[top] = bytes[top]! | 0x80;
  return new Uint8Array(bytes);
}

/** A block whose call count and segment count agree, so the encoder accepts it. */
function blockOf(callCount: number, segments: readonly (readonly RecordEntry[])[]): WitnessBlock {
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

/** Runs one walk over `block` with `entry` beneath it, and reports whether the walk reached its end. */
function run(block: WitnessBlock, walk: Uint8Array, entry: readonly Uint8Array[], trailing = true): {
  accepted: boolean; objection?: string;
} {
  const script = new Uint8Array([
    ...entry.flatMap((item) => [...encodeDataPush(item)]),
    ...walk,
    ...(trailing ? [0x77] : []), // OP_NIP: drop the unlocking bytecode's own copy of the block
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
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('the declared-record walks over a run whose calls the block fixes', () => {
  /** The shape a two-call run declares: two call records, three segments, each holding the frame's record kept. */
  const TWO_CALLS = blockOf(2, [
    [kept(RECORD_INDEX, VIEW)],
    [kept(RECORD_INDEX, VIEW)],
    [kept(RECORD_INDEX, VIEW)],
  ]);

  it('resolves a kept record\'s declared view in every segment the run reaches', () => {
    const walk = declaredRecordViewScript({ side: 'in', runtimeCounts: true });
    const verdicts = [0, 1, 2].map((segmentIndex) => run(
      TWO_CALLS, walk, [numberPush(segmentIndex), numberPush(RECORD_INDEX)],
    ));
    expect(verdicts).toStrictEqual([{ accepted: true }, { accepted: true }, { accepted: true }]);
  });

  it('resolves the same record\'s view from the output side', () => {
    const walk = declaredRecordViewScript({ side: 'out', runtimeCounts: true });
    expect(run(TWO_CALLS, walk, [numberPush(0), numberPush(RECORD_INDEX)])).toStrictEqual({ accepted: true });
  });

  it('resolves a record\'s first declared view by name, both for a kept index and for a created output', () => {
    const walk = declaredRecordFirstViewByNameScript({ runtimeCounts: true });
    expect(run(TWO_CALLS, walk, [numberPush(0), numberPush(RECORD_INDEX)])).toStrictEqual({ accepted: true });
    // A created record names its output alone, as `-(out + 1)`; this block declares none that way.
    expect(run(TWO_CALLS, walk, [numberPush(0), numberPush(-4)]).accepted).toBe(false);
  });

  it('requires every record the running segment declares kept, with the frame\'s own pair exempt', () => {
    const walk = declaredRecordsKeptScript({ runtimeCounts: true, exempt: 1 });
    const verdicts = [0, 1].map((segmentIndex) => run(
      TWO_CALLS, walk, [numberPush(RECORD_INDEX), numberPush(RECORD_INDEX), numberPush(segmentIndex)], false,
    ));
    expect(verdicts).toStrictEqual([{ accepted: true }, { accepted: true }]);
  });

  it('refuses a record the running segment declares created when the code exempts another', () => {
    const created = blockOf(2, [
      [kept(RECORD_INDEX, VIEW), { in: 0xffff, out: 10, viewIn: new Uint8Array(0), viewOut: VIEW }],
      [kept(RECORD_INDEX, VIEW)],
      [kept(RECORD_INDEX, VIEW)],
    ]);
    const walk = declaredRecordsKeptScript({ runtimeCounts: true, exempt: 1 });
    expect(run(created, walk, [numberPush(RECORD_INDEX), numberPush(RECORD_INDEX), numberPush(0)], false).accepted)
      .toBe(false);
  });
});
