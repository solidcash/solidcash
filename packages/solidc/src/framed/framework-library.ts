/**
 * The framework library: routines every per-entry master would otherwise carry, held once per transaction.
 *
 * A per-entry master (a function-split shard) is spent only where a validator covers it, and its head recognises
 * that validator by the SHA-256 of its program before the body runs. The library rides in that program as a push the
 * validator drops, so the hash the master checks covers it. Once the hash matches, the master cuts the push out of the
 * program bytes it already holds, defines it as a function and invokes it once: the library is a registrar, whose
 * body defines each routine under the identifier this module fixes. Each routine is then one `<id> OP_INVOKE` wherever
 * the master would have emitted the routine's code, and the transaction carries its bytes once, in the validator.
 *
 * The validator is padded to the budget its own checks spend, so the library's bytes mostly stand in for padding.
 *
 * The identifiers are two-byte negative script numbers, from -128 down. The framed outliner takes its identifiers from
 * 1-16, -1, 17-127, -2..-127 and 128-32767, and the traversal reserves every framework identifier against its helper
 * allocator, which counts down from -14. So no master defines one of them itself, which would fail its head at the
 * registrar's `OP_DEFINE`.
 */

import {
  KECCAK256_COMPUTE_STATEFUL_SHARED_LOCK,
  Op,
  buildDataNftCovenantScript,
  buildEntryNftCovenantScript,
  encodeInt,
  scriptToBytecode,
  type Script,
} from '@solidcash/utils';
import { assertP2pkhShapeScript, callerSignatureHashTypeScript, tailWalkBodies } from './master/frame-tail.js';

/** `OP_HASH256 OP_PUSHBYTES_32`, which opens a P2SH32 lock. */
const P2SH32_LOCK_PREFIX = Uint8Array.of(0xaa, 0x20);

/** `OP_EQUAL`, which closes a P2SH32 lock. */
const P2SH32_LOCK_SUFFIX = Uint8Array.of(0x87);

/** A routine the library defines: its identifier and the body a master would otherwise carry inline. */
export interface FrameworkRoutine {
  readonly name: string;
  readonly id: bigint;
  readonly body: Uint8Array;
}

/** The identifier a master defines the registrar under, to invoke it once. */
export const FRAMEWORK_REGISTRAR_ID = -128n;

/** `[category]` -> `[lock]`: the P2SH32 lock of the contract's data record for a category in chain order. */
export const DATA_RECORD_LOCK_ROUTINE_ID = -129n;

/**
 * `[category, collectionHash]` -> `[lock]`: the P2SH32 lock of a mapping entry or chunk of a collection, for a category
 * in chain order and the collection's 20-byte hash.
 */
export const ENTRY_RECORD_LOCK_ROUTINE_ID = -130n;

/**
 * `[blob]` -> `[raw, remainder]`: the first push of a blob decoded to its payload. The traversal's registry knows it
 * under this identifier too, which a master that does not define the library defines itself.
 */
export const INT_DECODE_ROUTINE_ID = -1n;

/** `[remainder, opcode, numeric_opcode]` -> `[raw, remainder]`: the PUSHDATA1/2/4 and OP_1NEGATE arms of the decoder. */
export const WIDE_PUSHDATA_DECODE_ROUTINE_ID = -17n;

/**
 * `[index, preimage]` -> `[holds]`: whether the input at `index` is a keccak side-car at the shared stateful lock whose
 * job is `preimage` (the push after its budget pad). The index must name an input.
 */
export const KECCAK_SIDE_CAR_MATCH_ROUTINE_ID = -131n;

/**
 * `[preimage, ordinal, index]` -> `[preimage, ordinal, index']`: the side-car a keccak call binds. `index` is the one
 * the layout gives the call; when that input does not hold the call's job, the lowest-indexed input that does, so
 * calls that hash one preimage can share one side-car. With no input holding it, and for a negative index, `index`
 * is kept: the call's own bind then fails, which is where a derivation learns a computed preimage.
 */
export const KECCAK_SIDE_CAR_FIND_ROUTINE_ID = -132n;

