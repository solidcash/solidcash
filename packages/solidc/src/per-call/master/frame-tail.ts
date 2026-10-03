/**
 * Walking the variable-length tail of a witness block inside script, and the checks a frame makes about the
 * transaction around it.
 *
 * The tail of section 16's block follows the frame fields: `retval`, then a call per external call, then the
 * segment, event and send sections. A frame that makes no call only has to know that it made none. The reader in
 * `witness-reader.ts` takes fields off the front of the tail; these builders walk it.
 *
 * A master with call sites walks past each call record without reading it: the record is bound to its site where
 * the call is made, in the caller's own body (`call-site.ts`). The head keeps the count check and the sections
 * after the calls, so the call section is still consumed and its length still fixed; only the per-record checks
 * move to the site, where a repeated or conditional call would verify per execution.
 *
 * The arguments of a call are the pushes between its selector push and the redeem-script push that closes the
 * callee's unlocking bytecode. Both pushes are stripped, so the arguments are however many pushes the callee
 * carries — none for a call with no arguments.
 *
 * The sections after the calls are checked, not dropped. The segment count is the call count plus one; every
 * segment's records are walked and each entry's shape is checked, so a record is kept in place, created or
 * deleted and never moved. The event and send counts are the ones the entry fixes, and each listed output is
 * checked: an event output carries the contract's category with no capability, and a send output is whatever the
 * body that computed it pins there. The last check is that nothing follows the final field, which is what makes
 * the walk exact.
 *
 * The event walk leaves a fixed-size region parked on the alt stack: one slot per position up to `maxEventCount`,
 * holding the listed output index where the block lists one and the no-index sentinel past its declared count,
 * with the declared count itself above them. The head hands those to the body as tracked slots, so a body reads
 * the index of its own `emitIndex`-th listed event and pins the number of events it emitted against the count.
 *
 * The send walk parks one slot per send position the entry fixes, holding that send's output index or the no-index
 * sentinel where the execution made no send. The head hands those to the body too, so a body pins the lock and the
 * value it computed at the output the frame listed, or requires the sentinel for a send it did not make, rather
 * than the tail requiring a P2PKH shape from an output whose lock only the body's own code knows.
 *
 * The first segment's walk can park its declared record indices the same way, so a body reads the data-NFT block
 * where the frame's own block declared it rather than at a fixed offset from the input the frame runs on. The
 * parked pair is the base of that block, one below the first declared index — the same convention the direct
 * path's `OP_INPUTINDEX` and the layout's one-based offsets use.
 */

import { encodeDataPush, Opcodes } from '@bitauth/libauth';
import { TokenCapability, VALIDATOR_PIN_PUSH_LENGTH } from '@solidcash/utils';
import { ADDRESS_SLOT_LENGTH } from './placeholders.js';
import {
  WITNESS_BLOCK_HEADER_LENGTH,
  dropFirstPushScript,
  dropPrefix,
  readOwnWitnessBlockScript,
  splitFirstPushScript,
  takeFixedWidthField,
  takeLengthPrefixedField,
  takeLengthPrefixedField32,
  unsignedLength,
} from './witness-reader.js';

/** One external call a master makes, as the code records it. */
export interface MasterCallSite {
  /** The frame kind the callee runs, which the caller records in `calls[k].kind`. */
  readonly kind: number;
  /** The callee's four-byte dispatcher selector, the first push of its call data. */
  readonly selector: Uint8Array;
  /**
   * The address called, which `calls[k].target` must name.
   *
   * When the target is a compile-time address these are the bytes the site folds in. When it is a value the
   * caller's own code holds — a state read or a parameter/local — the site supplies it to the check on the stack
   * instead and this is empty.
   */
  readonly target: Uint8Array;
  /**
   * True when the target is a value the caller's own code computes, so the site's check compares the record
   * against the value on the stack rather than a folded constant.
   */
  readonly targetFromStack?: boolean;
  /**
   * True when the call passes value the caller's own code computes, which the record's `value` must carry; without
   * it the call passes none and the record carries zero.
   */
  readonly valueFromStack?: boolean;
  /**
   * The interface the call goes through, when the source names one. Kept for the published stop-site table, which
   * a driver uses to name the callee; the head's own checks never read it.
   */
  readonly interfaceName?: string;
  /** The method called, whose entry the callee runs. Kept for the published stop-site table. */
  readonly functionName?: string;
  /**
   * The call's arguments in parameter order.
   *
   * A compile-time value carries the bytes the source wrote, which the caller folds into the digest at compile
   * time. A run-time value is one only the running code holds, and the site turns it into the push the wire
   * carries; `numeric` says the value reaches the site as a VM number, whose minimal encoding is the canonical
   * one.
   */
  readonly arguments?: readonly SiteArgument[];
  /**
   * Position of this call in the execution, which is the record it binds.
   *
   * A call inside a branch is at the same position on either arm, so two descriptors can name one record, and the
   * position is what a driver must fill rather than the descriptor's place in this list.
   */
  readonly ordinal?: number;
  /** True when the source does not fix whether this call runs, so a given execution may reach no witness for it. */
  readonly conditional?: boolean;
  /**
   * True when this call's own source site sits inside a loop, so one execution reaches the site as often as the
   * loop turns rather than once. A body may hold fixed calls beside such a loop: only the loop's own sites are
   * marked, and the calls before it keep the fixed positions the head checks them at.
   */
  readonly repeats?: boolean;
  /**
   * True when the caller forwards its own received call data to the callee unchanged.
   *
   * A proxy's fallback is one such call: it hands its own `input` to the implementation, so neither the selector
   * nor the argument values are known to the caller's code at compile time — `selector` is empty and the site
   * binds the callee by hashing the bytes the caller received rather than by comparing a selector.
   */
  readonly forwarded?: boolean;
}

/** One argument of a call, as the caller's own code can account for it. */
export type SiteArgument =
  | { readonly kind: 'constant'; readonly bytes: Uint8Array }
  | { readonly kind: 'runtime'; readonly numeric: boolean };

/**
 * Steps over the call section the block declares, and requires the segment count to be its successor.
 *
 * Entry `[..., tail]`, exit `[...]`. The declared call count is left parked on the alt stack, so a caller can use
 * it and drop it; the count itself is never fixed: one head serves every body a master dispatches, and two bodies
 * may make different numbers of calls, so how many records the tail holds is what the block declares. A body that
 * runs pins that count to its own source, which is what holds a declaration to the execution that made it.
 */
