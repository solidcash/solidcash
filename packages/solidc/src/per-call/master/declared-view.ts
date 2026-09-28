/**
 * Reading a record's own declared view out of a master's witness block.
 *
 * A body's storage reads and writes run against the segment's `viewIn`/`viewOut` records, not against the
 * commitment the transaction happens to spend: between two segments of one execution another frame may have
 * rewritten the record, so the spent commitment is stale. The head walks every segment's declaration for the shape
 * checks but drops the view payloads; this builder walks the same block from the body and returns the declared view
 * of the record that sits at a given coordinate, in the segment the body is running in.
 *
 * Entry `[..., coordinate]`, exit `[..., view]`. `coordinate` is the record's absolute input index (the input side)
 * or output index (the output side), which is what a segment's `in`/`out` field names; the record is matched on that
 * field. A segment that declares no record at the coordinate fails the read rather than returning the spent
 * commitment, so a body can never silently read past its own frame's declaration.
 *
 * The walk is exact because the block's two counts are known where it runs: the body has already pinned the
 * declared call count to the number of calls its own source makes, and the head checked the declared segment count
 * to be that plus one, so the call records and the earlier segments are stepped over by their declared widths.
 * A segment the body has not reached yet is skipped wholesale, count first, so a segment that declares several
 * records is stepped over correctly too.
 */

import { encodeDataPush, Opcodes } from '@bitauth/libauth';
import {
  WITNESS_BLOCK_HEADER_LENGTH,
  dropPrefix,
  readOwnWitnessBlockScript,
  takeFixedWidthField,
  takeLengthPrefixedField,
  takeLengthPrefixedField32,
} from './witness-reader.js';

/** Which side of a record a read addresses. */
export type RecordSide = 'in' | 'out';

/**
 * How many call records and segments the walk steps over before the record it reads.
 *
 * The counts are either numbers the source fixes, which is what a body with a fixed number of calls has, or the
 * running execution's own. A body whose calls repeat runs in the segment its own number of calls names and declares
 * as many call records as it makes, so the walk takes the segment index from the stack beneath the record it reads
 * and the call count from the block as it walks it; its entry gains one item: `[..., segmentIndex, coordinate]`.
 */
export type DeclaredViewCounts =
  | {
    /** The segment the body is running in, as the number of its external calls already executed. */
    readonly segmentIndex: number;
    /** How many call records the block declares, which is the body's own number of calls. */
    readonly callCount: number;
    readonly runtimeCounts?: false;
  }
  | { readonly runtimeCounts: true };

export type DeclaredViewOptions = DeclaredViewCounts & {
  /** Which index field selects the record, and therefore which view is returned. */
  readonly side: RecordSide;
};

/** Options for a read that selects its record by position in the segment rather than by index. */
export type DeclaredRecordOrdinalOptions = DeclaredViewCounts & {
  /** Which view the selected record's read returns. */
  readonly side: RecordSide;
};

/**
 * Builds the script that leaves the view of the record at a given ordinal in the running segment.
 *
 * Entry `[..., ordinal]`, exit `[..., view]`. A segment's records are an ordered list, and a frame that names a run
 * declares the run's records at fixed positions in it, so an ordinal selects a record without the body having to
 * know the index the composer gave it. That is what lets a created chunk sit wherever the trailing region puts it,
 * beside event outputs, rather than at a band offset the layout cannot always place it at. An ordinal past the
 * segment's declared count fails the read rather than selecting a record the frame did not declare.
 */
