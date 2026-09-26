/**
 * Walking the variable-length tail of a witness block inside script, and the checks a frame makes about the
 * transaction around it.
 *
 * The tail of section 16's block follows the frame fields: `retval`, then a call per external call, then the
 * segment, event and send sections. A frame that makes no call only has to know that it made none; a frame that
 * makes a call has to bind each record to the callee it names. The reader in `witness-reader.ts` takes fields off
 * the front of the tail; these builders walk it.
 *
 * The call-shape checks are the whole of a call's proof on the caller's side:
 *
 *   - the callee is not this input (a master never calls itself);
 *   - the recorded `argsHash` is the digest the caller's own code computes from the argument values it passes:
 *     `SHA256(selector || argument pushes)`, the pushes being the source values in the canonical encoding;
 *   - the callee's unlocking bytecode carries the selector the site names, with its argument pushes after it, and
 *     `SHA256(selector || args)` over those bytes is the same recorded digest;
 *   - the callee address the record names is the one the code calls, and the frame kind is the one it records.
 *
 * The result is read from the record and must be empty here: a site whose callee returns a value needs the value
 * on the stack, which the entry-return machinery does not emit yet.
 *
 * The recorded digest is the caller's own computation, so a builder cannot forge an argument by changing the
 * callee's bytes and the recorded hash together: the code's operands are the source's values. The callee's bytes
 * are still tied to the same digest, so a call whose callee carries other arguments than the source passed is
 * refused as well. A site whose arguments are not compile-time values has no digest the code can compute and is
 * refused by name rather than checked against the callee's bytes.
 *
 * The arguments of a call are the pushes between its selector push and the redeem-script push that closes the
 * callee's unlocking bytecode. Both pushes are stripped, so the arguments are however many pushes the callee
 * carries — none for a call with no arguments, in which case the hash is over the selector bytes alone.
 *
 * The sections after the calls are checked, not dropped. The segment count is the call count plus one; every
 * segment's records are walked and each entry's shape is checked, so a record is kept in place, created or
 * deleted and never moved. The event and send counts are the ones the entry fixes, and each listed output is
 * checked: an event output carries the contract's category with no capability, and a send output is a user's
 * P2PKH lock. The last check is that nothing follows the final field, which is what makes the walk exact.
 *
 * The event walk leaves each listed output index parked on the alt stack, in list order, so the head can hand
 * them to the body as tracked slots instead of dropping them with the rest of the tail.
 */

import { encodeDataPush, Opcodes } from '@bitauth/libauth';
import { TokenCapability, argsHash } from '@solidcash/utils';
import {
  dropFirstPushScript,
  dropLastPushScript,
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
   * The argument pushes the caller's code passes, in parameter order and the canonical encoding: exactly the
   * bytes the callee carries between its selector and its redeem script. `SHA256(selector || argumentPushes)` is
   * the digest the caller's own code computes, and the record must carry it. Absent for a call with no argument.
   */
  readonly argumentPushes?: Uint8Array;
}

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
 * must equal the number of sites (a loop that varies it is not emitted), and each record is checked against its
 * site. The segment count must be the call count plus one, and every segment's records are walked. The event and
 * send counts must equal the shape's, and each listed output is checked. The remaining tail must be empty, so
 * nothing follows the last field.
 */