export function callSectionWalkScript(): number[] {
  return [...callWalkScript(), ...segmentCountCheckScript()];
}

/**
 * The tail sections after the calls that a master's own code fixes.
 *
 * `segmentRecordCounts`, when present, is the record count every segment must declare, in segment order. It is
 * absent when the records a segment touches are decided by settlement rather than by the entry, and the walk then
 * consumes each segment's declared count. `maxEventCount` is the size of the event region the head parks: the
 * largest number of events any body the master runs emits. The block's own declared count is checked against it
 * and each body pins the count it emits, so bodies may emit different numbers. `sendCount` is the size of the send
 * region the head parks: the most sends any body the master runs lists. A body's sends take its first positions and
 * it requires the no-index sentinel past them, so bodies may list different numbers. A master with no call, event
 * or send carries none of them. `valueWitnessCount` is the number of
 * value slots the head parks: the most value-witness slots any body the master runs reads.
 */
export interface MasterTailShape {
  readonly segmentRecordCounts?: readonly number[];
  readonly maxEventCount: number;
  readonly sendCount: number;
  readonly valueWitnessCount?: number;
}

/** A tail carrying no events and no sends, with every segment declaring no record. */
export function zeroTailShape(callCount: number): MasterTailShape {
  return { segmentRecordCounts: new Array<number>(callCount + 1).fill(0), maxEventCount: 0, sendCount: 0 };
}

/** The `u16` sentinel a record entry uses for an input or output index it does not have. */
const INDEX_NONE_BYTES = new Uint8Array([0xff, 0xff]);

/** A 25-byte P2PKH locking bytecode: `OP_DUP OP_HASH160 <20> OP_EQUALVERIFY OP_CHECKSIG`. */
const P2PKH_PREFIX = new Uint8Array([0x76, 0xa9, 0x14]);
const P2PKH_SUFFIX = new Uint8Array([0x88, 0xac]);
const P2PKH_LENGTH = 25;

/**
 * Requires the item on top to be a 25-byte `OP_DUP OP_HASH160 <20> OP_EQUALVERIFY OP_CHECKSIG` lock, leaving it.
 *
 * A root frame's caller and its origin are user addresses, so the head checks both against this shape. A listed
 * value send is not: its recipient lock is a run-time value the body computes, which the body pins at the listed
 * output instead.
 */
export function assertP2pkhShapeScript(): Uint8Array {
  return new Uint8Array([
    // Length.
    Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP,
    ...encodeDataPush(scriptNumber(P2PKH_LENGTH)), Opcodes.OP_NUMEQUALVERIFY,
    // Prefix.
    Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(P2PKH_PREFIX.length)),
    Opcodes.OP_SPLIT, Opcodes.OP_DROP, ...encodeDataPush(P2PKH_PREFIX), Opcodes.OP_EQUALVERIFY,
    // Suffix.
    Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(P2PKH_LENGTH - P2PKH_SUFFIX.length)),
    Opcodes.OP_SPLIT, Opcodes.OP_NIP, ...encodeDataPush(P2PKH_SUFFIX), Opcodes.OP_EQUALVERIFY,
  ]);
}

/**
 * Consumes the tail of a witness block, requiring it to describe exactly the calls, segments, events and sends
 * the entry's code fixes.
 *
 * Entry `[..., tail]`, exit `[...]`. `retval` must be empty unless `returnsValue` says the entry returns one
 * value, in which case the recorded value is parked on the alt stack for the body to compare against what its
 * own code computed. The call count must equal `callCount` (a loop that varies it is not emitted), and each
 * record is walked past — the site that made the call binds it in the caller's own body. The segment count
 * must be the call count plus one, and every segment's records are walked. The block's declared event count must
 * be at most `maxEventCount`, that many listed outputs are checked and the region is padded with the no-index
 * sentinel to `maxEventCount` slots, and the send count must be at most the shape's, each listed output index
 * parked with the sentinel past the declared count. The value list may hold at most
 * `valueWitnessCount` values, parked last, one slot each. The remaining tail must be empty, so nothing follows the
 * last field.
 *
 * The block declares how many call records and segments it holds, and the walk reads those counts rather than
 * fixing them: one head serves every body the master dispatches, and two bodies may make different numbers of
 * calls. The declared call count is parked on the alt stack for the body that runs to pin to its own count, so a
 * block declaring a count no body has is refused by the body rather than by the walk. The segment count must be
 * the call count plus one, which the walk checks against the declared call count it just read.
 *
 * With `keepsRecordIndices` the first segment's declared record indices are parked on the alt stack, input index
 * first, beneath the event walk's own parkings; a segment that declares no record parks the no-index sentinel
 * under the same convention, so the pair is always there and always means the same thing. A parked `retval` is
 * deepest and a parked call count sits above it, below both, because `retval` is read after them.
 *
 * With `eventOwnerBelowTail` the caller leaves, directly below the tail, the index of the input whose UTXO carries
 * the category of the contract whose records the frame uses. The event walk then reads that index instead of the
 * executing input, so a frame that runs on another contract's records compares a listed event against the records'
 * owner rather than the code that executes. A frame that owns its records leaves its own input there, so the two
 * agree. The item is left in place: the walk only copies it, and the caller consumes it once the walk is done.
 */
export function verifyTailScript(
  tail: MasterTailShape,
  options: {
    readonly keepsRecordIndices?: boolean;
    readonly returnsValue?: boolean;
    readonly eventOwnerBelowTail?: boolean;
  } = {},
): Uint8Array {
  const keepsRecordIndices = options.keepsRecordIndices === true;
  const bytes: number[] = [];
  bytes.push(...takeLengthPrefixedField32(), Opcodes.OP_SWAP);
  if (options.returnsValue === true) {
    // The value the entry's own code computes is compared against this one, so the recorded bytes are kept
    // rather than required to be empty.
    bytes.push(Opcodes.OP_TOALTSTACK);
  } else {
    bytes.push(Opcodes.OP_0, Opcodes.OP_EQUALVERIFY);
  }
  bytes.push(...callWalkScript());
  bytes.push(...segmentCountCheckScript());
  bytes.push(...segmentLoopScript(keepsRecordIndices));
  bytes.push(...eventSection(tail.maxEventCount, options.eventOwnerBelowTail === true));
  bytes.push(...sendSection(tail.sendCount));
  bytes.push(...valueSection(tail.valueWitnessCount ?? 0));
  bytes.push(Opcodes.OP_0, Opcodes.OP_EQUALVERIFY);
  return new Uint8Array(bytes);
}