export function declaredRecordOrdinalViewScript(options: DeclaredRecordOrdinalOptions): Uint8Array {
  return buildOrdinalWalk(options, ({ op, skipField, takeView }) => {
    // The target record leads. Read its view for this side and leave only that view.
    skipField(takeFixedWidthField(2)); // in
    skipField(takeFixedWidthField(2)); // out
    if (options.side === 'in') {
      takeView(takeLengthPrefixedField32()); // viewIn, dropping the record's remaining fields
    } else {
      skipField(takeLengthPrefixedField32()); // viewIn
      takeView(takeLengthPrefixedField32()); // viewOut
    }
    op(Opcodes.OP_TOALTSTACK); // park the view while the walk's own items go
    op(Opcodes.OP_2DROP); // count, ordinal
    op(Opcodes.OP_FROMALTSTACK);
    // A record with no view on this side reads as empty, which fails rather than resolving to a spent commitment.
    op(Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP, Opcodes.OP_0, Opcodes.OP_GREATERTHAN, Opcodes.OP_VERIFY);
  });
}

/**
 * Builds the script that leaves the declared index of the record at a given ordinal in the running segment.
 *
 * Entry `[..., ordinal]`, exit `[..., index]`, where `index` is the record's `in` field for the input side and its
 * `out` field for the output side. A body uses it to check the transaction's own input or output at the coordinate
 * the record declares, which is where a created record's output actually sits rather than at the band the body
 * reads it from.
 */
export function declaredRecordOrdinalIndexScript(options: DeclaredRecordOrdinalOptions): Uint8Array {
  return buildOrdinalWalk(options, ({ op, raw, skipField }) => {
    if (options.side === 'out') skipField(takeFixedWidthField(2)); // the `in` field leads the record
    raw(takeFixedWidthField(2)); // the index this side names
    op(Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP); // [count, ordinal, index, rest]
    op(Opcodes.OP_DROP); // [count, ordinal, index]
    op(Opcodes.OP_TOALTSTACK); // park the index while the walk's own items go
    op(Opcodes.OP_2DROP); // count, ordinal
    op(Opcodes.OP_FROMALTSTACK);
  });
}

interface OrdinalWalkEmitters {
  readonly op: (...opcodes: number[]) => void;
  readonly raw: (script: Uint8Array) => void;
  readonly skipField: (field: Uint8Array) => void;
  readonly takeView: (field: Uint8Array) => void;
}

/**
 * Emits the walk that carries the ordinal on top to the segment it names, skips the records before the ordinal, and
 * leaves `[count, ordinal, records]` with the target record leading; the tail then takes the field this read names.
 */
function buildOrdinalWalk(
  options: DeclaredRecordOrdinalOptions,
  tail: (emit: OrdinalWalkEmitters) => void,
): Uint8Array {
  const bytes: number[] = [];
  const op = (...opcodes: number[]): void => { bytes.push(...opcodes); };
  const raw = (script: Uint8Array): void => { bytes.push(...script); };
  const num = (value: number): void => { bytes.push(...encodeDataPush(minimalNumber(value))); };
  const skipField = (field: Uint8Array): void => { raw(field); op(Opcodes.OP_NIP); };
  const takeView = (field: Uint8Array): void => { raw(field); op(Opcodes.OP_SWAP, Opcodes.OP_NIP); };

  // The ordinal is parked for the walk and used once the target segment's record list is on top; a walk over the
  // running execution's own counts parks the segment index beside it, because the block's call count is read as the
  // walk reaches it.
  op(Opcodes.OP_TOALTSTACK);
  if (options.runtimeCounts === true) op(Opcodes.OP_TOALTSTACK);
  raw(readOwnWitnessBlockScript());
  raw(dropPrefix(WITNESS_BLOCK_HEADER_LENGTH));
  skipField(takeLengthPrefixedField()); // sender
  skipField(takeLengthPrefixedField()); // self
  skipField(takeFixedWidthField(8)); // value
  skipField(takeLengthPrefixedField32()); // retval
  stepDeclaredCallRecords(bytes, options, op, raw, num); // declared call count, then its records
  skipField(takeFixedWidthField(2)); // declared segment count
  stepDeclaredSegments(options, op, raw, num);

  // The target segment's record list. `[records, count]` with the records on top, then the ordinal below the count.
  raw(takeFixedWidthField(2)); // [countBytes, records]
  op(Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP); // [count, records]
  op(Opcodes.OP_FROMALTSTACK, Opcodes.OP_SWAP); // [count, ordinal, records]

  // Require the ordinal to name a declared record.
  num(1); op(Opcodes.OP_PICK); // ordinal
  num(3); op(Opcodes.OP_PICK); // count
  op(Opcodes.OP_LESSTHAN, Opcodes.OP_VERIFY); // ordinal < count

  // Skip `ordinal` records; a zero ordinal must not run the skip body once, so the loop is guarded.
  num(1); op(Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL);
  op(Opcodes.OP_IF);
  op(Opcodes.OP_ELSE);
  op(Opcodes.OP_BEGIN);
  skipField(takeFixedWidthField(2)); // in
  skipField(takeFixedWidthField(2)); // out
  skipField(takeLengthPrefixedField32()); // viewIn
  skipField(takeLengthPrefixedField32()); // viewOut
  op(Opcodes.OP_SWAP, Opcodes.OP_1SUB, Opcodes.OP_SWAP); // ordinal -= 1
  num(1); op(Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL); // repeat until it reaches zero
  op(Opcodes.OP_UNTIL);
  op(Opcodes.OP_ENDIF);

  tail({ op, raw, skipField, takeView });
  return new Uint8Array(bytes);
}

