/**
 * Witness block codec.
 *
 * A master carries one witness block as the first push of its own unlocking bytecode, and re-reads that push so the
 * program always evaluates against exactly the block its witnesses were built from. The block states how the
 * execution was entered, who called it, what calls it made, and which records each segment touched.
 *
 * Wire layout (little-endian, `lp16`/`lp32` as in `primitives`):
 *
 *     "PW" 01
 *     kind:u8  callerRef:u16 originRef:u16 validatorRef:u16
 *     sender:lp16  self:lp16  value:u64
 *     retval:lp32
 *     callCount:u16 { kind:u8 target:lp16 value:u64 calleeRef:u16 argsHash:32 result:lp32 }
 *     segCount:u16  { recCount:u16 { in:u16 out:u16 viewIn:lp32 viewOut:lp32 } }
 *     eventCount:u16 { out:u16 }
 *     sendCount:u16  { out:u16 }
 *     valueCount:u16 { value:lp32 }
 *
 * `segCount` is always `callCount + 1`: a call splits the execution, so a program with no calls has one segment.
 * `values` are the long mapping values the body reads, one per value-witness slot in slot order; the body checks
 * each against the hash its record holds, so a value the frame does not read is empty.
 */

import { assertFrameKind, assertRecordEntry, type RecordEntry } from './frames.js';
import {
  ByteReader,
  ByteWriter,
  INDEX_NONE,
  FramedEncodingError,
  bytesEqual,
  bytesToHex,
  concatBytes,
  encodeMinimalDataPush,
} from './primitives.js';

/** Magic and version of the witness block, frozen with the validator program. */
export const WITNESS_BLOCK_MAGIC = new Uint8Array([0x50, 0x57]); // "PW"
export const WITNESS_BLOCK_VERSION = 0x01;

/** Length of the `argsHash` field: the hash of a call's selector and argument pushes. */
export const ARGS_HASH_LENGTH = 32;

/**
 * The high bit of a witness-block reference (`callerRef`, `originRef`, `validatorRef`, `calleeRef`): set when the
 * reference names a master minted as an output in the same transaction, whose witness block the transcript carries
 * inline. The low fifteen bits are the output index. `INDEX_NONE` (0xffff) stays the absent sentinel, so a minted
 * reference may name output indices below `0x7fff`, far above the transcript's one-byte counts.
 */
export const MINTED_REF_FLAG = 0x8000;

/** Whether a witness-block reference names a minted (output) master rather than a spent input. */
export function isMintedRef(ref: number): boolean {
  return (ref & MINTED_REF_FLAG) !== 0 && ref !== INDEX_NONE;
}

/** The flagged reference for a master minted at `outputIndex`. */
export function mintedRef(outputIndex: number): number {
  if (!Number.isInteger(outputIndex) || outputIndex < 0 || outputIndex > 0x7ffe) {
    throw new FramedEncodingError(`minted reference output index out of range: ${String(outputIndex)}`);
  }
  return MINTED_REF_FLAG | outputIndex;
}

/** The output index a flagged reference names. */
export function mintedRefIndex(ref: number): number {
  return ref & ~MINTED_REF_FLAG;
}

/** One external call an execution made. */
export interface CallRecord {
  /** The frame kind the callee ran in: `CALL`, `STATIC`, `DELEGATE`, `INTERNAL` or `CREATE`. */
  kind: number;
  /** The address called: for a delegate frame, the address of the contract whose code runs. */
  target: Uint8Array;
  /** Satoshis passed with the call. */
  value: bigint;
  /** Input index of the callee's master. */
  calleeRef: number;
  /** `SHA256(selector || args)` of the call. */
  argsHash: Uint8Array;
  /** The value the call returned, in the canonical result encoding. */
  result: Uint8Array;
}

