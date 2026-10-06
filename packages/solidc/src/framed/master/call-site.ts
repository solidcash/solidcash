/**
 * Binding an external call to its own witness record where the source makes the call.
 *
 * A framed master records every external call in the witness block it carries as the first push of its own
 * unlocking bytecode. The proof of a call belongs at the call site, in the caller's own code, so this module
 * emits that proof into the body: the code reads its block back from the transaction, walks to the record its
 * site names, and binds the record to what the source says.
 *
 * The record is the `k`-th the execution made, so the walk is exact: the frame fields come first, then `retval`, then
 * the records before this one are stepped over by their own widths, and only the `k`-th is read. `k` is a constant
 * where every path makes the same calls, and otherwise the number of calls the running body has made, so a site the
 * execution skips takes no record. The checks are:
 *
 *   - the record's `kind` is the site's frame kind, and its `target` is the address the site calls — a
 *     compile-time address, or a value the caller's own code computed and left for the check;
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
import { argsHash, encodeCallDataArguments, scriptToBytecode } from '@solidcash/utils';
import type { ExternalCallArgSource, ExternalCallExpression, ExternalCallStatement } from '../../ast/AST.js';
import { compileAddressToEvmIdentity } from '../../generation/utils.js';
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
  unsignedLength,
} from './witness-reader.js';
import { skipCallRecordsScript } from './frame-tail.js';

/** The `u16` sentinel a standalone frame's validator reference carries, in the block's own encoding. */
const INDEX_NONE_BYTES = new Uint8Array([0xff, 0xff]);

/**
 * The checks one call site makes against its own record.
 *
 * `index` is the site's position among the entry's external calls, which is the record it addresses. `usesResult`
 * is true when the caller's code consumes the call's value; false requires the record to carry an empty result.
 *
 * `digestFromStack` says the caller's own code computed the argument digest where it calls, from values only the
 * running execution holds, and left it on top of the stack. The constant form the compiler folds from compile-time
 * arguments is the other, smaller case.
 *
 * `targetFromStack` says the same for the record's `target`: the address is a value the caller's own code computed
 * — read from its own state, or held in a parameter or local — and parked on the alternate stack for the check.
 * When both are supplied the caller leaves the target beneath the digest, so each is reached at the field it binds.
 *
 * `indexFromStack` says the record's position is a value the running code holds: how many calls the execution has
 * already made, which the caller leaves on the stack beneath the values it computed. An execution whose calls
 * repeat — one inside a loop — reaches a position the source does not fix, so the number of records before this
 * site's is stepped over with a loop rather than unrolled. A target and a digest parked on the alternate stack are
 * unaffected: they are reached at their fields either way.
 */
