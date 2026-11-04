/**
 * Walking the variable-length tail of a witness block inside script, and the checks a frame makes about the
 * transaction around it.
 *
 * The tail of section 16's block follows the frame fields: `retval`, then a call per external call, then the
 * segment, event and send sections. A frame that makes no call only has to know that it made none. The reader in
 * `witness-reader.ts` takes fields off the front of the tail; these builders walk it.
 *
 * A master with call sites walks past each call record without reading it: the record is bound to its site where
 * the call is made, in the caller's own body (`call-site.ts`). The records are the calls the execution made, in the
 * order it made them: a site the execution skips binds none, and the body pins how many the block declares to how
 * many it made. The head parks the declared count for that and checks the sections after the calls.
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

import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { KEPT_VIEW_LENGTH, TokenCapability, VALIDATOR_PIN_PUSH_LENGTH, encodeInt } from '@solidcash/utils';
import { ADDRESS_SLOT_LENGTH } from './placeholders.js';
import {
  FRAMEWORK_REGISTRAR_ID,
  TAIL_CALLS_KEPT_ROUTINE_ID,
  TAIL_CALLS_ROUTINE_ID,
  TAIL_EVENTS_ROUTINE_ID,
  TAIL_EVENT_RUN_ROUTINE_ID,
  TAIL_PADDING_ROUTINE_ID,
  TAIL_SEGMENTS_KEPT_ROUTINE_ID,
  TAIL_SEGMENTS_ROUTINE_ID,
  TAIL_SENDS_ROUTINE_ID,
  TAIL_SEND_RUN_ROUTINE_ID,
  TAIL_VALUES_ROUTINE_ID,
  frameworkRegistrar,
  frameworkRegistrarOffset,
} from '../framework-library.js';
import {
  WITNESS_BLOCK_HEADER_LENGTH,
  dropFirstPushScript,
  dropPrefix,
  readOwnWitnessBlockScript,
  skipSegmentScript,
  splitFirstPushScript,
  takeFixedWidthField,
  takeLengthPrefixedField,
  takeLengthPrefixedField32,
  takeRecordFieldsScript,
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
 *
 * `eventRun` and `sendRun` park a region as a run instead, for a master with a body that emits or sends from a loop:
 * the listed outputs must be consecutive, every one is checked, and the head parks only the first and the declared
 * count, whatever the count. A body binds its k-th effect at the run's k-th output and pins how many it made.
 */
export interface MasterTailShape {
  readonly segmentRecordCounts?: readonly number[];
  readonly maxEventCount: number;
  readonly sendCount: number;
  readonly valueWitnessCount?: number;
  readonly eventRun?: boolean;
  readonly sendRun?: boolean;
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

/** The sighash type a root caller's signature must carry once its UTXOS bit (0x20) is masked off: `SIGHASH_ALL`. */
export const HASH_TYPE_ALL = 0x41;
/** Masks the UTXOS bit off a sighash type, which the head admits either way. */
export const HASH_TYPE_UTXOS_BIT_MASK = 0xdf;

/**
 * `[callerRef]` -> `[]`: the caller's signature, the first push of its unlocking bytecode, signs with `SIGHASH_ALL`,
 * its UTXOS bit either way. A caller whose unlocking bytecode carries no push fails the split.
 */
export function callerSignatureHashTypeScript(): Uint8Array {
  return new Uint8Array([
    Opcodes.OP_BIN2NUM, Opcodes.OP_INPUTBYTECODE, ...splitFirstPushScript(), Opcodes.OP_DROP,
    Opcodes.OP_SIZE, Opcodes.OP_1SUB, Opcodes.OP_SPLIT, Opcodes.OP_NIP,
    ...encodeDataPush(Uint8Array.of(HASH_TYPE_UTXOS_BIT_MASK)), Opcodes.OP_AND,
    ...encodeDataPush(Uint8Array.of(HASH_TYPE_ALL)), Opcodes.OP_EQUALVERIFY,
  ]);
}

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
 * own code computed. Each call record is walked past: the site that made the call binds it in the caller's own
 * body, and the body pins the count. The segment count must be the call count plus one, and every segment's
 * records are walked. The block's declared event count must be at most `maxEventCount`, that many listed outputs
 * are checked and the region is padded with the no-index sentinel to `maxEventCount` slots, and the send count
 * must be at most the shape's, each listed output index
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
    /** True when the master's bodies make calls, whose sites then bind their records from the head's kept copy. */
    readonly keepsCalls?: boolean;
    /**
     * True when the framework library is defined (a master every spend of which is covered recognises its validator
     * first): each walk is then one invocation of the library's routine for it, the counts the walks take pushed.
     */
    readonly viaLibrary?: boolean;
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
  if (options.viaLibrary === true) {
    if (options.eventOwnerBelowTail !== true) {
      throw new Error('master tail: the library walks the events of a frame that leaves their owner below the tail');
    }
    const invoke = (id: bigint, ...counts: number[]): number[] => [
      ...counts.flatMap((count) => [...encodeDataPush(scriptNumber(count))]), ...encodeDataPush(encodeInt(id)),
      Opcodes.OP_INVOKE,
    ];
    bytes.push(...invoke(options.keepsCalls === true ? TAIL_CALLS_KEPT_ROUTINE_ID : TAIL_CALLS_ROUTINE_ID));
    bytes.push(...invoke(keepsRecordIndices ? TAIL_SEGMENTS_KEPT_ROUTINE_ID : TAIL_SEGMENTS_ROUTINE_ID));
    if (tail.eventRun === true) bytes.push(...invoke(TAIL_EVENT_RUN_ROUTINE_ID));
    else if (tail.maxEventCount === 0) bytes.push(...requireU16Equals(0));
    else bytes.push(...invoke(TAIL_EVENTS_ROUTINE_ID, tail.maxEventCount));
    if (tail.sendRun === true) bytes.push(...invoke(TAIL_SEND_RUN_ROUTINE_ID));
    else if (tail.sendCount === 0) bytes.push(...requireU16Equals(0));
    else bytes.push(...invoke(TAIL_SENDS_ROUTINE_ID, tail.sendCount));
    const values = tail.valueWitnessCount ?? 0;
    bytes.push(...(values === 0 ? valueSection(0) : invoke(TAIL_VALUES_ROUTINE_ID, values)));
    bytes.push(...invoke(TAIL_PADDING_ROUTINE_ID));
    return new Uint8Array(bytes);
  }
  bytes.push(...(options.keepsCalls === true ? callWalkKeepingCallsScript() : callWalkScript()));
  bytes.push(...segmentCountCheckScript());
  bytes.push(...(keepsRecordIndices ? segmentLoopKeepingSegmentsScript() : segmentLoopScript()));
  bytes.push(...(tail.eventRun === true
    ? eventRunSection(options.eventOwnerBelowTail === true)
    : eventSection(tail.maxEventCount, options.eventOwnerBelowTail === true)));
  bytes.push(...(tail.sendRun === true ? sendRunSection() : sendSection(tail.sendCount)));
  bytes.push(...valueSection(tail.valueWitnessCount ?? 0));
  bytes.push(...paddingSection());
  return new Uint8Array(bytes);
}