/**
 * Consumes the value list and parks one slot per value-witness slot, leaving the tail on top.
 *
 * The block may list at most `slots` values. Slot `k` is parked `k`-th, holding the `k`-th listed value or empty
 * past the list; a body that reads a long value at an empty slot fails its own hash check. The count is read
 * unsigned, as the validator reads it, so no count the validator refuses is accepted here.
 */
function valueSection(slots: number): number[] {
  const bytes: number[] = [...takeFixedWidthField(2), Opcodes.OP_SWAP, ...unsignedLength()];
  for (let slot = 0; slot < slots; slot += 1) {
    // `[..., rest, count]`.
    bytes.push(Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(slot)), Opcodes.OP_GREATERTHAN, Opcodes.OP_IF);
    bytes.push(Opcodes.OP_SWAP, ...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK, Opcodes.OP_SWAP);
    bytes.push(Opcodes.OP_ELSE, Opcodes.OP_0, Opcodes.OP_TOALTSTACK, Opcodes.OP_ENDIF);
  }
  bytes.push(...encodeDataPush(scriptNumber(slots)), Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_VERIFY);
  return bytes;
}

/** Consumes a `u16` count and requires it to equal `expected`, leaving the tail on top. */
function requireU16Equals(expected: number): number[] {
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
    ...encodeDataPush(scriptNumber(expected)), Opcodes.OP_NUMEQUALVERIFY,
  ];
}

/**
 * Consumes the call section, whose length the block declares, and parks the declared count for the body.
 *
 * Entry `[..., tail]`, exit `[...]`. The record's own checks belong to the site that made the call, so the walk
 * only steps over each record; the count is what the body pins, because the body is what knows how many calls its
 * own source makes. A count of zero consumes nothing.
 */
function callWalkScript(): number[] {
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP,
    // Park a copy for the body; the copy below the cursor is dropped with it once the walk is done.
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_PICK, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_0, Opcodes.OP_SWAP,
    ...countCallRecordsScript(),
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_DROP,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_DROP,
  ];
}

/** Consumes `count` call records from `[count, 0, tail]`, leaving `[count, count, tail]`. */
function countCallRecordsScript(): number[] {
  return [
    ...encodeDataPush(scriptNumber(2)), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_ELSE,
    Opcodes.OP_BEGIN,
    ...callRecordSkip(),
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_1ADD, Opcodes.OP_SWAP,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_PICK,
    ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK,
    Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_ENDIF,
  ];
}

/**
 * Steps over a run-time number of call records.
 *
 * Entry `[..., tail, count]`, exit `[..., tail']`. A site binds the record the execution has reached, and an
 * execution whose calls repeat — one inside a loop — reaches a position the source does not fix, so the number of
 * records before it is a value the running code holds rather than one the compiler knows. A count of zero consumes
 * nothing.
 */
export function skipCallRecordsScript(): number[] {
  return [
    Opcodes.OP_SWAP, Opcodes.OP_0, Opcodes.OP_SWAP,
    ...countCallRecordsScript(),
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_DROP,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_DROP,
  ];
}

/**
 * Requires the declared segment count to be the declared call count plus one, leaving the count parked.
 *
 * Entry `[..., tail]`, exit `[...]`. Each call closes a segment and the execution opens with one, so the block's
 * two counts are not independent; the call count stays on the alt stack for the segments loop and for the body.
 */
function segmentCountCheckScript(): number[] {
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ADD,
    Opcodes.OP_NUMEQUALVERIFY,
  ];
}

/**
 * Walks every segment the block declares, each with the record list it declares.
 *
 * Entry `[..., tail]`, exit `[...]`. Only the first segment parks the record base a body reads its state through,
 * so the loop branches on the cursor; every later segment only checks its records' shapes.
 */
function segmentLoopScript(keepIndices: boolean): number[] {
  return [
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ADD,
    Opcodes.OP_SWAP,
    Opcodes.OP_0, Opcodes.OP_SWAP,
    Opcodes.OP_BEGIN,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL,
    Opcodes.OP_IF,
    ...recordWalkScript(keepIndices),
    Opcodes.OP_ELSE,
    ...recordWalkScript(false),
    Opcodes.OP_ENDIF,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_1ADD, Opcodes.OP_SWAP,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_PICK,
    ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK,
    Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_UNTIL,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_DROP,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_DROP,
  ];
}

/**
 * Consumes a segment's record list whose length the entry does not fix, checking each entry's shape.
 *
 * The count is not known, so it is read and its entries walked. The walk is guarded so a segment with no record
 * consumes none: the loop runs at least once, so a zero count would otherwise read a record that is not there.
 * The count and the cursor sit below the tail on the main stack, so the tail stays on top for the field reader.
 *
 * With `keepIndices` the first entry's own two index fields are parked before the walk consumes them, and a
 * segment that declares none parks the sentinel instead.
 */
function recordWalkScript(keepIndices = false): number[] {
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP,
    Opcodes.OP_0, Opcodes.OP_SWAP,
    ...encodeDataPush(scriptNumber(2)), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL,
    Opcodes.OP_IF,
    ...(keepIndices ? parkAbsentRecordBase() : []),
    Opcodes.OP_ELSE,
    ...(keepIndices ? parkFirstRecordBase() : []),
    Opcodes.OP_BEGIN,
    ...recordEntryCheck(),
    // cursor += 1, then continue while cursor < count.
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_1ADD, Opcodes.OP_SWAP,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_PICK,
    ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK,
    Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_ENDIF,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_DROP,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ROLL, Opcodes.OP_DROP,
  ];
}

/**
 * Park the base of the record block a segment declared none of: the sentinel, one below itself, so a state site
 * that reads through it fails the index rather than reading some other input.
 */
function parkAbsentRecordBase(): number[] {
  return [
    ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_BIN2NUM, Opcodes.OP_1SUB, Opcodes.OP_TOALTSTACK,
    ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_BIN2NUM, Opcodes.OP_1SUB, Opcodes.OP_TOALTSTACK,
  ];
}

/**
 * Park the base of the record block the first entry of a segment declares, without consuming the entry.
 *
 * Entry `[..., count, cursor, rest]`, exit the same with the base of the first entry's input block and of its
 * output block parked on the alt stack, input first. The two index fields lead the entry, so each is read from a
 * copy of the remainder and the entry itself is left for the walk.
 */
