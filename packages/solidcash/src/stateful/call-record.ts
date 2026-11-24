/**
 * Direct call records (docs/wip/call-records/DESIGN.md). A direct callee's return carrier commits to the call it
 * answers: the call's digest, a form byte, then the result inline (form 1) or its SHA256 (form 2), whose bytes
 * the caller takes from its preimage witness. The compiler computes the same digest on both sides of the call.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  bigIntToVmNumber, vmNumberToBigInt,
} from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  CALL_RECORD_NO_READER, CALL_RECORD_READER_INPUT, encodePushdataValue, sha256, type AbiFunction, type Artifact,
  type EnumDefinitionAbi, type ExternalCallAbi, type StructDefinitionInfo,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import { MixedCallRecordReaderError, MixedCompileModeCallError } from '../Errors.js';
import { materializeInternalFunctionArgument } from './kernel-journal-helpers.js';
import { artifactUsesSolidityAbi } from './solidityAbi.js';

export const CALL_RECORD_DIGEST_BYTES = 31;

/** The widest result a record carries inline, after its digest and form byte, in a 128-byte commitment. */
export const CALL_RECORD_INLINE_RESULT_BYTES = 128 - CALL_RECORD_DIGEST_BYTES - 1;

const INLINE_FORM = 0x01;
const HASHED_FORM = 0x02;

const NUMERIC_TYPE = /^(bool|bigint|u?int\d*|u?fixed(\d+x\d+)?)$/;

/** True when the record of a result this wide carries its SHA256, not its bytes. */
export function callRecordHashesResult(raw: Uint8Array): boolean {
  return raw.length > CALL_RECORD_INLINE_RESULT_BYTES;
}

/** True when this entry's records name their reader: it takes the reader witness. */
export function callRecordNamesReader(abiFunction: Pick<AbiFunction, 'inputs'>): boolean {
  return abiFunction.inputs.some((input) => input.name === CALL_RECORD_READER_INPUT);
}

/**
 * True for a call whose method its caller chooses at run time (a function pointer, a selector table) and whose record
 * its caller checks by no digest: it pins no edge for it, and it requires its callee's reader witness to name none
 * (the compiler's emitRequirePointerCalleePushes), so the callee's record names no reader. A pointer call that
 * digests its record with the selector it picks (`runtimeRecordSelector`) names its caller like any other.
 */
export function callNamesNoReader(
  call: Pick<ExternalCallAbi, 'fnPtrCall' | 'selectorArrayVar' | 'runtimeRecordSelector'> | undefined,
): boolean {
  return (call?.fnPtrCall === true || call?.selectorArrayVar !== undefined) && call?.runtimeRecordSelector !== true;
}

/** A reader input index as a digest takes it: `OP_NUM2BIN` to two bytes, sign in the top bit. */
export function callRecordReaderBytes(reader: bigint | number): Uint8Array {
  const value = BigInt(reader);
  const magnitude = value < 0n ? -value : value;
  if (magnitude > 0x7fffn) throw new Error(`A call record's reader ${value} does not fit two bytes`);
  return Uint8Array.of(Number(magnitude & 0xffn), Number(magnitude >> 8n) | (value < 0n ? 0x80 : 0));
}

/** A call's value as a record's digest ends with it: `OP_NUM2BIN` to eight bytes, none for zero. */
export function callRecordValueBytes(value: bigint): Uint8Array {
  if (value === 0n) return new Uint8Array();
  if (value < 0n || value >= 1n << 63n) throw new Error(`A call's value ${value} does not fit a record`);
  const bytes = new Uint8Array(8);
  bytes.set(bigIntToVmNumber(value));
  return bytes;
}

/**
 * The digest of a call: the first 31 bytes of the SHA256 of its ordinal as two little-endian bytes, its selector,
 * for an entry whose records name their reader `reader` (the input index of the contract that reads the record, or
 * `CALL_RECORD_NO_READER` when none does), then each argument as its length in two little-endian bytes and its
 * bytes, a number minimally encoded, then, for an entry that takes value (`callRecordValue`), the value the call sent
 * when not zero (callRecordValueBytes). A signature authorizes the transaction the record is part of, so it is no
 * argument of the digest.
 */
