/**
 * The code tail of a direct master (A2, A4.3; B6.4 of the deployer-coins spec).
 *
 * After a direct contract is optimised, its final code carries, at its very end:
 * - padding, when the code is shorter than the marker/trailer guard distance or an instance-filled slot reaches
 *   into it;
 * - the code marker `15 ‖ MAGIC ‖ f ‖ 75` when the contract is record-sound (bit 1) or a marked creator (bit 0);
 * - ever more padding until no accidental tail can be read as a birth trailer or as a marker.
 *
 * The code marker states a property of the compiled program, so the checks at the end never yield a script that
 * does not satisfy them.
 */
import { Op } from '@solidcash/utils';

/** The first 20 bytes of sha256("solidcash:code-marker:v1"). */
export const CODE_MARKER_MAGIC = Uint8Array.from([
  0x17, 0x44, 0xa6, 0x5e, 0x30, 0xfd, 0xa2, 0x20, 0x9c, 0x56, 0x1d, 0xa7, 0xe1, 0x92, 0x01, 0x01,
  0xf4, 0x4c, 0x31, 0x3a,
]);

export const CODE_MARKER_RECORD_SOUND = 0x02;
export const CODE_MARKER_MARKED_CREATOR = 0x01;

/** A push of 21 bytes (MAGIC ‖ flags) followed by OP_DROP. */
const MARKER_LENGTH = 23;
const TRAILER_LENGTH = 34;
/** The distance a marker or a birth trailer must be clear of the code's end. */
const GUARD_DISTANCE = 57;

export interface CodeTailOptions {
  /** Bits 0 and 1 of the marker's flag byte; 0 means the contract carries no marker. */
  readonly flags: number;
  /** End offsets of slots the SDK fills per instance (a 34-byte lock push each). */
  readonly instanceSlotOffsets?: readonly number[];
  /** Offset and length of each instance slot, when they differ from a 34-byte push at its offset. */
  readonly instanceSlots?: readonly { readonly offset: number; readonly length: number }[];
}

export class CodeTailError extends Error {
  constructor(message: string) {
    super(`internal deployer check failed: ${message}`);
    this.name = 'CodeTailError';
  }
}

const markerBytes = (flags: number): number[] => [0x15, ...CODE_MARKER_MAGIC, flags & 0xff, 0x75];

const isMarkerAt = (script: readonly number[], offset: number): boolean => (
  offset >= 0 && offset + MARKER_LENGTH <= script.length
  && script[offset] === 0x15
  && script[offset + MARKER_LENGTH - 1] === 0x75
  && CODE_MARKER_MAGIC.every((byte, index) => script[offset + 1 + index] === byte)
);

const hasTrailerAtEnd = (script: readonly number[]): boolean => (
  script.length >= TRAILER_LENGTH
  && script[script.length - TRAILER_LENGTH] === 0x20
  && script[script.length - 1] === 0x75
);

/**
 * Bring a direct master's code into its final form. Throws `CodeTailError` when the result would not satisfy the
 * rules, which means a defect in the compiler rather than in the source.
 */