/**
 * Builds the script that leaves the declared view of the record at the coordinate on top of the stack.
 *
 * Entry `[..., coordinate]`, exit `[..., view]`. A record is:
 *
 *     in:u16 out:u16 viewIn:u32-len viewOut:u32-len
 *
 * A record the segment declares more than once, a predecessor several inserts share, is read at its first
 * declaration on the input side, its view when the segment began, and at its last on the output side.
 *
 * The walk leaves the alt stack as it found it, so a body that already parked values there is unaffected.
 */
export function declaredRecordViewScript(options: DeclaredViewOptions): Uint8Array {
  const bytes: number[] = [];
  const op = (...opcodes: number[]): void => { bytes.push(...opcodes); };
  const raw = (script: Uint8Array): void => { bytes.push(...script); };
  const num = (value: number): void => { bytes.push(...encodeDataPush(minimalNumber(value))); };
  const skipField = (field: Uint8Array): void => { raw(field); op(Opcodes.OP_NIP); };

  // The coordinate is parked for the walk and recovered once the record is found; a walk over the running
  // execution's own counts parks the segment index beside it, because the block's call count is read as the walk
  // reaches it.
  op(Opcodes.OP_TOALTSTACK);
  if (options.runtimeCounts === true) op(Opcodes.OP_TOALTSTACK);
  raw(readOwnWitnessBlockScript());
  raw(dropPrefix(WITNESS_BLOCK_HEADER_LENGTH));
  skipField(takeLengthPrefixedField()); // sender
  skipField(takeLengthPrefixedField()); // self
  skipField(takeFixedWidthField(8)); // value
  skipField(takeLengthPrefixedField32()); // retval
  stepDeclaredCallRecords(bytes, options, op, raw, num); // declared call count, then its records
  skipField(takeFixedWidthField(2)); // declared segment count
  stepDeclaredSegments(options, op, raw, num);

  // The target segment's record list. The result starts empty and is replaced by the matching record's view; a
  // segment that declares no record at the coordinate therefore ends the walk with an empty result and fails.
  raw(takeFixedWidthField(2)); // [rest, count]
  op(Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP); // [rest, count]
  op(Opcodes.OP_0); // result
  num(2); op(Opcodes.OP_ROLL);
  num(2); op(Opcodes.OP_ROLL);
  op(Opcodes.OP_0); // cursor
  op(Opcodes.OP_SWAP); // [rest, cursor, count, result]

  // `OP_BEGIN` runs its body once before testing, so a segment that declares no record is guarded rather than
  // entered; the guard's arm leaves the same stack.
  num(2); op(Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL);
  op(Opcodes.OP_IF);
  op(Opcodes.OP_ELSE);
  op(Opcodes.OP_BEGIN);
  {
    // Read the field that selects the record, and compare it with the parked coordinate.
    if (options.side === 'out') skipField(takeFixedWidthField(2)); // the `in` field leads the record
    raw(takeFixedWidthField(2));
    op(Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM);
    raw(new Uint8Array([Opcodes.OP_FROMALTSTACK, Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK]));
    op(Opcodes.OP_EQUAL);
    op(Opcodes.OP_TOALTSTACK); // park the match while the view is read

    // Advance to the view this side names, consuming the record's remaining fields.
    if (options.side === 'in') {
      skipField(takeFixedWidthField(2)); // out
      raw(takeLengthPrefixedField32()); // viewIn
      op(Opcodes.OP_SWAP);
      op(Opcodes.OP_SWAP);
      skipField(takeLengthPrefixedField32()); // viewOut
      op(Opcodes.OP_SWAP);
    } else {
      skipField(takeLengthPrefixedField32()); // viewIn
      raw(takeLengthPrefixedField32()); // viewOut
      op(Opcodes.OP_SWAP);
    }

    // newResult = match ? view : result. `result` is on top: the match arm drops it, the other drops the view.
    // The input side keeps the first match: a later one only counts while the result is still empty.
    num(4); op(Opcodes.OP_ROLL);
    raw(new Uint8Array([Opcodes.OP_FROMALTSTACK]));
    if (options.side === 'in') op(Opcodes.OP_OVER, Opcodes.OP_SIZE, Opcodes.OP_NIP, Opcodes.OP_NOT, Opcodes.OP_BOOLAND);
    op(Opcodes.OP_IF);
    op(Opcodes.OP_DROP);
    op(Opcodes.OP_ELSE);
    op(Opcodes.OP_NIP);
    op(Opcodes.OP_ENDIF);
    num(3); op(Opcodes.OP_ROLL);
    num(3); op(Opcodes.OP_ROLL);
    num(3); op(Opcodes.OP_ROLL); // [rest, cursor, count, newResult]

    // cursor += 1, then repeat until the cursor reaches the count.
    op(Opcodes.OP_SWAP, Opcodes.OP_1ADD, Opcodes.OP_SWAP);
    num(1); op(Opcodes.OP_PICK);
    num(3); op(Opcodes.OP_PICK);
    op(Opcodes.OP_GREATERTHANOREQUAL);
  }
  op(Opcodes.OP_UNTIL);
  op(Opcodes.OP_ENDIF);

  // The record list, the cursor, the count and the consumed block all go; the coordinate is recovered and dropped.
  op(Opcodes.OP_NIP, Opcodes.OP_NIP, Opcodes.OP_DROP);
  op(Opcodes.OP_FROMALTSTACK, Opcodes.OP_DROP);
  // A read that matched no declared record fails here rather than resolving to the spent commitment.
  op(Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP, Opcodes.OP_0, Opcodes.OP_GREATERTHAN, Opcodes.OP_VERIFY);
  return new Uint8Array(bytes);
}

