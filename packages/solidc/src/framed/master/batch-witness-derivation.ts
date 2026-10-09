/**
 * Deriving a sorted-batch transition's witnesses from a master's own witness block.
 *
 * The direct convention receives the sorted-batch operands from its SDK: per target, the masked slot, the input
 * index the write proves against, the successor the written node carries and the output the rewritten predecessor
 * is recreated at, and once how many records the execution creates. A framed master has no such SDK operand list,
 * but its own witness block already declares, per segment, every record the execution touches as
 * `{ in, out, viewIn, viewOut }`. This builder reads that block back and leaves the operands the existing
 * verification already consumes, so no verification check changes.
 *
 * The operands, and where each comes from:
 *
 *   Slot      the masked `sha256` of the target key, computed in script from the key value on the stack
 *   Proof     the proof record's input index, relative to the input the frame's records are addressed from; for a
 *             record named at its output alone, `-(out + 1)` relative to the same input
 *   Next      the successor the written node carries
 *   PredOut   the output the predecessor is recreated at, or the direct convention's `-1` for an update
 *   Trailing  the distinct predecessors the execution rewrites
 *   Extra     the records the segment declares past the groups, which only the value chunks the body pins may be
 */

import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import {
  WITNESS_BLOCK_HEADER_LENGTH,
  dropPrefix,
  readOwnWitnessBlockScript,
  takeLengthPrefixedField,
  takeLengthPrefixedField32,
} from './witness-reader.js';
import { callSectionWalkScript } from './frame-tail.js';
import { declaredSegmentsSkipRuntimeScript, declaredSegmentsSkipScript } from './declared-view.js';

/**
 * The tracked slot names one derivation supplies per target, in the order the caller registers them, then the
 * trailing count; the extra-record count is registered last, on top.
 */
export const BATCH_DERIVATION_SLOT_ORDER = ['Slot', 'Proof', 'Next', 'PredOut', 'Trailing'] as const;

export type BatchDerivationSlot = (typeof BATCH_DERIVATION_SLOT_ORDER)[number];

/** The tracked name one target's operand lives in; the trailing count is one per function rather than per target. */
export function batchDerivationSlotName(kind: BatchDerivationSlot, slotIndex: number): string {
  if (kind === 'Trailing') return '__internal__vmapBatchTrailingCount';
  return `__internal__vmapBatch${kind}_${slotIndex}`;
}

/** The tracked name of the records the segment declares past the groups: the value chunks the body must pin. */
export const BATCH_EXTRA_RECORDS_SLOT = '__internal__vmapBatchExtraRecords';

/** The `PredOut` of a target whose skipped write its group declares as one kept record: an inactive row's. */
export const SKIPPED_TARGET_SENTINEL = -2n;

/** The u16 index the codec reserves for a record with no input or no output, as a script number. */
const INDEX_NONE_BYTES = new Uint8Array([0xff, 0xff]);