/**
 * The bodies of the library's tail walks (framework-library.ts), each what `verifyTailScript` emits inline for the
 * same walk. A counted walk takes its count on top of the tail and runs it as a loop, which leaves the alternate
 * stack as the unrolled walk does; it is invoked only for a count of at least one.
 */
export function tailWalkBodies(): {
  readonly calls: Uint8Array; readonly callsKept: Uint8Array; readonly segments: Uint8Array;
  readonly segmentsKept: Uint8Array; readonly events: Uint8Array; readonly eventRun: Uint8Array;
  readonly sends: Uint8Array; readonly sendRun: Uint8Array; readonly values: Uint8Array; readonly padding: Uint8Array;
} {
  return {
    calls: new Uint8Array(callWalkScript()),
    callsKept: new Uint8Array(callWalkKeepingCallsScript()),
    segments: new Uint8Array([...segmentCountCheckScript(), ...segmentLoopScript()]),
    segmentsKept: new Uint8Array([...segmentCountCheckScript(), ...segmentLoopKeepingSegmentsScript()]),
    events: new Uint8Array(eventLoopSection()),
    eventRun: new Uint8Array(eventRunSection(true)),
    sends: new Uint8Array(sendLoopSection()),
    sendRun: new Uint8Array(sendRunSection()),
    values: new Uint8Array(valueLoopSection()),
    padding: new Uint8Array(paddingSection()),
  };
}

/**
 * Consumes the block's padding, which nothing reads, and requires nothing to follow it. Entry `[..., tail]`, exit
 * `[...]`.
 */
function paddingSection(): number[] {
  return [...takeLengthPrefixedField(), Opcodes.OP_0, Opcodes.OP_EQUALVERIFY, Opcodes.OP_DROP];
}

/**
 * Consumes the value list and parks one slot per value-witness slot, leaving the tail on top.
 *
 * The block may list at most `slots` values. Slot `k` is parked `k`-th, holding the `k`-th listed value or empty
 * past the list; a body that reads a long value at an empty slot fails its own hash check. The count is read
 * unsigned, as the validator reads it, so no count the validator refuses is accepted here.
 */