function parkFirstRecordBase(): number[] {
  const parked = (): number[] => [Opcodes.OP_DROP, Opcodes.OP_BIN2NUM, Opcodes.OP_1SUB, Opcodes.OP_TOALTSTACK];
  return [
    Opcodes.OP_DUP, ...takeFixedWidthField(2), ...parked(),
    // The output field is read from the same copy: the split leaves the remainder on top, so the field just taken is
    // dropped before the next one is split off, or the second read would take the input field again.
    Opcodes.OP_DUP, ...takeFixedWidthField(2), Opcodes.OP_NIP, ...takeFixedWidthField(2), ...parked(),
  ];
}

/**
 * Consumes one record entry and requires its shape: kept in place, created, or deleted, at an index the transaction
 * has.
 *
 * Settlement walks only the indices the transaction has, so an index naming none would leave the entry's views
 * unsettled for the body to read. Read as signed numbers, the sentinel is the least an index field holds, so the
 * larger of the two must name an input or an output; that also refuses an entry with no index at all.
 */
function recordEntryCheck(): number[] {
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK,
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK,
    ...skipLengthPrefixed32(),
    ...skipLengthPrefixed32(),
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK, // [..., tail, out, in]
    Opcodes.OP_2DUP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_MAX,
    Opcodes.OP_0, Opcodes.OP_TXINPUTCOUNT, Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_MAX, Opcodes.OP_WITHIN, Opcodes.OP_VERIFY,
    // Equal indices, or one of them the sentinel.
    Opcodes.OP_2DUP, Opcodes.OP_EQUAL,
    Opcodes.OP_ROT, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL,
    Opcodes.OP_ROT, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL,
    Opcodes.OP_BOOLOR, Opcodes.OP_BOOLOR, Opcodes.OP_VERIFY,
  ];
}

/** Consumes an `lp32` field from the front of the tail and drops its payload. */
function skipLengthPrefixed32(): number[] {
  return [...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_DROP];
}

/**
 * Requires the two record indices on top to describe a kept, created or deleted record, leaving the tail.
 *
 * Entry `[..., tail, out, in]`, exit `[..., tail]`. A kept record recreates at its own index, a created one has
 * no input index and a deleted one no output index. An entry that both creates and deletes, or that moves an
 * index, is refused.
 */
function requireRecordShape(sentinel: Uint8Array = INDEX_NONE_BYTES): number[] {
  // a = in has no index, b = out has no index, c = the indices are equal.
  return [
    Opcodes.OP_DUP, ...encodeDataPush(sentinel), Opcodes.OP_EQUAL, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_SWAP, Opcodes.OP_DUP, ...encodeDataPush(sentinel), Opcodes.OP_EQUAL, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_EQUAL, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK,
    // valid = (a or b or c) and not (a and b).
    Opcodes.OP_2DUP, Opcodes.OP_BOOLAND, Opcodes.OP_NOT, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_BOOLOR, Opcodes.OP_BOOLOR,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_BOOLAND, Opcodes.OP_VERIFY,
  ];
}

/**
 * Consumes the event list into a fixed-size region, requiring each listed output to carry the contract's category
 * with no capability.
 *
 * The block declares how many events it lists, which may be any number up to `maxEventCount` because two bodies
 * behind the head may emit different numbers. The count is read, required to be at most `maxEventCount`, and then
 * `maxEventCount` positions are filled: a position the block declares an output for is read from the tail and
 * checked, and a position past the declared count parks the no-index sentinel, so a slot a body reads never hands
 * back another output's index. The category is the records' owner's own token, which the prologue already proved
 * carries the contract's category with minting capability where the frame owns its records; dropping that
 * capability byte leaves the pin an immutable token carries. With `ownerBelowTail` the owner is the index the
 * caller left below the tail, so a frame that runs on another contract's records is checked against the contract
 * it runs on; without it the owner is the executing input. The listed outputs must strictly increase, so no two
 * events share one and their order is fixed.
 *
 * The running previous index used for the ordering check sits on the alt stack and is refreshed by both arms, so
 * it is always on top and is popped once the region is consumed. Each position's value is parked below it, deepest
 * first, and the declared count is parked last, above them all; the caller moves them to the main stack as tracked
 * slots in the order the bodies read them.
 */
function eventSection(maxEventCount: number, ownerBelowTail: boolean): number[] {
  if (maxEventCount === 0) return requireU16Equals(0);
  const bytes: number[] = [
    // Read the declared count as a VM number, leaving `[declared, tail]`.
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
    // Require it not to exceed the region: `declared <= maxEventCount`.
    Opcodes.OP_DUP,
    ...encodeDataPush(scriptNumber(maxEventCount)), Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_VERIFY,
    // Put the tail on top, leaving `[tail, declared]`: the walk reads entries from the front of the tail and the
    // running previous index sits on the alt stack.
    Opcodes.OP_SWAP,
    Opcodes.OP_1NEGATE, Opcodes.OP_TOALTSTACK,
  ];
  for (let position = 0; position < maxEventCount; position += 1) {
    // `declared > position ?`: read and check the listed output, else park the sentinel.
    bytes.push(
      Opcodes.OP_1, Opcodes.OP_PICK,
      ...encodeDataPush(scriptNumber(position)), Opcodes.OP_GREATERTHAN, Opcodes.OP_IF,
      ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
      Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY,
      ...eventCategoryScript(ownerBelowTail), Opcodes.OP_EQUALVERIFY,
      Opcodes.OP_FROMALTSTACK, Opcodes.OP_OVER, Opcodes.OP_LESSTHAN, Opcodes.OP_VERIFY,
      // Keep the index for the walker, then hand the value back as the running previous index.
      Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK, Opcodes.OP_TOALTSTACK,
      Opcodes.OP_ELSE,
      // Park the no-index sentinel and put the running previous index back on top.
      Opcodes.OP_FROMALTSTACK,
      ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_BIN2NUM, Opcodes.OP_TOALTSTACK,
      Opcodes.OP_TOALTSTACK,
      Opcodes.OP_ENDIF,
    );
  }
  // Drop the running previous index, then park the declared count above the positions.
  bytes.push(Opcodes.OP_FROMALTSTACK, Opcodes.OP_DROP);
  bytes.push(Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK);
  return bytes;
}

/**
 * The number of items above the records' owner when the event walk reads a category.
 *
 * The owner sits directly below the tail. When a listed event is read the working region above it holds the tail's
 * remainder, the declared event count and the output index just read, in that order with the output index on top.
 */
const EVENT_OWNER_DEPTH = 4;