/*
 * The master head's tail walks (frame-tail.ts `verifyTailScript`), each `[..., tail]` -> `[..., tail']` with what the
 * walk parks on the alternate stack. A master every spend of which is covered recognises its validator before it
 * walks its tail, so it invokes these where an uncovered master emits the walks inline. A counted walk takes its count
 * above the tail.
 */
/** The call section, its count parked. */
export const TAIL_CALLS_ROUTINE_ID = -133n;
/** The call section, its count parked above the records kept for the body's call sites. */
export const TAIL_CALLS_KEPT_ROUTINE_ID = -134n;
/** The segment count checked against the parked call count, then the segments stepped over. */
export const TAIL_SEGMENTS_ROUTINE_ID = -135n;
/** The segment count checked, then the segments kept for the body's record reads beside the first record's base. */
export const TAIL_SEGMENTS_KEPT_ROUTINE_ID = -136n;
/** `[..., owner, tail, n]`: the event list read into `n` positions, each output the owner's category's. */
export const TAIL_EVENTS_ROUTINE_ID = -137n;
/** The event list read as a run of consecutive outputs of the owner's category. */
export const TAIL_EVENT_RUN_ROUTINE_ID = -138n;
/** `[..., tail, n]`: the send list read into `n` positions. */
export const TAIL_SENDS_ROUTINE_ID = -139n;
/** The send list read as a run of consecutive outputs. */
export const TAIL_SEND_RUN_ROUTINE_ID = -140n;
/** `[..., tail, n]`: the value list read into `n` slots. */
export const TAIL_VALUES_ROUTINE_ID = -141n;
/** The padding consumed, nothing after it. */
export const TAIL_PADDING_ROUTINE_ID = -142n;

/** `[lock]` -> `[lock]`: the lock is a P2PKH one, as a root frame's caller and origin are. */
export const P2PKH_SHAPE_ROUTINE_ID = -143n;

/** `[callerRef]` -> `[]`: the caller's signature signs with `SIGHASH_ALL`, its UTXOS bit either way. */
export const CALLER_HASH_TYPE_ROUTINE_ID = -144n;

/**
 * `[category]` -> `[lock]`: the P2SH32 lock of a category-seeded covenant, for a category in chain order.
 *
 * The covenant pushes the category as `0x20 || category` wherever it names it; the routine rebuilds it around those
 * pushes from the category on the stack, hashes it and wraps the hash.
 */
export function p2sh32FromCovenantScript(buildCovenant: (categoryId: Uint8Array) => Script): Script {
  // A display-order placeholder, which the covenant reverses into the chain order it pushes.
  const placeholder = Uint8Array.from({ length: 32 }, (_value, index) => index);
  const covenant = scriptToBytecode(buildCovenant(placeholder));
  const delimiter = Uint8Array.from([0x20, ...placeholder.slice().reverse()]);
  const segments = splitOnDelimiter(covenant, delimiter);
  const script: Script = [Uint8Array.of(0x20), Op.OP_SWAP, Op.OP_CAT, segments[0]!];
  for (const segment of segments.slice(1)) {
    script.push(Op.OP_OVER, Op.OP_CAT);
    if (segment.length > 0) script.push(segment, Op.OP_CAT);
  }
  script.push(
    Op.OP_NIP, Op.OP_HASH256,
    P2SH32_LOCK_PREFIX, Op.OP_SWAP, Op.OP_CAT, P2SH32_LOCK_SUFFIX, Op.OP_CAT,
  );
  return script;
}

/**
 * `[category, collectionHash]` -> `[lock]`: the entry covenant rebuilt around its category pushes (`0x20 || category`)
 * and its collection-hash pushes (`0x14 || hash`), hashed and wrapped.
 */