/** Everything one execution proves about itself. */
export interface WitnessBlock {
  kind: number;
  /** Input index of the caller: a signed P2PKH input for a root frame, otherwise the caller's master. */
  callerRef: number;
  /** Input index of the root user's signed input, which is `tx.origin` for this execution and everything below it. */
  originRef: number;
  /** Input index of the covering validator, or `INDEX_NONE` when the execution is standalone. */
  validatorRef: number;
  /** `msg.sender` for this execution. */
  sender: Uint8Array;
  /**
   * `address(this)` for this execution. Checked against the code constant for a root, call, read-only or create
   * frame, and against the caller for a frame that runs on the caller's records.
   */
  self: Uint8Array;
  /** `msg.value` for this execution. */
  value: bigint;
  /** The value returned, in the canonical result encoding; empty when the function returns nothing. */
  retval: Uint8Array;
  /** Calls made, in execution order. */
  calls: CallRecord[];
  /** One entry list per segment. `segments.length === calls.length + 1`. */
  segments: RecordEntry[][];
  /** Output indices of emitted events. */
  events: number[];
  /** Output indices of value sends to a user. */
  sends: number[];
  /** The long mapping values the body reads, by value-witness slot; omitted when there are none. */
  values?: Uint8Array[];
}

/** Encodes a witness block. */
export function encodeWitnessBlock(block: WitnessBlock): Uint8Array {
  assertFrameKind(block.kind);
  if (block.segments.length !== block.calls.length + 1) {
    throw new FramedEncodingError(
      `a witness block has one more segment than calls: got ${block.segments.length} segment(s) `
      + `for ${block.calls.length} call(s)`,
    );
  }
  for (const [index, call] of block.calls.entries()) {
    assertFrameKind(call.kind);
    if (call.kind === 0) {
      throw new FramedEncodingError(`call ${index} records a root frame, which is never a call kind`);
    }
    if (call.argsHash.length !== ARGS_HASH_LENGTH) {
      throw new FramedEncodingError(
        `call ${index} has a ${call.argsHash.length}-byte args hash, expected ${ARGS_HASH_LENGTH}`,
      );
    }
    if (call.calleeRef === INDEX_NONE) {
      throw new FramedEncodingError(`call ${index} has no callee`);
    }
  }
  for (const segment of block.segments) {
    for (const entry of segment) assertRecordEntry(entry);
  }

  return new ByteWriter()
    .pushBytes(WITNESS_BLOCK_MAGIC)
    .pushByte(WITNESS_BLOCK_VERSION)
    .pushByte(block.kind)
    .pushUint16(block.callerRef)
    .pushUint16(block.originRef)
    .pushUint16(block.validatorRef)
    .pushLp16(block.sender)
    .pushLp16(block.self)
    .pushUint64(block.value)
    .pushLp32(block.retval)
    .pushCounted16(block.calls, (out, call) => {
      out.pushByte(call.kind)
        .pushLp16(call.target)
        .pushUint64(call.value)
        .pushUint16(call.calleeRef)
        .pushBytes(call.argsHash)
        .pushLp32(call.result);
    })
    .pushCounted16(block.segments, (out, segment) => {
      out.pushCounted16(segment, (entries, entry) => {
        entries.pushUint16(entry.in)
          .pushUint16(entry.out)
          .pushLp32(entry.viewIn)
          .pushLp32(entry.viewOut);
      });
    })
    .pushCounted16(block.events, (out, outputIndex) => { out.pushUint16(outputIndex); })
    .pushCounted16(block.sends, (out, outputIndex) => { out.pushUint16(outputIndex); })
    .pushCounted16(block.values ?? [], (out, value) => { out.pushLp32(value); })
    .finish();
}

/**
 * Decodes a witness block, rejecting a bad magic, an unknown version or frame kind, a truncated field, an
 * inconsistent segment count, and any trailing byte.
 */