/**
 * Leaves the category of the input the records belong to, without a capability byte.
 *
 * Without `ownerBelowTail` the owner is the executing input, whose token the prologue has already required to be
 * the contract's. With it the owner is the input index directly below the tail, which the caller left there: a
 * frame that runs on another contract's records is checked against that contract's category, and a frame that owns
 * its records leaves its own index there, so the two cases agree.
 */
function eventCategoryScript(ownerBelowTail: boolean): number[] {
  const owner = ownerBelowTail
    ? [...encodeDataPush(scriptNumber(EVENT_OWNER_DEPTH)), Opcodes.OP_PICK]
    : [Opcodes.OP_INPUTINDEX];
  return [
    ...owner, Opcodes.OP_UTXOTOKENCATEGORY,
    ...encodeDataPush(scriptNumber(32)), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
  ];
}

/**
 * Consumes the send list into a fixed-size region, parking each listed output index for the body that sent it.
 *
 * The block declares how many sends the execution made, which may be any number up to `count` because a send on
 * one branch of a conditional may not happen. The count is read and required to be at most `count`; then `count`
 * positions are filled, a position the block lists an output for being read from the tail and a position past the
 * declared count parking the no-index sentinel. The body that computed each send reads its own position and pins
 * the lock and the value it computed at the listed output, or requires the sentinel when its own send did not
 * happen, so the region states exactly the sends the execution made.
 */
function sendSection(count: number): number[] {
  if (count === 0) return requireU16Equals(0);
  const bytes: number[] = [
    // Read the declared count as a VM number, leaving `[declared, tail]`, and require it not to exceed the region.
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
    Opcodes.OP_DUP,
    ...encodeDataPush(scriptNumber(count)), Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_VERIFY,
    // Put the tail on top, leaving `[tail, declared]`.
    Opcodes.OP_SWAP,
  ];
  for (let position = 0; position < count; position += 1) {
    // `declared > position ?`: read the listed output, else park the sentinel.
    bytes.push(
      Opcodes.OP_1, Opcodes.OP_PICK,
      ...encodeDataPush(scriptNumber(position)), Opcodes.OP_GREATERTHAN, Opcodes.OP_IF,
      ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_TOALTSTACK,
      Opcodes.OP_ELSE,
      ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_BIN2NUM, Opcodes.OP_TOALTSTACK,
      Opcodes.OP_ENDIF,
    );
  }
  // Park the declared count above the positions.
  bytes.push(Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK);
  return bytes;
}

/**
 * Consumes one `calls[k]` record without reading it, so the tail walk reaches the sections after the calls.
 *
 * The record's own checks belong to the site that made the call (`call-site.ts`), which reads the same block
 * itself. `kind`, `target`, `value`, `calleeRef`, `argsHash` and `result` have fixed widths except the last two;
 * a `u16`-length `target` and a `u32`-length `result` are read the way the codec writes them.
 */
function callRecordSkip(): number[] {
  return [
    ...takeFixedWidthField(1), Opcodes.OP_NIP, // kind
    ...takeLengthPrefixedField(), Opcodes.OP_NIP, // target
    ...takeFixedWidthField(8), Opcodes.OP_NIP, // value
    ...takeFixedWidthField(2), Opcodes.OP_NIP, // calleeRef
    ...takeFixedWidthField(32), Opcodes.OP_NIP, // argsHash
    ...takeLengthPrefixedField32(), Opcodes.OP_NIP, // result
  ];
}

/**
 * Consumes a pinned category on top and requires exactly one input to carry it.
 *
 * Entry `[..., pinned]`, exit `[...]`. A master's `pinned` is `OP_INPUTINDEX OP_UTXOTOKENCATEGORY`, which the
 * prologue has already required to be the contract's category with minting capability. Masters are the only
 * UTXOs that carry that, so a count of one is N1's "it is the only master of X in the transaction".
 */
export function requireSingleMasterScript(): Uint8Array {
  return new Uint8Array([...countMastersScript(), Opcodes.OP_1, Opcodes.OP_NUMEQUALVERIFY]);
}

/**
 * Consumes a pinned category on top and leaves how many inputs carry it.
 *
 * Entry `[..., pinned]`, exit `[..., count]`. A master that settles its own records has to know whether it is its
 * category's only master in the transaction: when it is, its own walk settles the records, and when it is not, its
 * validator does.
 */
export function countMastersScript(): Uint8Array {
  return new Uint8Array([
    Opcodes.OP_0, Opcodes.OP_0, // count, index
    Opcodes.OP_BEGIN,
    Opcodes.OP_DUP, Opcodes.OP_UTXOTOKENCATEGORY, // the input's pinned category
    ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK, // the expected pin, at depth 3
    Opcodes.OP_EQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_1, Opcodes.OP_ROLL, // count to the top
    Opcodes.OP_1ADD,
    Opcodes.OP_SWAP, // and back under the index
    Opcodes.OP_ENDIF,
    Opcodes.OP_1ADD,
    Opcodes.OP_DUP, Opcodes.OP_TXINPUTCOUNT, Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_DROP, // index
    Opcodes.OP_SWAP,
    Opcodes.OP_DROP, // pinned
  ]);
}

/**
 * Consumes a validator input index on top and requires it to name a validator for the hash in the reserved slot.
 *
 * Entry `[..., reservedHash, validatorIndex]`, exit `[...]`. The expected hash is the master's reserved slot, which
 * the head pushes immediately beneath the index: its value exists only once the validator is deployed, so it is a
 * slot rather than a constant the compile could bake in. `reservedHash` sits four items below the hash this
 * comparison computes, which is what fixes the pick's depth.
 *
 * The input must hold a mutable NFT of some category `c`, and its redeem script — the last push of its unlocking
 * bytecode, after the transcript — must be the category pin pushed, then a program hashing to the expected hash. The pin's
 * category is read from the redeem script and compared with the category the UTXO itself carries, so a validator
 * whose token is not the one its script pins is refused. P2SH32 consensus gives its lock as `addrV(c)`, and the
 * master skips the transcript and never interprets it.
 */
