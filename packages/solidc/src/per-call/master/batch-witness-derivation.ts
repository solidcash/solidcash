/**
 * Deriving a sorted-batch transition's witnesses from a master's own witness block.
 *
 * The direct convention receives the five sorted-batch operands from its SDK: the target's masked slot, the input
 * index the write proves against, the successor the written node carries, the output the rewritten predecessor is
 * recreated at, and how many records the execution creates. A per-call master has no such SDK operand list, but
 * its own witness block already declares, per segment, every record the execution touches as
 * `{ in, out, viewIn, viewOut }`. This builder reads that block back and leaves the five operands the existing
 * verification already consumes, so no verification check changes.
 *
 * A single logical target is the shape this derivation covers. The composer plans either
 *
 *   - an UPDATE: one record, the target node recreated in place, whose `viewIn` and `viewOut` both carry the
 *     target slot; or
 *   - an INSERT: the predecessor recreated in place first, then the created node as a trailing output. The
 *     predecessor's `viewOut` re-points its successor at the target slot and its `viewIn` carries the successor
 *     the created node takes over.
 *
 * Both shapes declare the node kept in place with `in == out` and the created node with the sentinel `in`, so a
 * segment of one record is an update and a segment of two is an insert. The script branches on that count. The
 * settlement walk in the master head has already established the chain from the spent commitment to the written
 * one and the node census, so this builder reads the successor link and the indices and re-checks neither.
 *
 * The five operands, and where each comes from:
 *
 *   Slot      the masked `sha256` of the target key, computed in script from the key value on the stack
 *   Proof     the proof record's input index, relative to the master's own input
 *   Next      the successor the written node carries (the predecessor's old `next`, or the updated node's)
 *   PredOut   the output the predecessor is recreated at, or the direct convention's `-1` for an update
 *   Trailing  the created records, the trailing output region the direct convention also plans
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

export interface BatchWitnessDerivationOptions {
  /** Top-relative depths of the one target's keys, in source order, when the script begins. */
  readonly keyDepths: readonly number[];
  /** How many call records the master's tail holds, which the walk steps over before the segments. */
  readonly callCount: number;
}

/**
 * The tracked slot names one derivation supplies, in the order the caller registers them.
 *
 * The script leaves `[Trailing, PredOut, Next, Proof, Slot]` with `Slot` on top. A caller that registers the
 * names in this (deepest first) order keeps the compiler's tracked stack aligned with the runtime one.
 */
export const BATCH_DERIVATION_SLOT_ORDER = ['Slot', 'Proof', 'Next', 'PredOut', 'Trailing'] as const;

export type BatchDerivationSlot = (typeof BATCH_DERIVATION_SLOT_ORDER)[number];

/** The tracked name one target's operand lives in; the trailing count is one per function rather than per target. */
export function batchDerivationSlotName(kind: BatchDerivationSlot, slotIndex: number): string {
  if (kind === 'Trailing') return '__internal__vmapBatchTrailingCount';
  return `__internal__vmapBatch${kind}_${slotIndex}`;
}

/**
 * Builds the script that leaves one target's five sorted-batch operands, reading the master's own witness block.
 *
 * Entry `[..., key, base]` with `key` at `keyDepth`; exit `[..., Trailing, PredOut, Next, Proof, Slot, base]`.
 * The script leaves the base untouched and consumes everything it pushes, so the caller registers exactly five
 * tracked slots. A segment that declares neither one nor two records fails rather than reading a field that is
 * not there.
 */