export function callRecordDigest(
  abiFunction: Pick<AbiFunction, 'inputs' | 'selector' | 'callRecordValue'>, params: readonly FunctionArgument[],
  options: {
    readonly structs?: readonly StructDefinitionInfo[]; readonly enums?: readonly EnumDefinitionAbi[];
    /**
     * Whether the digest names its reader. By default where the entry takes the reader witness, as the callee
     * digests its run; a caller's edge names it where the caller digests its own input (`callRecordReader`).
     */
    readonly namesReader?: boolean;
  } = {},
  ordinal = 0, reader: bigint | number = CALL_RECORD_NO_READER, value = 0n,
): Uint8Array | undefined {
  if (abiFunction.selector === undefined) return undefined;
  const parts: number[] = [ordinal & 0xff, (ordinal >> 8) & 0xff, ...hexToBin(abiFunction.selector)];
  if (options.namesReader ?? callRecordNamesReader(abiFunction)) parts.push(...callRecordReaderBytes(reader));
  for (const [index, input] of abiFunction.inputs.entries()) {
    if (input.name.startsWith('__internal__') || input.type === 'sig') continue;
    const encoded = encodeFunctionArgument(params[index] as FunctionArgument, input.type, options.structs);
    if (!(encoded instanceof Uint8Array)) return undefined;
    const numeric = NUMERIC_TYPE.test(input.type)
      || options.enums?.some((definition) => definition.name === input.type) === true;
    const bytes = numeric ? bigIntToVmNumber(vmNumberToBigInt(encoded, { requireMinimalEncoding: false }) as bigint)
      : encoded;
    parts.push(bytes.length & 0xff, (bytes.length >> 8) & 0xff, ...bytes);
  }
  if (abiFunction.callRecordValue === true) parts.push(...callRecordValueBytes(value));
  return sha256(Uint8Array.from(parts)).slice(0, CALL_RECORD_DIGEST_BYTES);
}

/** A caller's witness of the argument at a position its call at a callsite leaves to the callee. */
export const CALL_ARGUMENT_WITNESS = /^__internal__callArgument(\d+)_(\d+)$/;

/** The same for a call a loop over targets makes once per turn: one element per call made, in order. */
export const CALL_ARGUMENT_LIST = /^__internal__callArgumentList(\d+)_(\d+)$/;

/** The parts of a callee's artifact its record's arguments are encoded from. */
type RecordArtifact = Pick<Artifact, 'abi' | 'structs'> & Partial<Pick<Artifact, 'stateLayout'>>;

/** A co-spent call: the method its callee runs and the arguments it runs on. */
interface CallRecordGroup {
  readonly functionName: string;
  readonly functionArgs: readonly unknown[];
  readonly logicalFunctionName?: string;
  readonly logicalFunctionArgs?: readonly unknown[];
  readonly logicalArtifact?: RecordArtifact;
  readonly externalContract?: { readonly inner?: { readonly artifact?: RecordArtifact } };
}

/**
 * A caller's witness of an argument its call leaves to the callee (CALL_ARGUMENT_WITNESS): that argument of the method
 * `group` runs, as the callee's record digests it. The caller digests it with the arguments it names, so the record
 * binds the method and every argument. Undefined when the argument cannot be encoded.
 */