export function recogniseValidatorScriptAgainstReservedHash(): Uint8Array {
  return new Uint8Array([
    Opcodes.OP_DUP, Opcodes.OP_UTXOTOKENCATEGORY,
    // The category plus its capability byte: 33 bytes, and a mutable NFT is capability 0x01.
    Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP,
    ...encodeDataPush(scriptNumber(33)), Opcodes.OP_NUMEQUALVERIFY,
    Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(32)), Opcodes.OP_SPLIT, Opcodes.OP_NIP,
    ...encodeDataPush(new Uint8Array([TokenCapability.MUTABLE])), Opcodes.OP_EQUALVERIFY,
    // The redeem script: the last push of the validator's unlocking bytecode.
    Opcodes.OP_1, Opcodes.OP_PICK, Opcodes.OP_INPUTBYTECODE,
    ...dropFirstPushScript(), ...splitFirstPushScript(),
    Opcodes.OP_0, Opcodes.OP_EQUALVERIFY,
    // `push(pin(c)) || program`. The push is 34 bytes; the program after it must hash to the reserved slot, four
    // items below the computed hash.
    ...encodeDataPush(scriptNumber(VALIDATOR_PIN_PUSH_LENGTH)), Opcodes.OP_SPLIT,
    Opcodes.OP_SHA256, ...encodeDataPush(scriptNumber(4)), Opcodes.OP_PICK, Opcodes.OP_EQUALVERIFY,
    // Drop the push opcode and require the pin to be the category the UTXO carries.
    Opcodes.OP_1, Opcodes.OP_SPLIT, Opcodes.OP_NIP,
    Opcodes.OP_1, Opcodes.OP_PICK, Opcodes.OP_EQUALVERIFY,
    Opcodes.OP_NIP, Opcodes.OP_DROP,
    // The reserved hash, consumed with the index.
    Opcodes.OP_DROP,
  ]);
}

/**
 * Settles the records a master declares itself, without a validator.
 *
 * A master settles its own records when it is its category's only master in the transaction and it made no
 * `DELEGATE` or `INTERNAL` call, which the head establishes before this runs. Its execution is split into one
 * segment per external call plus one, and each segment declares, for the record it touches, the commitment that
 * record holds at the segment's start and at its end. This walk turns those declarations into one transition: the
 * first begins at the commitment the transaction spends, every later one carries on from the one before it, and the
 * last ends at the commitment the transaction writes; a record the transaction creates has no input index, so it
 * begins at the empty commitment rather than at one an input carries. The same walk checks that the state UTXOs
 * spent are exactly the record declared, and that no state output carries the contract's token that no segment
 * declared.
 *
 * It also counts the outputs whose token is the bare category, which the head's census makes immutable NFTs, and
 * holds the count to the events the frame declares (spec S2). The tail walk proved each listed event a distinct such
 * output, so no unlisted one remains.
 *
 * The check re-reads the block rather than reusing the shape walk, because the shape walk drops the view payloads it
 * reads. One chain is settled: a contract's data NFT is one record, so the shape covers it. A segment declaring
 * several records, and a later segment declaring a record the chain does not already name, are refused rather than
 * settled partly, because only one chain is walked.
 *
 * A send is paid from the contract's containers (spec 4b), never from a record, so a record written back keeps at
 * least the value it held whether or not the entry sends.
 */
export interface SelfSettlementShape {
  /** Where the contract address's payload sits in the running script, for the census. */
  readonly addressPayloadOffset: number;
}