export function buildBatchWitnessDerivationScript(options: BatchWitnessDerivationOptions): Uint8Array {
  const bytes: number[] = [];
  const num = (value: number): void => { bytes.push(...encodeDataPush(minimalNumber(value))); };
  const op = (...opcodes: number[]): void => { bytes.push(...opcodes); };
  const raw = (script: Uint8Array): void => { bytes.push(...script); };
  const pick = (depth: number): void => { num(depth); op(Opcodes.OP_PICK); };
  const takeField = (width: number): void => raw(takeFixedWidthField(width));
  const takeLp32 = (): void => raw(takeLengthPrefixedField32());
  /** Drops the fixed-width field the reader just left below the block, restoring the block on top. */
  const takeAndDrop = (width: number): void => { takeField(width); op(Opcodes.OP_NIP); };
  /** Drops the 32-bit length-prefixed field the reader just left below the block. */
  const takeAndDropLp32 = (): void => { takeLp32(); op(Opcodes.OP_NIP); };
  /** Rolls the item at `depth` to the top and drops it, removing a field or marker under the working area. */
  const rollAndDrop = (depth: number): void => { num(depth); op(Opcodes.OP_ROLL, Opcodes.OP_DROP); };
  /** Leaves bytes 32..64 of the item on top: the commitment's successor link. */
  const takeSuccessor = (): void => {
    num(32); op(Opcodes.OP_SPLIT); op(Opcodes.OP_NIP); // drop the slot half
    num(32); op(Opcodes.OP_SPLIT); op(Opcodes.OP_DROP); // drop everything after the successor
  };
  /** Leaves the nth call record's fixed and length-prefixed fields, the way the head's tail walk steps over them. */
  const skipCallRecord = (): void => {
    takeAndDrop(1); // kind
    raw(takeLengthPrefixedField()); op(Opcodes.OP_NIP); // target
    takeAndDrop(8); // value
    takeAndDrop(2); // calleeRef
    takeAndDrop(32); // argsHash
    takeAndDropLp32(); // result
  };

  // Slot = the masked key hash the write path computes: each key hashed, the hashes concatenated, hashed again
  // when there is more than one, and the high bit of the last byte cleared. A key's depth is taken from the frame
  // as the script found it, so only the hashes already concatenated sit above it.
  options.keyDepths.forEach((depth, index) => {
    pick(depth + (index === 0 ? 0 : 1)); // [key]
    op(Opcodes.OP_SHA256); // [H]
    if (index > 0) op(Opcodes.OP_CAT); // [H(k0) ++ ... ++ H(ki)]
  });
  if (options.keyDepths.length > 1) op(Opcodes.OP_SHA256); // [composite hash]
  num(31); op(Opcodes.OP_SPLIT); // [tail, head31]
  bytes.push(...encodeDataPush(new Uint8Array([0x7f])));
  op(Opcodes.OP_AND); // [masked, head31]
  op(Opcodes.OP_CAT); // [Slot]

  // Read the master's own block and step to the first segment's record list. The header the walk drops is the
  // fixed prefix only; the frame's `sender`, `self` and `value` follow it, then `retval`.
  raw(readOwnWitnessBlockScript()); // [block, Slot]
  raw(dropPrefix(WITNESS_BLOCK_HEADER_LENGTH));
  raw(takeLengthPrefixedField()); op(Opcodes.OP_NIP); // sender
  raw(takeLengthPrefixedField()); op(Opcodes.OP_NIP); // self
  takeAndDrop(8); // value
  takeAndDropLp32(); // retval
  takeAndDrop(2); // callCount
  for (let call = 0; call < options.callCount; call += 1) skipCallRecord();
  takeAndDrop(2); // segment count
  takeField(2); // [block, records, Slot]

  // A single target declares one record (update) or two (insert); require that and branch on it.
  pick(1); op(Opcodes.OP_BIN2NUM); // [count, block, records, Slot]
  op(Opcodes.OP_DUP, ...encodeDataPush(minimalNumber(1)), Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY);
  op(Opcodes.OP_DUP, ...encodeDataPush(minimalNumber(2)), Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_VERIFY);
  num(2); op(Opcodes.OP_NUMEQUAL); // [isInsert, block, records, Slot]
  op(Opcodes.OP_IF);

  // INSERT: record 0 is the predecessor; the created node is the record that follows it.
  {
    takeField(2); // [block, in0, records, Slot]
    pick(1); op(Opcodes.OP_BIN2NUM, Opcodes.OP_INPUTINDEX, Opcodes.OP_SUB); // [proof, block, in0, records, Slot]
    op(Opcodes.OP_SWAP); // [block, proof, in0, records, Slot]
    rollAndDrop(2); // in0 -> [block, proof, records, Slot]
    takeField(2); // [block, out0, proof, records, Slot]
    pick(1); op(Opcodes.OP_BIN2NUM); // [predOut, block, out0, proof, records, Slot]
    op(Opcodes.OP_SWAP); // [block, predOut, out0, proof, records, Slot]
    rollAndDrop(2); // out0 -> [block, predOut, proof, records, Slot]
    takeLp32(); // [block, viewIn0, predOut, proof, records, Slot]
    pick(1); takeSuccessor(); // [next, block, viewIn0, predOut, proof, records, Slot]
    op(Opcodes.OP_SWAP); // [block, next, viewIn0, predOut, proof, records, Slot]
    rollAndDrop(2); // viewIn0 -> [block, next, predOut, proof, records, Slot]
    op(Opcodes.OP_DROP); // block -> [next, predOut, proof, records, Slot]
    rollAndDrop(3); // records -> [next, predOut, proof, Slot]
    op(Opcodes.OP_SWAP); // [predOut, next, proof, Slot]
    op(Opcodes.OP_1); // [Trailing, predOut, next, proof, Slot]
  }
  op(Opcodes.OP_ELSE);
  // UPDATE: record 0 is the target node, recreated in place, and it opens no predecessor output.
  {
    takeField(2); // [block, in0, records, Slot]
    pick(1); op(Opcodes.OP_BIN2NUM, Opcodes.OP_INPUTINDEX, Opcodes.OP_SUB); // [proof, block, in0, records, Slot]
    op(Opcodes.OP_SWAP); // [block, proof, in0, records, Slot]
    rollAndDrop(2); // in0 -> [block, proof, records, Slot]
    takeAndDrop(2); // out0
    takeAndDropLp32(); // viewIn0
    takeLp32(); // [block, viewOut0, proof, records, Slot]
    pick(1); takeSuccessor(); // [next, block, viewOut0, proof, records, Slot]
    op(Opcodes.OP_SWAP); // [block, next, viewOut0, proof, records, Slot]
    rollAndDrop(2); // viewOut0 -> [block, next, proof, records, Slot]
    op(Opcodes.OP_1NEGATE); // [predOut, block, next, proof, records, Slot]
    op(Opcodes.OP_SWAP); // [block, predOut, next, proof, records, Slot]
    op(Opcodes.OP_DROP); // block -> [predOut, next, proof, records, Slot]
    rollAndDrop(3); // records -> [predOut, next, proof, Slot]
    op(Opcodes.OP_0); // [Trailing, predOut, next, proof, Slot]
  }
  op(Opcodes.OP_ENDIF);

  return new Uint8Array(bytes);
}

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
  /** How many call records the master's tail holds, which the walk steps over before the segments. */
  readonly callCount: number;
}