export function leftCallArgumentWitness(group: CallRecordGroup, position: number): Uint8Array | undefined {
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const functionName = group.logicalFunctionName ?? group.functionName;
  const input = artifact?.abi.find((entry) => entry.name === functionName)?.inputs[position];
  if (artifact === undefined || input === undefined || input.name.startsWith('__internal__')
    || input.type === 'sig') return undefined;
  const args = group.logicalFunctionArgs ?? group.functionArgs;
  try {
    const encoded = encodeFunctionArgument(
      args[position] as FunctionArgument, input.type, artifact.structs ?? artifact.stateLayout?.structs,
    );
    return encoded instanceof Uint8Array ? encoded : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The witness list of the argument at `position` a loop's call leaves to each turn's callee: each group's
 * leftCallArgumentWitness, pushdata-framed, in the order the calls are made. Undefined when one cannot be encoded.
 */
export function leftCallArgumentList(
  groups: readonly CallRecordGroup[], position: number,
): Uint8Array | undefined {
  const elements: Uint8Array[] = [];
  for (const group of groups) {
    const value = leftCallArgumentWitness(group, position);
    if (value === undefined) return undefined;
    elements.push(encodePushdataValue(value, 'bytes'));
  }
  return Uint8Array.from(elements.flatMap((element) => [...element]));
}

/**
 * Sets, by name, each witness of an argument a call of `abiFunction` leaves to its callee, from the group co-spent at
 * that callsite (`edgeEcSlot`, a top-level call's published callsite), and each witness list of one a loop's call
 * leaves, from the groups of that callsite in order. A witness with no such group keeps its value.
 */
export function fillLeftCallArgumentWitnesses(
  args: readonly FunctionArgument[], abiFunction: Pick<AbiFunction, 'inputs'>,
  groups: readonly (CallRecordGroup & { readonly edgeParentIndex?: number; readonly edgeEcSlot?: number })[],
): FunctionArgument[] {
  let filled = [...args];
  const atCallsite = (callsite: number): typeof groups => groups.filter((candidate) => (
    (candidate.edgeParentIndex ?? -1) < 0 && candidate.edgeEcSlot === callsite));
  for (const input of abiFunction.inputs) {
    const witness = CALL_ARGUMENT_WITNESS.exec(input.name);
    const list = CALL_ARGUMENT_LIST.exec(input.name);
    let value: Uint8Array | undefined;
    if (witness !== null) {
      const group = atCallsite(Number(witness[1]))[0];
      value = group === undefined ? undefined : leftCallArgumentWitness(group, Number(witness[2]));
    } else if (list !== null) {
      const turns = atCallsite(Number(list[1]));
      value = turns.length === 0 ? undefined : leftCallArgumentList(turns, Number(list[2]));
    }
    if (value !== undefined) filled = materializeInternalFunctionArgument(filled, abiFunction.inputs, input.name, value);
  }
  return filled;
}

/**
 * Refuses a call whose caller and callee were compiled in different modes when it binds the selector its caller
 * compiled: a selector check, or a record whose digest carries it. Every selector is hashed by its compile's mode, so
 * the two never match, and no compile sees both. A pointer, a selector table or a raw call binds no compiled selector.
 */
export function assertCallSelectorScheme(
  call: ExternalCallAbi, caller: Pick<Artifact, 'compiler'>, callee: Pick<Artifact, 'compiler'>,
): void {
  const fixedMethod = call.interfaceName !== '__raw__' && call.callMode === undefined && call.fnPtrCall !== true
    && call.selectorArrayVar === undefined && call.opaqueReturn !== true && call.batchInvocations === undefined;
  if (!fixedMethod || (call.needsSelectorVerification !== true && call.hasReturnValues !== true)) return;
  const callerEvmCompat = artifactUsesSolidityAbi(caller);
  if (callerEvmCompat !== artifactUsesSolidityAbi(callee)) {
    throw new MixedCompileModeCallError(call.interfaceName, call.functionName, callerEvmCompat);
  }
}

/**
 * Refuses a call whose caller and callee digest it apart, when the call digests: it reads a record its caller checks,
 * or its callee reads `msg.sender` and so requires the caller's edge, whose digest is the call's. A caller names its
 * reader where its artifact says `callRecordReader`; the callee's run names one where its entry takes the reader
 * witness (an artifact compiled before has none, nor does a kernel direct participant's entry). The two never
 * digest alike, and a caller that accepted an unbound record would let two callers read one run. A callee whose
 * artifact holds no entry of the method (a proxy, whose implementation runs it) is left to its run.
 */
export function assertCallRecordReaderScheme(
  call: ExternalCallAbi, caller: Pick<Artifact, 'callRecordReader'>,
  callee: Pick<Artifact, 'callRecordReader' | 'abi'>,
): void {
  const callerNamesReader = caller.callRecordReader === true;
  const method = call.rawFunctionName ?? call.functionName;
  const entries = callee.abi.filter((entry) => entry.name === method);
  if (entries.length === 0) return;
  const calleeNamesReader = entries.some((entry) => callRecordNamesReader(entry));
  if (callerNamesReader === calleeNamesReader) return;
  const readsRecord = call.hasReturnValues === true && call.opaqueReturn !== true;
  const calleeReadsSender = entries.some((entry) => entry.usesMsgSender === true);
  if (!readsRecord && !calleeReadsSender) return;
  throw new MixedCallRecordReaderError(call.interfaceName, call.functionName, callerNamesReader);
}

/** A record's commitment: the digest, then the result inline or its SHA256. */
export function callRecordCommitment(raw: Uint8Array, digest: Uint8Array): Uint8Array {
  const field = callRecordHashesResult(raw) ? Uint8Array.of(HASHED_FORM, ...sha256(raw))
    : Uint8Array.of(INLINE_FORM, ...raw);
  return Uint8Array.of(...digest, ...field);
}

/** A record's parts, or undefined when `record` is no call record. */
export function parseCallRecord(record: Uint8Array): {
  readonly digest: Uint8Array; readonly raw?: Uint8Array; readonly hash?: Uint8Array;
} | undefined {
  if (record.length < CALL_RECORD_DIGEST_BYTES + 1) return undefined;
  const digest = record.slice(0, CALL_RECORD_DIGEST_BYTES);
  const form = record[CALL_RECORD_DIGEST_BYTES];
  const field = record.slice(CALL_RECORD_DIGEST_BYTES + 1);
  if (form === INLINE_FORM && field.length <= CALL_RECORD_INLINE_RESULT_BYTES) return { digest, raw: field };
  if (form === HASHED_FORM && field.length === 32) return { digest, hash: field };
  return undefined;
}
