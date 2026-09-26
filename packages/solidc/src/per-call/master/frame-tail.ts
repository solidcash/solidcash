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
 * checked: an event output carries the contract's category with no capability, and a send output is a user's
 * P2PKH lock. The last check is that nothing follows the final field, which is what makes the walk exact.
 *
 * The event walk leaves each listed output index parked on the alt stack, in list order, so the head can hand
 * them to the body as tracked slots instead of dropping them with the rest of the tail.
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
} from './witness-reader.js';

/** One external call a master makes, as the code records it. */
export interface MasterCallSite {
  /** The frame kind the callee runs, which the caller records in `calls[k].kind`. */
  readonly kind: number;
  /** The callee's four-byte dispatcher selector, the first push of its call data. */
  readonly selector: Uint8Array;
  /** The address called, which `calls[k].target` must name. */
  readonly target: Uint8Array;
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
}

/** One argument of a call, as the caller's own code can account for it. */
export type SiteArgument =
  | { readonly kind: 'constant'; readonly bytes: Uint8Array }
  | { readonly kind: 'runtime'; readonly numeric: boolean };

/**
 * The tail sections after the calls that a master's own code fixes.
 *
 * `segmentRecordCounts`, when present, is the record count every segment must declare, in segment order. It is
 * absent when the records a segment touches are decided by settlement rather than by the entry, and the walk then
 * consumes each segment's declared count. `eventCount` and `sendCount` are the event and send lists an entry
 * fixes; a master with no call, event or send carries none of both.
 */
export interface MasterTailShape {
  readonly segmentRecordCounts?: readonly number[];
  readonly eventCount: number;
  readonly sendCount: number;
}

/** A tail carrying no events and no sends, with every segment declaring no record. */
export function zeroTailShape(callCount: number): MasterTailShape {
  return { segmentRecordCounts: new Array<number>(callCount + 1).fill(0), eventCount: 0, sendCount: 0 };
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
 * A root frame's caller and a listed value send are both user addresses, so the frame checks and the tail walk
 * test the same shape from the same bytes.
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
 * Entry `[..., tail]`, exit `[...]`. `retval` must be empty (a supported entry returns nothing), the call count
 * must equal the number of sites (a loop that varies it is not emitted), and each record is walked past — the
 * site that made the call binds it in the caller's own body. The segment count must be the call count plus one,
 * and every segment's records are walked. The event and send counts must equal the shape's, and each listed
 * output is checked. The remaining tail must be empty, so nothing follows the last field.
 *
 * With `keepsRecordIndices` the first segment's declared record indices are parked on the alt stack, input index
 * first, beneath the event walk's own parkings; a segment that declares no record parks the no-index sentinel
 * under the same convention, so the pair is always there and always means the same thing.
 */
export function verifyTailScript(
  callSites: readonly MasterCallSite[],
  tail: MasterTailShape = zeroTailShape(callSites.length),
  options: { readonly keepsRecordIndices?: boolean } = {},
): Uint8Array {
  const keepsRecordIndices = options.keepsRecordIndices === true;
  const bytes: number[] = [];
  bytes.push(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_0, Opcodes.OP_EQUALVERIFY);
  bytes.push(...requireU16Equals(callSites.length));
  for (let site = 0; site < callSites.length; site += 1) bytes.push(...callRecordSkip());
  bytes.push(...requireU16Equals(callSites.length + 1));
  for (let segment = 0; segment < callSites.length + 1; segment += 1) {
    bytes.push(...segmentRecordSection(tail.segmentRecordCounts?.[segment], keepsRecordIndices && segment === 0));
  }
  bytes.push(...requireU16Equals(tail.eventCount));
  if (tail.eventCount > 0) bytes.push(...eventOutputSection(tail.eventCount));
  bytes.push(...requireU16Equals(tail.sendCount));
  if (tail.sendCount > 0) bytes.push(...sendOutputSection(tail.sendCount));
  bytes.push(Opcodes.OP_0, Opcodes.OP_EQUALVERIFY);
  return new Uint8Array(bytes);
}

/** Consumes a `u16` count and requires it to equal `expected`, leaving the tail on top. */
function requireU16Equals(expected: number): number[] {
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
    ...encodeDataPush(scriptNumber(expected)), Opcodes.OP_NUMEQUALVERIFY,
  ];
}