export function callSiteCheckScript(
  site: MasterCallSite,
  index: number,
  usesResult: boolean,
  options: {
    readonly digestFromStack?: boolean;
    readonly targetFromStack?: boolean;
    /** True when the record's value is the one the caller left beneath the target. */
    readonly valueFromStack?: boolean;
    readonly indexFromStack?: boolean;
    /**
     * True when the caller forwards its own call data, so it holds no compile-time selector to compare.
     *
     * The callee's call data is still hashed and compared with the recorded digest, which binds its selector and
     * its arguments to the bytes the caller received; only the constant selector equality is left out.
     */
    readonly skipSelectorCheck?: boolean;
    /**
     * True for a site the head's call count does not cover, whose frame may claim to stand alone: the frame must
     * name a validator, which binds the callee (N1, V5, V11).
     */
    readonly requiresValidator?: boolean;
    /**
     * The parameter positions of run-time `address` arguments the caller holds as a 20-byte identity, a value read
     * back through a Solidity ABI call result (DECISIONS D13), whose digest the caller computed over that identity.
     *
     * The callee's call data carries the lock the identity names at each such position, so the check binds the call
     * data to the caller's values with those pushes projected to their identity, and the record's hash to the call
     * data byte for byte. Only a site whose digest the caller computes names any.
     */
    readonly identityArguments?: readonly number[];
  } = {},
): Uint8Array {
  const digestFromStack = options.digestFromStack === true;
  const targetFromStack = options.targetFromStack === true;
  const valueFromStack = options.valueFromStack === true;
  const indexFromStack = options.indexFromStack === true;
  const skipSelectorCheck = options.skipSelectorCheck === true;
  const identityArguments = digestFromStack && !skipSelectorCheck ? options.identityArguments ?? [] : [];
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  // The values the caller computed go where the walk can reach them: beneath the walk's own scratch, on the
  // alternate stack. The target is retrieved before the digest, so it is parked last and comes up first.
  if (digestFromStack) emit(Opcodes.OP_TOALTSTACK);
  if (valueFromStack) emit(Opcodes.OP_TOALTSTACK);
  if (targetFromStack) emit(Opcodes.OP_TOALTSTACK);
  // The caller's own block, read from the first push of its own unlocking bytecode.
  emit(...readOwnWitnessBlockScript());
  // The magic and version are required; the four fixed header fields are only walked past.
  emit(...readFrameHeaderScript());
  if (options.requiresValidator === true) {
    // The validator reference, topmost of the four, is not the u16 sentinel.
    emit(Opcodes.OP_TOALTSTACK, ...encodeDataPush(INDEX_NONE_BYTES), Opcodes.OP_EQUAL, Opcodes.OP_NOT,
      Opcodes.OP_VERIFY, Opcodes.OP_2DROP, Opcodes.OP_DROP, Opcodes.OP_FROMALTSTACK);
  } else {
    emit(Opcodes.OP_TOALTSTACK, Opcodes.OP_2DROP, Opcodes.OP_2DROP, Opcodes.OP_FROMALTSTACK);
  }
  // `sender`, `self` and `value` are read only to advance the cursor to the tail.
  emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
  emit(...takeLengthPrefixedField(), Opcodes.OP_NIP);
  emit(...takeFixedWidthField(8), Opcodes.OP_NIP);
  // `retval`.
  emit(...takeLengthPrefixedField32(), Opcodes.OP_NIP);
  // `callCount`: the body pins how many records the tail holds, so the site only walks past it.
  emit(...takeFixedWidthField(2), Opcodes.OP_NIP);
  // The records before this site's, stepped over by their own widths: a fixed number when the source fixes the
  // position, and the number the execution has reached when it does not.
  if (indexFromStack) {
    // The caller left the position beneath the values it computed, so it sits directly under the tail here.
    emit(Opcodes.OP_SWAP);
    emit(...skipCallRecordsScript());
  } else {
    for (let earlier = 0; earlier < index; earlier += 1) emit(...skipCallRecord());
  }
  emit(...bindCallRecord(site, usesResult, {
    digestFromStack, targetFromStack, valueFromStack, skipSelectorCheck, identityArguments,
  }));
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
function bindCallRecord(
  site: MasterCallSite,
  usesResult: boolean,
  options: { readonly digestFromStack: boolean; readonly targetFromStack: boolean;
    readonly valueFromStack: boolean; readonly skipSelectorCheck: boolean;
    readonly identityArguments: readonly number[] },
): number[] {
  const { digestFromStack, targetFromStack, valueFromStack, skipSelectorCheck, identityArguments } = options;
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };

  // kind: the frame the callee runs is the one the site records.
  emit(...takeFixedWidthField(1), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM,
    ...encodeDataPush(scriptNumber(site.kind)), Opcodes.OP_NUMEQUALVERIFY);
  // target: the address called is the one the caller's own code holds — the value it computed, or the constant.
  emit(...takeLengthPrefixedField(), Opcodes.OP_SWAP);
  if (targetFromStack) emit(Opcodes.OP_FROMALTSTACK);
  else emit(...encodeDataPush(site.target));
  emit(Opcodes.OP_EQUALVERIFY);
  // value: the amount the caller's code computed, as the record's eight bytes, or none for a call that passes
  // none; the validator binds the callee's value to it.
  emit(...takeFixedWidthField(8), Opcodes.OP_SWAP);
  if (valueFromStack) {
    emit(Opcodes.OP_FROMALTSTACK, ...encodeDataPush(scriptNumber(8)), Opcodes.OP_NUM2BIN, Opcodes.OP_EQUALVERIFY);
  } else {
    emit(Opcodes.OP_BIN2NUM, Opcodes.OP_0, Opcodes.OP_NUMEQUALVERIFY);
  }
  // calleeRef: a master never calls itself. Parked while the arguments hash is read, so it is on hand for the
  // callee's own bytes.
  emit(...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_DUP,
    Opcodes.OP_INPUTINDEX, Opcodes.OP_NUMNOTEQUAL, Opcodes.OP_VERIFY, Opcodes.OP_TOALTSTACK);
  if (identityArguments.length > 0) {
    emit(...bindIdentityArguments(site, identityArguments));
    emit(...bindResult(usesResult));
    return bytes;
  }
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
  if (skipSelectorCheck) {
    // The selector is the caller's own received bytes, so there is no constant to compare: the hash of the
    // callee's selector and argument pushes against the recorded digest binds both to what the caller forwarded.
    emit(Opcodes.OP_INPUTBYTECODE,
      ...dropFirstPushScript(), ...dropLastPushScript(), ...splitFirstPushScript(),
      Opcodes.OP_CAT, Opcodes.OP_SHA256, Opcodes.OP_EQUALVERIFY);
  } else {
    emit(Opcodes.OP_INPUTBYTECODE,
      ...dropFirstPushScript(), ...dropLastPushScript(), ...splitFirstPushScript(),
      Opcodes.OP_SWAP, Opcodes.OP_DUP, ...encodeDataPush(site.selector), Opcodes.OP_EQUALVERIFY,
      Opcodes.OP_SWAP, Opcodes.OP_CAT, Opcodes.OP_SHA256, Opcodes.OP_EQUALVERIFY);
  }
  emit(...bindResult(usesResult));
  return bytes;
}

