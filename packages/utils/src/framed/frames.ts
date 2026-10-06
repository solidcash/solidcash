/**
 * Frame and call kinds, and the record-entry convention.
 *
 * A frame is how an execution was entered. The same numbering labels a call record, because a call record states
 * the frame kind it produced in the callee. `ROOT` labels an execution a user entered; it is never a call kind.
 */

import { INDEX_NONE, PerCallEncodingError } from './primitives.js';

/** How an execution was entered: a user, a message call, a read-only call, a delegate or facet frame, or a deploy. */
export const FrameKind = {
  ROOT: 0,
  CALL: 1,
  STATIC: 2,
  DELEGATE: 3,
  INTERNAL: 4,
  CREATE: 5,
} as const;

export type FrameKindValue = (typeof FrameKind)[keyof typeof FrameKind];

const FRAME_KIND_NAMES: Record<number, string> = {
  0: 'ROOT',
  1: 'CALL',
  2: 'STATIC',
  3: 'DELEGATE',
  4: 'INTERNAL',
  5: 'CREATE',
};

/** A printable name for a frame kind, for diagnostics. */
export function frameKindName(kind: number): string {
  return FRAME_KIND_NAMES[kind] ?? `unknown(${kind})`;
}

/** Rejects a frame kind the wire format does not define. */
export function assertFrameKind(kind: number): FrameKindValue {
  if (!(kind in FRAME_KIND_NAMES)) {
    throw new PerCallEncodingError(`unknown frame kind: ${kind}`);
  }
  return kind as FrameKindValue;
}

/** Frames whose `address(this)` comes from the code constant rather than from the witness block. */
export function selfIsCodeConstant(kind: number): boolean {
  return kind === FrameKind.ROOT
    || kind === FrameKind.CALL
    || kind === FrameKind.STATIC
    || kind === FrameKind.CREATE;
}

/** Frames that run on the caller's records rather than on the callee's. */
export function runsOnCallerRecords(kind: number): boolean {
  return kind === FrameKind.DELEGATE || kind === FrameKind.INTERNAL;
}

/** Frames whose `msg.sender` is the caller's `self` rather than the caller's sender. */
export function senderIsCallerSelf(kind: number): boolean {
  return kind === FrameKind.CALL || kind === FrameKind.STATIC || kind === FrameKind.CREATE;
}

/** Frames that carry `msg.value` through unchanged from their caller. */
export function valuePassesThrough(kind: number): boolean {
  return kind === FrameKind.DELEGATE || kind === FrameKind.INTERNAL;
}

/**
 * One record entry inside a segment: where the record lives, and its commitment at the segment's start and end.
 *
 * An existing record that is kept has `in === out`, because the transaction recreates it at the same index. A
 * created record has `in === INDEX_NONE` and lives at a trailing output. A deleted record has `out === INDEX_NONE`
 * and only the record's last entry in the derived order may delete it.
 */
export interface RecordEntry {
  /** Input index holding the record, or `INDEX_NONE` when the record is created by this segment. */
  in: number;
  /** Output index recreating the record, or `INDEX_NONE` when this segment deletes it. */
  out: number;
  /** The record's whole commitment at the segment's start. */
  viewIn: Uint8Array;
  /** The record's whole commitment at the segment's end. */
  viewOut: Uint8Array;
}

/** A record entry is created when nothing holds it yet. */
export function isCreatedEntry(entry: RecordEntry): boolean {
  return entry.in === INDEX_NONE;
}

/** A record entry is deleted when nothing recreates it. */
export function isDeletedEntry(entry: RecordEntry): boolean {
  return entry.out === INDEX_NONE;
}

/** A record entry is kept in place when the same index holds it before and after. */
export function isKeptEntry(entry: RecordEntry): boolean {
  return entry.in !== INDEX_NONE && entry.in === entry.out;
}

/** Rejects an entry that is created and deleted at once, or that claims to move an index. */
export function assertRecordEntry(entry: RecordEntry): void {
  if (entry.in === INDEX_NONE && entry.out === INDEX_NONE) {
    throw new PerCallEncodingError('a record entry cannot be created and deleted by the same segment');
  }
  if (entry.in !== INDEX_NONE && entry.out !== INDEX_NONE && entry.in !== entry.out) {
    throw new PerCallEncodingError(`a record entry recreates at its own index: got in=${entry.in} out=${entry.out}`);
  }
}

/** Does this entry leave the record's commitment unchanged? */
export function entryLeavesCommitmentUnchanged(entry: RecordEntry): boolean {
  if (entry.viewIn.length !== entry.viewOut.length) return false;
  for (let index = 0; index < entry.viewIn.length; index += 1) {
    if (entry.viewIn[index] !== entry.viewOut[index]) return false;
  }
  return true;
}