/**
 * Consumes one segment's record list and checks each entry's shape.
 *
 * When the entry fixes the count the list is required to hold exactly that many records and is unrolled; without
 * one the declared count is walked, because the records a segment touches are decided by settlement.
 */
function segmentRecordSection(expected: number | undefined, keepIndices = false): number[] {
  if (expected === undefined) return recordWalkScript(keepIndices);
  const bytes: number[] = [...requireU16Equals(expected)];
  if (keepIndices && expected === 0) bytes.push(...parkAbsentRecordBase());
  for (let entry = 0; entry < expected; entry += 1) {
    bytes.push(...recordEntryCheck(keepIndices && entry === 0));
  }
  return bytes;
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
    Opcodes.OP_DUP, ...takeFixedWidthField(2), ...parked(),
  ];
}

/** Consumes one record entry and requires its shape: kept in place, created, or deleted. */
function recordEntryCheck(keepBase = false): number[] {
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK,
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK,
    ...skipLengthPrefixed32(),
    ...skipLengthPrefixed32(),
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK,
    ...(keepBase
      ? [
        Opcodes.OP_2DUP, Opcodes.OP_BIN2NUM, Opcodes.OP_1SUB, Opcodes.OP_TOALTSTACK,
        Opcodes.OP_BIN2NUM, Opcodes.OP_1SUB, Opcodes.OP_TOALTSTACK,
      ]
      : []),
    ...requireRecordShape(),
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
 * Consumes the event list, requiring each output to carry the contract's category with no capability.
 *
 * The category comes from the active input's own token, which the prologue already proved is the contract's
 * category with minting capability; dropping that capability byte leaves the pin an immutable token carries. The
 * listed outputs must strictly increase, so no two events share one and their order is fixed.
 *
 * Each listed index is left parked on the alt stack, deepest first, so the caller can move them to the main stack
 * as tracked slots. The running previous index used for the ordering check is a second copy of the same value, so
 * it is popped and dropped once the list is consumed and only the parked copies remain.
 */
function eventOutputSection(count: number): number[] {
  const bytes: number[] = [Opcodes.OP_1NEGATE, Opcodes.OP_TOALTSTACK];
  for (let event = 0; event < count; event += 1) {
    bytes.push(
      ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
      Opcodes.OP_DUP, Opcodes.OP_OUTPUTTOKENCATEGORY,
      ...immutableCategoryScript(), Opcodes.OP_EQUALVERIFY,
      Opcodes.OP_FROMALTSTACK, Opcodes.OP_OVER, Opcodes.OP_LESSTHAN, Opcodes.OP_VERIFY,
      // Keep the index for the walker, then hand the value back as the running previous index.
      Opcodes.OP_DUP, Opcodes.OP_TOALTSTACK, Opcodes.OP_TOALTSTACK,
    );
  }
  bytes.push(Opcodes.OP_FROMALTSTACK, Opcodes.OP_DROP);
  return bytes;
}

/** Leaves the active input's category without a capability byte: the token category an immutable token carries. */
function immutableCategoryScript(): number[] {
  return [
    Opcodes.OP_INPUTINDEX, Opcodes.OP_UTXOTOKENCATEGORY,
    ...encodeDataPush(scriptNumber(32)), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
  ];
}

/** Consumes the send list, requiring each output to be a user's P2PKH lock. */
function sendOutputSection(count: number): number[] {
  const bytes: number[] = [];
  for (let send = 0; send < count; send += 1) {
    bytes.push(
      ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
      Opcodes.OP_OUTPUTBYTECODE,
      ...assertP2pkhShapeScript(),
      Opcodes.OP_DROP,
    );
  }
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
 * last ends at the commitment the transaction writes. The same walk checks that the state UTXOs spent are exactly
 * the record declared, and that no state output carries the contract's token that no segment declared.
 *
 * The check re-reads the block rather than reusing the shape walk, because the shape walk drops the view payloads it
 * reads. One chain is settled: a contract's data NFT is one record, so the shape covers it. A segment declaring
 * several records, and a later segment declaring a record the chain does not already name, are refused rather than
 * settled partly, because only one chain is walked.
 *
 * A listed send does not carry the record that pays it (section 16 gives a send entry only an output index), so the
 * value floor is emitted only when the entry lists no send.
 */
export interface SelfSettlementShape {
  /** How many call records the tail holds, and so how many segments the execution has after the first. */
  readonly callCount: number;
  /** How many segments the block declares: the call count plus one. */
  readonly segmentCount: number;
  /** How many sends the entry lists, which decides whether the value floor can be checked. */
  readonly sendCount: number;
  /** Where the contract address's payload sits in the running script, for the census. */
  readonly addressPayloadOffset: number;
}

/**
 * Where one segment block keeps the fields it read, with the record's input index topmost, and where it keeps the
 * chain's registers: below the block's remainder and the count it declared.
 */
const RECORD = { in: 0, out: 1, viewIn: 2, viewOut: 3 } as const;
const REGISTER = { declared: 6, chainViewOut: 7, chainIndex: 8, censusIn: 9 } as const;


export function selfSettlementScript(shape: SelfSettlementShape): Uint8Array {
  const { callCount, segmentCount, sendCount, addressPayloadOffset } = shape;
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  const num = (value: number): Uint8Array => encodeDataPush(scriptNumber(value));
  const fromAlt = (count: number): void => { for (let item = 0; item < count; item += 1) emit(Opcodes.OP_FROMALTSTACK); };
  const toAlt = (count: number): void => { for (let item = 0; item < count; item += 1) emit(Opcodes.OP_TOALTSTACK); };
  /**
   * Absence, as the codec writes it: the `u16` sentinel an entry with no index carries. `OP_BIN2NUM` leaves it
   * alone (the machine reads those two bytes as one large negative number), so the raw field is what every
   * comparison in this walk uses.
   */
  const absent = (): void => emit(...encodeDataPush(INDEX_NONE_BYTES));
  /** A copy of the item at `depth` in the layout the surrounding block describes, `held` values above it. */
  const copy = (depth: number, held = 0): void => emit(num(depth + held), Opcodes.OP_PICK);
  /** Removes the item at `depth` (plus `held`), keeping every other item in order. */
  const discard = (depth: number, held = 0): void => emit(num(depth + held), Opcodes.OP_ROLL, Opcodes.OP_DROP);
  /** Leaves whether the item at `depth` (plus `held`) has no index, as the record entries express absence. */
  const indexIsAbsent = (depth: number, held = 0): void => { copy(depth, held); absent(); emit(Opcodes.OP_EQUAL); };
  /** A record the entry lists no send from keeps at least the value it held. */
  const emitValueFloor = (): void => {
    indexIsAbsent(RECORD.in); // the input side
    emit(Opcodes.OP_NOT);
    indexIsAbsent(RECORD.out, 1); // the output side
    emit(Opcodes.OP_NOT, Opcodes.OP_BOOLAND, Opcodes.OP_IF);
    copy(RECORD.out);
    emit(Opcodes.OP_OUTPUTVALUE);
    copy(RECORD.in, 1);
    emit(Opcodes.OP_UTXOVALUE);
    emit(Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY);
    emit(Opcodes.OP_ENDIF);
  };

  emit(...readOwnWitnessBlockScript());
  // Everything before the segments: the fixed header, the variable frame fields, and the calls.
  emit(...dropPrefix(WITNESS_BLOCK_HEADER_LENGTH));
  emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
  emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
  emit(...takeFixedWidthField(8), Opcodes.OP_NIP);
  emit(...takeLengthPrefixedField32(), Opcodes.OP_NIP);
  emit(...requireU16Equals(callCount));
  for (let call = 0; call < callCount; call += 1) emit(...callRecordSkip());
  emit(...requireU16Equals(segmentCount));

  // The chain's registers, parked so that taking them back leaves the flag topmost: whether any segment has
  // declared the record at all, the commitment its last declaration ended at, the record's live index, and the
  // input index the census declares.
  emit(Opcodes.OP_0);
  emit(Opcodes.OP_TOALTSTACK); // declared
  emit(Opcodes.OP_0);
  emit(Opcodes.OP_TOALTSTACK); // chainViewOut
  absent();
  emit(Opcodes.OP_TOALTSTACK); // chainIndex
  absent();
  emit(Opcodes.OP_TOALTSTACK); // censusIn

  for (let segment = 0; segment < segmentCount; segment += 1) {
    // The registers come up from the park and the block's remainder goes on top of them, so the segment's own
    // fields can be taken off its front: `[tail, declared, chainViewOut, chainIndex, censusIn]`.
    fromAlt(4);
    emit(num(4), Opcodes.OP_ROLL);
    // The declared record count, as a number: `[count, tail, declared, chainViewOut, chainIndex, censusIn]`.
    emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM);
    // At most one record is settled: several would need a chain each, and only one is walked.
    emit(Opcodes.OP_DUP, num(2), Opcodes.OP_LESSTHAN, Opcodes.OP_VERIFY);
    emit(Opcodes.OP_DUP, num(1), Opcodes.OP_NUMEQUAL, Opcodes.OP_IF);

    // The four declared fields come off the block onto the top, in the order the reader leaves them:
    // `[in, out, viewIn, viewOut, tail, count, declared, chainViewOut, chainIndex, censusIn]`. The two index
    // fields are normalised, so an index that has none reads as the same number the chain registers use.
    emit(Opcodes.OP_SWAP);
    emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_TOALTSTACK);
    emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_TOALTSTACK);
    emit(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK);
    emit(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK);
    fromAlt(4);
    // Kept in place, created or deleted, and never moved.
    copy(RECORD.in);
    copy(RECORD.out, 1);
    emit(...requireRecordShape());

    // The chain as this declaration found it, by register depth: declared 6, chainViewOut 7, chainIndex 8,
    // censusIn 9. The record's own fields stay at 0..3 for the whole block.
    copy(REGISTER.declared);
    emit(Opcodes.OP_IF);
    // A continuation: the record is already in the chain, so this declaration has to carry on from it.
    copy(REGISTER.chainIndex);
    absent();
    emit(Opcodes.OP_EQUAL, Opcodes.OP_NOT, Opcodes.OP_VERIFY);
    copy(REGISTER.chainIndex);
    copy(RECORD.in, 1);
    emit(Opcodes.OP_EQUALVERIFY);
    copy(REGISTER.chainViewOut);
    copy(RECORD.viewIn, 1);
    emit(Opcodes.OP_EQUALVERIFY);
    if (sendCount === 0) {
      // A record the execution created has no value it held before it, so the floor is the first declaration's
      // business and a continuation only has to keep what a transaction input already held.
      copy(REGISTER.censusIn);
      absent();
      emit(Opcodes.OP_EQUAL, Opcodes.OP_NOT, Opcodes.OP_IF);
      emitValueFloor();
      emit(Opcodes.OP_ENDIF);
    }

    // The new registers, the deepest of the four first, so the top of the stack reads `declared, chainViewOut,
    // chainIndex, censusIn` once the block has replaced them.
    copy(REGISTER.censusIn); // unchanged: the record first appears where the chain says it does
    indexIsAbsent(RECORD.out, 1);
    emit(Opcodes.OP_IF);
    absent(); // a deleted record: its index is gone, which ends the chain
    emit(Opcodes.OP_ELSE);
    copy(RECORD.out, 1);
    emit(Opcodes.OP_ENDIF);
    copy(RECORD.viewOut, 2); // chainViewOut = viewOut
    emit(num(1)); // declared

    emit(Opcodes.OP_ELSE);
    // A first declaration: the record is not in the chain yet, so this one establishes where it lives.
    if (sendCount === 0) emitValueFloor();
    // A declaration that spends the record has to be the commitment the transaction spends.
    indexIsAbsent(RECORD.in);
    emit(Opcodes.OP_IF);
    emit(Opcodes.OP_ELSE);
    copy(RECORD.in);
    emit(Opcodes.OP_UTXOTOKENCOMMITMENT);
    copy(RECORD.viewIn, 1);
    emit(Opcodes.OP_EQUALVERIFY);
    emit(Opcodes.OP_ENDIF);

    copy(RECORD.in); // censusIn = the index the record was read at
    indexIsAbsent(RECORD.out, 1);
    emit(Opcodes.OP_IF);
    absent(); // a deleted record ends the chain where it was
    emit(Opcodes.OP_ELSE);
    indexIsAbsent(RECORD.in, 1);
    emit(Opcodes.OP_IF);
    copy(RECORD.out, 1); // created: the record lives where it is written
    emit(Opcodes.OP_ELSE);
    copy(RECORD.in, 1); // kept in place: the index it was read at
    emit(Opcodes.OP_ENDIF);
    emit(Opcodes.OP_ENDIF);
    copy(RECORD.viewOut, 2); // chainViewOut = viewOut
    emit(num(1)); // declared
    emit(Opcodes.OP_ENDIF);

    // The four new registers sit above what the block read, so the fields, the count and the registers this
    // declaration replaces are four and five deep; dropping them leaves the block's remainder and the new four.
    const replaced = RECORD.viewOut + 1;
    discard(replaced); // in
    discard(replaced); // out
    discard(replaced); // viewIn
    discard(replaced); // viewOut
    for (let count = 0; count < 5; count += 1) discard(replaced + 1);
    toAlt(4);

    emit(Opcodes.OP_ELSE);
    // No record in this segment: the chain carries over unchanged.
    emit(Opcodes.OP_DROP); // count
    emit(num(1), Opcodes.OP_ROLL, Opcodes.OP_TOALTSTACK);
    emit(num(1), Opcodes.OP_ROLL, Opcodes.OP_TOALTSTACK);
    emit(num(1), Opcodes.OP_ROLL, Opcodes.OP_TOALTSTACK);
    emit(num(1), Opcodes.OP_ROLL, Opcodes.OP_TOALTSTACK);
    emit(Opcodes.OP_ENDIF);
  }

  // The chain's end: where the last declaration left the record is what the transaction writes. The registers come
  // back as `[declared, chainViewOut, chainIndex, censusIn]`, with the block's remainder below them.
  fromAlt(4);
  discard(REGISTER.declared - REGISTER.declared); // the flag, which has no part in the closing comparison
  // `[chainViewOut, chainIndex, censusIn, tail]`.
  copy(1);
  absent();
  emit(Opcodes.OP_EQUAL, Opcodes.OP_IF);
  emit(Opcodes.OP_DROP); // nothing was declared, or the record was deleted, so there is no output to compare
  emit(Opcodes.OP_ELSE);
  copy(1);
  emit(Opcodes.OP_OUTPUTTOKENCOMMITMENT);
  copy(0, 1);
  emit(Opcodes.OP_EQUALVERIFY);
  emit(Opcodes.OP_DROP); // the commitment the last declaration ended at
  emit(Opcodes.OP_ENDIF);

  // The census reads the transaction rather than the walk's leavings, so the block's own remainder goes with the
  // rest: `[chainIndex, censusIn, tail]` becomes an empty stack and two parked indices.
  emit(Opcodes.OP_TOALTSTACK); // chainIndex, the index the census expects a state output at
  emit(Opcodes.OP_TOALTSTACK); // censusIn, the index it expects a state UTXO at
  emit(Opcodes.OP_DROP); // the block's own remainder
  emit(...stateUtxosAreDeclaredScript(addressPayloadOffset));
  emit(...stateOutputsAreDeclaredScript(addressPayloadOffset));
  return new Uint8Array(bytes);
}