/** result: what the body uses for the call's value, or an empty field for a call that returns nothing. */
function bindResult(usesResult: boolean): number[] {
  return usesResult
    ? [...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_NIP]
    : [...takeLengthPrefixedField32(), Opcodes.OP_SWAP, Opcodes.OP_SIZE, Opcodes.OP_0, Opcodes.OP_NUMEQUALVERIFY,
      Opcodes.OP_DROP, Opcodes.OP_DROP];
}

/**
 * The argument binding of a site whose caller holds some `address` arguments as their 20-byte identity.
 *
 * Entry `[..., tail]` with the record's `argsHash` next on the tail and, on the alternate stack, the caller's digest
 * beneath the parked callee reference; exit `[..., tail]` past the hash. The record's hash is the callee's own call
 * data byte for byte, and the caller's digest, which it computed over the identities, is the call data's with each
 * of those pushes projected to the push of its identity: so every other argument is the caller's value exactly, and
 * each projected one is a lock the identity names.
 */
function bindIdentityArguments(site: MasterCallSite, identityArguments: readonly number[]): number[] {
  const count = site.arguments?.length ?? 0;
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  // [tail] -> [tail, argsHash, digest, calleeRef]
  emit(...takeFixedWidthField(32), Opcodes.OP_SWAP, Opcodes.OP_FROMALTSTACK, Opcodes.OP_FROMALTSTACK, Opcodes.OP_SWAP);
  // The callee's call data, its selector checked: [tail, argsHash, digest, selector, argument pushes]
  emit(Opcodes.OP_INPUTBYTECODE,
    ...dropFirstPushScript(), ...dropLastPushScript(), ...splitFirstPushScript(),
    Opcodes.OP_SWAP, Opcodes.OP_DUP, ...encodeDataPush(site.selector), Opcodes.OP_EQUALVERIFY, Opcodes.OP_SWAP);
  // The record's hash is the call data's own: [tail, digest, selector, argument pushes]
  emit(Opcodes.OP_2DUP, Opcodes.OP_CAT, Opcodes.OP_SHA256, ...encodeDataPush(scriptNumber(4)), Opcodes.OP_ROLL,
    Opcodes.OP_EQUALVERIFY);
  // The pushes in wire order, the last parameter's first, each appended to the selector as the caller's digest
  // read it: [tail, digest, projected so far, pushes left]
  for (let push = 0; push < count; push += 1) {
    emit(...splitFirstRawPush());
    if (identityArguments.includes(count - 1 - push)) emit(Opcodes.OP_SWAP, ...identityPush(), Opcodes.OP_SWAP);
    emit(Opcodes.OP_TOALTSTACK, Opcodes.OP_CAT, Opcodes.OP_FROMALTSTACK);
  }
  // No push is left over, and the projection hashes to the caller's digest.
  emit(Opcodes.OP_SIZE, Opcodes.OP_0, Opcodes.OP_NUMEQUALVERIFY, Opcodes.OP_DROP,
    Opcodes.OP_SHA256, Opcodes.OP_EQUALVERIFY);
  return bytes;
}

