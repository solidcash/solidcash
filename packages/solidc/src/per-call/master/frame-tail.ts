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
   * The argument pushes the source passes, in parameter order and the canonical encoding: exactly the bytes the
   * callee carries between its selector and its redeem script. `SHA256(selector || argumentPushes)` is the digest
   * the caller's own code computes at the call site, and the record must carry it. Absent for a call with no
   * argument.
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
 * must equal the number of sites (a loop that varies it is not emitted), and each record is walked past — the
 * site that made the call binds it in the caller's own body. The segment count must be the call count plus one,
 * and every segment's records are walked. The event and send counts must equal the shape's, and each listed
 * output is checked. The remaining tail must be empty, so nothing follows the last field.
 */
export function verifyTailScript(
  callSites: readonly MasterCallSite[],
  tail: MasterTailShape = zeroTailShape(callSites.length),
): Uint8Array {
  const bytes: number[] = [];
  bytes.push(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_0, Opcodes.OP_EQUALVERIFY);
  bytes.push(...requireU16Equals(callSites.length));
  for (let site = 0; site < callSites.length; site += 1) bytes.push(...callRecordSkip());
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
 * The head requires this master to be its category's only master, and the emitter calls this only for an entry that
 * makes no external call — a condition stricter than the spec's, which asks for one master that made no `DELEGATE`
 * or `INTERNAL` call and lets a master that makes ordinary calls settle its own records across its several
 * segments. Such a master is not settled here: the walk below covers one segment, so a master with calls keeps its
 * records out of settlement until the cross-segment chain is emitted.
 *
 * For the master that qualifies, its one segment's record declarations are the whole settlement: every declared
 * record begins at the commitment the transaction spends and ends at the commitment it writes, at the index the
 * declaration names, and the state UTXOs spent are exactly the records declared. The check re-reads the block
 * instead of reusing the shape walk, because the shape walk drops the view payloads it reads.
 *
 * Only a segment declaring at most one record is settled here: a contract's data NFT is one record, so the shape
 * covers it. A segment declaring several records (mapping nodes, chunks) is refused rather than settled partly,
 * because their chains are not emitted.
 *
 * A listed send does not carry the record that pays it (section 16 gives a send entry only an output index), so the
 * value floor is emitted only when the entry lists no send.
 */
export function selfSettlementScript(sendCount: number, addressPayloadOffset: number): Uint8Array {
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  const num = (value: number): Uint8Array => encodeDataPush(scriptNumber(value));

  emit(...readOwnWitnessBlockScript());
  // Everything before the one segment's record list: the fixed header, then the variable frame fields, then the
  // call count and the segment count.
  emit(...dropPrefix(WITNESS_BLOCK_HEADER_LENGTH));
  emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
  emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
  emit(...takeFixedWidthField(8), Opcodes.OP_NIP);
  emit(...takeLengthPrefixedField32(), Opcodes.OP_NIP);
  emit(...requireU16Equals(0));
  emit(...requireU16Equals(1));

  // The record list, walked with the count and a cursor below it, as the shape walk does.
  emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP, Opcodes.OP_0, Opcodes.OP_SWAP);
  emit(num(2), Opcodes.OP_PICK, num(2), Opcodes.OP_LESSTHAN, Opcodes.OP_VERIFY);
  emit(num(2), Opcodes.OP_PICK, num(1), Opcodes.OP_NUMEQUAL, Opcodes.OP_IF);
  emit(...singleRecordSettlement(sendCount));
  emit(Opcodes.OP_ELSE);
  // No record: no state UTXO may be spent and no state output may exist, expressed as an index no input or output
  // can have. The output index is parked first, so the input rule's pass reads its own index first.
  emit(...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_TOALTSTACK);
  emit(...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_TOALTSTACK);
  emit(Opcodes.OP_ENDIF);
  emit(num(1), Opcodes.OP_ROLL, Opcodes.OP_DROP, num(1), Opcodes.OP_ROLL, Opcodes.OP_DROP, Opcodes.OP_DROP);

  emit(...stateUtxosAreDeclaredScript(addressPayloadOffset));
  emit(...stateOutputsAreDeclaredScript(addressPayloadOffset));
  return new Uint8Array(bytes);
}