export function entryRecordLockScript(): Script {
  const category = Uint8Array.from({ length: 32 }, (_value, index) => index);
  const hash = Uint8Array.from({ length: 20 }, (_value, index) => 0xa0 + index);
  const covenant = scriptToBytecode(buildEntryNftCovenantScript(category, hash));
  const markers = [
    { kind: 'category' as const, bytes: Uint8Array.from([0x20, ...category.slice().reverse()]) },
    { kind: 'hash' as const, bytes: Uint8Array.from([0x14, ...hash]) },
  ];
  // `[encodedHash, encodedCategory, body]` while the body grows: the category is one item down, the hash two.
  const script: Script = [
    Uint8Array.of(0x14), Op.OP_SWAP, Op.OP_CAT,
    Op.OP_SWAP, Uint8Array.of(0x20), Op.OP_SWAP, Op.OP_CAT,
  ];
  let cursor = 0;
  let first = true;
  while (cursor <= covenant.length) {
    let found = -1;
    let marker: (typeof markers)[number] | undefined;
    for (let at = cursor; at < covenant.length && found < 0; at += 1) {
      marker = markers.find((candidate) => startsWith(covenant, at, candidate.bytes));
      if (marker !== undefined) found = at;
    }
    const segment = covenant.slice(cursor, found < 0 ? covenant.length : found);
    if (first) script.push(segment);
    else if (segment.length > 0) script.push(segment, Op.OP_CAT);
    first = false;
    if (found < 0) break;
    script.push(...(marker!.kind === 'category' ? [Op.OP_OVER] : [encodeInt(2n), Op.OP_PICK]), Op.OP_CAT);
    cursor = found + marker!.bytes.length;
  }
  script.push(
    Op.OP_NIP, Op.OP_NIP, Op.OP_HASH256,
    P2SH32_LOCK_PREFIX, Op.OP_SWAP, Op.OP_CAT, P2SH32_LOCK_SUFFIX, Op.OP_CAT,
  );
  return script;
}

/**
 * The decoder's rare arms, `[remainder, opcode, numeric_opcode]` -> `[raw, remainder]`: PUSHDATA1/2/4 and OP_1NEGATE.
 * Outlined so ordinary array elements pay only for the short dispatcher.
 */
export function widePushdataDecodeScript(): Script {
  return [
    Op.OP_DUP, encodeInt(0x4cn), Op.OP_NUMEQUAL, Op.OP_IF,
    Op.OP_2DROP, Op.OP_1, Op.OP_SPLIT, Op.OP_SWAP,
    new Uint8Array([0x00]), Op.OP_CAT, Op.OP_BIN2NUM, Op.OP_SPLIT,
    Op.OP_ELSE,
    Op.OP_DUP, encodeInt(0x4dn), Op.OP_NUMEQUAL, Op.OP_IF,
    Op.OP_2DROP, Op.OP_2, Op.OP_SPLIT, Op.OP_SWAP,
    new Uint8Array([0x00]), Op.OP_CAT, Op.OP_BIN2NUM, Op.OP_SPLIT,
    Op.OP_ELSE,
    Op.OP_DUP, encodeInt(0x4en), Op.OP_NUMEQUAL, Op.OP_IF,
    Op.OP_2DROP, Op.OP_4, Op.OP_SPLIT, Op.OP_SWAP,
    new Uint8Array([0x00]), Op.OP_CAT, Op.OP_BIN2NUM, Op.OP_SPLIT,
    Op.OP_ELSE,
    encodeInt(0x4fn), Op.OP_NUMEQUALVERIFY, Op.OP_DROP,
    new Uint8Array([0x81]), Op.OP_SWAP,
    Op.OP_ENDIF, Op.OP_ENDIF, Op.OP_ENDIF,
  ];
}

/**
 * `[blob]` -> `[raw, remainder]`: the first push of a blob decoded to its payload, `[0, empty]` for an empty blob. The
 * common forms (OP_1-OP_16, OP_0 and direct pushes) are decided first; the rest invoke the wide arms.
 */
export function intDecodeScript(): Script {
  return [
    Op.OP_SIZE, Op.OP_IF,
    // Split the first byte: [blob] -> [remainder, first_byte], then classify it once.
    Op.OP_1, Op.OP_SPLIT, Op.OP_SWAP,
    Op.OP_DUP, Op.OP_BIN2NUM,
    // OP_1-OP_16 (0x51-0x60) -> one-byte raw numeric encoding.
    Op.OP_DUP, encodeInt(0x51n), encodeInt(0x61n), Op.OP_WITHIN, Op.OP_IF,
    encodeInt(0x50n), Op.OP_SUB, Op.OP_1, Op.OP_NUM2BIN, Op.OP_NIP, Op.OP_SWAP,
    Op.OP_ELSE,
    // OP_0 and direct pushes (0x01-0x4b) share the same split length.
    Op.OP_DUP, encodeInt(0x4cn), Op.OP_LESSTHAN, Op.OP_IF,
    Op.OP_NIP, Op.OP_SPLIT,
    Op.OP_ELSE,
    encodeInt(WIDE_PUSHDATA_DECODE_ROUTINE_ID), Op.OP_INVOKE,
    Op.OP_ENDIF,
    Op.OP_ENDIF,
    Op.OP_ELSE,
    Op.OP_0, Op.OP_SWAP,
    Op.OP_ENDIF,
  ];
}