/**
 * `[item]` to `[push, rest]`: the first push of a push-only script, opcode and payload together, split off.
 *
 * A direct push carries its length in its opcode, `PUSHDATA1`, `PUSHDATA2` and `PUSHDATA4` in one, two and four
 * bytes after it, and `OP_0`, `OP_1NEGATE` and `OP_1`-`OP_16` occupy their opcode alone.
 */
function splitFirstRawPush(): number[] {
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  const lengthField = (width: number, base: number): void => {
    emit(Opcodes.OP_DROP, Opcodes.OP_DUP, Opcodes.OP_1, Opcodes.OP_SPLIT, Opcodes.OP_NIP,
      ...encodeDataPush(scriptNumber(width)), Opcodes.OP_SPLIT, Opcodes.OP_DROP, ...unsignedLength(),
      ...encodeDataPush(scriptNumber(base)), Opcodes.OP_ADD);
  };
  // [item, opcode]
  emit(Opcodes.OP_DUP, Opcodes.OP_1, Opcodes.OP_SPLIT, Opcodes.OP_DROP, ...unsignedLength());
  emit(Opcodes.OP_DUP, Opcodes.OP_0, Opcodes.OP_NUMEQUAL, Opcodes.OP_IF, Opcodes.OP_DROP, Opcodes.OP_1);
  emit(Opcodes.OP_ELSE, Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(0x4b)), Opcodes.OP_LESSTHANOREQUAL,
    Opcodes.OP_IF, Opcodes.OP_1ADD);
  emit(Opcodes.OP_ELSE, Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(0x4c)), Opcodes.OP_NUMEQUAL, Opcodes.OP_IF);
  lengthField(1, 2);
  emit(Opcodes.OP_ELSE, Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(0x4d)), Opcodes.OP_NUMEQUAL, Opcodes.OP_IF);
  lengthField(2, 3);
  emit(Opcodes.OP_ELSE, Opcodes.OP_DUP, ...encodeDataPush(scriptNumber(0x4e)), Opcodes.OP_NUMEQUAL, Opcodes.OP_IF);
  lengthField(4, 5);
  emit(Opcodes.OP_ELSE, Opcodes.OP_DROP, Opcodes.OP_1);
  emit(Opcodes.OP_ENDIF, Opcodes.OP_ENDIF, Opcodes.OP_ENDIF, Opcodes.OP_ENDIF, Opcodes.OP_ENDIF);
  // [item, size] -> [push, rest]
  emit(Opcodes.OP_SPLIT);
  return bytes;
}

/**
 * `[push]` to `[push of its identity]`: an address argument's push, `OP_0` for address(0) or a direct push of a
 * lock or an identity, replaced by the 20-byte push of the identity its payload projects to.
 */
function identityPush(): number[] {
  return [
    Opcodes.OP_1, Opcodes.OP_SPLIT, Opcodes.OP_NIP,
    ...scriptToBytecode(compileAddressToEvmIdentity()),
    ...encodeDataPush(new Uint8Array([0x14])), Opcodes.OP_SWAP, Opcodes.OP_CAT,
  ];
}

/**
 * True when a call argument's serialized source reads what an earlier call returned: a producer's result or a
 * returning call itself, anywhere in the expression the argument is built from.
 */
export function sourceReadsCallResult(source: ExternalCallArgSource | undefined): boolean {
  const statement = (node: ExternalCallStatement): boolean => [node.index, node.expression, node.condition]
    .some(expression) || [...(node.statements ?? []), ...(node.elseStatements ?? [])].some(statement);
  const expression = (node: ExternalCallExpression | undefined): boolean => node !== undefined
    && (node.kind === 'producerResult' || node.kind === 'externalCall'
      || [node.target, node.expression, node.left, node.right, node.condition, node.ifTrue, node.ifFalse,
        ...(node.args ?? [])].some(expression)
      || (node.source !== undefined && sourceReadsCallResult(node.source))
      || (node.statements ?? []).some(statement));
  return source !== undefined && (expression(source.expression) || expression(source.stepExpression));
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
