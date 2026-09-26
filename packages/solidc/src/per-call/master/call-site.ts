/**
 * Binding an external call to its own witness record where the source makes the call.
 *
 * A per-call master records every external call in the witness block it carries as the first push of its own
 * unlocking bytecode. The proof of a call belongs at the call site, in the caller's own code, so this module
 * emits that proof into the body: the code reads its block back from the transaction, walks to the record its
 * site names, and binds the record to what the source says.
 *
 * The record is addressed by the site's position `k`, so the walk is exact: the frame fields come first, then
 * `retval`, then the records before this one are stepped over by their own widths, and only the `k`-th is read.
 * The checks are:
 *
 *   - the record's `kind` is the site's frame kind, and its `target` is the address the site calls;
 *   - its `argsHash` is the digest the caller's own code computes from the source's argument values,
 *     `SHA256(selector || argument pushes)`, the pushes being those values in the canonical encoding. The record
 *     is not the authority for the digest, the code's operands are, so a builder cannot forge an argument by
 *     changing the callee's bytes and the recorded hash together;
 *   - its `calleeRef` is not this input, and the callee's own call data — the pushes between its witness block and
 *     its redeem script — carries the site's selector and hashes to the same recorded digest, which ties the
 *     callee the transaction co-spends to the site;
 *   - the call's result is the record's `result`, which is what the body uses; a site that returns nothing
 *     requires the `result` to be empty.
 *
 * Entry `[..., base]`, exit `[..., base]` for a site that returns nothing and `[..., base, result]` for one whose
 * caller uses the value. The block is read from the canonical location (`OP_INPUTINDEX OP_INPUTBYTECODE`), so the
 * code and any verifier of the same input can never disagree about which bytes were checked.
 */

import { encodeDataPush, Opcodes } from '@bitauth/libauth';
import { argsHash, encodeCallDataArguments } from '@solidcash/utils';
import type { MasterCallSite } from './frame-tail.js';
import {
  dropFirstPushScript,
  dropLastPushScript,
  readFrameHeaderScript,
  readOwnWitnessBlockScript,
  splitFirstPushScript,
  takeFixedWidthField,
  takeLengthPrefixedField,
  takeLengthPrefixedField32,
} from './witness-reader.js';

/**
 * The checks one call site makes against its own record.
 *
 * `index` is the site's position among the entry's external calls, which is the record it addresses. `usesResult`
 * is true when the caller's code consumes the call's value; false requires the record to carry an empty result.
 *
 * `digestFromStack` says the caller's own code computed the argument digest where it calls, from values only the
 * running execution holds, and left it on top of the stack. The constant form the compiler folds from compile-time
 * arguments is the other, smaller case.
 */
export function callSiteCheckScript(
  site: MasterCallSite,
  index: number,
  usesResult: boolean,
  options: { readonly digestFromStack?: boolean } = {},
): Uint8Array {
  const digestFromStack = options.digestFromStack === true;
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  // The digest the caller computed goes where the walk can reach it: beneath the walk's own scratch, on the
  // alternate stack.
  if (digestFromStack) emit(Opcodes.OP_TOALTSTACK);
  // The caller's own block, read from the first push of its own unlocking bytecode.
  emit(...readOwnWitnessBlockScript());
  // The magic and version are required; the four fixed header fields are only walked past.
  emit(...readFrameHeaderScript());
  emit(Opcodes.OP_TOALTSTACK, Opcodes.OP_2DROP, Opcodes.OP_2DROP, Opcodes.OP_FROMALTSTACK);
  // `sender`, `self` and `value` are read only to advance the cursor to the tail.
  emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
  emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
  emit(...takeFixedWidthField(8), Opcodes.OP_NIP);
  // `retval`.
  emit(...takeLengthPrefixedField32(), Opcodes.OP_NIP);
  // `callCount`: the head fixes how many records the tail holds, so the site only walks them.
  emit(...takeFixedWidthField(2), Opcodes.OP_NIP);
  // The records before this site's, stepped over by their own widths.
  for (let earlier = 0; earlier < index; earlier += 1) emit(...skipCallRecord());
  emit(...bindCallRecord(site, usesResult, digestFromStack));
  return new Uint8Array(bytes);
}