export function verifyTailScript(
  callSites: readonly MasterCallSite[],
  tail: MasterTailShape = zeroTailShape(callSites.length),
): Uint8Array {
  const bytes: number[] = [];
  bytes.push(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_0, Opcodes.OP_EQUALVERIFY);
  bytes.push(...requireU16Equals(callSites.length));
  for (const site of callSites) bytes.push(...callRecordChecks(site));
  bytes.push(...requireU16Equals(callSites.length + 1));
  for (let segment = 0; segment < callSites.length + 1; segment += 1) {
    bytes.push(...segmentRecordSection(tail.segmentRecordCounts?.[segment]));
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
function segmentRecordSection(expected: number | undefined): number[] {
  if (expected === undefined) return recordWalkScript();
  const bytes: number[] = [...requireU16Equals(expected)];
  for (let entry = 0; entry < expected; entry += 1) bytes.push(...recordEntryCheck());
  return bytes;
}

/**
 * Consumes a segment's record list whose length the entry does not fix, checking each entry's shape.
 *
 * The count is not known, so it is read and its entries walked. The walk is guarded so a segment with no record
 * consumes none: the loop runs at least once, so a zero count would otherwise read a record that is not there.
 * The count and the cursor sit below the tail on the main stack, so the tail stays on top for the field reader.
 */
function recordWalkScript(): number[] {
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP,
    Opcodes.OP_0, Opcodes.OP_SWAP,
    ...encodeDataPush(scriptNumber(2)), Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_NUMEQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_ELSE,
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

/** Consumes one record entry and requires its shape: kept in place, created, or deleted. */
function recordEntryCheck(): number[] {
  return [
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK,
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK,
    ...skipLengthPrefixed32(),
    ...skipLengthPrefixed32(),
    Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK,
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
function requireRecordShape(): number[] {
  // a = in has no index, b = out has no index, c = the indices are equal.
  return [
    Opcodes.OP_DUP, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL, Opcodes.OP_TOALTSTACK,
    Opcodes.OP_SWAP, Opcodes.OP_DUP, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL, Opcodes.OP_TOALTSTACK,
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

/** The digest a site's own code computes: `SHA256(selector || argument pushes)` over the caller's passed values. */
function callerArgumentDigest(site: MasterCallSite): Uint8Array {
  return argsHash(site.selector, site.argumentPushes ?? new Uint8Array(0));
}

/** The checks one `calls[k]` record must satisfy, consuming it from the front of the tail. */
function callRecordChecks(site: MasterCallSite): number[] {
  const bytes: number[] = [];
  // kind
  bytes.push(...takeFixedWidthField(1), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
    ...encodeDataPush(scriptNumber(site.kind)), Opcodes.OP_NUMEQUALVERIFY);
  // target
  bytes.push(...takeLengthPrefixedField(), Opcodes.OP_SWAP,
    ...encodeDataPush(site.target), Opcodes.OP_EQUALVERIFY);
  // value: the validator binds the callee's value to this one; the caller does not check it.
  bytes.push(...takeFixedWidthField(8), Opcodes.OP_NIP);
  // calleeRef, kept on the alt stack while the hash is read.
  bytes.push(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_DUP,
    Opcodes.OP_INPUTINDEX, Opcodes.OP_NUMNOTEQUAL, Opcodes.OP_VERIFY, Opcodes.OP_TOALTSTACK);
  // argsHash: the recorded digest must be the one the caller's own code computes from the argument values it
  // passes. The record is not the authority; the code's operands are the source's values, so a builder cannot
  // forge an argument by changing the callee's bytes and the recorded hash together. The record is kept while the
  // callee's bytes are checked below, which ties them to the same digest.
  bytes.push(...takeFixedWidthField(32), Opcodes.OP_SWAP);
  bytes.push(Opcodes.OP_DUP, ...encodeDataPush(callerArgumentDigest(site)), Opcodes.OP_EQUALVERIFY);
  // The callee's unlocking bytecode is its witness block, then its call data, then its redeem script. The call
  // data is what the first and last pushes leave between them: the selector's own push, then the argument pushes.
  // Hashing the selector's payload concatenated with the argument pushes is `SHA256(selector || args)`; a call
  // with no arguments leaves that region empty and hashes the selector bytes alone, so one path serves both.
  bytes.push(Opcodes.OP_FROMALTSTACK, Opcodes.OP_INPUTBYTECODE,
    ...dropFirstPushScript(), ...dropLastPushScript(), ...splitFirstPushScript(),
    Opcodes.OP_SWAP, Opcodes.OP_DUP, ...encodeDataPush(site.selector), Opcodes.OP_EQUALVERIFY,
    Opcodes.OP_SWAP, Opcodes.OP_CAT, Opcodes.OP_SHA256, Opcodes.OP_EQUALVERIFY);
  // result: a supported call returns nothing.
  bytes.push(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_0, Opcodes.OP_EQUALVERIFY);
  return bytes;
}

/**
 * Consumes a pinned category on top and requires exactly one input to carry it.
 *
 * Entry `[..., pinned]`, exit `[...]`. A master's `pinned` is `OP_INPUTINDEX OP_UTXOTOKENCATEGORY`, which the
 * prologue has already required to be the contract's category with minting capability. Masters are the only
 * UTXOs that carry that, so a count of one is N1's "it is the only master of X in the transaction".
 */
export function requireSingleMasterScript(): Uint8Array {
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
    Opcodes.OP_1, Opcodes.OP_NUMEQUALVERIFY,
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
 * bytecode, after the transcript — must be `pin(c)` followed by a program hashing to the expected hash. The pin's
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
    // `pin(c) || program`: the pin is 33 bytes, and the program must hash to the reserved slot, four items below
    // the computed hash.
    ...encodeDataPush(scriptNumber(33)), Opcodes.OP_SPLIT,
    Opcodes.OP_SHA256, ...encodeDataPush(scriptNumber(4)), Opcodes.OP_PICK, Opcodes.OP_EQUALVERIFY,
    // The pin's category must be the category the UTXO carries.
    Opcodes.OP_1, Opcodes.OP_PICK, Opcodes.OP_EQUALVERIFY,
    Opcodes.OP_NIP, Opcodes.OP_DROP,
    // The reserved hash, consumed with the index.
    Opcodes.OP_DROP,
  ]);
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