export function decodeWitnessBlock(payload: Uint8Array): WitnessBlock {
  const reader = new ByteReader(payload);
  const magic = reader.readBytes(2);
  if (!bytesEqual(magic, WITNESS_BLOCK_MAGIC)) {
    throw new FramedEncodingError(`not a witness block: magic ${bytesToHex(magic)}`);
  }
  const version = reader.readByte();
  if (version !== WITNESS_BLOCK_VERSION) {
    throw new FramedEncodingError(`unsupported witness block version: ${version}`);
  }

  const kind = assertFrameKind(reader.readByte());
  const callerRef = reader.readUint16();
  const originRef = reader.readUint16();
  const validatorRef = reader.readUint16();
  const sender = reader.readLp16();
  const self = reader.readLp16();
  const value = reader.readUint64();
  const retval = reader.readLp32();

  const calls = reader.readCounted16((inner, index): CallRecord => {
    const callKind = assertFrameKind(inner.readByte());
    if (callKind === 0) {
      throw new FramedEncodingError(`call ${index} records a root frame, which is never a call kind`);
    }
    const target = inner.readLp16();
    const callValue = inner.readUint64();
    const calleeRef = inner.readUint16();
    if (calleeRef === INDEX_NONE) throw new FramedEncodingError(`call ${index} has no callee`);
    return {
      kind: callKind,
      target,
      value: callValue,
      calleeRef,
      argsHash: inner.readBytes(ARGS_HASH_LENGTH),
      result: inner.readLp32(),
    };
  });

  const segments = reader.readCounted16((inner): RecordEntry[] =>
    inner.readCounted16((entries): RecordEntry => {
      const entry: RecordEntry = {
        in: entries.readUint16(),
        out: entries.readUint16(),
        viewIn: entries.readLp32(),
        viewOut: entries.readLp32(),
      };
      assertRecordEntry(entry);
      return entry;
    }));

  const events = reader.readCounted16((inner): number => inner.readUint16());
  const sends = reader.readCounted16((inner): number => inner.readUint16());
  const values = reader.readCounted16((inner): Uint8Array => inner.readLp32());
  reader.assertEnd();

  if (segments.length !== calls.length + 1) {
    throw new FramedEncodingError(
      `a witness block has one more segment than calls: got ${segments.length} segment(s) `
      + `for ${calls.length} call(s)`,
    );
  }

  return {
    kind, callerRef, originRef, validatorRef, sender, self, value, retval, calls, segments, events, sends,
    ...(values.length > 0 ? { values } : {}),
  };
}

/**
 * Splits the first push off a push-only unlocking bytecode, returning its payload and the bytes that follow.
 *
 * Both the direct push opcodes and the three length-prefixed forms are accepted, and the `OP_0`/`OP_1NEGATE`/
 * `OP_1`-`OP_16` shorthands are decoded to the byte they push. Minimality is a consensus rule on the unlocking
 * bytecode, so one encoding exists for any given payload.
 */
export function splitFirstPush(unlockingBytecode: Uint8Array): { payload: Uint8Array; rest: Uint8Array } {
  if (unlockingBytecode.length === 0) throw new FramedEncodingError('empty unlocking bytecode');
  const opcode = unlockingBytecode[0]!;
  const body = unlockingBytecode.subarray(1);
  if (opcode === 0x00) return { payload: new Uint8Array(0), rest: body };
  if (opcode >= 0x51 && opcode <= 0x60) return { payload: new Uint8Array([opcode - 0x50]), rest: body };
  if (opcode === 0x4f) return { payload: new Uint8Array([0x81]), rest: body };

  let lengthFieldBytes: number;
  if (opcode <= 0x4b) {
    lengthFieldBytes = 0;
  } else if (opcode === 0x4c) {
    lengthFieldBytes = 1;
  } else if (opcode === 0x4d) {
    lengthFieldBytes = 2;
  } else if (opcode === 0x4e) {
    lengthFieldBytes = 4;
  } else {
    throw new FramedEncodingError(`unlocking bytecode does not begin with a push: opcode ${opcode}`);
  }

  if (body.length < lengthFieldBytes) throw new FramedEncodingError('truncated push length');
  let length = lengthFieldBytes === 0 ? opcode : 0;
  for (let index = lengthFieldBytes - 1; index >= 0; index -= 1) {
    length = length * 256 + body[index]!;
  }
  const afterLength = body.subarray(lengthFieldBytes);
  if (afterLength.length < length) throw new FramedEncodingError('truncated push payload');
  return { payload: afterLength.subarray(0, length), rest: afterLength.subarray(length) };
}

/**
 * Splits the last push off a push-only bytecode, returning the bytes that precede it and its payload.
 *
 * A master's unlocking bytecode ends with the redeem script, so this is what separates the argument pushes from the
 * script that consumes them.
 */