export function applyCodeTail(script: readonly number[], options: CodeTailOptions): number[] {
  const slots = options.instanceSlots
    ?? (options.instanceSlotOffsets ?? []).map((offset) => ({ offset, length: 34 }));
  const flagByte = options.flags & (CODE_MARKER_RECORD_SOUND | CODE_MARKER_MARKED_CREATOR);
  if (options.flags !== 0 && flagByte === 0) {
    throw new CodeTailError(`unknown code-marker flags ${options.flags}`);
  }
  const out = [...script];

  const needsPadding = (): boolean => out.length < GUARD_DISTANCE
    || slots.some((slot) => out.length - (slot.offset + slot.length) < GUARD_DISTANCE);
  while (needsPadding()) out.push(Op.OP_NOP);

  if (flagByte !== 0) out.push(...markerBytes(flagByte));

  // An accidental marker or trailer at the guarded places would make a reader take the code for something it is
  // not. Each round inserts one OP_NOP; a run of 0x20 bytes before a marker needs one per byte, bounded by the
  // marker's distance from the end.
  let rounds = 0;
  for (;;) {
    const marked = flagByte !== 0;
    const last34 = hasTrailerAtEnd(out);
    const markerBeforeTrailer = out.length >= TRAILER_LENGTH + MARKER_LENGTH
      && isMarkerAt(out, out.length - TRAILER_LENGTH - MARKER_LENGTH);
    const accidentalMarker = !marked && isMarkerAt(out, out.length - MARKER_LENGTH);
    if (!last34 && !markerBeforeTrailer && !accidentalMarker) break;
    if (++rounds > 32) throw new CodeTailError('the code tail did not stabilise within 32 rounds');
    if (marked) out.splice(out.length - MARKER_LENGTH, 0, Op.OP_NOP);
    else out.push(Op.OP_NOP);
  }

  // The O4 conditions. § leaves no way to emit a script that fails them.
  if (out.length < GUARD_DISTANCE) throw new CodeTailError('the code is shorter than the guard distance');
  for (const slot of slots) {
    if (out.length - (slot.offset + slot.length) < GUARD_DISTANCE) {
      throw new CodeTailError('an instance-filled slot reaches into the last 57 bytes');
    }
  }
  const hasMarker = flagByte !== 0;
  if (isMarkerAt(out, out.length - MARKER_LENGTH) !== hasMarker) {
    throw new CodeTailError('the marker is not where the flags say it is');
  }
  if (hasMarker && isMarkerAt(out, out.length - TRAILER_LENGTH - MARKER_LENGTH)) {
    throw new CodeTailError('a marker stands at the 23 bytes before the last 34');
  }
  if (hasTrailerAtEnd(out)) throw new CodeTailError('the code ends in a birth-trailer shape');
  if (hasMarker) {
    const at = out.length - MARKER_LENGTH;
    const flagsAt = out[at + 21]!;
    if (flagsAt !== flagByte) throw new CodeTailError('the marker flags differ from the requested flags');
  }
  return out;
}

/**
 * O4 on finished code, read as A4.3 step 8.3 reads a code: the marker form stands only where the compiler placed
 * the marker (the last 23 bytes, or, before a birth trailer, the 23 bytes before the last 34), with the flags it
 * meant; the code ends in the trailer form exactly when it carries the trailer that names `trailer`; and the body is
 * at least 57 bytes long. It does not trust `applyCodeTail`, so it also holds every step after it to the rule: the
 * compiler's own passes over the finished script and the trailer of B7.14.
 */
export function verifyCodeTail(
  code: ArrayLike<number>, expected: { readonly flags: number; readonly trailer?: ArrayLike<number> },
): void {
  const bytes = Array.from(code);
  const flags = expected.flags & (CODE_MARKER_RECORD_SOUND | CODE_MARKER_MARKED_CREATOR);
  const trailer = expected.trailer === undefined ? undefined : Array.from(expected.trailer);
  if (trailer !== undefined && trailer.length !== 32) throw new CodeTailError('a birth trailer names 32 bytes');
  const bodyLength = bytes.length - (trailer === undefined ? 0 : TRAILER_LENGTH);
  if (bodyLength < GUARD_DISTANCE) {
    throw new CodeTailError(`the code body is ${bodyLength} bytes, shorter than the guard distance`);
  }
  if (hasTrailerAtEnd(bytes) !== (trailer !== undefined)) {
    throw new CodeTailError(trailer === undefined
      ? 'the code ends in the form of a birth trailer the compiler did not append'
      : 'the born code does not end in its birth trailer');
  }
  if (trailer !== undefined && trailer.some((byte, index) => bytes[bodyLength + 1 + index] !== byte)) {
    throw new CodeTailError('the birth trailer does not name the deployer');
  }
  const markerAt = trailer === undefined ? bytes.length - MARKER_LENGTH : bodyLength - MARKER_LENGTH;
  const otherAt = trailer === undefined ? bytes.length - TRAILER_LENGTH - MARKER_LENGTH : bytes.length - MARKER_LENGTH;
  if (isMarkerAt(bytes, otherAt)) throw new CodeTailError(`the marker form stands at offset ${otherAt}, where no marker goes`);
  const read = isMarkerAt(bytes, markerAt) ? bytes[markerAt + 21]! : undefined;
  if ((read === undefined) !== (flags === 0) || (read !== undefined && read !== flags)) {
    throw new CodeTailError(`a reader takes the flags ${read ?? 'of no marker'} from the code, and the compiler meant ${flags}`);
  }
}