/**
 * The checks one declared record must satisfy, leaving the walk state and parking the index a spent state UTXO is
 * expected at on the alt stack.
 *
 * Entry `[recordCount, cursor, tail]`, exit the same. The four record fields are parked and brought back with the
 * input index on top. A kept record's declaration is required to be the real input and output commitments; a created
 * or deleted record has one side without an index, and the missing side is not compared.
 */
function singleRecordSettlement(sendCount: number): number[] {
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  const num = (value: number): Uint8Array => encodeDataPush(scriptNumber(value));

  emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_TOALTSTACK);
  emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_TOALTSTACK);
  emit(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK);
  emit(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_TOALTSTACK);
  emit(Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK);
  // [in, out, viewIn, viewOut, tail, cursor, recordCount]

  // The shape the record walk checks, on a copy of the pair so the indices stay for the comparisons below.
  emit(Opcodes.OP_2DUP, ...requireRecordShape());

  // The input the record is carried at must be a state record and its commitment must be the declared `viewIn`.
  // The gate compares a copy, so the arm that checks runs against the untouched stack and both arms are neutral.
  emit(Opcodes.OP_DUP, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL, Opcodes.OP_IF);
  emit(Opcodes.OP_ELSE);
  emit(Opcodes.OP_DUP, Opcodes.OP_UTXOTOKENCATEGORY, ...mutableRecordPin(), Opcodes.OP_EQUALVERIFY);
  emit(Opcodes.OP_DUP, Opcodes.OP_UTXOTOKENCOMMITMENT, num(3), Opcodes.OP_PICK, Opcodes.OP_EQUALVERIFY);
  emit(Opcodes.OP_ENDIF);

  // The output the record is written to must be a state record and its commitment must be the declared `viewOut`.
  emit(num(1), Opcodes.OP_PICK, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL, Opcodes.OP_IF);
  emit(Opcodes.OP_ELSE);
  emit(num(1), Opcodes.OP_PICK, Opcodes.OP_OUTPUTTOKENCATEGORY, ...mutableRecordPin(), Opcodes.OP_EQUALVERIFY);
  emit(num(1), Opcodes.OP_PICK, Opcodes.OP_OUTPUTTOKENCOMMITMENT, num(4), Opcodes.OP_PICK, Opcodes.OP_EQUALVERIFY);
  emit(Opcodes.OP_ENDIF);

  // A record the entry lists no send from keeps at least the value it held.
  if (sendCount === 0) {
    emit(num(0), Opcodes.OP_PICK, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL);
    emit(num(2), Opcodes.OP_PICK, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL);
    emit(Opcodes.OP_NOT, Opcodes.OP_SWAP, Opcodes.OP_NOT, Opcodes.OP_BOOLAND, Opcodes.OP_IF);
    emit(num(1), Opcodes.OP_PICK, Opcodes.OP_OUTPUTVALUE);
    emit(num(1), Opcodes.OP_PICK, Opcodes.OP_UTXOVALUE);
    emit(Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY);
    emit(Opcodes.OP_ENDIF);
  }

  // Park the indices the transaction must carry the record at: the output index first, then the input index, so
  // the input rule's pass reads its own index from the alt stack first. The no-index sentinel stands in for a side
  // the record does not have.
  emit(num(1), Opcodes.OP_PICK, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL, Opcodes.OP_IF);
  emit(...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_TOALTSTACK);
  emit(Opcodes.OP_ELSE);
  emit(num(1), Opcodes.OP_PICK, Opcodes.OP_TOALTSTACK);
  emit(Opcodes.OP_ENDIF);
  emit(Opcodes.OP_DUP, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL, Opcodes.OP_IF);
  emit(Opcodes.OP_DROP, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_TOALTSTACK);
  emit(Opcodes.OP_ELSE);
  emit(Opcodes.OP_TOALTSTACK);
  emit(Opcodes.OP_ENDIF);
  // The two parked indices left the stack, so only `out`, `viewIn` and `viewOut` are dropped.
  emit(Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP);
  return bytes;
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
 * The record's own token is the only state token the shape admits: a self-settling master makes no external call,
 * so the shape has no validator to recreate and its one record is its whole state. Comparing each output's own token
 * against the declared output index refuses an extra state output the same way the input rule refuses an extra state
 * input.
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