/** A script number in its minimal push form. */
function minimalNumber(value: number): Uint8Array {
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

export interface BatchTargetsDerivationOptions {
  /** Top-relative depths of each target's keys, in target order and, inside a target, in source order. */
  readonly keyDepths: readonly (readonly number[])[];
  /**
   * How many records a segment declares at the head of its record list for the frame's own contract state.
   *
   * A framed frame declares its own data-NFT state records before any mapping target's group, so the walk steps
   * over that many records before reading the first group. Absent means none.
   */
  readonly leadingRecords?: number;
  /**
   * The bottom ordinal of the tracked slot holding the input the frame's records belong to, when the frame runs on
   * another contract's records.
   *
   * A proof operand is the group's input coordinate less the input its records are addressed from, and the reader
   * of that operand adds the same input back. A frame that borrowed its records addresses them from its caller's
   * input, which is not the input the frame runs on, so the operand has to be measured from that one. Absent means
   * the frame's own input.
   */
  readonly recordsOwnerOrdinal?: number;
  /**
   * The segment the write's records are declared in, as the number of external calls the body makes before it.
   *
   * The walk steps over that many segments after the call section, so the record list it reads is the one the
   * write lands in rather than the one the body begins in. Absent means the body's first segment.
   */
  readonly segmentIndex?: number;
  /**
   * Whether the segment is the one the run's own declared call count names, taken from the block as the walk runs.
   *
   * A body whose calls the source does not fix reaches a segment only its execution names, and a write no call
   * follows lands in the last segment — the one whose index is the number of call records the block declares. The
   * walk then steps over that many segments instead of a compile-time count. Mutually exclusive with `segmentIndex`.
   */
  readonly segmentFromDeclaredCallCount?: boolean;
  /**
   * The positions, in target order, of the targets whose write a branch guards, which a frame may skip.
   *
   * A frame that skips such a write declares its group as one kept record that is not the target's node: the node
   * itself for a key the list holds reads as an update, so the record is the key's predecessor, kept as the proof of
   * its absence. Its `PredOut` is the `-2` an inactive row carries, which the write site refuses if the write runs.
   */
  readonly skippableTargets?: readonly number[];
  /**
   * Where an earlier round of the same derivation stopped, when this round continues its walk.
   *
   * A key the body reads out of a node its own batch writes is read through the operands that node's group yields,
   * so such a body is derived in rounds, and its code emits a round's keys once the rounds before it are derived. A
   * later round takes the record list where the earlier one left it rather than walking the block again, and counts
   * the trailing region over every round's targets, the earlier ones by their `PredOut` operands.
   */
  readonly resume?: {
    /** Top-relative depth of the rest of the record list the earlier round left. */
    readonly recordsDepth: number;
    /** Top-relative depth of the record count the segment declares, as the earlier round took it. */
    readonly declaredDepth: number;
    /** Top-relative depths of every earlier round's `PredOut` operands, in group order. */
    readonly priorPredOutDepths: readonly number[];
  };
  /**
   * Whether a later round continues the walk: the script then leaves the rest of the record list and the declared
   * count above its operands, the count on top, in place of `Trailing` and `Extra`.
   */
  readonly continues?: boolean;
}

/**
 * Builds the script that leaves every target of one batch's five sorted-batch operands, reading the master's own
 * witness block.
 *
 * The write's segment declares one record group per target, after `leadingRecords` records the frame declares
 * for its own contract state, in the order the writes were planned: a target the
 * inventory holds is rewritten in place, so its group is one record whose `viewIn` and `viewOut` both carry the
 * target's slot; a target the inventory does not hold is spliced in, so its group is the relinked predecessor
 * followed by the created node. The created node's `viewOut` carries the target slot, which is what tells the two
 * groups apart. The composer writes the group in that order, so the walk reads the group's first record, compares
 * its `viewOut` slot with the target's own slot, and reads a second record only for the insert case.
 *
 * Per target the script leaves `[Slot, Proof, Next, PredOut]` with the target's fixed `-1` predecessor output for an
 * update and the predecessor's recreated output for an insert, then once for the batch `Trailing`, the number of
 * distinct predecessors the execution rewrites, and `Extra` on top: the records the segment declares past its state
 * records and the groups. Settlement admits a created record wherever a frame declares one, so the body holds
 * `Extra` to the value chunks it pins. The script never reorders the frame: operands are parked on the alternate
 * stack as they are found and moved back in ABI order at the end, and it consumes everything it pushes above the
 * frame. A round that `resume`s an earlier one consumes the record list and count that round left, and a round that
 * `continues` leaves them for the next.
 */
export function buildBatchTargetsDerivationScript(options: BatchTargetsDerivationOptions): Uint8Array {
  const builder = new BatchTargetsDerivationBuilder(options);
  return builder.build();
}

/**
 * Emits one batch's per-target derivation, tracking the modelled main and alternate stacks so every depth and every
 * branch join is computed rather than hand-counted.
 */
class BatchTargetsDerivationBuilder {
  private readonly bytes: number[] = [];
  /** Modelled main stack, top first. */
  private main: string[] = [];
  /** Modelled alternate stack, top first. */
  private alt: string[] = [];
  private fresh = 0;

  constructor(private readonly options: BatchTargetsDerivationOptions) {
    const resume = options.resume;
    const depths = [
      ...options.keyDepths.flat(),
      ...(resume === undefined ? [] : [resume.recordsDepth, resume.declaredDepth, ...resume.priorPredOutDepths]),
    ];
    const deepest = depths.reduce((max, depth) => Math.max(max, depth), 0);
    for (let depth = 0; depth <= deepest; depth += 1) this.main.push(`frame_${depth}`);
  }

  /** Picks the frame value a key sits at, by the depth it had when the script began. */
  private pickKey(depth: number, name: string): void {
    this.num(this.main.indexOf(`frame_${depth}`));
    this.op(Opcodes.OP_PICK);
    this.main.unshift(`${name}~${this.fresh++}`);
  }

  build(): Uint8Array {
    const count = this.options.keyDepths.length;
    this.pushSlots(count);
    if (this.options.resume === undefined) this.readToRecordList();
    else this.resumeRecordList();
    for (let target = 0; target < count; target += 1) this.deriveTarget(target);
    if (this.options.continues === true) this.carry(count);
    else this.finish(count);
    return new Uint8Array(this.bytes);
  }

  // --- The three phases ---------------------------------------------------------------------------------------

  /** Computes each target's masked slot from its keys and leaves all of them above the frame. */
  private pushSlots(count: number): void {
    for (let target = 0; target < count; target += 1) {
      const keys = this.options.keyDepths[target]!;
      keys.forEach((depth, index) => {
        this.pickKey(depth, `key_${target}_${index}`);
        this.unary(Opcodes.OP_SHA256, 'hash');
        if (index > 0) this.binary(Opcodes.OP_CAT, `key_hashes_${target}`);
      });
      if (keys.length > 1) this.unary(Opcodes.OP_SHA256, `key_hashes_${target}`);
      this.splitConst(31, 'slot_head', 'slot_low');
      this.pushBytes('low', new Uint8Array([0x7f]));
      this.binary(Opcodes.OP_AND, 'slot_low_masked');
      this.binary(Opcodes.OP_CAT, `slot_${target}`);
    }
  }

  /** Pushes the block, steps over the frame's own fields and every call record, and leaves the record list. */
  private readToRecordList(): void {
    this.push('block', readOwnWitnessBlockScript());
    this.raw(dropPrefix(WITNESS_BLOCK_HEADER_LENGTH));
    this.dropLengthField(); // sender
    this.dropLengthField(); // self
    this.dropFixedField(8); // value
    this.dropLengthField32(); // retval
    // The call section is the block's own: step over the records it declares and require the segment count to be
    // their successor. The declared count the walk parks on the alt stack is spent here, so the modelled stacks
    // are as the walk found them.
    this.raw(new Uint8Array(callSectionWalkScript()));
    // The call-section walk leaves the declared call count parked on the alt stack. The write's records are
    // declared in the segment the write lands in: a fixed count names it outright, and a write whose segment the
    // execution decides — one no call follows — is reached at the segment the declared count itself names.
    this.raw(new Uint8Array([Opcodes.OP_FROMALTSTACK]));
    if (this.options.segmentFromDeclaredCallCount === true) {
      this.raw(declaredSegmentsSkipRuntimeScript());
    } else {
      this.raw(new Uint8Array([Opcodes.OP_DROP]));
      if ((this.options.segmentIndex ?? 0) > 0) {
        this.raw(declaredSegmentsSkipScript(this.options.segmentIndex!));
      }
    }
    this.takeFixedField(2, 'record_count');
    // The declared count is parked beneath the operands the walk parks, and checked once they are back.
    this.op(Opcodes.OP_SWAP);
    [this.main[0], this.main[1]] = [this.main[1]!, this.main[0]!];
    this.toAlt('declared_records');
    this.skipLeadingStateRecords();
    this.main[0] = 'records';
  }

  /** Takes the record list and the declared count an earlier round left, where `readToRecordList` leaves them. */
  private resumeRecordList(): void {
    const resume = this.options.resume!;
    this.rollFrame(resume.declaredDepth, 'declared_records');
    this.toAlt('declared_records');
    this.rollFrame(resume.recordsDepth, 'records');
  }

  /** Moves the frame item the script began with at `depth` to the top. */
  private rollFrame(depth: number, name: string): void {
    const index = this.main.indexOf(`frame_${depth}`);
    this.num(index);
    this.op(Opcodes.OP_ROLL);
    this.main.splice(index, 1);
    this.main.unshift(name);
  }

  /**
   * Steps over the records the frame's own contract state declares at the head of the record list.
   *
   * The list is the item on top, so each field read and drop leaves it in place: the modelled stack is unchanged.
   */
  private skipLeadingStateRecords(): void {
    for (let record = 0; record < (this.options.leadingRecords ?? 0); record += 1) {
      this.dropFixedField(2); // in
      this.dropFixedField(2); // out
      this.dropLengthField32(); // viewIn
      this.dropLengthField32(); // viewOut
    }
  }

  /** Derives one target's operands from its record group while the frame stays put. */
  private deriveTarget(target: number): void {
    // Park the target's slot first, so the batch's operands materialise in ABI order on the alternate stack.
    this.pick(`slot_${target}`);
    this.toAlt(`slot_result_${target}`);

    this.takeFixedField(2, `in0_${target}`);
    this.takeFixedField(2, `out0_${target}`);
    this.takeLengthField32(`view_in0_${target}`);
    this.takeLengthField32(`view_out0_${target}`);

    // The first record's written node carries the target slot exactly when the target is rewritten in place.
    this.pick(`view_out0_${target}`);
    this.dup();
    this.splitConst(32, 'node_slot', 'node_rest');
    this.drop(); // the trailing value of the copied commitment
    this.pick(`slot_${target}`);
    this.binary(Opcodes.OP_EQUAL, 'rewritten_in_place');

    if (!(this.options.skippableTargets ?? []).includes(target)) {
      this.branch(() => this.deriveUpdate(target), () => this.deriveInsert(target));
      return;
    }
    // A skippable target's other record is either an insert's relinked predecessor, which changes, or the kept
    // predecessor of a write the frame skipped. A predecessor an earlier group of the segment already left in its
    // final form is declared kept by an insert too, so past the first group a kept record is a skip only where the
    // record after it is not the node the insert creates.
    this.branch(() => this.deriveUpdate(target), () => {
      this.pick(`view_in0_${target}`);
      this.pick(`view_out0_${target}`);
      this.binary(Opcodes.OP_EQUAL, 'kept');
      if (target > 0 || this.options.resume !== undefined) {
        this.nextRecordCarriesSlot(target);
        this.unary(Opcodes.OP_NOT, 'creates_none');
        this.binary(Opcodes.OP_BOOLAND, 'kept');
      }
      this.branch(() => this.deriveSkipped(target), () => this.deriveInsert(target));
    });
  }

  /**
   * Leaves whether the record after the group's first is the node the target's insert creates: one no input holds,
   * declared from the empty view, whose view carries the target's slot.
   *
   * The walk's list runs on past the segment into the rest of the block, so the bytes after the group may be another
   * section's, of any shape: a copy is read, every field only where the bytes hold it, and anything that is not such
   * a record reads as none.
   */
  private nextRecordCarriesSlot(target: number): void {
    this.pick('records');
    // An in, an out and the two length fields of the views.
    this.op(Opcodes.OP_SIZE); this.num(12); this.op(Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_IF);
    this.num(2); this.op(Opcodes.OP_SPLIT, Opcodes.OP_SWAP);
    this.raw(encodeDataPush(INDEX_NONE_BYTES)); this.op(Opcodes.OP_EQUAL, Opcodes.OP_SWAP); // [none, rest]
    this.num(2); this.op(Opcodes.OP_SPLIT, Opcodes.OP_NIP); // out
    this.num(4); this.op(Opcodes.OP_SPLIT, Opcodes.OP_SWAP);
    this.raw(encodeDataPush(new Uint8Array(4))); this.op(Opcodes.OP_EQUAL); // the empty view in: [none, rest, empty]
    this.op(Opcodes.OP_ROT, Opcodes.OP_BOOLAND, Opcodes.OP_SWAP); // [created, rest]
    this.num(4); this.op(Opcodes.OP_SPLIT, Opcodes.OP_NIP); // the view out's length
    this.op(Opcodes.OP_SIZE); this.num(32); this.op(Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_IF);
    this.num(32); this.op(Opcodes.OP_SPLIT, Opcodes.OP_DROP);
    // Two items stand where the copy did: the flag beneath the view's slot.
    this.num(this.main.indexOf(`slot_${target}`) + 1); this.op(Opcodes.OP_PICK, Opcodes.OP_EQUAL);
    this.op(Opcodes.OP_ELSE, Opcodes.OP_DROP, Opcodes.OP_0, Opcodes.OP_ENDIF);
    this.op(Opcodes.OP_BOOLAND);
    this.op(Opcodes.OP_ELSE, Opcodes.OP_DROP, Opcodes.OP_0, Opcodes.OP_ENDIF);
    this.main[0] = 'creates';
  }

  /** One kept record that is not the target's node: the write was skipped, and the record proves the key absent. */
  private deriveSkipped(target: number): void {
    this.pushProofCoordinate(target);
    this.pushRecordsOwner('records_owner');
    this.binary(Opcodes.OP_SUB, 'proof');
    this.toAlt(`proof_${target}`);
    this.pick(`view_out0_${target}`);
    this.takeSuccessor();
    this.toAlt(`next_${target}`);
    this.raw(encodeDataPush(bigIntToVmNumber(SKIPPED_TARGET_SENTINEL)));
    this.main.unshift('skipped_sentinel');
    this.toAlt(`pred_out_${target}`);
    this.drop(); // the compared viewOut copy
    for (let field = 0; field < 4; field += 1) this.nip(); // in0, out0, viewIn0, viewOut0
  }

  /**
   * Leaves the coordinate the target's proof record is named at.
   *
   * A spent record is named by its input. A record named at its output alone, a node an earlier frame created,
   * carries the no-index sentinel there and is named by that output instead, as `-(out + 1)`: a coordinate below
   * every input, from which the master recovers the output without walking the segment again.
   */
  private pushProofCoordinate(target: number): void {
    this.pick(`in0_${target}`);
    this.unary(Opcodes.OP_BIN2NUM, 'proof_index');
    this.op(Opcodes.OP_DUP);
    this.raw(encodeDataPush(INDEX_NONE_BYTES));
    this.op(Opcodes.OP_NUMEQUAL, Opcodes.OP_IF, Opcodes.OP_DROP);
    // With the sentinel dropped, the output field sits one shallower than the model, which still counts it.
    this.num(this.main.indexOf(`out0_${target}`) - 1);
    this.op(Opcodes.OP_PICK, Opcodes.OP_BIN2NUM);
    this.op(Opcodes.OP_DUP, Opcodes.OP_0, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY);
    this.op(Opcodes.OP_1ADD, Opcodes.OP_NEGATE, Opcodes.OP_ENDIF);
  }

  /** One in-place record: the target's own input proves it and opens no predecessor output. */
  private deriveUpdate(target: number): void {
    this.pushProofCoordinate(target);
    this.pushRecordsOwner('records_owner');
    this.binary(Opcodes.OP_SUB, 'proof');
    this.toAlt(`proof_${target}`);
    this.pick(`view_out0_${target}`);
    this.takeSuccessor();
    this.toAlt(`next_${target}`);
    this.pushConst('update_sentinel', Opcodes.OP_1NEGATE);
    this.toAlt(`pred_out_${target}`);
    this.drop(); // the compared viewOut copy
    for (let field = 0; field < 4; field += 1) this.nip(); // in0, out0, viewIn0, viewOut0
  }

  /** A relinked predecessor then a created node: the predecessor proves the link and is recreated at its output. */
  private deriveInsert(target: number): void {
    this.drop(); // the compared viewOut copy
    this.takeFixedField(2, `in1_${target}`);
    this.takeFixedField(2, `out1_${target}`);
    this.takeLengthField32(`view_in1_${target}`);
    this.takeLengthField32(`view_out1_${target}`);
    this.pushProofCoordinate(target);
    this.pushRecordsOwner('records_owner');
    this.binary(Opcodes.OP_SUB, 'proof');
    this.toAlt(`proof_${target}`);
    this.pick(`view_out1_${target}`);
    this.takeSuccessor();
    this.toAlt(`next_${target}`);
    this.pick(`out0_${target}`);
    this.unary(Opcodes.OP_BIN2NUM, 'pred_out');
    // The relinked predecessor lands at an output the transaction writes. A negative index would read as the direct
    // convention's inactive-row sentinel, which skips a target's checks.
    this.op(Opcodes.OP_DUP, Opcodes.OP_0, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY);
    this.toAlt(`pred_out_${target}`);
    for (let field = 0; field < 8; field += 1) this.nip(); // the four fields of each record
  }

  /**
   * Moves this round's operands back to the main stack in ABI order, as `finish` does, then leaves the rest of the
   * record list and the declared count above them for the round that continues the walk.
   */
  private carry(count: number): void {
    for (let slot = 0; slot < count; slot += 1) this.nip(); // the original slots beneath the record list
    for (let parked = 0; parked < count * 4; parked += 1) this.fromAlt();
    this.reverseTopBlock(count * 4);
    this.num(this.main.indexOf('records'));
    this.op(Opcodes.OP_ROLL);
    this.main.splice(this.main.indexOf('records'), 1);
    this.main.unshift('records');
    this.fromAlt(); // the declared count
  }

  /** Moves the batch's operands back to the main stack in ABI order and appends the distinct-predecessor count. */
  private finish(count: number): void {
    this.drop(); // the consumed record list
    for (let slot = 0; slot < count; slot += 1) this.drop(); // the original slots, whose copies were parked

    for (let parked = 0; parked < count * 4; parked += 1) this.fromAlt();
    // Popping the alternate stack leaves the operands in target order, deepest first; the ABI reads them with the
    // last target nearest the top, so the block is reversed before the trailing count is appended.
    this.reverseTopBlock(count * 4);

    // The trailing region is the body's, so it counts every round's targets, an earlier round's first.
    const predOuts = [
      ...(this.options.resume?.priorPredOutDepths ?? []).map((depth) => `frame_${depth}`),
      ...Array.from({ length: count }, (_unused, target) => `pred_out_${target}`),
    ];
    this.pushConst('trailing', Opcodes.OP_0);
    for (let target = 0; target < predOuts.length; target += 1) {
      this.pick(predOuts[target]!);
      this.pushConst('zero', Opcodes.OP_0);
      this.binary(Opcodes.OP_GREATERTHANOREQUAL, 'rewrites_predecessor');
      for (let prior = 0; prior < target; prior += 1) {
        this.pick(predOuts[target]!);
        this.pick(predOuts[prior]!);
        this.binary(Opcodes.OP_NUMNOTEQUAL, 'distinct');
        this.binary(Opcodes.OP_BOOLAND, 'rewrites_predecessor');
      }
      this.pick('trailing');
      this.binary(Opcodes.OP_ADD, 'trailing_sum');
      const depth = this.main.indexOf('trailing');
      this.num(depth);
      this.op(Opcodes.OP_ROLL, Opcodes.OP_DROP);
      this.main.splice(depth, 1);
      this.main[0] = 'trailing';
    }

    // The groups consumed the frame's own state records, then one record per update or skipped write and two per
    // insert. What the segment declares past them is left as `Extra`, never negative, for the body to hold to its
    // value chunks.
    this.fromAlt();
    this.unary(Opcodes.OP_BIN2NUM, 'declared_count');
    this.num((this.options.leadingRecords ?? 0) + predOuts.length);
    this.main.unshift('consumed');
    for (const predOut of predOuts) {
      this.pick(predOut);
      this.pushConst('zero', Opcodes.OP_0);
      this.binary(Opcodes.OP_GREATERTHANOREQUAL, 'inserts');
      this.binary(Opcodes.OP_ADD, 'consumed');
    }
    this.binary(Opcodes.OP_SUB, 'extra');
    this.op(Opcodes.OP_DUP, Opcodes.OP_0, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY);
  }

  // --- Emitters that keep the modelled stacks in step with the bytes ------------------------------------------

  private num(value: number): void { this.bytes.push(...encodeDataPush(minimalNumber(value))); }

  private op(...opcodes: number[]): void { this.bytes.push(...opcodes); }

  private raw(script: Uint8Array): void { for (const byte of script) this.bytes.push(byte); }

  private push(name: string, script?: Uint8Array): void {
    if (script) this.raw(script);
    this.main.unshift(name);
  }

  private pushBytes(name: string, bytes: Uint8Array): void {
    this.bytes.push(...encodeDataPush(bytes));
    this.main.unshift(name);
  }

  private pushConst(name: string, opcode: number): void {
    this.op(opcode);
    this.main.unshift(name);
  }

  /** Leaves the input the frame's records are addressed from, modelling the one item it pushes. */
  private pushRecordsOwner(name: string): void {
    if (this.options.recordsOwnerOrdinal === undefined) {
      this.pushConst(name, Opcodes.OP_INPUTINDEX);
      return;
    }
    // As in the emitter's own bottom-ordinal reads, the depth is taken at run time so the items the script has
    // pushed above the frame do not have to be modelled.
    this.op(Opcodes.OP_DEPTH);
    this.num(this.options.recordsOwnerOrdinal);
    this.op(Opcodes.OP_SUB, Opcodes.OP_PICK);
    this.main.unshift(name);
  }

  private unary(opcode: number, name: string): void {
    this.op(opcode);
    this.main[0] = name;
  }

  private binary(opcode: number, name: string): void {
    this.op(opcode);
    this.main.shift();
    this.main.shift();
    this.main.unshift(name);
  }

  private dup(): void { this.op(Opcodes.OP_DUP); this.main.unshift(this.main[0]!); }

  private drop(): void { this.op(Opcodes.OP_DROP); this.main.shift(); }

  private nip(): void { this.op(Opcodes.OP_NIP); this.main.splice(1, 1); }

  private pick(name: string): void {
    const depth = this.main.indexOf(name);
    if (depth < 0) throw new Error(`batch derivation: '${name}' is not on the modelled stack`);
    this.num(depth);
    this.op(Opcodes.OP_PICK);
    this.main.unshift(`${name}~${this.fresh++}`);
  }

  private toAlt(name: string): void {
    this.op(Opcodes.OP_TOALTSTACK);
    this.main.shift();
    this.alt.unshift(name);
  }

  private fromAlt(): void {
    this.op(Opcodes.OP_FROMALTSTACK);
    const value = this.alt.shift();
    this.main.unshift(value ?? `alt~${this.fresh++}`);
  }

  private splitConst(position: number, first: string, remainder: string): void {
    this.num(position);
    this.op(Opcodes.OP_SPLIT);
    this.main.shift();
    this.main.unshift(first);
    this.main.unshift(remainder);
  }

  /** Reverses the `size` items on top of the main stack, moving the deepest to the top one at a time. */
  private reverseTopBlock(size: number): void {
    for (let moved = 0; moved < size; moved += 1) {
      const depth = size - 1 - moved;
      this.num(depth);
      this.op(Opcodes.OP_ROLL);
      const [top] = this.main.splice(depth, 1);
      this.main.unshift(top!);
      this.op(Opcodes.OP_TOALTSTACK);
      this.alt.unshift(this.main.shift()!);
    }
    for (let moved = 0; moved < size; moved += 1) this.fromAlt();
  }

  /** Replaces the item on top with the successor it carries, bytes 32..64 of a commitment. */
  private takeSuccessor(): void {
    this.num(32); this.op(Opcodes.OP_SPLIT, Opcodes.OP_NIP);
    this.num(32); this.op(Opcodes.OP_SPLIT, Opcodes.OP_DROP);
    this.main[0] = 'successor';
  }

  private takeFixedField(width: number, name: string): void {
    this.num(width);
    this.op(Opcodes.OP_SPLIT);
    this.leaveField(name);
  }

  private dropFixedField(width: number): void {
    this.num(width);
    this.op(Opcodes.OP_SPLIT, Opcodes.OP_NIP);
  }

  private takeLengthField32(name: string): void {
    this.raw(takeLengthPrefixedField32());
    this.leaveField(name);
  }

  private dropLengthField(): void {
    this.raw(takeLengthPrefixedField());
    this.op(Opcodes.OP_NIP);
  }

  private dropLengthField32(): void {
    this.raw(takeLengthPrefixedField32());
    this.op(Opcodes.OP_NIP);
  }

  /** After a split the remainder is on top and the field below; name the field and keep the remainder above it. */
  private leaveField(name: string): void {
    const remainder = this.main.shift();
    this.main.unshift(name);
    this.main.unshift(remainder!);
  }

  /** Emits both arms, requiring each to leave the same modelled stacks so the join is well-formed. */
  private branch(thenArm: () => void, elseArm: () => void): void {
    // OP_IF consumes the condition, so the arms begin from the stack below it.
    this.main.shift();
    const mainEntry = [...this.main];
    const altEntry = [...this.alt];
    this.op(Opcodes.OP_IF);
    thenArm();
    const mainThen = [...this.main];
    const altThen = [...this.alt];
    this.main = [...mainEntry];
    this.alt = [...altEntry];
    this.op(Opcodes.OP_ELSE);
    elseArm();
    if (!sameStack(this.main, mainThen) || !sameStack(this.alt, altThen)) {
      throw new Error('batch derivation: the update and insert arms leave different stacks');
    }
    this.op(Opcodes.OP_ENDIF);
    this.main = mainThen;
    this.alt = altThen;
  }
}

/** True when two modelled stacks hold the same names, so the two arms of a branch join at one shape. */
function sameStack(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}