/** Steps one call record off the front of the tail without reading it. */
function skipCallRecord(): number[] {
  return [
    ...takeFixedWidthField(1), Opcodes.OP_NIP, // kind
    ...takeLengthPrefixedField(), Opcodes.OP_NIP, // target
    ...takeFixedWidthField(8), Opcodes.OP_NIP, // value
    ...takeFixedWidthField(2), Opcodes.OP_NIP, // calleeRef
    ...takeFixedWidthField(32), Opcodes.OP_NIP, // argsHash
    ...takeLengthPrefixedField32(), Opcodes.OP_NIP, // result
  ];
}

/** The checks one `calls[k]` record must satisfy, consuming the record and binding the result. */
function bindCallRecord(site: MasterCallSite, usesResult: boolean, digestFromStack: boolean): number[] {
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };

  // kind: the frame the callee runs is the one the site records.
  emit(...takeFixedWidthField(1), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
    ...encodeDataPush(scriptNumber(site.kind)), Opcodes.OP_NUMEQUALVERIFY);
  // target: the address called is the one the source names.
  emit(...takeLengthPrefixedField(), Opcodes.OP_SWAP,
    ...encodeDataPush(site.target), Opcodes.OP_EQUALVERIFY);
  // value: the validator binds the callee's value to this one; the caller does not check it here.
  emit(...takeFixedWidthField(8), Opcodes.OP_NIP);
  // calleeRef: a master never calls itself. Parked while the arguments hash is read, so it is on hand for the
  // callee's own bytes.
  emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_DUP,
    Opcodes.OP_INPUTINDEX, Opcodes.OP_NUMNOTEQUAL, Opcodes.OP_VERIFY, Opcodes.OP_TOALTSTACK);
  // argsHash: the record must carry the digest the source's own argument values produce.
  emit(...takeFixedWidthField(32), Opcodes.OP_SWAP, Opcodes.OP_DUP);
  if (digestFromStack) {
    // The caller's own computed digest is below the parked callee reference. Both come up, the rotation puts the
    // record's own hash next to the digest for the comparison, and the callee reference is left on top — the
    // record's hash is still there for the callee's own bytes, exactly as in the folded form below.
    emit(Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK, Opcodes.OP_ROT, Opcodes.OP_EQUALVERIFY);
  } else {
    emit(...encodeDataPush(callerArgumentDigest(site)), Opcodes.OP_EQUALVERIFY, Opcodes.OP_FROMALTSTACK);
  }
  // The callee's unlocking bytecode is its witness block, its call data and its redeem script. The call data is
  // what the first and the last push leave between them: the selector's push and then the argument pushes.
  // Hashing the selector with those pushes must give the recorded digest the code's own operands produced.
  emit(Opcodes.OP_INPUTBYTECODE,
    ...dropFirstPushScript(), ...dropLastPushScript(), ...splitFirstPushScript(),
    Opcodes.OP_SWAP, Opcodes.OP_DUP, ...encodeDataPush(site.selector), Opcodes.OP_EQUALVERIFY,
    Opcodes.OP_SWAP, Opcodes.OP_CAT, Opcodes.OP_SHA256, Opcodes.OP_EQUALVERIFY);
  // result: what the body uses for the call's value, or an empty field for a call that returns nothing.
  emit(...takeLengthPrefixedField32());
  if (usesResult) {
    emit(Opcodes.OP_SWAP, Opcodes.OP_NIP);
  } else {
    emit(Opcodes.OP_SWAP, Opcodes.OP_SIZE, Opcodes.OP_0, Opcodes.OP_NUMEQUALVERIFY,
      Opcodes.OP_DROP, Opcodes.OP_DROP);
  }
  return bytes;
}

/**
 * The digest a site's own code folds from its compile-time arguments: `SHA256(selector || argument pushes)`.
 *
 * A site with a run-time argument computes the same digest from the values it holds instead, and never asks for
 * this one.
 */
export function callerArgumentDigest(site: MasterCallSite): Uint8Array {
  const pushes = constantArgumentPushes(site);
  if (pushes === undefined) {
    throw new Error('call-site: a site with a run-time argument has no compile-time digest');
  }
  return argsHash(site.selector, pushes);
}

/** The concatenated argument pushes of a call whose arguments are all compile-time values, as the wire carries them. */
export function constantArgumentPushes(site: MasterCallSite): Uint8Array | undefined {
  const siteArguments = site.arguments ?? [];
  if (siteArguments.some((argument) => argument.kind !== 'constant')) return undefined;
  return encodeCallDataArguments(siteArguments.map((argument) => (argument as { bytes: Uint8Array }).bytes));
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