export function valueSection(slots: number): number[] {
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

/**
 * `valueSection` over a count on top of the tail rather than one built in: entry `[..., tail, slots]` with `slots`
 * at least one, exit as `valueSection(slots)` leaves it. The loop keeps `[count, slots, rest, slot]`.
 */
function valueLoopSection(): number[] {
  return [
    Opcodes.OP_TOALTSTACK,
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, ...unsignedLength(), // [rest, count]
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_ROT, Opcodes.OP_0, // [count, slots, rest, 0]
    Opcodes.OP_BEGIN,
    ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK, Opcodes.OP_OVER, Opcodes.OP_GREATERTHAN, Opcodes.OP_IF,
    Opcodes.OP_SWAP, ...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK, Opcodes.OP_SWAP,
    Opcodes.OP_ELSE, Opcodes.OP_0, Opcodes.OP_TOALTSTACK, Opcodes.OP_ENDIF,
    Opcodes.OP_1ADD, Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK, Opcodes.OP_NUMEQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_DROP, Opcodes.OP_ROT, Opcodes.OP_ROT, // [rest, count, slots]
    Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_VERIFY,
  ];
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

/**
 * Consumes the call section as `callWalkScript` does, and parks the call records for the body's call sites.
 *
 * Entry `[..., tail]`, exit `[...]`. Each record's bytes are kept as the walk steps over them, each led by its own
 * length as a two-byte number, and the run is parked on the alt stack beneath the declared call count
 * (`callsSlotName`), which the segment walk reads next. A site then steps to its own record with one split a record
 * instead of reading the block and walking the frame's header.
 */
function callWalkKeepingCallsScript(): number[] {
  const num = (value: number): number[] => [...encodeDataPush(scriptNumber(value))];
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP,
    // Park a copy for the body, as the plain walk does.
    ...num(1), Opcodes.OP_PICK, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_0, Opcodes.OP_ROT, Opcodes.OP_ROT, Opcodes.OP_0, Opcodes.OP_SWAP, // [kept, count, cursor, tail]
    ...num(2), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_ELSE,
    Opcodes.OP_BEGIN,
    Opcodes.OP_DUP, // [kept, count, cursor, before, tail]
    ...callRecordSkip(),
    // The record is what the skip consumed: `before` up to the length the tail lost.
    Opcodes.OP_SIZE, ...num(2), Opcodes.OP_PICK, Opcodes.OP_SIZE, Opcodes.OP_NIP, Opcodes.OP_SWAP, Opcodes.OP_SUB,
    Opcodes.OP_ROT, Opcodes.OP_SWAP,
    Opcodes.OP_DUP, ...num(2), Opcodes.OP_NUM2BIN, Opcodes.OP_ROT, Opcodes.OP_ROT,
    Opcodes.OP_SPLIT, Opcodes.OP_DROP, Opcodes.OP_CAT, // [kept, count, cursor, tail, lengthAndRecord]
    ...num(4), Opcodes.OP_ROLL, Opcodes.OP_SWAP, Opcodes.OP_CAT,
    ...num(3), Opcodes.OP_ROLL, ...num(3), Opcodes.OP_ROLL, ...num(3), Opcodes.OP_ROLL, // [kept, count, cursor, tail]
    ...num(1), Opcodes.OP_ROLL, Opcodes.OP_1ADD, Opcodes.OP_SWAP,
    ...num(1), Opcodes.OP_PICK,
    ...num(3), Opcodes.OP_PICK,
    Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_ENDIF,
    ...num(1), Opcodes.OP_ROLL, Opcodes.OP_DROP,
    ...num(1), Opcodes.OP_ROLL, Opcodes.OP_DROP, // [kept, tail]
    // Beneath the parked count, which the segment walk reads from the top.
    Opcodes.OP_SWAP, Opcodes.OP_FROMALTSTACK, Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK, Opcodes.OP_TOALTSTACK,
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
 * Steps over every segment the block declares, by the length each leads with.
 *
 * Entry `[..., tail]`, exit `[..., tail']` past the segments, with the declared call count parked on the alt stack:
 * the block declares one segment more. The records are not read here: a covered frame's are its validator's to
 * hold to the codec and to settle (V2, V7), and a standalone frame's its own settlement walk's.
 */
function segmentLoopScript(): number[] {
  return [
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_ADD,
    Opcodes.OP_SWAP, // [count, tail]
    Opcodes.OP_BEGIN,
    ...skipSegmentScript(),
    Opcodes.OP_SWAP, Opcodes.OP_1SUB, Opcodes.OP_SWAP,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_NIP,
  ];
}

/**
 * Steps over every segment as `segmentLoopScript` does, keeping them for the body's reads of its records, and parks
 * the base of the record block the first segment's first record names.
 *
 * Entry `[..., tail]`, exit `[..., tail']`. The segments are kept as the block writes them, each led by its length,
 * and parked on the alt stack (`segmentsSlotName`) above the record base, so a read steps over a segment with one
 * cut and scans only the bytes of the segment it resolves against. The base is the first record's input and output
 * indices less one, input side first; a first segment that declares no record parks the no-index sentinel instead.
 */
function segmentLoopKeepingSegmentsScript(): number[] {
  const num = (value: number): number[] => [...encodeDataPush(scriptNumber(value))];
  return [
    Opcodes.OP_0, Opcodes.OP_SWAP, // [kept, tail]
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK,
    ...num(1), Opcodes.OP_ADD,
    Opcodes.OP_SWAP, // [kept, count, tail]
    Opcodes.OP_BEGIN,
    ...num(2), Opcodes.OP_SPLIT, // [kept, count, length, rest]
    Opcodes.OP_OVER, ...unsignedLength(), Opcodes.OP_SPLIT, // [kept, count, length, segment, rest']
    Opcodes.OP_TOALTSTACK, Opcodes.OP_CAT, // [kept, count, lengthAndSegment]
    Opcodes.OP_ROT, Opcodes.OP_SWAP, Opcodes.OP_CAT, Opcodes.OP_SWAP, Opcodes.OP_1SUB, // [kept', count - 1]
    Opcodes.OP_FROMALTSTACK, // [kept', count - 1, rest']
    ...num(1), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_NIP, Opcodes.OP_SWAP, // [tail', kept]
    // The first segment's record count, two bytes past its length.
    Opcodes.OP_DUP, ...num(4), Opcodes.OP_SPLIT, Opcodes.OP_DROP, ...num(2), Opcodes.OP_SPLIT, Opcodes.OP_NIP,
    ...unsignedLength(),
    Opcodes.OP_IF,
    ...parkFirstRecordBase(),
    Opcodes.OP_ELSE,
    ...parkAbsentRecordBase(),
    Opcodes.OP_ENDIF,
    Opcodes.OP_TOALTSTACK,
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
 * Park the base of the record block the first record of the kept segments declares, without consuming them.
 *
 * Entry `[..., kept]`, exit the same with the base of the first record's input block and of its output block parked
 * on the alt stack, input first. The two index fields lead the record, four bytes into its segment.
 */
function parkFirstRecordBase(): number[] {
  const num = (value: number): number[] => [...encodeDataPush(scriptNumber(value))];
  return [
    Opcodes.OP_DUP, ...num(8), Opcodes.OP_SPLIT, Opcodes.OP_DROP, ...num(4), Opcodes.OP_SPLIT, Opcodes.OP_NIP,
    ...num(2), Opcodes.OP_SPLIT, // [kept, in, out]
    Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_1SUB, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_BIN2NUM, Opcodes.OP_1SUB, Opcodes.OP_TOALTSTACK,
  ];
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
export function eventSection(maxEventCount: number, ownerBelowTail: boolean): number[] {
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
 * `eventSection(maxEventCount, true)` over a count on top of the tail rather than one built in: entry
 * `[..., owner, tail, maxEventCount]` with the count at least one, exit as the unrolled walk leaves it. The loop keeps
 * `[owner, declared, maxEventCount, rest, position]`, so the owner sits six items below a category just read.
 */
function eventLoopSection(): number[] {
  return [
    Opcodes.OP_TOALTSTACK,
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, // [owner, rest, declared]
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_2DUP, Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_VERIFY,
    Opcodes.OP_ROT, // [owner, declared, max, rest]
    Opcodes.OP_1NEGATE, Opcodes.OP_TOALTSTACK, Opcodes.OP_0,
    Opcodes.OP_BEGIN,
    ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK, Opcodes.OP_OVER, Opcodes.OP_GREATERTHAN, Opcodes.OP_IF,
    Opcodes.OP_SWAP, ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, // [.., position, rest', out]
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY,
    ...encodeDataPush(scriptNumber(6)), Opcodes.OP_PICK, Opcodes.OP_UTXOTOKENCATEGORY,
    ...encodeDataPush(scriptNumber(32)), Opcodes.OP_SPLIT, Opcodes.OP_DROP, Opcodes.OP_EQUALVERIFY,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_OVER, Opcodes.OP_LESSTHAN, Opcodes.OP_VERIFY,
    Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK, Opcodes.OP_TOALTSTACK, Opcodes.OP_SWAP,
    Opcodes.OP_ELSE,
    Opcodes.OP_FROMALTSTACK,
    ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_BIN2NUM, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_TOALTSTACK,
    Opcodes.OP_ENDIF,
    Opcodes.OP_1ADD, Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK, Opcodes.OP_NUMEQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_DROP, Opcodes.OP_NIP, // [owner, declared, rest]
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_DROP,
    Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK,
  ];
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
export function sendSection(count: number): number[] {
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
 * `sendSection` over a count on top of the tail rather than one built in: entry `[..., tail, count]` with the count
 * at least one, exit as `sendSection(count)` leaves it. The loop keeps `[declared, count, rest, position]`.
 */
function sendLoopSection(): number[] {
  return [
    Opcodes.OP_TOALTSTACK,
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, // [rest, declared]
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_2DUP, Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_VERIFY,
    Opcodes.OP_ROT, Opcodes.OP_0, // [declared, count, rest, 0]
    Opcodes.OP_BEGIN,
    ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK, Opcodes.OP_OVER, Opcodes.OP_GREATERTHAN, Opcodes.OP_IF,
    Opcodes.OP_SWAP, ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_SWAP,
    Opcodes.OP_ELSE,
    ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_BIN2NUM, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_ENDIF,
    Opcodes.OP_1ADD, Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK, Opcodes.OP_NUMEQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_DROP, Opcodes.OP_NIP, // [declared, rest]
    Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK,
  ];
}

/**
 * Consumes the event list as a run, requiring every listed output to carry the records' owner's category with no
 * capability, and parks the run's first output and the declared count.
 *
 * A body that emits from a loop emits as many events as the loop turns, so no fixed number of positions holds them:
 * the listed outputs must be consecutive instead, and a body binds its k-th event at the run's first output plus
 * `k`. Consecutive outputs are distinct and in order, which the fixed walk requires of its positions too. The owner
 * is read as `eventSection` reads it.
 */
function eventRunSection(ownerBelowTail: boolean): number[] {
  // `[owner, n, k, rest, out, category]`: the owner sits five items below the category just read.
  const owner = ownerBelowTail
    ? [...encodeDataPush(scriptNumber(5)), Opcodes.OP_PICK]
    : [Opcodes.OP_INPUTINDEX];
  return runSection([
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY,
    ...owner, Opcodes.OP_UTXOTOKENCATEGORY, ...encodeDataPush(scriptNumber(32)), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
    Opcodes.OP_EQUALVERIFY,
  ]);
}

/**
 * Consumes the send list as a run, parking its first output and the declared count.
 *
 * A body that sends from a loop sends as many times as the loop turns, so the listed outputs must be consecutive and
 * a body pins its k-th send at the run's first output plus `k`. What each output is, its lock and its value, only the
 * body knows, so the walk checks the run's shape alone.
 */
function sendRunSection(): number[] {
  return runSection([]);
}

/**
 * Consumes a list of `u16` output indices that must be consecutive, running `check` on each, and parks the first
 * index, or the no-index sentinel for an empty list, beneath the declared count.
 *
 * Entry `[..., tail]`, exit `[..., tail']`; `check` runs on `[..., n, k, rest, out]` and leaves it as it found it.
 * The count is read unsigned, as the validator reads it, and bounds the walk; a list shorter than it declares fails
 * the split that reads past its end.
 */
function runSection(check: readonly number[]): number[] {
  const num = (value: number): Uint8Array => encodeDataPush(scriptNumber(value));
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, ...unsignedLength(), Opcodes.OP_SWAP,
    // `[n, rest]`: the first index, read without consuming it, or the sentinel.
    Opcodes.OP_OVER, Opcodes.OP_0, Opcodes.OP_GREATERTHAN, Opcodes.OP_IF,
    Opcodes.OP_DUP, ...takeFixedWidthField(2), Opcodes.OP_DROP, Opcodes.OP_BIN2NUM,
    Opcodes.OP_ELSE,
    ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_BIN2NUM,
    Opcodes.OP_ENDIF,
    Opcodes.OP_TOALTSTACK,
    // `[n, k, rest]`: every entry is checked and must be the first index plus its position.
    Opcodes.OP_0, Opcodes.OP_SWAP,
    ...num(2), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_GREATERTHAN, Opcodes.OP_IF,
    Opcodes.OP_BEGIN,
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
    ...check,
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK,
    ...num(3), Opcodes.OP_PICK, Opcodes.OP_ADD, Opcodes.OP_NUMEQUALVERIFY,
    Opcodes.OP_SWAP, Opcodes.OP_1ADD, Opcodes.OP_SWAP,
    Opcodes.OP_OVER, ...num(3), Opcodes.OP_PICK, Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_ENDIF,
    // Park the declared count above the first index.
    Opcodes.OP_NIP, Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK,
  ];
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

/** The frame kinds of the calls that run on the caller's records, `DELEGATE` and `INTERNAL`, as `[low, high)`. */
const CONTEXT_CALL_KINDS = [3, 5] as const;

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
 *
 * With `definesFramework`, the master then defines the framework library the program opens with
 * (framework-library.ts). The hash just checked covers that push, so the bytes cut from it are the registrar this
 * compiler built; defined under its identifier and invoked once, it defines every routine. Entry and exit stay the
 * same.
 */
export function recogniseValidatorScriptAgainstReservedHash(definesFramework = false): Uint8Array {
  return new Uint8Array([
    Opcodes.OP_DUP, Opcodes.OP_UTXOTOKENCATEGORY,
    // The category plus its capability byte: 33 bytes, and a mutable NFT is capability 0x01.
    Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP,
    ...encodeDataPush(scriptNumber(33)), Opcodes.OP_NUMEQUALVERIFY,
    Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(32)), Opcodes.OP_SPLIT, Opcodes.OP_NIP,
    ...encodeDataPush(new Uint8Array([TokenCapability.MUTABLE])), Opcodes.OP_EQUALVERIFY,
    // The redeem script: the last push of the validator's unlocking bytecode, after the transcript. The pin and the
    // program are thousands of bytes, so the push is `OP_PUSHDATA2` and its header three bytes; what follows the
    // header is the redeem, whose hash256 the P2SH32 check below binds to the input's lock (so no other bytes, and
    // nothing after them, pass it).
    Opcodes.OP_1, Opcodes.OP_PICK, Opcodes.OP_INPUTBYTECODE,
    ...dropFirstPushScript(), ...encodeDataPush(scriptNumber(3)), Opcodes.OP_SPLIT, Opcodes.OP_NIP,
    // The redeem runs only when this input's lock is P2SH32 of it. Require that, and require the pin push to
    // open with the 33-byte push opcode. A bare lock replaying the unlocking is not a validator.
    Opcodes.OP_DUP,
    ...encodeDataPush(scriptNumber(1)), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
    ...encodeDataPush(new Uint8Array([0x21])), Opcodes.OP_EQUALVERIFY,
    Opcodes.OP_DUP, Opcodes.OP_HASH256,
    ...encodeDataPush(new Uint8Array([0xaa, 0x20])), Opcodes.OP_SWAP, Opcodes.OP_CAT,
    ...encodeDataPush(new Uint8Array([0x87])), Opcodes.OP_CAT,
    ...encodeDataPush(scriptNumber(3)), Opcodes.OP_PICK, Opcodes.OP_UTXOBYTECODE, Opcodes.OP_EQUALVERIFY,
    // `push(pin(c)) || program`. The push is 34 bytes; the program after it must hash to the reserved slot, four
    // items below the computed hash.
    ...encodeDataPush(scriptNumber(VALIDATOR_PIN_PUSH_LENGTH)), Opcodes.OP_SPLIT,
    ...(definesFramework
      ? [
        // `[.., pinPush, program]`: the program is kept past its check, then cut down to the registrar.
        Opcodes.OP_DUP, Opcodes.OP_SHA256, ...encodeDataPush(scriptNumber(5)), Opcodes.OP_PICK, Opcodes.OP_EQUALVERIFY,
        ...encodeDataPush(scriptNumber(frameworkRegistrarOffset())), Opcodes.OP_SPLIT, Opcodes.OP_NIP,
        ...encodeDataPush(scriptNumber(frameworkRegistrar().length)), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
        ...encodeDataPush(encodeInt(FRAMEWORK_REGISTRAR_ID)), Opcodes.OP_DEFINE,
        ...encodeDataPush(encodeInt(FRAMEWORK_REGISTRAR_ID)), Opcodes.OP_INVOKE,
      ]
      : [Opcodes.OP_SHA256, ...encodeDataPush(scriptNumber(4)), Opcodes.OP_PICK, Opcodes.OP_EQUALVERIFY]),
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
 * record holds at the segment's start and at its end. This walk turns those declarations into one transition per
 * record: the first begins at the commitment the transaction spends, every later one carries on from the one before
 * it, and the last ends at the commitment the transaction writes; a record the transaction creates has no input
 * index, so it begins at the empty commitment rather than at one an input carries. The same walk checks that the
 * state UTXOs spent and the state outputs written are exactly the records declared.
 *
 * It also counts the outputs whose token is the bare category, which the head's census makes immutable NFTs, and
 * holds the count to the events the frame declares (spec S2). The tail walk proved each listed event a distinct such
 * output, so no unlisted one remains.
 *
 * A record is named by its index, kept at its own index or created or deleted there (the shape check refuses a
 * move), so the walk keeps one entry per index the transaction has: whether the index was read and whether it is
 * written back, and where in the segment section the view the record was last declared with sits. The declarations
 * are walked once, in execution order, each updating the entry of the index it names; then every index is visited
 * once for the commitment it ends at and the census. Each check compares the views themselves, the operands in the
 * order a derivation reads a close by. The table rides on the alt stack while the declarations are read, so the
 * block's remainder stays on top for the field readers, and the block is read from the transaction once.
 *
 * A send is paid from the contract's containers (spec 4b), never from a record, so a record written back keeps at
 * least the value it held whether or not the entry sends.
 */
export interface SelfSettlementShape {
  /** Where the contract address's payload sits in the running script, for the census. */
  readonly addressPayloadOffset: number;
}

/**
 * One index's entry in the settlement table: a flag byte, then where the record's last view sits in the segment
 * section, as the two-byte offset of that `viewOut`'s length field (zero when the chain ended in a deletion).
 */
const SETTLEMENT_ENTRY_BYTES = 3;
/** The flag bits of an entry: the record was read at the index, and it is written back there. */
const SEEN_IN = 0x01;
const SEEN_OUT = 0x02;
/** A declaration's two index fields and its views' two length fields, which lie before its `viewIn` payload. */
const DECLARATION_VIEW_IN_OFFSET = 8;

/** The raw `outLen` of a declaration its segment leaves as it found it, whose `viewOut` is its `viewIn`. */
const KEPT_VIEW_LENGTH_RAW = new Uint8Array([KEPT_VIEW_LENGTH & 0xff, KEPT_VIEW_LENGTH >>> 8]);

export function selfSettlementScript(shape: SelfSettlementShape): Uint8Array {
  const { addressPayloadOffset } = shape;
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  const num = (value: number): Uint8Array => encodeDataPush(scriptNumber(value));
  const flag = (value: number): Uint8Array => encodeDataPush(new Uint8Array([value]));
  const pick = (depth: number): void => { emit(num(depth), Opcodes.OP_PICK); };
  const roll = (depth: number): void => { emit(num(depth), Opcodes.OP_ROLL); };
  /** `[table, index]` to `[flags, offset]`: the entry at the index. */
  const entryAt = (): void => {
    emit(num(SETTLEMENT_ENTRY_BYTES), Opcodes.OP_MUL, Opcodes.OP_SPLIT, Opcodes.OP_NIP);
    emit(num(SETTLEMENT_ENTRY_BYTES), Opcodes.OP_SPLIT, Opcodes.OP_DROP);
    emit(num(1), Opcodes.OP_SPLIT, Opcodes.OP_BIN2NUM);
  };
  /** `[flags, offset]` to `[entry]`. */
  const packEntry = (): void => { emit(num(2), Opcodes.OP_NUM2BIN, Opcodes.OP_CAT); };
  /** `[entry, table, index]` to `[table']`: the table with the entry at the index replaced. */
  const writeEntry = (): void => {
    emit(num(SETTLEMENT_ENTRY_BYTES), Opcodes.OP_MUL, Opcodes.OP_SPLIT);
    emit(num(SETTLEMENT_ENTRY_BYTES), Opcodes.OP_SPLIT, Opcodes.OP_NIP);
    emit(Opcodes.OP_ROT, Opcodes.OP_SWAP, Opcodes.OP_CAT, Opcodes.OP_CAT);
  };
  /** `[flags]` to `[flags, bit]`: whether the entry carries `bit`, as a boolean. */
  const hasFlag = (bit: number): void => { emit(Opcodes.OP_DUP, flag(bit), Opcodes.OP_AND, flag(bit), Opcodes.OP_EQUAL); };
  /**
   * `[offset]` to `[view]`: the view the declaration an entry's offset names in the segment section, kept
   * `sectionDepth` items beneath the offset, ends at — its `viewOut`, or its `viewIn` when it is kept — or the
   * no-index sentinel a deletion leaves.
   */
  const viewAt = (sectionDepth: number): void => {
    emit(Opcodes.OP_DUP, Opcodes.OP_0, Opcodes.OP_NUMEQUAL, Opcodes.OP_IF);
    emit(Opcodes.OP_DROP, encodeDataPush(INDEX_NONE_BYTES));
    emit(Opcodes.OP_ELSE);
    pick(sectionDepth);
    emit(Opcodes.OP_SWAP, Opcodes.OP_SPLIT, Opcodes.OP_NIP);
    emit(num(DECLARATION_VIEW_IN_OFFSET), Opcodes.OP_SPLIT, Opcodes.OP_SWAP);
    emit(num(4), Opcodes.OP_SPLIT, Opcodes.OP_NIP, num(2), Opcodes.OP_SPLIT); // [views, inLen, outLen]
    emit(Opcodes.OP_DUP, encodeDataPush(KEPT_VIEW_LENGTH_RAW), Opcodes.OP_EQUAL, Opcodes.OP_IF);
    emit(Opcodes.OP_DROP, ...unsignedLength(), Opcodes.OP_SPLIT, Opcodes.OP_DROP);
    emit(Opcodes.OP_ELSE);
    emit(...unsignedLength(), Opcodes.OP_SWAP, ...unsignedLength());
    emit(Opcodes.OP_ROT, Opcodes.OP_SWAP, Opcodes.OP_SPLIT, Opcodes.OP_NIP, Opcodes.OP_SWAP, Opcodes.OP_SPLIT, Opcodes.OP_DROP);
    emit(Opcodes.OP_ENDIF);
    emit(Opcodes.OP_ENDIF);
  };
  /** The offset an entry ends at: the running declaration's own, `declarationDepth` items down. */
  const viewOutOffset = (declarationDepth: number): void => {
    pick(declarationDepth);
  };

  // The block, from the transaction once, walked to its first segment.
  emit(...readOwnWitnessBlockScript());
  emit(...dropPrefix(WITNESS_BLOCK_HEADER_LENGTH));
  emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
  emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
  emit(...takeFixedWidthField(8), Opcodes.OP_NIP);
  emit(...takeLengthPrefixedField32(), Opcodes.OP_NIP);
  // The call section is the block's own, so the walk steps over however many records it declares and keeps the
  // declared segment count as its segment counter.
  emit(...callSectionWalkScript());
  emit(Opcodes.OP_FROMALTSTACK, Opcodes.OP_1ADD, Opcodes.OP_SWAP);
  // The segment section is kept whole, with its length, so an entry can name a view by where it sits:
  // `[section, length, segments, tail]`.
  emit(Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_2SWAP);
  // The table, one zeroed entry per index the transaction has, parked on the alt stack.
  emit(Opcodes.OP_TXINPUTCOUNT, Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_MAX, num(SETTLEMENT_ENTRY_BYTES), Opcodes.OP_MUL);
  emit(Opcodes.OP_0, Opcodes.OP_SWAP, Opcodes.OP_NUM2BIN, Opcodes.OP_TOALTSTACK);

  // Every segment, in execution order. Main: [section, length, segments, tail]. Alt: [table].
  emit(Opcodes.OP_BEGIN);
  {
    // The segment's length leads it, then its record count.
    emit(...dropPrefix(2));
    emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP);
    // Main: [.., segments, count, tail]. A segment that declares nothing runs no declaration: the loop tests its
    // condition after the body, so the body is guarded rather than entered once for nothing.
    pick(1);
    emit(Opcodes.OP_0, Opcodes.OP_GREATERTHAN, Opcodes.OP_IF, Opcodes.OP_BEGIN);
    {
      // Where the declaration starts in the section, then its four fields, off the front of the tail.
      emit(Opcodes.OP_SIZE);
      pick(4);
      emit(Opcodes.OP_SWAP, Opcodes.OP_SUB, Opcodes.OP_TOALTSTACK);
      emit(...takeRecordFieldsScript()); // [.., in, out, viewIn, viewOut, tail]
      roll(4); emit(Opcodes.OP_TOALTSTACK); // in
      roll(3); emit(Opcodes.OP_TOALTSTACK); // out
      roll(2); emit(Opcodes.OP_TOALTSTACK); // viewIn
      emit(Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK); // viewOut
      emit(Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK);
      emit(Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK);
      // Main: [.., tail, viewOut, viewIn, out, in, at, table].
      pick(3);
      pick(3);
      emit(...requireRecordShape());
      roll(3);
      emit(Opcodes.OP_BIN2NUM);
      roll(3);
      emit(Opcodes.OP_BIN2NUM);
      // Main: [.., tail, viewOut, viewIn, at, table, out, in], the indices as numbers, the sentinel negative. The
      // walk settles only the indices the transaction has, so a declaration at any other names a record no input or
      // output carries, whose views a body would read on the frame's word: the larger index must be one the
      // transaction has, which also refuses a declaration with no index at all.
      emit(Opcodes.OP_2DUP, Opcodes.OP_MAX, Opcodes.OP_0, Opcodes.OP_TXINPUTCOUNT, Opcodes.OP_TXOUTPUTCOUNT);
      emit(Opcodes.OP_MAX, Opcodes.OP_WITHIN, Opcodes.OP_VERIFY);
      emit(Opcodes.OP_DUP, Opcodes.OP_0, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_IF);
      {
        // The declaration reads the record at `in`: `[.., table, out, in, flags, last]`.
        pick(2);
        pick(1);
        entryAt();
        pick(1);
        emit(flag(0), Opcodes.OP_EQUAL, Opcodes.OP_IF);
        {
          // Not seen yet: the chain starts at the commitment the transaction spends.
          pick(2);
          emit(Opcodes.OP_UTXOTOKENCOMMITMENT);
          pick(7); // viewIn
          emit(Opcodes.OP_EQUALVERIFY);
          // The value floor applies where the record is written back: a kept record keeps what it held.
          pick(3);
          emit(Opcodes.OP_0, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_IF);
          pick(2);
          emit(Opcodes.OP_OUTPUTVALUE);
          pick(3);
          emit(Opcodes.OP_UTXOVALUE, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY, Opcodes.OP_ENDIF);
          emit(Opcodes.OP_SWAP, flag(SEEN_IN), Opcodes.OP_OR, Opcodes.OP_SWAP);
        }
        emit(Opcodes.OP_ELSE);
        {
          // Seen: it carries on from the view the record was last declared with.
          pick(6); // viewIn
          pick(1);
          viewAt(14);
          emit(Opcodes.OP_EQUALVERIFY);
        }
        emit(Opcodes.OP_ENDIF);
        // Where the record goes: kept at its own index, or deleted, which ends the chain.
        emit(Opcodes.OP_DROP);
        pick(2);
        pick(2);
        emit(Opcodes.OP_NUMEQUAL, Opcodes.OP_IF);
        emit(flag(SEEN_OUT), Opcodes.OP_OR);
        viewOutOffset(4);
        emit(Opcodes.OP_ELSE);
        emit(flag(0xff ^ SEEN_OUT), Opcodes.OP_AND, Opcodes.OP_0);
        emit(Opcodes.OP_ENDIF);
        packEntry();
        roll(3);
        pick(2);
        writeEntry();
      }
      emit(Opcodes.OP_ELSE);
      {
        pick(1);
        emit(Opcodes.OP_0, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_IF);
        {
          // No input index: the record is created at `out`, from nothing, and once.
          pick(4); // viewIn
          emit(Opcodes.OP_0, Opcodes.OP_EQUALVERIFY);
          pick(2);
          pick(2);
          entryAt();
          emit(Opcodes.OP_DROP);
          hasFlag(SEEN_OUT);
          emit(Opcodes.OP_NOT, Opcodes.OP_VERIFY, flag(SEEN_OUT), Opcodes.OP_OR);
          viewOutOffset(4);
          packEntry();
          roll(3);
          pick(3);
          writeEntry();
        }
        emit(Opcodes.OP_ELSE);
        // No index at all, which the shape check already refused.
        roll(2);
        emit(Opcodes.OP_ENDIF);
      }
      emit(Opcodes.OP_ENDIF);
      // Main: [.., tail, viewOut, viewIn, at, out, in, table']: the table goes back, the fields go.
      emit(Opcodes.OP_TOALTSTACK, Opcodes.OP_2DROP, Opcodes.OP_2DROP, Opcodes.OP_DROP);
      roll(1);
      emit(Opcodes.OP_1SUB, Opcodes.OP_SWAP);
      // The loop repeats until this is true, so the condition is "no declaration is left".
      pick(1);
      emit(Opcodes.OP_0, Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_UNTIL);
    }
    emit(Opcodes.OP_ENDIF, Opcodes.OP_NIP);
    roll(1);
    emit(Opcodes.OP_1SUB, Opcodes.OP_SWAP);
    pick(1);
    emit(Opcodes.OP_0, Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_UNTIL);
  }
  // The spent counter goes, and the remainder leaves the declared event count, read as the tail walk read it.
  emit(Opcodes.OP_NIP, ...takeFixedWidthField(2), Opcodes.OP_DROP, Opcodes.OP_BIN2NUM);

  // Every index once. Main: [section, length, table, address, declared, seen, index].
  emit(Opcodes.OP_FROMALTSTACK, Opcodes.OP_SWAP, ...pushContractAddress(addressPayloadOffset), Opcodes.OP_SWAP);
  emit(Opcodes.OP_0, Opcodes.OP_0);
  emit(Opcodes.OP_BEGIN);
  {
    pick(4);
    pick(1);
    entryAt();
    // [.., index, flags, last]: a record written back ends at the commitment the transaction writes.
    emit(Opcodes.OP_SWAP);
    hasFlag(SEEN_OUT);
    emit(Opcodes.OP_ROT, Opcodes.OP_SWAP, Opcodes.OP_IF, Opcodes.OP_DUP);
    viewAt(9);
    pick(3);
    emit(Opcodes.OP_OUTPUTTOKENCOMMITMENT, Opcodes.OP_EQUALVERIFY, Opcodes.OP_ENDIF);
    emit(Opcodes.OP_DROP);
    // [.., table, address, declared, seen, index, flags]: the census at the index, on either side.
    emit(...indexCensusScript('input', 4), ...indexCensusScript('output', 4));
    emit(Opcodes.OP_DROP);
    // [.., declared, seen, index]: a bare own-category output is counted, and the count never passes the events
    // listed.
    emit(Opcodes.OP_DUP, Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_LESSTHAN, Opcodes.OP_IF);
    emit(Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY, Opcodes.OP_INPUTINDEX, Opcodes.OP_UTXOTOKENCATEGORY);
    emit(num(32), Opcodes.OP_SPLIT, Opcodes.OP_DROP, Opcodes.OP_EQUAL);
    emit(Opcodes.OP_ELSE, Opcodes.OP_0, Opcodes.OP_ENDIF);
    emit(Opcodes.OP_ROT, Opcodes.OP_ADD);
    pick(2);
    emit(Opcodes.OP_OVER, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY, Opcodes.OP_SWAP);
  }
  emit(Opcodes.OP_1ADD);
  emit(Opcodes.OP_DUP);
  emit(Opcodes.OP_TXINPUTCOUNT, Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_MAX);
  emit(Opcodes.OP_GREATERTHANOREQUAL);
  emit(Opcodes.OP_UNTIL);
  emit(Opcodes.OP_2DROP, Opcodes.OP_2DROP, Opcodes.OP_2DROP, Opcodes.OP_DROP);
  return new Uint8Array(bytes);
}

/**
 * Requires the transaction to carry a state token at the index under test exactly when the walk said it does.
 *
 * Entry and exit `[.., index, flags]`, where `flags` is the index's settlement entry flag byte and the contract
 * address the walk read once sits `addressDepth` items beneath `flags`. The index is visited whatever side it names,
 * and the side that has no item at that index is skipped rather than read. A validator of the contract's own category
 * is recreated in place at the contract address carrying the same mutable token a record does with an empty
 * commitment, and that index is not a record: the census admits exactly that token beside the ones the walk saw.
 */
function indexCensusScript(side: 'input' | 'output', addressDepth: number): number[] {
  const countOpcode = side === 'input' ? Opcodes.OP_TXINPUTCOUNT : Opcodes.OP_TXOUTPUTCOUNT;
  const otherCountOpcode = side === 'input' ? Opcodes.OP_TXOUTPUTCOUNT : Opcodes.OP_TXINPUTCOUNT;
  const tokenOpcode = side === 'input' ? Opcodes.OP_UTXOTOKENCATEGORY : Opcodes.OP_OUTPUTTOKENCATEGORY;
  const bit = encodeDataPush(new Uint8Array([side === 'input' ? SEEN_IN : SEEN_OUT]));
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  const pick = (depth: number): void => { emit(encodeDataPush(scriptNumber(depth)), Opcodes.OP_PICK); };

  pick(1);
  emit(countOpcode, Opcodes.OP_LESSTHAN);
  emit(Opcodes.OP_IF);
  {
    // What the transaction carries at the index, against the token a record is pinned with, and the flag the walk
    // ended at.
    pick(1);
    emit(tokenOpcode, ...mutableRecordPin(), Opcodes.OP_EQUAL);
    pick(1);
    emit(bit, Opcodes.OP_AND, bit, Opcodes.OP_EQUAL, Opcodes.OP_EQUAL);
    // Or a validator of the contract's own category, recreated in place at the contract address: both sides exist
    // at the index, both locks are the address, and both tokens are the mutable one a record carries, with the
    // empty commitment a validator is deployed with.
    pick(2);
    emit(countOpcode, Opcodes.OP_LESSTHAN);
    pick(3);
    emit(otherCountOpcode, Opcodes.OP_LESSTHAN, Opcodes.OP_BOOLAND);
    emit(Opcodes.OP_IF);
    {
      // One copy of the index serves every read: `[index, admitted]`, the index dropped at the end.
      pick(2);
      emit(Opcodes.OP_DUP, Opcodes.OP_UTXOBYTECODE);
      pick(addressDepth + 3);
      emit(Opcodes.OP_EQUAL, Opcodes.OP_OVER, Opcodes.OP_OUTPUTBYTECODE);
      pick(addressDepth + 4);
      emit(Opcodes.OP_EQUAL, Opcodes.OP_BOOLAND);
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