/**
 * Builds the script that leaves every target of one batch's five sorted-batch operands, reading the master's own
 * witness block.
 *
 * A batch's first segment declares one record group per target, in the order the writes were planned: a target the
 * inventory holds is rewritten in place, so its group is one record whose `viewIn` and `viewOut` both carry the
 * target's slot; a target the inventory does not hold is spliced in, so its group is the relinked predecessor
 * followed by the created node. The created node's `viewOut` carries the target slot, which is what tells the two
 * groups apart. The composer writes the group in that order, so the walk reads the group's first record, compares
 * its `viewOut` slot with the target's own slot, and reads a second record only for the insert case.
 *
 * Per target the script leaves `[Slot, Proof, Next, PredOut]` with the target's fixed `-1` predecessor output for an
 * update and the predecessor's recreated output for an insert, and once for the batch `Trailing`, the number of
 * distinct predecessors the execution rewrites. The script never reorders the frame: operands are parked on the
 * alternate stack as they are found and moved back in ABI order at the end, and it consumes everything it pushes
 * above the frame.
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

  /** How many items the modelled stack held before the script pushed anything: the frame, and nothing else. */
  private readonly frameLength: number;

  constructor(private readonly options: BatchTargetsDerivationOptions) {
    const depths = options.keyDepths.flat();
    const deepest = depths.reduce((max, depth) => Math.max(max, depth), 0);
    for (let depth = 0; depth <= deepest; depth += 1) this.main.push(`frame_${depth}`);
    this.frameLength = this.main.length;
  }

  /** The number of items the script has pushed above the frame, which shifts every depth it reads from it. */
  private pushedAboveFrame(): number {
    return this.main.length - this.frameLength;
  }

  /** Picks the frame value a key sits at, by the depth it had when the script began. */
  private pickKey(depth: number, name: string): void {
    this.num(depth + this.pushedAboveFrame());
    this.op(Opcodes.OP_PICK);
    this.main.unshift(`${name}~${this.fresh++}`);
  }

  build(): Uint8Array {
    const count = this.options.keyDepths.length;
    this.pushSlots(count);
    this.readToRecordList();
    for (let target = 0; target < count; target += 1) this.deriveTarget(target);
    this.finish(count);
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
    this.dropFixedField(2); // call count
    for (let call = 0; call < this.options.callCount; call += 1) this.skipCallRecord();
    this.dropFixedField(2); // segment count
    this.takeFixedField(2, 'record_count');
    this.nip(); // drop the declared count, keep the entries
    this.main[0] = 'records';
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

    this.branch(() => this.deriveUpdate(target), () => this.deriveInsert(target));
  }

  /** One in-place record: the target's own input proves it and opens no predecessor output. */
  private deriveUpdate(target: number): void {
    this.pick(`in0_${target}`);
    this.unary(Opcodes.OP_BIN2NUM, 'proof_index');
    this.pushConst('active_input', Opcodes.OP_INPUTINDEX);
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
    this.pick(`in0_${target}`);
    this.unary(Opcodes.OP_BIN2NUM, 'proof_index');
    this.pushConst('active_input', Opcodes.OP_INPUTINDEX);
    this.binary(Opcodes.OP_SUB, 'proof');
    this.toAlt(`proof_${target}`);
    this.pick(`view_out1_${target}`);
    this.takeSuccessor();
    this.toAlt(`next_${target}`);
    this.pick(`out0_${target}`);
    this.unary(Opcodes.OP_BIN2NUM, 'pred_out');
    this.toAlt(`pred_out_${target}`);
    for (let field = 0; field < 8; field += 1) this.nip(); // the four fields of each record
  }

  /** Moves the batch's operands back to the main stack in ABI order and appends the distinct-predecessor count. */
  private finish(count: number): void {
    this.drop(); // the consumed record list
    for (let slot = 0; slot < count; slot += 1) this.drop(); // the original slots, whose copies were parked

    for (let parked = 0; parked < count * 4; parked += 1) this.fromAlt();
    // Popping the alternate stack leaves the operands in target order, deepest first; the ABI reads them with the
    // last target nearest the top, so the block is reversed before the trailing count is appended.
    this.reverseTopBlock(count * 4);

    this.pushConst('trailing', Opcodes.OP_0);
    for (let target = 0; target < count; target += 1) {
      this.pick(`pred_out_${target}`);
      this.pushConst('zero', Opcodes.OP_0);
      this.binary(Opcodes.OP_GREATERTHANOREQUAL, 'rewrites_predecessor');
      for (let prior = 0; prior < target; prior += 1) {
        this.pick(`pred_out_${target}`);
        this.pick(`pred_out_${prior}`);
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

  private skipCallRecord(): void {
    this.dropFixedField(1); // kind
    this.dropLengthField(); // target
    this.dropFixedField(8); // value
    this.dropFixedField(2); // callee reference
    this.dropFixedField(32); // argument digest
    this.dropLengthField32(); // result
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