/**
 * Consumes the block's declared call-count field and steps that many call records off the item on top.
 *
 * A count the source fixes is the number the body's own calls make, so the records are unrolled and the field is
 * dropped with them. A body whose calls repeat declares as many records as it makes, which no compile-time number
 * names: the field's own value is the loop's bound, and the counter is dropped where the loop ends.
 */
function stepDeclaredCallRecords(
  bytes: number[],
  options: DeclaredViewCounts,
  op: (...opcodes: number[]) => void,
  raw: (script: Uint8Array) => void,
  num: (value: number) => void,
): void {
  raw(takeFixedWidthField(2));
  if (options.runtimeCounts !== true) {
    op(Opcodes.OP_NIP);
    for (let call = 0; call < options.callCount; call += 1) skipCallRecord(bytes);
    return;
  }
  op(Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP); // [count, rest]
  num(1); op(Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL);
  op(Opcodes.OP_IF);
  op(Opcodes.OP_ELSE);
  op(Opcodes.OP_BEGIN);
  skipCallRecord(bytes);
  op(Opcodes.OP_SWAP, Opcodes.OP_1SUB, Opcodes.OP_SWAP);
  num(1); op(Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL);
  op(Opcodes.OP_UNTIL);
  op(Opcodes.OP_ENDIF);
  op(Opcodes.OP_NIP); // the counter
}