export function splitLastPush(unlockingBytecode: Uint8Array): { leading: Uint8Array; payload: Uint8Array } {
  if (unlockingBytecode.length === 0) throw new FramedEncodingError('empty unlocking bytecode');
  let offset = 0;
  let lastPushStart = 0;
  while (offset < unlockingBytecode.length) {
    lastPushStart = offset;
    const { rest } = splitFirstPush(unlockingBytecode.subarray(offset));
    offset = unlockingBytecode.length - rest.length;
  }
  return {
    leading: unlockingBytecode.subarray(0, lastPushStart),
    payload: splitFirstPush(unlockingBytecode.subarray(lastPushStart)).payload,
  };
}

/**
 * The argument pushes of a master's unlocking bytecode.
 *
 * The layout is `<witness block push> <argument pushes> <redeem-script push>`, so the arguments are the pushes the
 * first and the last one leave between them. These bytes are what a caller hashes as `args` and what a callee
 * re-reads, which is why the boundaries matter: a hash taken over the redeem script would never agree with the
 * callee's.
 */
export function argumentPushesOf(unlockingBytecode: Uint8Array): Uint8Array {
  const { rest } = splitFirstPush(unlockingBytecode);
  if (rest.length === 0) return rest;
  return splitLastPush(rest).leading;
}

/** Encodes a witness block as the minimal push that introduces a master's unlocking bytecode. */
export function encodeWitnessBlockPush(block: WitnessBlock): Uint8Array {
  return encodeMinimalDataPush(encodeWitnessBlock(block));
}

/**
 * Checks that an unlocking bytecode begins with exactly this witness block, and returns the argument pushes and the
 * redeem script that follow it. A program calls this against the block it evaluated with, so the two can never
 * disagree.
 */
export function readOwnWitnessBlock(
  unlockingBytecode: Uint8Array,
  expected: WitnessBlock,
): { block: WitnessBlock; argumentPushes: Uint8Array; redeemScript: Uint8Array } {
  const { payload, rest } = splitFirstPush(unlockingBytecode);
  const block = decodeWitnessBlock(payload);
  if (!bytesEqual(payload, encodeWitnessBlock(expected))) {
    throw new FramedEncodingError('the first push is not the witness block this execution used');
  }
  if (rest.length === 0) {
    throw new FramedEncodingError('unlocking bytecode carries no redeem-script push');
  }
  const { leading, payload: redeemScript } = splitLastPush(rest);
  return { block, argumentPushes: leading, redeemScript };
}

/** Unlocking bytecode for a master: the witness block push, the argument pushes, then the redeem script. */
/**
 * The argument pushes and the redeem-script push of one master, already concatenated.
 *
 * The witness block in front of them is rebuilt on every attempt, because it states the calls and the records that
 * the attempt is about; the tail behind it is the same bytes every time for a given master, and a redeem script is
 * up to ten kilobytes. Keyed on the argument array and the program buffer, so a rebuilt program or a changed
 * argument list misses rather than reusing an old push.
 */
const masterTails = new WeakMap<Uint8Array, WeakMap<readonly Uint8Array[], Uint8Array>>();

function masterTail(argumentPushes: readonly Uint8Array[], redeemScript: Uint8Array): Uint8Array {
  let byArguments = masterTails.get(redeemScript);
  if (byArguments === undefined) {
    byArguments = new WeakMap();
    masterTails.set(redeemScript, byArguments);
  }
  const cached = byArguments.get(argumentPushes);
  if (cached !== undefined) return cached;
  const tail = concatBytes([
    ...argumentPushes.map((argument) => encodeMinimalDataPush(argument)),
    encodeMinimalDataPush(redeemScript),
  ]);
  byArguments.set(argumentPushes, tail);
  return tail;
}

export function buildMasterUnlockingBytecode(
  block: WitnessBlock,
  argumentPushes: readonly Uint8Array[],
  redeemScript: Uint8Array,
): Uint8Array {
  const witness = encodeWitnessBlockPush(block);
  const tail = masterTail(argumentPushes, redeemScript);
  const out = new Uint8Array(witness.length + tail.length);
  out.set(witness, 0);
  out.set(tail, witness.length);
  return out;
}