export function selfSettlementScript(shape: SelfSettlementShape): Uint8Array {
  const { addressPayloadOffset } = shape;
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  const num = (value: number): Uint8Array => encodeDataPush(scriptNumber(value));
  const absent = (): Uint8Array => encodeDataPush(INDEX_NONE_BYTES);
  const toAlt = (count: number): void => { for (let item = 0; item < count; item += 1) emit(Opcodes.OP_TOALTSTACK); };
  const fromAlt = (count: number): void => { for (let item = 0; item < count; item += 1) emit(Opcodes.OP_FROMALTSTACK); };
  /** A copy of the item at `depth` in the main stack, leaving it in place. */
  const copy = (depth: number, held = 0): void => { emit(num(depth + held), Opcodes.OP_PICK); };
  /** Keeps the shape check's raw two-byte fields, which the sentinel comparison reads as written. */
  const copyNumber = (depth: number, held = 0): void => { copy(depth, held); emit(Opcodes.OP_BIN2NUM); };
  /** A copy of the item at alt-stack `depth`, leaving the alt stack as it was. */
  const copyAlt = (depth: number): void => {
    fromAlt(depth + 1);
    emit(Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK);
    for (let held = 0; held < depth; held += 1) emit(num(1), Opcodes.OP_ROLL, Opcodes.OP_TOALTSTACK);
  };
  /**
   * Replaces the alt-stack item at `depth` with the single value `newValue` leaves on the main stack.
   *
   * The items above the one replaced come off first and go back in the same order — pushing them back in the
   * order they were popped would reverse them — and `newValue` is emitted between the two, so it can read the
   * main stack with the popped items already above it, which is what `held` names.
   */
  const replaceAlt = (depth: number, newValue: (held: number) => void): void => {
    fromAlt(depth);
    emit(Opcodes.OP_FROMALTSTACK, Opcodes.OP_DROP);
    newValue(depth);
    toAlt(depth + 1);
  };

  // The own-category immutable outputs seen, the index under test, and the pass over every index the transaction
  // could name.
  emit(Opcodes.OP_0, Opcodes.OP_0);
  emit(Opcodes.OP_BEGIN);
  {
    emit(Opcodes.OP_TOALTSTACK);
    // The pass's prologue: the block, its fixed prefix, and the three values the walk carries.
    emit(...readOwnWitnessBlockScript());
    emit(...dropPrefix(WITNESS_BLOCK_HEADER_LENGTH));
    emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
    emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
    emit(...takeFixedWidthField(8), Opcodes.OP_NIP);
    emit(...takeLengthPrefixedField32(), Opcodes.OP_NIP);
    // The call section is the block's own, so the walk steps over however many records it declares and keeps the
    // declared segment count as this walk's segment counter.
    emit(...callSectionWalkScript());
    emit(Opcodes.OP_FROMALTSTACK, Opcodes.OP_1ADD, Opcodes.OP_SWAP);
    // Alt: [index]. Main: [segments, block]. The flags go below the index, so `copyAlt` can reach them with the
    // block never leaving the top of the main stack.
    emit(Opcodes.OP_0);
    emit(Opcodes.OP_0);
    emit(absent());
    // Alt: [seenIn, seenOut, lastView, index].
    toAlt(3);
    // Main: [segments, block]
    emit(Opcodes.OP_BEGIN);
    {
      // The segment's record count comes off the front of the block, leaving the block back on top.
      emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM);
      emit(Opcodes.OP_SWAP);
      // Main: [block, count, segments] — the layout every declaration below is written against. A segment that
      // declares nothing runs no declaration at all, which the loop cannot express on its own: it tests its
      // condition after the body, so the body is guarded rather than entered once for nothing.
      emit(num(1), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_GREATERTHAN);
      emit(Opcodes.OP_IF);
      emit(Opcodes.OP_BEGIN);
      {
        // One declaration: its four fields come off the front of the block and are parked above the flags, so the
        // block returns to the top of the main stack after each one.
        emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK); // in
        emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK); // out
        emit(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK); // viewIn
        emit(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK); // viewOut
        fromAlt(4);
        // Main: [in, out, viewIn, viewOut, block, count, segments]. Alt: [seenIn, seenOut, lastView, index].
        emit(Opcodes.OP_2DUP);
        emit(...requireRecordShape());

        // Does this declaration read the index under test?
        copyNumber(0);
        copyAlt(3);
        emit(Opcodes.OP_EQUAL);
        emit(Opcodes.OP_IF);
        {
          // A declaration that reads the index: the chain starts at the commitment the transaction spends, or
          // carries on from the commitment the previous declaration ended at.
          // A declaration carries on from the chain when the record has been seen at all: either the input side
          // was read before, or the record was created at this index by an earlier declaration.
          copyAlt(0); // seenIn
          copyAlt(1); // seenOut
          emit(Opcodes.OP_BOOLOR, Opcodes.OP_NOT);
          emit(Opcodes.OP_IF);
          {
            copyAlt(3); // index
            emit(Opcodes.OP_UTXOTOKENCOMMITMENT);
            copy(3); // viewIn
            emit(Opcodes.OP_EQUALVERIFY);
            // The value floor applies where the record is written back: a kept record keeps what it held.
            copyNumber(1); // out
            emit(Opcodes.OP_0, Opcodes.OP_LESSTHAN, Opcodes.OP_NOT);
            emit(Opcodes.OP_IF);
            copyAlt(3);
            emit(Opcodes.OP_OUTPUTVALUE);
            copyAlt(3);
            emit(Opcodes.OP_UTXOVALUE);
            emit(Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY);
            emit(Opcodes.OP_ENDIF);
            replaceAlt(0, () => emit(Opcodes.OP_1)); // seenIn = 1
          }
          emit(Opcodes.OP_ELSE);
          {
            copy(2); // viewIn
            copyAlt(2); // lastView
            emit(Opcodes.OP_EQUALVERIFY);
          }
          emit(Opcodes.OP_ENDIF);

          // Where the record goes: kept at its own index, or deleted. The shape check already refused a move.
          copyNumber(1); // out
          copyAlt(3);
          emit(Opcodes.OP_EQUAL);
          emit(Opcodes.OP_IF);
          {
            replaceAlt(2, (held) => copy(3, held)); // lastView = viewOut
            replaceAlt(1, () => emit(Opcodes.OP_1)); // seenOut = 1
          }
          emit(Opcodes.OP_ELSE);
          {
            replaceAlt(2, () => emit(absent())); // a deletion ends the chain
            replaceAlt(1, () => emit(Opcodes.OP_0));
          }
          emit(Opcodes.OP_ENDIF);
        }
        emit(Opcodes.OP_ELSE);
        {
          // A declaration that does not read the index can still create the record at it.
          copyNumber(1); // out
          copyAlt(3);
          emit(Opcodes.OP_EQUAL);
          emit(Opcodes.OP_IF);
          {
            copyNumber(0); // in
            emit(Opcodes.OP_0, Opcodes.OP_LESSTHAN);
            emit(Opcodes.OP_VERIFY); // a created record has no index to be read at
            copy(2); // viewIn
            emit(Opcodes.OP_0, Opcodes.OP_EQUALVERIFY); // and it starts from nothing
            copyAlt(1); // seenOut
            emit(Opcodes.OP_NOT, Opcodes.OP_VERIFY); // and it is created once
            replaceAlt(2, (held) => copy(3, held)); // lastView = viewOut
            replaceAlt(1, () => emit(Opcodes.OP_1)); // seenOut = 1
          }
          emit(Opcodes.OP_ENDIF);
        }
        emit(Opcodes.OP_ENDIF);

        // The four fields have been read and judged; the layout is back to [block, count, segments].
        emit(Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP);
        emit(num(1), Opcodes.OP_ROLL, Opcodes.OP_1SUB, Opcodes.OP_SWAP);
        // The loop repeats until this is true, so the condition is "no declaration is left".
        emit(num(1), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_LESSTHANOREQUAL);
        emit(Opcodes.OP_UNTIL);
      }
      emit(Opcodes.OP_ENDIF);
      // Main: [block, 0, segments]
      emit(num(1), Opcodes.OP_ROLL, Opcodes.OP_DROP);
      emit(num(1), Opcodes.OP_ROLL, Opcodes.OP_1SUB, Opcodes.OP_SWAP);
      emit(num(1), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_LESSTHANOREQUAL);
      emit(Opcodes.OP_UNTIL);
    }
    // The spent counter goes, and the remainder leaves the declared event count, read as the tail walk read it.
    emit(Opcodes.OP_NIP, ...takeFixedWidthField(2), Opcodes.OP_DROP, Opcodes.OP_BIN2NUM);

    // The pass's closing checks: what the chain ended at, and the census at this index.
    copyAlt(1); // seenOut
    emit(Opcodes.OP_IF);
    {
      copyAlt(2); // lastView
      copyAlt(3); // index
      emit(Opcodes.OP_OUTPUTTOKENCOMMITMENT);
      emit(Opcodes.OP_EQUALVERIFY);
    }
    emit(Opcodes.OP_ENDIF);
    emit(...indexCensusScript('input', addressPayloadOffset));
    emit(...indexCensusScript('output', addressPayloadOffset));

    // The pass's own values go with it; the index is the loop's.
    fromAlt(3);
    emit(Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP);
    emit(Opcodes.OP_FROMALTSTACK);

    // [seen, declared, index]: a bare own-category output is counted, and the count never passes the events listed.
    emit(Opcodes.OP_DUP, Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_LESSTHAN, Opcodes.OP_IF);
    emit(Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY, Opcodes.OP_INPUTINDEX, Opcodes.OP_UTXOTOKENCATEGORY);
    emit(num(32), Opcodes.OP_SPLIT, Opcodes.OP_DROP, Opcodes.OP_EQUAL);
    emit(Opcodes.OP_ELSE, Opcodes.OP_0, Opcodes.OP_ENDIF);
    emit(num(3), Opcodes.OP_ROLL, Opcodes.OP_ADD, Opcodes.OP_ROT);
    emit(Opcodes.OP_OVER, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY, Opcodes.OP_SWAP);
  }
  emit(Opcodes.OP_1ADD);
  emit(Opcodes.OP_DUP);
  emit(Opcodes.OP_TXINPUTCOUNT, Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_MAX);
  emit(Opcodes.OP_GREATERTHANOREQUAL);
  emit(Opcodes.OP_UNTIL);
  emit(Opcodes.OP_2DROP);
  return new Uint8Array(bytes);
}

