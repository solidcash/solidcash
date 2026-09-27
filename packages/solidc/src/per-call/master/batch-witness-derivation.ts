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
  /** Top-relative depth of the target key's value on the runtime stack when the script begins. */
  readonly keyDepth: number;
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

  // Slot = the masked sha256 of the target key, exactly as the write path's own key hash computes it.
  pick(options.keyDepth); // [key]
  op(Opcodes.OP_SHA256); // [H]
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
  if (value === 0) return new Uint8Array([0x00]);
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0) {
    bytes.push(rest & 0xff);
    rest = Math.floor(rest / 256);
  }
  if ((bytes[bytes.length - 1]! & 0x80) !== 0) bytes.push(0x00);
  return new Uint8Array(bytes);
}
