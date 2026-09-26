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
 *   - the callee's unlocking bytecode carries the selector the site names, with its argument pushes after it;
 *   - `SHA256(selector || args)` equals the record's `argsHash`, computed from the callee's own call data;
 *   - the callee address the record names is the one the code calls, and the frame kind is the one it records.
 *
 * The result is read from the record and must be empty here: a site whose callee returns a value needs the value
 * on the stack, which the entry-return machinery does not emit yet.
 *
 * The arguments of a call are the pushes between its selector push and the redeem-script push that closes the
 * callee's unlocking bytecode. Both pushes are stripped, so the arguments are however many pushes the callee
 * carries — none for a call with no arguments, in which case the hash is over the selector bytes alone. Segment
 * settlement — the records a segment computed equalling its `viewOut` — is a separate stream and is not emitted.
 */

import { encodeDataPush, Opcodes } from '@bitauth/libauth';
import { TokenCapability } from '@solidcash/utils';
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
}

/**
 * Consumes the tail of a witness block, requiring it to describe exactly `callSites` external calls.
 *
 * Entry `[..., tail]`, exit `[...]`. `retval` must be empty (a supported entry returns nothing), the call count
 * must equal the number of sites (a loop that varies it is not emitted), and each record is checked against its
 * site. The segment, event and send sections after the calls belong to settlement and are dropped.
 */
export function verifyTailScript(callSites: readonly MasterCallSite[]): Uint8Array {
  const bytes: number[] = [];
  bytes.push(...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_0, Opcodes.OP_EQUALVERIFY);
  bytes.push(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
    ...encodeDataPush(scriptNumber(callSites.length)), Opcodes.OP_NUMEQUALVERIFY);
  for (const site of callSites) bytes.push(...callRecordChecks(site));
  bytes.push(Opcodes.OP_DROP);
  return new Uint8Array(bytes);
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
  // argsHash
  bytes.push(...takeFixedWidthField(32), Opcodes.OP_SWAP);
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
 * whose token is not the one its script pins is refused. P2SH32 consensus gives its lock as `addrV(c)`; the master
 * skips the transcript and never interprets it.
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