/**
 * Requires that an input carries a state record exactly when it is the one the segment declared.
 *
 * The state UTXOs the transaction spends are exactly the records the master touched. Comparing each input's own
 * token against the declared index, rather than collecting the declared set, needs no storage for a set whose
 * length the block decides. The declared index is parked on the alt stack; the no-index sentinel makes the same
 * comparison refuse every state UTXO when the segment declared none.
 */
function stateUtxosAreDeclaredScript(addressPayloadOffset: number): number[] {
  return censusLoop(Opcodes.OP_UTXOTOKENCATEGORY, Opcodes.OP_TXINPUTCOUNT, Opcodes.OP_TXOUTPUTCOUNT, addressPayloadOffset);
}

/**
 * Requires that an output carries a state record exactly when it is the one the segment declared.
 *
 * The record's own token is the only state token the shape admits beside the contract's validator, which a master
 * that makes an ordinary call recreates in place. Comparing each output's own token against the declared output
 * index refuses an extra state output the same way the input rule refuses an extra state input.
 *
 * A validator of the contract's own category is recreated in place at the contract address, carrying the same
 * mutable token a record does. That index is not a record: the input and the output at it are both locked to the
 * address the master reserves, so the census admits it beside the records the segment declared.
 */
function stateOutputsAreDeclaredScript(addressPayloadOffset: number): number[] {
  return censusLoop(Opcodes.OP_OUTPUTTOKENCATEGORY, Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_TXINPUTCOUNT, addressPayloadOffset);
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

/**
 * Requires that index `i` carries this contract's mutable token exactly when the segment declared it, or when `i`
 * recreates the contract's validator.
 *
 * Entry is the expected index on the alt stack. The address is pushed first and sits under the expected index, so
 * the comparisons the old loop made keep their depths. Exit drops the address, the expected index and the cursor.
 */
function censusLoop(
  tokenOpcode: number,
  countOpcode: number,
  otherCountOpcode: number,
  addressPayloadOffset: number,
): number[] {
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  const num = (value: number): Uint8Array => encodeDataPush(scriptNumber(value));

  emit(...pushContractAddress(addressPayloadOffset));
  emit(Opcodes.OP_FROMALTSTACK);
  emit(Opcodes.OP_0);
  emit(Opcodes.OP_BEGIN);
  emit(Opcodes.OP_DUP, tokenOpcode, ...mutableRecordPin(), Opcodes.OP_EQUAL);
  emit(num(1), Opcodes.OP_PICK, num(3), Opcodes.OP_PICK, Opcodes.OP_NUMEQUAL);
  emit(Opcodes.OP_NUMEQUAL);
  // A validator recreation: both sides exist, both locks are the contract address, and both tokens are mutable.
  emit(num(1), Opcodes.OP_PICK, otherCountOpcode, Opcodes.OP_LESSTHAN, Opcodes.OP_IF);
  emit(num(1), Opcodes.OP_PICK, Opcodes.OP_UTXOBYTECODE, num(4), Opcodes.OP_PICK, Opcodes.OP_EQUAL);
  emit(num(2), Opcodes.OP_PICK, Opcodes.OP_OUTPUTBYTECODE, num(5), Opcodes.OP_PICK, Opcodes.OP_EQUAL);
  emit(Opcodes.OP_BOOLAND);
  emit(num(2), Opcodes.OP_PICK, Opcodes.OP_UTXOTOKENCATEGORY, ...mutableRecordPin(), Opcodes.OP_EQUAL);
  emit(Opcodes.OP_BOOLAND);
  emit(num(2), Opcodes.OP_PICK, Opcodes.OP_OUTPUTTOKENCATEGORY, ...mutableRecordPin(), Opcodes.OP_EQUAL);
  emit(Opcodes.OP_BOOLAND);
  emit(Opcodes.OP_ELSE, Opcodes.OP_0, Opcodes.OP_ENDIF);
  emit(Opcodes.OP_BOOLOR, Opcodes.OP_VERIFY);
  emit(Opcodes.OP_1ADD);
  emit(Opcodes.OP_DUP, countOpcode, Opcodes.OP_GREATERTHANOREQUAL);
  emit(Opcodes.OP_UNTIL);
  emit(Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP);
  return bytes;
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