/**
 * `[index, preimage]` -> `[holds]` ({@link KECCAK_SIDE_CAR_MATCH_ROUTINE_ID}). The lock check comes first, so an input
 * whose second push merely equals the preimage is never taken for a side-car, and only side-cars are decoded.
 */
export function keccakSideCarMatchScript(): Script {
  return [
    Op.OP_OVER, Op.OP_UTXOBYTECODE, KECCAK256_COMPUTE_STATEFUL_SHARED_LOCK, Op.OP_EQUAL,
    Op.OP_IF,
    // `[preimage, unlocking]`: the budget pad, then the job.
    Op.OP_SWAP, Op.OP_INPUTBYTECODE,
    encodeInt(INT_DECODE_ROUTINE_ID), Op.OP_INVOKE, Op.OP_NIP,
    encodeInt(INT_DECODE_ROUTINE_ID), Op.OP_INVOKE, Op.OP_DROP,
    Op.OP_EQUAL,
    Op.OP_ELSE,
    Op.OP_2DROP, Op.OP_0,
    Op.OP_ENDIF,
  ];
}

/** `[preimage, ordinal, index]` -> `[preimage, ordinal, index']` ({@link KECCAK_SIDE_CAR_FIND_ROUTINE_ID}). */
export function keccakSideCarFindScript(): Script {
  const match = [encodeInt(KECCAK_SIDE_CAR_MATCH_ROUTINE_ID), Op.OP_INVOKE];
  return [
    Op.OP_DUP, Op.OP_0, Op.OP_LESSTHAN, Op.OP_NOTIF,
    // The layout's own slot first: the common case reads one side-car.
    Op.OP_DUP, Op.OP_TXINPUTCOUNT, Op.OP_LESSTHAN,
    Op.OP_IF, Op.OP_DUP, encodeInt(3n), Op.OP_PICK, ...match, Op.OP_ELSE, Op.OP_0, Op.OP_ENDIF,
    Op.OP_NOTIF,
    // `[preimage, ordinal, index, found, j]`, j counting down every input; found ends at the lowest one that holds it.
    Op.OP_1NEGATE, Op.OP_TXINPUTCOUNT,
    Op.OP_BEGIN,
    Op.OP_1SUB, Op.OP_DUP, encodeInt(5n), Op.OP_PICK, ...match,
    Op.OP_IF, Op.OP_NIP, Op.OP_DUP, Op.OP_ENDIF,
    Op.OP_DUP, Op.OP_NOT,
    Op.OP_UNTIL,
    Op.OP_DROP,
    Op.OP_DUP, Op.OP_0, Op.OP_LESSTHAN, Op.OP_IF, Op.OP_DROP, Op.OP_ELSE, Op.OP_NIP, Op.OP_ENDIF,
    Op.OP_ENDIF,
    Op.OP_ENDIF,
  ];
}

/** Every routine the library defines. */
export function frameworkRoutines(): readonly FrameworkRoutine[] {
  return [
    {
      name: 'data record lock',
      id: DATA_RECORD_LOCK_ROUTINE_ID,
      body: scriptToBytecode(p2sh32FromCovenantScript(buildDataNftCovenantScript)),
    },
    { name: 'entry record lock', id: ENTRY_RECORD_LOCK_ROUTINE_ID, body: scriptToBytecode(entryRecordLockScript()) },
    { name: 'wide pushdata decode', id: WIDE_PUSHDATA_DECODE_ROUTINE_ID, body: scriptToBytecode(widePushdataDecodeScript()) },
    { name: 'pushdata decode', id: INT_DECODE_ROUTINE_ID, body: scriptToBytecode(intDecodeScript()) },
    {
      name: 'keccak side-car match', id: KECCAK_SIDE_CAR_MATCH_ROUTINE_ID, body: scriptToBytecode(keccakSideCarMatchScript()),
    },
    { name: 'keccak side-car find', id: KECCAK_SIDE_CAR_FIND_ROUTINE_ID, body: scriptToBytecode(keccakSideCarFindScript()) },
    ...tailWalkRoutines(),
    { name: 'p2pkh shape', id: P2PKH_SHAPE_ROUTINE_ID, body: assertP2pkhShapeScript() },
    { name: 'caller hash type', id: CALLER_HASH_TYPE_ROUTINE_ID, body: callerSignatureHashTypeScript() },
  ];
}