/**
 * Requires the transaction to carry a state token at the index under test exactly when the pass said it does.
 *
 * The index is visited whatever side it names, and the side that has no item at that index is skipped rather than
 * read. A validator of the contract's own category is recreated in place at the contract address carrying the same
 * mutable token a record does with an empty commitment, and that index is not a record: the census admits exactly
 * that token beside the ones the pass saw.
 */
function indexCensusScript(side: 'input' | 'output', addressPayloadOffset: number): number[] {
  const countOpcode = side === 'input' ? Opcodes.OP_TXINPUTCOUNT : Opcodes.OP_TXOUTPUTCOUNT;
  const otherCountOpcode = side === 'input' ? Opcodes.OP_TXOUTPUTCOUNT : Opcodes.OP_TXINPUTCOUNT;
  const tokenOpcode = side === 'input' ? Opcodes.OP_UTXOTOKENCATEGORY : Opcodes.OP_OUTPUTTOKENCATEGORY;
  const flagDepth = side === 'input' ? 0 : 1;
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  const num = (value: number): Uint8Array => encodeDataPush(scriptNumber(value));
  const copyAlt = (depth: number): void => {
    for (let item = 0; item <= depth; item += 1) emit(Opcodes.OP_FROMALTSTACK);
    emit(Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK);
    for (let held = 0; held < depth; held += 1) emit(num(1), Opcodes.OP_ROLL, Opcodes.OP_TOALTSTACK);
  };

  // The index under test is at alt depth 3, and the flag that says whether this side carries the record at 0.
  copyAlt(3);
  emit(countOpcode, Opcodes.OP_LESSTHAN);
  emit(Opcodes.OP_IF);
  {
    // What the transaction carries at the index, against the token a record is pinned with.
    copyAlt(3);
    emit(tokenOpcode);
    emit(...mutableRecordPin());
    emit(Opcodes.OP_EQUAL);
    // The flag the pass ended at.
    copyAlt(flagDepth);
    emit(Opcodes.OP_EQUAL);
    // Or a validator of the contract's own category, recreated in place at the contract address: both sides exist
    // at the index, both locks are the address, and both tokens are the mutable one a record carries, with the
    // empty commitment a validator is deployed with.
    copyAlt(3);
    emit(countOpcode, Opcodes.OP_LESSTHAN);
    copyAlt(3);
    emit(otherCountOpcode, Opcodes.OP_LESSTHAN);
    emit(Opcodes.OP_BOOLAND);
    emit(Opcodes.OP_IF);
    {
      // One copy of the index serves every read: `[index, admitted]`, the index dropped at the end.
      copyAlt(3);
      emit(Opcodes.OP_DUP, Opcodes.OP_UTXOBYTECODE, ...pushContractAddress(addressPayloadOffset), Opcodes.OP_EQUAL);
      emit(Opcodes.OP_OVER, Opcodes.OP_OUTPUTBYTECODE, ...pushContractAddress(addressPayloadOffset), Opcodes.OP_EQUAL);
      emit(Opcodes.OP_BOOLAND);
      emit(Opcodes.OP_OVER, Opcodes.OP_UTXOTOKENCATEGORY, ...mutableRecordPin(), Opcodes.OP_EQUAL, Opcodes.OP_BOOLAND);
      emit(Opcodes.OP_OVER, Opcodes.OP_OUTPUTTOKENCATEGORY, ...mutableRecordPin(), Opcodes.OP_EQUAL, Opcodes.OP_BOOLAND);
      emit(Opcodes.OP_OVER, Opcodes.OP_UTXOTOKENCOMMITMENT, Opcodes.OP_0, Opcodes.OP_EQUAL, Opcodes.OP_BOOLAND);
      emit(Opcodes.OP_OVER, Opcodes.OP_OUTPUTTOKENCOMMITMENT, Opcodes.OP_0, Opcodes.OP_EQUAL, Opcodes.OP_BOOLAND);
      emit(Opcodes.OP_NIP);
    }
    emit(Opcodes.OP_ELSE);
    emit(Opcodes.OP_0);
    emit(Opcodes.OP_ENDIF);
    emit(Opcodes.OP_BOOLOR, Opcodes.OP_VERIFY);
  }
  emit(Opcodes.OP_ENDIF);
  return bytes;
}

/** The contract address, read from its reserved slot in the script that is running. */
function pushContractAddress(payloadOffset: number): number[] {
  return [
    Opcodes.OP_ACTIVEBYTECODE,
    ...encodeDataPush(scriptNumber(payloadOffset)),
    Opcodes.OP_SPLIT,
    Opcodes.OP_NIP,
    ...encodeDataPush(scriptNumber(ADDRESS_SLOT_LENGTH)),
    Opcodes.OP_SPLIT,
    Opcodes.OP_DROP,
  ];
}

/** The pin of a state record's token, `catX` with the mutable capability, read from the active input's category. */
function mutableRecordPin(): number[] {
  return [
    Opcodes.OP_INPUTINDEX, Opcodes.OP_UTXOTOKENCATEGORY,
    ...encodeDataPush(scriptNumber(32)), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
    ...encodeDataPush(new Uint8Array([TokenCapability.MUTABLE])), Opcodes.OP_CAT,
  ];
}

/** Appends opcode bytes and pushed payloads, so a builder can mix numbers and `encodeDataPush` results. */
function pushAll(target: number[], ops: readonly (number | Uint8Array)[]): void {
  for (const op of ops) {
    if (typeof op === 'number') target.push(op);
    else target.push(...op);
  }
}

/** A script number in its minimal push form; zero is the empty push. */
function scriptNumber(value: number): Uint8Array {
  if (value === 0) return new Uint8Array(0);
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0) {
    bytes.push(rest & 0xff);
    rest = Math.floor(rest / 256);
  }
  if ((bytes[bytes.length - 1]! & 0x80) !== 0) bytes.push(0x00);
  return new Uint8Array(bytes);
}
