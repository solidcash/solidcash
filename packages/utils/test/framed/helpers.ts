import { expect } from 'vitest';
import {
  FramedEncodingError,
  bytesToHex,
  hexToBytes,
} from '../../src/framed/primitives.js';
import type { CallRecord, WitnessBlock } from '../../src/framed/witness-block.js';
import type { RecordEntry } from '../../src/framed/frames.js';
import type { BlockVector, CallVector, RecordEntryVector } from './vectors/witness-block.js';

/** Parses one of the vectors' hex strings. */
export const toBytes = (hex: string): Uint8Array => hexToBytes(hex);

/** Renders bytes back to the vectors' form. */
export const toHex = (bytes: Uint8Array): string => bytesToHex(bytes);

const toCallRecord = (call: CallVector): CallRecord => ({
  kind: call.kind,
  target: hexToBytes(call.target),
  value: BigInt(call.value),
  calleeRef: call.calleeRef,
  argsHash: hexToBytes(call.argsHash),
  result: hexToBytes(call.result),
});

const toRecordEntry = (entry: RecordEntryVector): RecordEntry => ({
  in: entry.in,
  out: entry.out,
  viewIn: hexToBytes(entry.viewIn),
  viewOut: hexToBytes(entry.viewOut),
});

/** Builds the in-memory witness block the vector's fields describe. */
export const toWitnessBlock = (vector: BlockVector): WitnessBlock => ({
  kind: vector.kind,
  callerRef: vector.callerRef,
  originRef: vector.originRef,
  validatorRef: vector.validatorRef,
  sender: hexToBytes(vector.sender),
  self: hexToBytes(vector.self),
  value: BigInt(vector.value),
  retval: hexToBytes(vector.retval),
  calls: vector.calls.map(toCallRecord),
  segments: vector.segments.map((segment) => segment.map(toRecordEntry)),
  events: [...vector.events],
  sends: [...vector.sends],
});

/** Runs `run` and asserts it is rejected as malformed, optionally matching the message. */
export const expectFramedRejection = (run: () => unknown, messagePattern?: RegExp): void => {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught, 'expected the call to be rejected').toBeInstanceOf(FramedEncodingError);
  if (messagePattern !== undefined) {
    expect((caught as Error).message).toMatch(messagePattern);
  }
};