/** The master head's tail walks, as `verifyTailScript` emits them inline. */
function tailWalkRoutines(): readonly FrameworkRoutine[] {
  const walks = tailWalkBodies();
  return [
    { name: 'tail calls', id: TAIL_CALLS_ROUTINE_ID, body: walks.calls },
    { name: 'tail calls kept', id: TAIL_CALLS_KEPT_ROUTINE_ID, body: walks.callsKept },
    { name: 'tail segments', id: TAIL_SEGMENTS_ROUTINE_ID, body: walks.segments },
    { name: 'tail segments kept', id: TAIL_SEGMENTS_KEPT_ROUTINE_ID, body: walks.segmentsKept },
    { name: 'tail events', id: TAIL_EVENTS_ROUTINE_ID, body: walks.events },
    { name: 'tail event run', id: TAIL_EVENT_RUN_ROUTINE_ID, body: walks.eventRun },
    { name: 'tail sends', id: TAIL_SENDS_ROUTINE_ID, body: walks.sends },
    { name: 'tail send run', id: TAIL_SEND_RUN_ROUTINE_ID, body: walks.sendRun },
    { name: 'tail values', id: TAIL_VALUES_ROUTINE_ID, body: walks.values },
    { name: 'tail padding', id: TAIL_PADDING_ROUTINE_ID, body: walks.padding },
  ];
}

/** True when `bytes` holds `needle` at `at`. */
function startsWith(bytes: Uint8Array, at: number, needle: Uint8Array): boolean {
  if (at + needle.length > bytes.length) return false;
  for (let index = 0; index < needle.length; index += 1) {
    if (bytes[at + index] !== needle[index]) return false;
  }
  return true;
}

/** `<id> OP_INVOKE`: one of the library's routines, where a master would have emitted its code. */
export function invokeFrameworkRoutine(id: bigint): Uint8Array {
  return scriptToBytecode([encodeInt(id), Op.OP_INVOKE]);
}

/** Every identifier the library takes, the registrar's included, which a master must not define itself. */
export function frameworkIdentifiers(): readonly bigint[] {
  return [FRAMEWORK_REGISTRAR_ID, ...frameworkRoutines().map((routine) => routine.id)];
}

/** The registrar: the body that, invoked once, defines every routine. It leaves the stack as it found it. */
export function frameworkRegistrar(): Uint8Array {
  return scriptToBytecode(frameworkRoutines().flatMap((routine) => [routine.body, encodeInt(routine.id), Op.OP_DEFINE]));
}

/**
 * The bytes the validator program opens with: the registrar pushed, then dropped. They leave the validator's stack as
 * its unlocking bytecode left it.
 */
export function frameworkCarrier(): Uint8Array {
  return scriptToBytecode([frameworkRegistrar(), Op.OP_DROP]);
}

/** How many bytes of the carrier come before the registrar: its push's opcode and length field. */
export function frameworkRegistrarOffset(): number {
  return frameworkCarrier().length - 1 - frameworkRegistrar().length;
}

/** Split a byte array on each occurrence of `delimiter`, returning the pieces between and around them. */
function splitOnDelimiter(bytes: Uint8Array, delimiter: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let start = 0;
  let index = 0;
  while (index + delimiter.length <= bytes.length) {
    let match = true;
    for (let at = 0; at < delimiter.length; at += 1) {
      if (bytes[index + at] !== delimiter[at]) {
        match = false;
        break;
      }
    }
    if (match) {
      out.push(bytes.slice(start, index));
      index += delimiter.length;
      start = index;
    } else {
      index += 1;
    }
  }
  out.push(bytes.slice(start));
  return out;
}