/**
 * Steps the segments declared before the one the read resolves against off the item on top.
 *
 * A segment the source fixed is skipped outright. A body whose calls repeat runs in a segment only its execution
 * names, so the index was parked by the walk's prologue and the same skip runs that many times; the index is
 * consumed here so the record scan below finds the record it selects on top.
 */
function stepDeclaredSegments(
  options: DeclaredViewCounts,
  op: (...opcodes: number[]) => void,
  raw: (script: Uint8Array) => void,
  num: (value: number) => void,
): void {
  if (options.runtimeCounts !== true) {
    for (let segment = 0; segment < options.segmentIndex; segment += 1) skipSegment(op, raw, num);
    return;
  }
  op(Opcodes.OP_FROMALTSTACK, Opcodes.OP_SWAP); // [segmentIndex, rest]
  num(1); op(Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL);
  op(Opcodes.OP_IF);
  op(Opcodes.OP_ELSE);
  op(Opcodes.OP_BEGIN);
  skipSegment(op, raw, num);
  op(Opcodes.OP_SWAP, Opcodes.OP_1SUB, Opcodes.OP_SWAP);
  num(1); op(Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL);
  op(Opcodes.OP_UNTIL);
  op(Opcodes.OP_ENDIF);
  op(Opcodes.OP_NIP); // the segment index
}

/** Steps one call record off the block on top, by the widths the codec writes it with. */
function skipCallRecord(bytes: number[]): void {
  const emit = (field: Uint8Array): void => { bytes.push(...field, Opcodes.OP_NIP); };
  emit(takeFixedWidthField(1)); // kind
  emit(takeLengthPrefixedField()); // target
  emit(takeFixedWidthField(8)); // value
  emit(takeFixedWidthField(2)); // callee reference
  emit(takeFixedWidthField(32)); // argument digest
  emit(takeLengthPrefixedField32()); // result
}

/** Steps one whole segment off the block on top: its declared count, then each of its records. */
function skipSegment(
  op: (...opcodes: number[]) => void,
  raw: (script: Uint8Array) => void,
  num: (value: number) => void,
): void {
  const skipRecord = (): void => {
    const emit = (field: Uint8Array): void => { raw(field); op(Opcodes.OP_NIP); };
    emit(takeFixedWidthField(2)); // in
    emit(takeFixedWidthField(2)); // out
    emit(takeLengthPrefixedField32()); // viewIn
    emit(takeLengthPrefixedField32()); // viewOut
  };
  raw(takeFixedWidthField(2));
  op(Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP);
  op(Opcodes.OP_0, Opcodes.OP_SWAP); // [rest, cursor, count]
  // As in the target segment, a segment that declares no record must not run the skip body once.
  num(2); op(Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL);
  op(Opcodes.OP_IF);
  op(Opcodes.OP_ELSE);
  op(Opcodes.OP_BEGIN);
  skipRecord();
  op(Opcodes.OP_SWAP, Opcodes.OP_1ADD, Opcodes.OP_SWAP);
  num(1); op(Opcodes.OP_PICK);
  num(3); op(Opcodes.OP_PICK);
  op(Opcodes.OP_GREATERTHANOREQUAL);
  op(Opcodes.OP_UNTIL);
  op(Opcodes.OP_ENDIF);
  op(Opcodes.OP_NIP, Opcodes.OP_NIP);
}

/** A script number in its minimal push form; zero is the empty push. */
function minimalNumber(value: number): Uint8Array {
  if (value === 0) return new Uint8Array(0);
  const result: number[] = [];
  let rest = value;
  while (rest > 0) {
    result.push(rest & 0xff);
    rest = Math.floor(rest / 256);
  }
  if ((result[result.length - 1]! & 0x80) !== 0) result.push(0x00);
  return new Uint8Array(result);
}
