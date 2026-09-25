import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, sha256 } from '@bitauth/libauth';
import {
  ArrayType, addressToGraphEmissionBytes, decodePushdataValue, encodePushdataValue,
  parseArrayTypeString, parseType,
  type Artifact, type StateValue, scriptToBytecode,
  type StructDefinitionInfo, type ExternalCallExpression, type ExternalResultEncoding,
} from '@solidcash/utils';
import {
  encodeFunctionArgument, isSignatureTemplateArgumentForType, type ConstructorArgument, type FunctionArgument,
  type SignatureTemplateArgument,
} from '../Argument.js';
import { MessageBusDiagnosticError } from './diagnostics.js';
import {
  findKernelAbiFunctionBySelector,
  findKernelHandlerBySelector,
  normalizeMessageBusFunctionSelector,
  resolvePublishedHandlerByNameOrSelector,
} from './handler-selector-authority.js';
import { markCanonicalBatchBlob } from './internal-batch-authority.js';
import { resolveExternalResultEncoding } from '../stateful/solidityAbi.js';
import { decodeEvmInvocationResultPrefix } from '../stateful/evm-abi-result.js';

export interface MessageBatchCall {
  function: string;
  /** Exact ABI entry-point selector. Required when `function` names distinct overloads. */
  selector?: string;
  /** Authenticated graph call mode. Presence selects the message-bus v2 per-row mode framing. */
  callMode?: 'call' | 'staticcall';
  args?: readonly FunctionArgument[];
  /** Logical per-invocation satoshi delta when compiler-authored effects cannot derive it. */
  msgValue?: bigint;
  /** Graph-authenticated caller identity bytecode for msg.sender-keyed resources. */
  logicalCaller?: FunctionArgument;
}

/** @deprecated Prefer `normalizeMessageBusFunctionSelector` from handler-selector-authority. */
const normalizeFunctionSelector = normalizeMessageBusFunctionSelector;

/**
 * Resolve one ABI entry point.
 * Kernel (`kernel-row-loop`) with a selector: selector is authority; diagnostic `name` is ignored.
 * Legacy / no selector: name (+ optional selector among name matches) as before.
 */
export function resolveMessageBusAbiFunction(
  artifact: Artifact, name: string, selector?: string,
): Artifact['abi'][number] | undefined {
  const convention = artifact.messageBus?.convention;
  if (selector !== undefined) {
    if (convention === 'kernel-row-loop') {
      return findKernelAbiFunctionBySelector(artifact, selector);
    }
    const normalized = normalizeFunctionSelector(selector);
    if (normalized === undefined) {
      throw new Error(`messageBus: function selector '${selector}' must be exactly four hexadecimal bytes`);
    }
    const matches = artifact.abi.filter((candidate) => candidate.name === name);
    const selected = matches.find((candidate) => candidate.selector?.toLowerCase() === normalized);
    if (!selected) {
      throw new Error(
        `messageBus: selector ${normalized} does not identify ABI function '${name}' in '${artifact.contractName}'`,
      );
    }
    return selected;
  }
  const matches = artifact.abi.filter((candidate) => candidate.name === name);
  if (matches.length > 1
    && new Set(matches.map((candidate) => candidate.selector ?? '')).size > 1) {
    throw new Error(
      `messageBus: participant artifact declares ${matches.length} distinct ABI functions named '${name}'`,
    );
  }
  return matches[0];
}

/**
 * Resolve the message-bus handler for one entry point.
 * Kernel with a selector: selector is authority; diagnostic `name` is ignored.
 * handler selector authority: kernel (+ selector-bearing) joins share `handler-selector-authority`.
 */
export function resolveMessageBusHandler(
  artifact: Artifact, name: string, selector?: string,
): NonNullable<Artifact['messageBus']>['handlers'][number] | undefined {
  const convention = artifact.messageBus?.convention;
  if (convention === 'kernel-row-loop' && selector !== undefined) {
    return findKernelHandlerBySelector(artifact, selector);
  }
  if (selector !== undefined && selector.length > 0 && convention !== 'kernel-row-loop') {
    return resolvePublishedHandlerByNameOrSelector(artifact, { name, selector });
  }
  const handlers = artifact.messageBus?.handlers ?? [];
  const abiFunction = resolveMessageBusAbiFunction(artifact, name, selector);
  const matches = handlers.filter((candidate) => candidate.name === name);
  if (abiFunction?.selector !== undefined) {
    return matches.find((candidate) =>
      candidate.selector.toLowerCase() === abiFunction.selector!.toLowerCase());
  }
  if (matches.length > 1
    && new Set(matches.map((candidate) => candidate.selector.toLowerCase())).size > 1) {
    throw new Error(
      `messageBus: participant artifact declares ${matches.length} distinct message-bus handlers named '${name}'`,
    );
  }
  return matches[0];
}

/**
 * prepared-call selector match: whether a prepared call matches a planned graph invocation.
 * Kernel: selector authority (transported selector, or plan selector resolved on the artifact).
 * Legacy: diagnostic function-name equality.
 */
export function preparedCallMatchesPlanInvocation(
  supplied: {
    functionName: string;
    selector?: string;
    artifact?: Artifact;
  },
  invocation: { function: string; selectorHex: string },
): boolean {
  const convention = supplied.artifact?.messageBus?.convention;
  if (convention === 'kernel-row-loop') {
    const planned = normalizeFunctionSelector(invocation.selectorHex)
      ?? invocation.selectorHex.toLowerCase();
    if (supplied.selector !== undefined) {
      const prepared = normalizeFunctionSelector(supplied.selector);
      return prepared === planned;
    }
    if (supplied.artifact === undefined) return false;
    try {
      return resolveMessageBusAbiFunction(
        supplied.artifact, supplied.functionName, invocation.selectorHex,
      ) !== undefined;
    } catch {
      return false;
    }
  }
  return supplied.functionName === invocation.function;
}

/** Framing fields a mixed-handler / multi-row consumer needs to slice one row's calldata from `blob`. */
export type MessageBatchRowCalldataFrame = {
  /** Absolute byte offset of this row's argument payload inside `blob`. */
  calldataStart?: number;
  /** Authoritative argument payload length in bytes. */
  calldataLength?: number;
  /** Exact pushdata-encoded ABI argument vector; when present must match the sliced bytes. */
  argsHex?: string;
  /** Optional row index for error attribution. */
  row?: number;
};

/**
 * Slice one row's authenticated calldata from a message-bus batch blob using published framing.
 * Fail-closes when `calldataStart`/`calldataLength` are missing or non-integer, the slice walks past
 * `blob`, or (when `argsHex` is published) the slice disagrees with that hex.
 *
 * This is the shipped consume-path authority for mixed-handler row framing (handler-frame ABI residual).
 */
export function sliceMessageBatchRowCalldata(
  blob: Uint8Array,
  row: MessageBatchRowCalldataFrame,
): Uint8Array {
  const label = row.row === undefined ? 'row' : `row ${row.row}`;
  const { calldataStart, calldataLength } = row;
  if (calldataStart === undefined || calldataLength === undefined) {
    throw new Error(`message-bus batch ${label} is unframed: missing calldataStart/Length`);
  }
  if (!Number.isInteger(calldataStart) || !Number.isInteger(calldataLength)
    || calldataStart < 0 || calldataLength < 0) {
    throw new Error(
      `message-bus batch ${label} framing is malformed: `
      + `calldataStart=${String(calldataStart)} calldataLength=${String(calldataLength)}`,
    );
  }
  if (calldataStart + calldataLength > blob.length) {
    throw new Error(
      `message-bus batch ${label} unframed split walked past authenticated blob bounds `
      + `(start ${calldataStart} + length ${calldataLength} > ${blob.length})`,
    );
  }
  const slice = blob.subarray(calldataStart, calldataStart + calldataLength);
  if (row.argsHex !== undefined) {
    const expectedLength = row.argsHex.length / 2;
    if (calldataLength !== expectedLength) {
      throw new Error(
        `message-bus batch ${label} row framing mismatch: published calldataLength ${calldataLength} `
        + `≠ argsHex byte length ${expectedLength}`,
      );
    }
    if (binToHex(slice) !== row.argsHex.toLowerCase()) {
      throw new Error(`message-bus batch ${label} calldata frame does not match encoded arguments`);
    }
  }
  return slice;
}

export interface EncodedMessageBatch {
  /** Exact message-bus batch blob consumed by the compiler-owned route. */
  blob: Uint8Array;
  /** Non-internal route arguments following `batchBlob`, in artifact order. */
  routeWitnesses: readonly FunctionArgument[];
  /** Number of logical handler invocations encoded in `blob`. */
  rowCount: number;
  /**
   * ABI result schema in row order. The compiler-owned message-bus batch route computes these values and commits its
   * canonical aggregate return blob to the return-event NFT; a graph consumer must authenticate that output
   * before decoding it.
   */
  results: readonly { row: number; types: readonly string[]; resultEncoding: ExternalResultEncoding }[];
  /** Canonical row projection used by the graph callManifest. */
  rows: readonly {
    row: number;
    function: string;
    selectorHex: string;
    /** Exact pushdata-encoded ABI argument vector parsed by message-bus batch. */
    argsHex: string;
    /**
     * Absolute byte offset of this row's argument payload inside `blob`.
     * Decode walks must stay inside `[calldataStart, calldataStart + calldataLength)`.
     */
    calldataStart: number;
    /** Authoritative argument payload length in bytes (== `argsHex.length / 2`). */
    calldataLength: number;
    /** Compiler-derived transaction-signature provenance; never contains signature bytes. */
    transactionSignatureFrameHex: string;
  }[];
}

/** Evaluate the immutable argument/literal predicate language used by fixed effect recipes. */
export function evaluateFixedEffectPredicate(
  expression: ExternalCallExpression, args: readonly FunctionArgument[],
  state: Readonly<Record<string, FunctionArgument>> = {},
): unknown {
  if (expression.kind === 'literal') {
    if (expression.type === 'bigint' && typeof expression.value === 'string') return BigInt(expression.value);
    if (expression.type === 'bool' && typeof expression.value === 'boolean') return expression.value;
    if (expression.type === 'string' && typeof expression.value === 'string') return expression.value;
    if (expression.type?.startsWith('bytes') && typeof expression.value === 'string') {
      return hexToBin(expression.value);
    }
    return undefined;
  }
  if (expression.kind === 'source' && expression.source?.kind === 'forward'
    && expression.source.paramIndex !== undefined) return args[expression.source.paramIndex];
  if (expression.kind === 'state') return Object.hasOwn(state, expression.name ?? '')
    ? state[expression.name!] : undefined;
  if (expression.kind === 'cast') return expression.expression
    ? evaluateFixedEffectPredicate(expression.expression, args, state) : undefined;
  if (expression.kind === 'unary' && expression.expression) {
    const value = evaluateFixedEffectPredicate(expression.expression, args, state);
    if (expression.operator === '!') return typeof value === 'boolean' ? !value : undefined;
    if (expression.operator === '-' && typeof value === 'bigint') return -value;
    if (expression.operator === '.length' && (typeof value === 'string' || value instanceof Uint8Array
      || Array.isArray(value))) return BigInt(value.length);
    return undefined;
  }
  if (expression.kind === 'binary' && expression.left && expression.right) {
    const left = evaluateFixedEffectPredicate(expression.left, args, state);
    if (left === undefined) return undefined;
    if (expression.operator === '&&' && typeof left === 'boolean' && !left) return false;
    if (expression.operator === '||' && typeof left === 'boolean' && left) return true;
    const right = evaluateFixedEffectPredicate(expression.right, args, state);
    if (right === undefined) return undefined;
    const equal = left instanceof Uint8Array && right instanceof Uint8Array
      ? left.length === right.length && left.every((byte, index) => byte === right[index])
      : (typeof left === 'bigint' || typeof left === 'number')
        && (typeof right === 'bigint' || typeof right === 'number')
        ? BigInt(left) === BigInt(right) : left === right;
    switch (expression.operator) {
      case '&&': return typeof left === 'boolean' && typeof right === 'boolean' ? left && right : undefined;
      case '||': return typeof left === 'boolean' && typeof right === 'boolean' ? left || right : undefined;
      case '==': return equal;
      case '!=': return !equal;
      case '<': return typeof left === 'bigint' && typeof right === 'bigint' ? left < right : undefined;
      case '<=': return typeof left === 'bigint' && typeof right === 'bigint' ? left <= right : undefined;
      case '>': return typeof left === 'bigint' && typeof right === 'bigint' ? left > right : undefined;
      case '>=': return typeof left === 'bigint' && typeof right === 'bigint' ? left >= right : undefined;
      case '+': return typeof left === 'bigint' && typeof right === 'bigint' ? left + right : undefined;
      case '-': return typeof left === 'bigint' && typeof right === 'bigint' ? left - right : undefined;
      case '*': return typeof left === 'bigint' && typeof right === 'bigint' ? left * right : undefined;
      case '/': return typeof left === 'bigint' && typeof right === 'bigint' && right !== 0n ? left / right : undefined;
      case '%': return typeof left === 'bigint' && typeof right === 'bigint' && right !== 0n ? left % right : undefined;
      default: return undefined;
    }
  }
  if (expression.kind === 'ternary' && expression.condition && expression.ifTrue && expression.ifFalse) {
    const selected = evaluateFixedEffectPredicate(expression.condition, args, state);
    return typeof selected === 'boolean'
      ? evaluateFixedEffectPredicate(selected ? expression.ifTrue : expression.ifFalse, args, state) : undefined;
  }
  return undefined;
}

export interface DecodedMessageBusResult {
  row: number;
  type: string;
  value: StateValue;
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

/**
 * Encode a message-bus row's canonical argument vector.
 *
 * Scalars need a pushdata field frame. Structs and arrays already are self-delimiting canonical blobs, so an
 * additional outer frame would make the wire format depend on which SDK path assembled the row and would be
 * ambiguous with a composite's first field.
 */
export function encodeMessageBusArguments(
  encoded: readonly Uint8Array[],
  inputTypes: readonly string[],
  structs?: readonly StructDefinitionInfo[],
): Uint8Array {
  if (encoded.length !== inputTypes.length) {
    throw new Error(`Message-bus argument vector has ${encoded.length} values for ${inputTypes.length} types`);
  }
  return concat(...encoded.map((argument, index) => {
    const typeName = inputTypes[index];
    const type = parseType(typeName);
    const composite = type instanceof ArrayType
      || structs?.some((definition) => definition.name === typeName);
    // `encodeFunctionArgument` uses `01 00` for an empty top-level array so the count byte survives when a normal
    // unlocking template pushes that argument. Message-bus composites are already copied inline into `argsBlob`,
    // so retaining the outer transport escape changes the value from canonical empty-array `00` to a non-minimal
    // count. Remove it only for this exact dynamic-array value; fixed arrays and nonempty arrays are unchanged.
    if (type instanceof ArrayType && type.bound === undefined
      && argument.length === 2 && argument[0] === 0x01 && argument[1] === 0x00) {
      return Uint8Array.of(0x00);
    }
    return composite ? argument : scriptToBytecode([argument]);
  }));
}

/** Unwrap a single script push frame to its payload; raw payloads pass through. */
const unwrapScriptPushPayload = (bytes: Uint8Array): Uint8Array => {
  if (bytes.length === 0) return bytes;
  const first = bytes[0]!;
  if (first >= 1 && first <= 75 && bytes.length === 1 + first) return bytes.slice(1);
  if (first === 0x4c && bytes.length >= 2 && bytes.length === 2 + bytes[1]!) {
    return bytes.slice(2);
  }
  if (first === 0x4d && bytes.length >= 3) {
    const length = bytes[1]! | (bytes[2]! << 8);
    if (bytes.length === 3 + length) return bytes.slice(3);
  }
  return bytes;
};

/** Coerce hex-string locking bytecodes to bytes before address-lane projection. */
const coerceAddressBytes = (value: StateValue): Uint8Array | undefined => {
  if (value instanceof Uint8Array) return unwrapScriptPushPayload(value);
  if (typeof value === 'string' && /^(?:0x)?(?:[0-9a-fA-F]{2})+$/.test(value)) {
    const hex = value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
    return hexToBin(hex);
  }
  return undefined;
};

/** Project address / address-payable leaves inside a decoded state value to ABI words. */
export function projectAddressFieldsInStateValue(
  value: StateValue,
  typeName: string,
  structs?: readonly StructDefinitionInfo[],
): StateValue {
  if (typeName === 'address' || typeName === 'address payable') {
    const bytes = coerceAddressBytes(value);
    if (bytes === undefined) return value;
    return addressToGraphEmissionBytes(bytes);
  }
  const structDef = structs?.find((definition) => definition.name === typeName);
  if (structDef) {
    if (Array.isArray(value)) {
      return structDef.fields.map((field, index) => projectAddressFieldsInStateValue(
        value[index] as StateValue, field.type, structs,
      ));
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, StateValue>;
      const out: Record<string, StateValue> = { ...record };
      for (const field of structDef.fields) {
        if (record[field.name] !== undefined) {
          out[field.name] = projectAddressFieldsInStateValue(record[field.name]!, field.type, structs);
        }
      }
      return out;
    }
  }
  const array = parseArrayTypeString(typeName);
  if (array && Array.isArray(value)) {
    return value.map((element) => projectAddressFieldsInStateValue(element, array.elementType, structs));
  }
  return value;
}

/**
 * Project address fields in an args vector to solidity ABI words (top-level and nested in structs).
 * Live batching uses a selective policy in `encodeMessageBatch` (call-target address params
 * stay native); this helper is the full-vector projector for tests and emission-side tooling.
 */
export function projectGraphEmissionAddressArgs(
  args: Uint8Array,
  inputTypes: readonly string[],
  structs?: readonly StructDefinitionInfo[],
): Uint8Array {
  if (args.length === 0 || inputTypes.length === 0) return args;
  let offset = 0;
  const parts: Uint8Array[] = [];
  for (const typeName of inputTypes) {
    const type = parseType(typeName);
    const isStruct = structs?.some((definition) => definition.name === typeName) === true;
    const composite = type instanceof ArrayType || isStruct;
    if (composite) {
      const { value, bytesConsumed } = decodePushdataValue(args, offset, typeName, structs);
      offset += bytesConsumed;
      if (isStruct) {
        const projected = projectAddressFieldsInStateValue(value, typeName, structs);
        parts.push(encodePushdataValue(projected, typeName, structs));
      } else {
        // Dynamic arrays: leave unchanged this wedge (struct elements only).
        parts.push(args.slice(offset - bytesConsumed, offset));
      }
      continue;
    }
    const { value, bytesConsumed } = decodePushdataValue(args, offset, typeName, structs);
    const frame = args.slice(offset, offset + bytesConsumed);
    offset += bytesConsumed;
    if ((typeName === 'address' || typeName === 'address payable') && value instanceof Uint8Array) {
      // encodeMessageBusArguments wraps encodeFunctionArgument pushes once more; unwrap to the lock bytes.
      const lockOrIdentity = unwrapScriptPushPayload(value);
      parts.push(scriptToBytecode([addressToGraphEmissionBytes(lockOrIdentity)]));
    } else {
      parts.push(frame);
    }
  }
  if (offset !== args.length) {
    throw new Error(
      `graph emission address projection consumed ${offset} of ${args.length} argument bytes`,
    );
  }
  return concat(...parts);
}

const uintLe = (value: bigint, width: number): Uint8Array => {
  if (value < 0n || value >= (1n << BigInt(width * 8))) {
    throw new Error(`Unsigned ${width}-byte overflow`);
  }
  const result = new Uint8Array(width);
  let rest = value;
  for (let i = 0; i < width; i += 1) {
    result[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return result;
};

const signedValue = (value: bigint): Uint8Array => {
  const magnitude = value < 0n ? -value : value;
  if (magnitude > 0x7fff_ffff_ffff_ffffn) {
    throw new Error('message-bus batch logical msg.value exceeds the signed 64-bit satoshi envelope');
  }
  return concat(Uint8Array.of(value < 0n ? 1 : 0), uintLe(magnitude, 8));
};

type TransactionSignaturePathSegment =
  | { kind: 'field'; name: string; index: number }
  | { kind: 'array'; bound?: number };

interface TransactionSignatureLeaf {
  path: readonly TransactionSignaturePathSegment[];
  type: string;
}

const transactionSignatureLeaves = (
  type: string,
  structs: readonly StructDefinitionInfo[] | undefined,
  path: readonly TransactionSignaturePathSegment[] = [],
  activeStructs = new Set<string>(),
): TransactionSignatureLeaf[] => {
  if (type === 'sig') {
    let witnessType = 'sig';
    for (const segment of [...path].reverse()) {
      if (segment.kind === 'array') witnessType += `[${segment.bound ?? ''}]`;
    }
    return [{ path, type: witnessType }];
  }
  const array = parseArrayTypeString(type);
  if (array) {
    return transactionSignatureLeaves(array.elementType, structs, [...path, {
      kind: 'array', ...(array.bound !== undefined && { bound: array.bound }),
    }], activeStructs);
  }
  const struct = structs?.find((candidate) => candidate.name === type);
  if (!struct || activeStructs.has(type)) return [];
  activeStructs.add(type);
  const leaves = struct.fields.flatMap((field, index) => transactionSignatureLeaves(
    field.type, structs, [...path, { kind: 'field', name: field.name, index }], activeStructs,
  ));
  activeStructs.delete(type);
  return leaves;
};

const TRANSACTION_SIGNATURE_FRAME = Uint8Array.of(0x4b, 0x54, 0x53, 0x31); // KTS1

/**
 * Commit the exact row-local signature provenance without creating a signature/manifest hash cycle. Signature
 * bytes remain in aligned route witnesses; SIGHASH_ALL binds those bytes to the transaction carrying this frame.
 */
const transactionSignatureFrame = (
  handler: NonNullable<Artifact['messageBus']>['handlers'][number],
  structs: readonly StructDefinitionInfo[] | undefined,
): Uint8Array => {
  if (!handler.usesTransactionSignature) return new Uint8Array();
  const policy = handler.transactionSignaturePolicy;
  if (policy?.hashType !== 'all' || policy.parameterIndices.length === 0) {
    throw new Error(`Handler '${handler.name}' has no exact SIGHASH_ALL transaction-signature policy`);
  }
  if (policy.parameterIndices.length > 0xff) {
    throw new Error(`Handler '${handler.name}' has too many transaction-signature parameters`);
  }
  const covered = new Map<string, string>();
  for (const entry of policy.coveredBytecodes ?? []) {
    if (!Number.isSafeInteger(entry.parameterIndex)
      || !policy.parameterIndices.includes(entry.parameterIndex)
      || !Number.isSafeInteger(entry.leafIndex) || entry.leafIndex < 0
      || covered.has(`${entry.parameterIndex}:${entry.leafIndex}`)) {
      throw new Error(`Handler '${handler.name}' has a non-canonical covered-bytecode parameter index`);
    }
    covered.set(`${entry.parameterIndex}:${entry.leafIndex}`, entry.bytecode);
  }
  const parts: Uint8Array[] = [TRANSACTION_SIGNATURE_FRAME, Uint8Array.of(1, policy.parameterIndices.length)];
  let prior = -1;
  for (const parameterIndex of policy.parameterIndices) {
    if (!Number.isSafeInteger(parameterIndex) || parameterIndex <= prior || parameterIndex >= handler.inputs.length) {
      throw new Error(`Handler '${handler.name}' has a non-canonical transaction-signature parameter index`);
    }
    prior = parameterIndex;
    const leaves = transactionSignatureLeaves(handler.inputs[parameterIndex].type, structs);
    if (leaves.length === 0 || leaves.length > 0xff) {
      throw new Error(`Handler '${handler.name}' transaction-signature parameter ${parameterIndex} has no exact leaves`);
    }
    parts.push(uintLe(BigInt(parameterIndex), 2), Uint8Array.of(leaves.length));
    for (const [leafIndex, leaf] of leaves.entries()) {
      const bytecode = covered.get(`${parameterIndex}:${leafIndex}`) ?? handler.signatureBytecode;
      if (bytecode === undefined || !/^(?:[0-9a-fA-F]{2})+$/.test(bytecode)) {
        throw new Error(`Handler '${handler.name}' transaction-signature leaf ${parameterIndex}:${leafIndex} has no covered bytecode`);
      }
      if (leaf.path.length > 0xff) throw new Error(`Handler '${handler.name}' transaction-signature path is too deep`);
      parts.push(Uint8Array.of(leaf.path.length));
      for (const segment of leaf.path) {
        parts.push(segment.kind === 'field'
          ? concat(Uint8Array.of(0), uintLe(BigInt(segment.index), 2))
          : concat(Uint8Array.of(1), uintLe(BigInt(segment.bound ?? 0xffff), 2)));
      }
      parts.push(sha256.hash(hexToBin(bytecode)));
    }
  }
  return concat(...parts);
};

/** Derive the canonical KTS1 frame from compiler-owned handler metadata, never invocation input. */
export function messageBusTransactionSignatureFrameHex(
  artifact: Artifact, name: string, selector?: string,
): string {
  const handler = resolveMessageBusHandler(artifact, name, selector);
  if (!handler) throw new Error(`Unknown message-bus batch handler '${name}'`);
  return binToHex(transactionSignatureFrame(handler, artifact.structs));
}

const isEntireTransactionSignatureType = (type: string): boolean => {
  if (type === 'sig') return true;
  const array = parseArrayTypeString(type);
  return array !== undefined && isEntireTransactionSignatureType(array.elementType);
};

const signatureLeafValue = (
  value: FunctionArgument,
  path: readonly TransactionSignaturePathSegment[],
  depth = 0,
): SignatureTemplateArgument => {
  if (depth === path.length) {
    if (!isSignatureTemplateArgumentForType(value, 'sig')) {
      throw new Error('transaction signature leaf requires SignatureTemplate');
    }
    return value;
  }
  const segment = path[depth];
  if (segment.kind === 'array') {
    if (!Array.isArray(value)) throw new Error('transaction signature array path requires an array argument');
    return value.map((element) => signatureLeafValue(element, path, depth + 1));
  }
  if (typeof value !== 'object' || value === null || value instanceof Uint8Array) {
    throw new Error(`transaction signature field '${segment.name}' requires a struct argument`);
  }
  const nested = Array.isArray(value)
    ? value[segment.index]
    : (value as Record<string, FunctionArgument>)[segment.name];
  if (nested === undefined) throw new Error(`transaction signature field '${segment.name}' is missing`);
  return signatureLeafValue(nested, path, depth + 1);
};

const stripTransactionSignatures = (
  value: FunctionArgument,
  type: string,
  structs: readonly StructDefinitionInfo[] | undefined,
): FunctionArgument => {
  if (type === 'sig') {
    if (!isSignatureTemplateArgumentForType(value, type)) {
      throw new Error('transaction signature leaf requires SignatureTemplate');
    }
    return new Uint8Array();
  }
  const array = parseArrayTypeString(type);
  if (array) {
    if (!Array.isArray(value)) throw new Error(`transaction signature composite '${type}' requires an array`);
    return value.map((element) =>
      stripTransactionSignatures(element, array.elementType, structs)) as ConstructorArgument[];
  }
  const struct = structs?.find((candidate) => candidate.name === type);
  if (!struct) return value;
  if (Array.isArray(value)) {
    return value.map((field, index) =>
      stripTransactionSignatures(field, struct.fields[index].type, structs)) as ConstructorArgument[];
  }
  if (typeof value !== 'object' || value === null || value instanceof Uint8Array) {
    throw new Error(`transaction signature composite '${type}' requires a struct argument`);
  }
  return Object.fromEntries(struct.fields.map((field) => {
    const fieldValue = (value as Record<string, FunctionArgument>)[field.name];
    if (fieldValue === undefined) throw new Error(`struct field '${field.name}' is missing`);
    return [field.name, stripTransactionSignatures(fieldValue, field.type, structs)];
  }));
};

const inactiveSignatureRouteWitness = (type: string): FunctionArgument => {
  let value: ConstructorArgument = new Uint8Array();
  for (let depth = (type.match(/\[\]/g) ?? []).length; depth > 0; depth -= 1) value = [value];
  return value;
};

/** ABI-valid default for an inactive position in a bounded message-bus route. */
export function inactiveMessageBusRouteWitness(type: string): FunctionArgument {
  const array = parseArrayTypeString(type);
  if (array) {
    if (array.bound === undefined) return [];
    return Array.from(
      { length: array.bound },
      () => inactiveMessageBusRouteWitness(array.elementType) as ConstructorArgument,
    );
  }
  if (type === 'bool') return false;
  if (type === 'string') return '';
  if (type === 'address' || type === 'address payable') {
    return encodeLockingBytecodeP2pkh(new Uint8Array(20));
  }
  if (type === 'byte') return new Uint8Array(1);
  const fixedBytes = type.match(/^bytes(\d+)$/);
  if (fixedBytes) return new Uint8Array(Number(fixedBytes[1]));
  if (type === 'bytes' || type === 'sig' || type === 'datasig') return new Uint8Array();
  if (type === 'pubkey') return new Uint8Array(33);
  return 0n;
}

/**
 * Canonically encode real compiler-generated message-bus batch handlers without constructing a transaction.
 *
 * This is the common execution primitive for owner-local batching and the general participant-graph
 * planner: message bus commits the returned `blob`, while the participant's compiler-owned message-bus batch covenant
 * parses and executes the same bytes. No parallel application DSL or hand-authored selector table is
 * involved.
 */
export function encodeMessageBatch(
  artifact: Artifact,
  invocations: readonly MessageBatchCall[],
  /**
   * Optional values for route key witnesses no invocation binds. Inactive fixed-row bands otherwise receive a
   * type-correct neutral value; callers only need this override when another compiler-owned route resource gives
   * an unselected position an explicit identity.
   */
  unboundRouteWitnesses: Readonly<Record<string, FunctionArgument>> = {},
): EncodedMessageBatch {
  const capability = artifact.messageBus;
  if (!capability) {
    throw new Error(
      `Artifact '${artifact.contractName}' does not advertise a message-bus route`,
    );
  }
  if (capability.version !== 1) {
    throw new MessageBusDiagnosticError(
      'L3_PROTOCOL_VERSION_UNSUPPORTED',
      `artifact '${artifact.contractName}' advertises unsupported message bus version ${String(capability.version)}`,
      { metadataField: 'messageBus.version', actual: capability.version, expected: 1, ownerIdentity: artifact.contractName },
    );
  }
  if (capability.selector !== '53434231'
    || !Number.isInteger(capability.maximumRows) || capability.maximumRows < 1
    || !Number.isInteger(capability.maximumBlobBytes) || capability.maximumBlobBytes < 1) {
    throw new MessageBusDiagnosticError(
      'L3_PROTOCOL_METADATA_MALFORMED',
      `artifact '${artifact.contractName}' publishes malformed message-bus batch capability metadata`,
      {
        metadataField: 'messageBus',
        actual: {
          selector: capability.selector,
          maximumRows: capability.maximumRows,
          maximumBlobBytes: capability.maximumBlobBytes,
        },
        expected: { selector: '53434231', positiveIntegerBounds: true },
        ownerIdentity: artifact.contractName,
      },
    );
  }
  const minimumRows = capability.minimumRows ?? 1;
  if (invocations.length < minimumRows || invocations.length > capability.maximumRows) {
    throw new Error(
      `message-bus batch batch row count must be between ${minimumRows} and ${capability.maximumRows}`,
    );
  }
  const fixedChunkablePolicy = capability.fixedChunkableWritePolicy;
  if (fixedChunkablePolicy !== undefined) {
    const selectors = fixedChunkablePolicy.selectors.map(normalizeFunctionSelector);
    if (fixedChunkablePolicy.version !== 1 || fixedChunkablePolicy.maximumRows !== 1
      || selectors.some((selector) => selector === undefined)
      || new Set(selectors).size !== selectors.length) {
      throw new MessageBusDiagnosticError(
        'L3_PROTOCOL_METADATA_MALFORMED',
        `artifact '${artifact.contractName}' publishes malformed fixed chunkable-write policy metadata`,
        { metadataField: 'messageBus.fixedChunkableWritePolicy', ownerIdentity: artifact.contractName },
      );
    }
    const selected = invocations.filter((invocation) => {
      const handler = resolveMessageBusHandler(artifact, invocation.function, invocation.selector);
      return handler !== undefined && selectors.includes(normalizeFunctionSelector(handler.selector));
    }).length;
    if (selected > fixedChunkablePolicy.maximumRows) {
      throw new Error(
        `message-bus batch selects ${selected} direct chunkable-write rows; `
        + `the authenticated participant route permits at most ${fixedChunkablePolicy.maximumRows}`,
      );
    }
  }

  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  // A compiler-owned literal mapping key has no row argument to source it from. Recover it from the direct
  // handler's published entry access, which is the same constant the route's key witness is checked against.
  // This keeps literals distinct from genuinely computed expressions, which still require a caller/composer
  // supplied witness when their expression cannot be evaluated locally.
  const literalKeyWitness = (
    handlerName: string,
    handlerSelector: string,
    binding: NonNullable<typeof capability.handlers[number]['batchKeyWitnesses']>[number],
  ): FunctionArgument | undefined => {
    if (binding.source !== 'expression') return undefined;
    const routeAccess = capability.route.entryAccesses?.find((access) => access.keyParams.some((param) =>
      param.replace(/^__message_bus_ek_/, '') === binding.routeInput));
    const direct = resolveMessageBusAbiFunction(artifact, handlerName, handlerSelector);
    const match = binding.routeInput.match(/_(\d+)(?:_row)?$/);
    const keyIndex = match ? Number(match[1]) : undefined;
    if (keyIndex === undefined) return undefined;
    // The aggregate route deduplicates physical entries, while a handler's
    // local slot numbering still includes its own unrelated accesses. Thus a
    // shared literal reader need not have the route entry's slot index (a
    // writer in another row may own that index). Resolve by collection and
    // key position, retaining the slot match only as the preferred candidate.
    const candidates = direct?.entryAccesses?.filter((candidate) =>
      candidate.collection === routeAccess?.collection
      && candidate.keySources?.[keyIndex] !== undefined) ?? [];
    const access = routeAccess?.slotIndex === undefined ? undefined
      : candidates.find((candidate) => candidate.slotIndex === routeAccess.slotIndex)
        ?? candidates.find((candidate) => candidate.keySources?.[keyIndex]?.kind === 'constant'
          || (candidate.keySources?.[keyIndex]?.kind === 'expression'
            && candidate.keySources[keyIndex]?.expressionLabel?.startsWith('lit:')));
    const source = access?.keySources?.[keyIndex];
    const literal = source?.kind === 'constant' ? source.constantValue
      : source?.kind === 'expression' && source.expressionLabel?.startsWith('lit:')
        ? source.expressionLabel.slice(4) : undefined;
    if (literal === undefined) return undefined;
    const type = capability.route.inputs.find((input) => input.name === binding.routeInput)?.type;
    if (type === 'bool') return literal === 'true' || literal === '1';
    if (type === 'bigint' || type === 'int' || type === 'uint' || /^u?int\d+$/.test(type ?? '')) {
      return BigInt(literal);
    }
    if (/^(?:bytes\d*|byte|address|pubkey)$/.test(type ?? '') && /^0x[0-9a-fA-F]*$/.test(literal)) {
      return hexToBin(literal.slice(2));
    }
    if (type === 'string') return literal;
    return undefined;
  };
  // X199. Over the handlers the route can DISPATCH, not every published one. A REFUSED handler still publishes
  // `usesMsgValue` - `EnglishAuction.bid` is payable, uses msg.value and is refused by route synthesis - and
  // counting it wrote `01` into a header the compiled route demands to be `00`, aborting in the route preamble
  // before any row was parsed, and widened every row from 12 to 21 bytes on the way. The compiler decides the
  // same flag over the same predicate (`compiler.ts`, `logicalValueMode`).
  const valueMode = capability.handlers.some((handler) => handler.eligible && handler.usesMsgValue);
  const modeVersion = invocations.some((invocation) => invocation.callMode !== undefined);
  const keyWitnessValues = new Map<string, { value: FunctionArgument; encoded: Uint8Array }>();
  const fixedTupleValues = new Map<number, { primary: string; alternate: string }>();
  const swappableGlobals = new Map<string, { value: FunctionArgument; encoded: Uint8Array; rowBase: string }>();
  // A resource route has one shared entry and one row-local alternative. The compiler can advertise the two as
  // swappable, allowing the batch to choose the value common to every relevant row rather than assuming the
  // source handler's first mapping access is globally shared.
  const swappableBases = new Set(capability.handlers.flatMap((handler) => {
    const bindings = handler.batchKeyWitnesses ?? [];
    return bindings.filter((binding) => binding.swappable
      && !binding.routeInput.endsWith('_row')
      && bindings.some((candidate) => candidate.swappable
        && candidate.routeInput === `${binding.routeInput}_row`))
      .map((binding) => binding.routeInput);
  }));
  for (const base of swappableBases) {
    const choices: Array<Array<{ value: FunctionArgument; encoded: Uint8Array }>> = [];
    let rowBase = `${base}_row`;
    let unconstrainedCandidate: { value: FunctionArgument; encoded: Uint8Array } | undefined;
    for (const invocation of invocations) {
      const handler = resolveMessageBusHandler(artifact, invocation.function, invocation.selector);
      if (!handler) continue;
      const bindings = handler.batchKeyWitnesses ?? [];
      const shared = bindings.find((binding) => binding.routeInput === base);
      const varying = bindings.find((binding) => binding.routeInput === `${base}_row`);
      const invocationArgs = invocation.args ?? [];
      // A row only constrains the shared slot when its own key comes from a batch argument. A row whose shared
      // binding is the caller identity (or an expression) derives that value at run time, so the shared route
      // input is unused by it and it must not manufacture a disagreement: `transfer` binds `_balances_0` to
      // msgSender while `transferFrom` binds the same input to its `from` argument, and a batch that reaches only
      // `transfer` still has to produce one type-correct value for the shared input.
      const constrainsShared = shared !== undefined
        && shared.source !== 'msgSender' && shared.source !== 'expression' && shared.inputIndex >= 0;
      const relevant = constrainsShared
        ? [shared, ...(varying?.swappable === true ? [varying] : [])]
        : [];
      const rowChoices = relevant.flatMap((binding) => {
        if (!binding || binding.source === 'msgSender' || binding.source === 'expression'
          || binding.inputIndex < 0) return [];
        const value = invocationArgs[binding.inputIndex];
        const type = handler.inputs[binding.inputIndex]?.type;
        if (value === undefined || !type) return [];
        const encoded = encodeFunctionArgument(value, type, structs);
        return encoded instanceof Uint8Array ? [{ value, encoded }] : [];
      });
      if (rowChoices.length > 0) choices.push(rowChoices);
      // A row that does not constrain the shared slot can still name a type-correct value for it through its
      // row-local binding; keep the first one as the fallback for a batch no row constrains.
      if (!constrainsShared && unconstrainedCandidate === undefined && varying !== undefined
        && varying.inputIndex >= 0) {
        const value = invocationArgs[varying.inputIndex];
        const type = handler.inputs[varying.inputIndex]?.type;
        if (value !== undefined && type) {
          const encoded = encodeFunctionArgument(value, type, structs);
          if (encoded instanceof Uint8Array) unconstrainedCandidate = { value, encoded };
        }
      }
      if (varying) rowBase = varying.routeInput;
    }
    const suppliedValue = unboundRouteWitnesses[base];
    const suppliedType = capability.route.inputs.find((input) => input.name === base)?.type;
    const suppliedEncoded = suppliedValue === undefined || !suppliedType
      ? undefined : encodeFunctionArgument(suppliedValue, suppliedType, structs);
    const suppliedCandidate = suppliedEncoded instanceof Uint8Array
      ? { value: suppliedValue!, encoded: suppliedEncoded } : undefined;
    const suppliedFits = suppliedCandidate && (choices.length === 0 || choices.every((row) => row.some((choice) =>
      binToHex(choice.encoded) === binToHex(suppliedCandidate.encoded))));
    const selected = suppliedFits ? suppliedCandidate : choices.length === 0
      ? unconstrainedCandidate ?? (suppliedType === undefined ? undefined : {
        value: inactiveMessageBusRouteWitness(suppliedType),
        encoded: encodeFunctionArgument(
          inactiveMessageBusRouteWitness(suppliedType), suppliedType, structs,
        ) as Uint8Array,
      })
      : choices[0]?.find((candidate) =>
        choices.every((row) => row.some((choice) =>
          binToHex(choice.encoded) === binToHex(candidate.encoded))));
    if (!selected) {
      throw new MessageBusDiagnosticError(
        'L3_RESOURCE_UNRESOLVED',
        `message-bus batch collection witness '${base}' has no shared physical entry orientation`,
        { resourceIdentity: base },
      );
    }
    swappableGlobals.set(base, { ...selected, rowBase });
  }
  const signatureWitnessValues = new Map<string, FunctionArgument>();
  const results: { row: number; types: readonly string[]; resultEncoding: ExternalResultEncoding }[] = [];
  const projectedRows: {
    row: number; function: string; selectorHex: string; argsHex: string; transactionSignatureFrameHex: string;
  }[] = [];
  const rows = invocations.map((invocation, rowIndex) => {
    const handler = resolveMessageBusHandler(artifact, invocation.function, invocation.selector);
    if (!handler) throw new Error(`Unknown message-bus batch handler '${invocation.function}'`);
    if (!handler.eligible) {
      throw new Error(`Handler '${invocation.function}' is not batch eligible: ${handler.rejectionReason}`);
    }
    if ((handler.outputs?.length ?? 0) > 0) {
      const types = Object.freeze(handler.outputs!.map((output) => output.type));
      results.push({
        row: rowIndex,
        types,
        resultEncoding: resolveExternalResultEncoding(
          handler.resultEncoding, artifact, types, `message-bus handler '${handler.name}'`,
        ),
      });
    }
    const args = [...(invocation.args ?? [])];
    if (args.length !== handler.inputs.length) {
      throw new Error(
        `Incorrect number of arguments for batched '${handler.name}': expected ${handler.inputs.length}, got ${args.length}`,
      );
    }
    // Compiler witness ordinals index only dispatchable handlers; refused diagnostic siblings are not branches
    // in the generated route and therefore must not shift these names.
    const handlerIndex = capability.handlers.filter((candidate) => candidate.eligible).indexOf(handler);
    const signatureLeavesByInput = handler.inputs.map((input) =>
      transactionSignatureLeaves(input.type, structs));
    // Address params used as IFoo(addr) call targets must stay native locking bytecode so emission
    // targets EQUALVERIFY against authenticated participant locks. Other address value-args under
    // solidity-compat use ABI words so nested returning addresses match constructed emission rows.
    const abiFunction = resolveMessageBusAbiFunction(artifact, invocation.function, invocation.selector);
    const callTargetAddressIndexes = new Set<number>();
    for (const call of abiFunction?.externalCalls ?? []) {
      if (call.addressSource?.kind === 'forward' && typeof call.addressSource.paramIndex === 'number') {
        callTargetAddressIndexes.add(call.addressSource.paramIndex);
      }
    }
    const projectAddressValueArgs = artifact.compiler?.options?.solidityImportCompat === true
      || artifact.compiler?.options?.evmCompat === true;
    const encoded = args.map((arg, index) => {
      const inputType = handler.inputs[index].type;
      const leaves = signatureLeavesByInput[index];
      // Coerce hex-string address leaves inside structs before pushdata encode (avoids UTF-8 of hex text).
      let value: FunctionArgument = arg;
      if (projectAddressValueArgs
        && !callTargetAddressIndexes.has(index)
        && structs?.some((definition) => definition.name === inputType)
        && value && typeof value === 'object' && !(value instanceof Uint8Array)) {
        value = projectAddressFieldsInStateValue(value as StateValue, inputType, structs) as FunctionArgument;
      } else if (projectAddressValueArgs
        && !callTargetAddressIndexes.has(index)
        && (inputType === 'address' || inputType === 'address payable')) {
        const bytes = coerceAddressBytes(value as StateValue);
        if (bytes !== undefined) value = addressToGraphEmissionBytes(bytes);
      }
      if (leaves.length === 0 || isEntireTransactionSignatureType(inputType)) {
        return encodeFunctionArgument(value, inputType, structs);
      }
      try {
        return encodeFunctionArgument(stripTransactionSignatures(value, inputType, structs), inputType, structs);
      } catch (error) {
        throw new Error(
          `Handler '${handler.name}' transaction signature argument ${index} requires SignatureTemplate: `
          + `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
    const rowEncoded: Uint8Array[] = [];
    encoded.forEach((argument, index) => {
      const inputType = handler.inputs[index].type;
      const leaves = signatureLeavesByInput[index];
      if (leaves.length > 0) {
        // A transaction-bound batch signature cannot be committed inside rowArgs: doing so would make the
        // signature commit to a manifest which already commits to that signature. Composite arguments retain an
        // ABI-valid copy with empty signature leaves; the real leaves are detached below and restored by the route.
        if (!isEntireTransactionSignatureType(inputType)) {
          if (!(argument instanceof Uint8Array)) {
            throw new Error(`Handler '${handler.name}' contains an unsupported signature composite`);
          }
          rowEncoded.push(argument);
        }
      } else if (!(argument instanceof Uint8Array)) {
        throw new Error(`Handler '${handler.name}' contains an unsupported signature-like argument`);
      } else {
        // Address / struct address leaves were already ABI-projected above before encodeFunctionArgument.
        rowEncoded.push(argument);
        return;
      }
      leaves.forEach((leaf, leafIndex) => {
        let signatureArgument: SignatureTemplateArgument;
        try {
          signatureArgument = signatureLeafValue(args[index], leaf.path);
        } catch (error) {
          throw new Error(
            `Handler '${handler.name}' transaction signature argument ${index} requires SignatureTemplate: `
            + `${error instanceof Error ? error.message : String(error)}`,
          );
        }
        if (capability.convention === 'kernel-row-loop') {
          const name = `__message_bus_sig_${handlerIndex}_${index}`
            + `${leaves.length > 1 ? `_${leafIndex}` : ''}_rows`;
          const aligned = signatureWitnessValues.get(name);
          const values = Array.isArray(aligned)
            ? [...aligned] as SignatureTemplateArgument[]
            : new Array<SignatureTemplateArgument>(invocations.length);
          values[rowIndex] = signatureArgument;
          signatureWitnessValues.set(name, values);
        } else {
          signatureWitnessValues.set(
            `__message_bus_sig_${handlerIndex}_${index}_r${rowIndex}`, signatureArgument,
          );
        }
      });
    });
    const tupleGroups = new Map<number, NonNullable<typeof handler.batchKeyWitnesses>>();
    for (const binding of handler.batchKeyWitnesses ?? []) {
      if (binding.entryTupleGroup === undefined) continue;
      const group = tupleGroups.get(binding.entryTupleGroup) ?? [];
      group.push(binding);
      tupleGroups.set(binding.entryTupleGroup, group);
    }
    for (const [groupId, bindings] of tupleGroups) {
      bindings.sort((left, right) => (left.keyComponentIndex ?? -1) - (right.keyComponentIndex ?? -1));
      if (bindings.length === 0 || bindings.some((binding, index) =>
        binding.keyComponentIndex !== index || binding.alternateRouteInput === undefined
        || binding.perRow || binding.swappable
        || (binding.source !== 'argument' && binding.source !== 'msgSender'))) {
        throw new MessageBusDiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `message-bus fixed collection tuple group ${groupId} is incomplete`,
          { handler: handler.name, invocationIds: [rowIndex] },
        );
      }
      const components = bindings.map((binding) => {
        const value = binding.source === 'msgSender' ? invocation.logicalCaller : args[binding.inputIndex];
        if (value === undefined) {
          throw new MessageBusDiagnosticError(
            'L3_RESOURCE_UNRESOLVED',
            `message-bus fixed collection tuple group ${groupId} requires an authenticated active caller`,
            { handler: handler.name, invocationIds: [rowIndex] },
          );
        }
        const encodedValue = binding.source === 'msgSender'
          ? encodeFunctionArgument(value, 'address', structs)
          : encoded[binding.inputIndex];
        if (!(encodedValue instanceof Uint8Array)) {
          throw new MessageBusDiagnosticError(
            'L3_RESOURCE_UNRESOLVED',
            `message-bus fixed collection tuple group ${groupId} is not byte-encodable`,
            { handler: handler.name, invocationIds: [rowIndex] },
          );
        }
        return { binding, value, encoded: encodedValue };
      });
      const identity = components.map(({ encoded: component }) => binToHex(component)).join(':');
      const prior = fixedTupleValues.get(groupId);
      const lane = prior === undefined || prior.primary === identity
        ? 'primary' : prior.alternate === prior.primary || prior.alternate === identity
          ? 'alternate' : undefined;
      if (lane === undefined) {
        throw new MessageBusDiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `message-bus fixed collection tuple group ${groupId} exceeds two physical entries`,
          { handler: handler.name, invocationIds: [rowIndex] },
        );
      }
      if (!prior) fixedTupleValues.set(groupId, { primary: identity, alternate: identity });
      else if (lane === 'alternate') fixedTupleValues.set(groupId, { ...prior, alternate: identity });
      for (const { binding, value, encoded: component } of components) {
        const routeInput = lane === 'primary' ? binding.routeInput : binding.alternateRouteInput!;
        keyWitnessValues.set(routeInput, { value, encoded: component });
        // Until a second distinct tuple is reached, alias the alternate lane to the primary. The compiler and
        // SDK then collapse equal targets through runtimeAliasPriorSlots instead of funding a fictitious key.
        if (!prior) keyWitnessValues.set(binding.alternateRouteInput!, { value, encoded: component });
      }
    }
    for (const binding of handler.batchKeyWitnesses ?? []) {
      if (binding.entryTupleGroup !== undefined) continue;
      if (binding.swappable) {
        if (binding.perRow || binding.routeInput.endsWith('_row')) continue;
        const global = swappableGlobals.get(binding.routeInput);
        const varying = handler.batchKeyWitnesses?.find((candidate) => candidate.swappable
          && candidate.routeInput === `${binding.routeInput}_row`);
        if (!global || !varying || binding.inputIndex < 0 || varying.inputIndex < 0) {
          throw new MessageBusDiagnosticError(
            'L3_RESOURCE_UNRESOLVED',
            `message-bus batch collection witness '${binding.routeInput}' lacks a swappable key pair`,
            { handler: handler.name, resourceIdentity: binding.routeInput, invocationIds: [rowIndex] },
          );
        }
        const sharedValue = args[binding.inputIndex];
        const varyingValue = args[varying.inputIndex];
        const sharedEncoded = encoded[binding.inputIndex];
        const varyingEncoded = encoded[varying.inputIndex];
        if (!(sharedEncoded instanceof Uint8Array) || !(varyingEncoded instanceof Uint8Array)) {
          throw new MessageBusDiagnosticError(
            'L3_RESOURCE_UNRESOLVED', 'message-bus swappable collection keys are not byte-encodable',
            { handler: handler.name, resourceIdentity: binding.routeInput, invocationIds: [rowIndex] },
          );
        }
        const sharedMatches = binToHex(sharedEncoded) === binToHex(global.encoded);
        const varyingMatches = binToHex(varyingEncoded) === binToHex(global.encoded);
        if (!sharedMatches && !varyingMatches) {
          throw new MessageBusDiagnosticError(
            'L3_RESOURCE_UNRESOLVED',
            `message-bus batch collection witness '${binding.routeInput}' does not match either row key`,
            { handler: handler.name, resourceIdentity: binding.routeInput, invocationIds: [rowIndex] },
          );
        }
        keyWitnessValues.set(binding.routeInput, { value: global.value, encoded: global.encoded });
        const varyingInput = varying.perRow ? `${varying.routeInput}_r${rowIndex}` : varying.routeInput;
        const selectedVarying = sharedMatches
          ? { value: varyingValue, encoded: varyingEncoded }
          : { value: sharedValue, encoded: sharedEncoded };
        const priorVarying = keyWitnessValues.get(varyingInput);
        if (priorVarying && binToHex(priorVarying.encoded) !== binToHex(selectedVarying.encoded)) {
          throw new MessageBusDiagnosticError(
            'L3_RESOURCE_UNRESOLVED',
            `message-bus batch collection witness '${varyingInput}' must identify one physical entry`,
            { handler: handler.name, resourceIdentity: varyingInput, invocationIds: [rowIndex] },
          );
        }
        if (!priorVarying) keyWitnessValues.set(varyingInput, selectedVarying);
        continue;
      }
      const value = binding.source === 'msgSender'
        ? invocation.logicalCaller
        : binding.source === 'expression'
          ? unboundRouteWitnesses[binding.perRow ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput]
            ?? literalKeyWitness(handler.name, handler.selector, binding)
          : args[binding.inputIndex];
      if (value === undefined) {
        throw new MessageBusDiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `message-bus batch collection witness '${binding.routeInput}' requires an authenticated active caller`,
          { handler: handler.name, resourceIdentity: binding.routeInput, keyIdentity: 'msg.sender', invocationIds: [rowIndex] },
        );
      }
      const routeInputName = binding.perRow ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput;
      const routeInputType = capability.route.inputs.find((input) => input.name === routeInputName)?.type;
      const encodedValue = binding.source === 'msgSender'
        ? encodeFunctionArgument(value, 'address', structs)
        : binding.source === 'expression'
          ? encodeFunctionArgument(value, routeInputType ?? 'bytes', structs)
          : encoded[binding.inputIndex] as Uint8Array;
      if (!(encodedValue instanceof Uint8Array)) {
        throw new MessageBusDiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `message-bus batch collection witness '${binding.routeInput}' is not byte-encodable`,
          { handler: handler.name, resourceIdentity: binding.routeInput, invocationIds: [rowIndex] },
        );
      }
      const routeInput = routeInputName;
      const prior = keyWitnessValues.get(routeInput);
      if (prior && binToHex(prior.encoded) !== binToHex(encodedValue)) {
        throw new MessageBusDiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `message-bus batch collection witness '${routeInput}' must identify one physical entry`,
          { handler: handler.name, resourceIdentity: routeInput, invocationIds: [rowIndex] },
        );
      }
      if (!prior) keyWitnessValues.set(routeInput, { value, encoded: encodedValue });
    }
    const argsBlob = encodeMessageBusArguments(
      rowEncoded,
      handler.inputs.filter((input) => !isEntireTransactionSignatureType(input.type))
        .map((input) => input.type),
      structs,
    );
    if (argsBlob.length > 0xffff) {
      throw new Error(`message-bus batch arguments for '${handler.name}' exceed 65535 bytes`);
    }
    projectedRows.push({
      row: rowIndex,
      function: invocation.function,
      selectorHex: handler.selector,
      argsHex: binToHex(argsBlob),
      transactionSignatureFrameHex: binToHex(transactionSignatureFrame(handler, structs)),
    });
    let logicalValue = invocation.msgValue ?? 0n;
    if (handler.usesMsgValue && (handler.transfers?.length ?? 0) > 0) {
      let outgoing = 0n;
      for (const transfer of handler.transfers!) {
        if (transfer.condition === null) {
          throw new Error(`message-bus batch BCH transfer in '${handler.name}' has no canonical predicate`);
        }
        if (transfer.condition !== undefined) {
          const active = evaluateFixedEffectPredicate(transfer.condition, args);
          if (typeof active !== 'boolean') {
            throw new Error(`message-bus batch BCH transfer in '${handler.name}' has an unresolved predicate`);
          }
          if (!active) continue;
        }
        const source = transfer.amount;
        let amount: bigint;
        if (source.kind === 'forward' && source.paramIndex !== undefined
          && typeof args[source.paramIndex] === 'bigint') {
          amount = args[source.paramIndex] as bigint;
        } else if (source.kind === 'literal' && source.value !== undefined) {
          amount = BigInt(source.value);
        } else {
          throw new Error(
            `message-bus batch msg.value for '${handler.name}' has a non-derivable transfer amount expression`,
          );
        }
        outgoing += amount;
      }
      const derived = -outgoing;
      if (invocation.msgValue !== undefined && invocation.msgValue !== derived) {
        throw new Error(`message-bus batch msg.value for '${handler.name}' disagrees with compiler-derived effects`);
      }
      logicalValue = derived;
    } else if (handler.usesMsgValue && invocation.msgValue === undefined) {
      throw new Error(`message-bus batch msg.value for '${handler.name}' requires an explicit logical value`);
    }
    return concat(
      hexToBin(handler.selector),
      uintLe(BigInt(rowIndex), 4),
      uintLe(0n, 2),
      uintLe(BigInt(argsBlob.length), 2),
      ...(modeVersion ? [Uint8Array.of(invocation.callMode === 'staticcall' ? 1 : 0)] : []),
      ...(valueMode ? [signedValue(logicalValue)] : []),
      argsBlob,
    );
  });

  const blobHeader = concat(
    hexToBin('53434231'),
    Uint8Array.from([modeVersion ? 2 : 1, valueMode ? 1 : 0, invocations.length]),
  );
  const blob = concat(blobHeader, ...rows);
  if (blob.length > capability.maximumBlobBytes) {
    throw new Error(`message-bus batch blob is ${blob.length} bytes; maximum is ${capability.maximumBlobBytes}`);
  }
  // Publish absolute argument bounds so mixed-handler / multi-row consumers slice without re-deriving
  // schema walks that can OP_SPLIT past a shorter sibling row's payload. The same helper consumers use
  // (`sliceMessageBatchRowCalldata`) verifies each published frame before it leaves encode.
  let rowCursor = blobHeader.length;
  const framedRows = projectedRows.map((row, index) => {
    const rowBytes = rows[index]!;
    const calldataLength = row.argsHex.length / 2;
    if (calldataLength > rowBytes.length) {
      throw new Error(`message-bus batch row ${index} argument length exceeds its encoded frame`);
    }
    const calldataStart = rowCursor + (rowBytes.length - calldataLength);
    sliceMessageBatchRowCalldata(blob, {
      row: index, calldataStart, calldataLength, argsHex: row.argsHex,
    });
    rowCursor += rowBytes.length;
    return {
      ...row,
      calldataStart,
      calldataLength,
    };
  });
  if (rowCursor !== blob.length) {
    throw new Error('message-bus batch row frames do not tile the authenticated blob');
  }

  const routeWitnesses = capability.route.inputs
    .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'))
    .map((input) => {
      const witness = keyWitnessValues.get(input.name);
      if (witness) return witness.value;
      const signatureWitness = signatureWitnessValues.get(input.name);
      if (/^__message_bus_sig_\d+_\d+(?:_\d+)?_rows$/.test(input.name)) {
        if (!Array.isArray(signatureWitness) || signatureWitness.length === 0) {
          // The handler is not selected in this envelope, so the route never indexes this array. Supply one
          // already-encoded NULLFAIL signature value without requiring an unrelated signer.
          return inactiveSignatureRouteWitness(input.type);
        }
        const sourceType = input.type.slice(0, -2);
        const aligned = signatureWitness as SignatureTemplateArgument[];
        const fallback = aligned.find((value) => isSignatureTemplateArgumentForType(value, sourceType));
        if (!fallback) return inactiveSignatureRouteWitness(input.type);
        return Array.from({ length: invocations.length }, (_unused, row) =>
          isSignatureTemplateArgumentForType(aligned[row], sourceType) ? aligned[row] : fallback);
      }
      if (signatureWitness) return signatureWitness;
      // Signature slots are allocated for the route's full bounded row width.
      // Unreached rows are never executed, but their ABI positions must still
      // receive a valid template so transaction construction remains typed.
      if (/^__message_bus_sig_\d+_\d+_r\d+$/.test(input.name)) {
        const sameParameter = input.name.replace(/_r\d+$/, '');
        const fallback = [...signatureWitnessValues].find(([name]) =>
          name.replace(/_r\d+$/, '') === sameParameter)?.[1];
        if (fallback) return fallback;
      }
      const supplied = unboundRouteWitnesses[input.name];
      if (supplied !== undefined) return supplied;
      // Route dispatch never observes an inactive row's key band. Keep it distinct from active identities: reusing
      // an active family member manufactures a false same-target alias and can redirect a later row's journal to
      // an inactive default-valued cache. The positional ABI only requires a type-correct value here.
      return inactiveMessageBusRouteWitness(input.type);
    });

  markCanonicalBatchBlob(blob);
  return {
    blob,
    routeWitnesses: Object.freeze(routeWitnesses),
    rowCount: invocations.length,
    results: Object.freeze(results),
    rows: Object.freeze(framedRows.map((row) => Object.freeze(row))),
  };
}

/**
 * Decode and completely consume the aggregate return-event commitment produced by a returning message-bus batch route.
 *
 * The compiler route concatenates the canonical ABI fields returned by each reached returning row. The plan
 * supplies the exact ordered type vector, so decoding is deterministic even when rows return different types
 * or tuples. Complete consumption rejects both omitted fields and attacker-controlled suffixes.
 */
export function decodeMessageBusResults(
  artifact: Artifact,
  plan: Pick<EncodedMessageBatch, 'results'>,
  commitment: Uint8Array,
): readonly DecodedMessageBusResult[] {
  const capability = artifact.messageBus;
  if (!capability) throw new Error('This artifact does not advertise a message-bus route');
  if (plan.results.length === 0) {
    if (commitment.length !== 0) throw new Error('Non-returning message-bus batch plan has an unexpected result commitment');
    return [];
  }
  // `__message_bus1` returns one `bytes`. Its outer carrier follows the published route ABI independently of
  // each child row's result encoding. Current compiler-generated routes use compact framing; the EVM leg keeps
  // older/external artifacts explicit rather than inferring the carrier from artifact-wide compatibility mode.
  const carrierTypes = (capability.route.outputs ?? []).map((output) => output.type);
  if (carrierTypes.length !== 1 || carrierTypes[0] !== 'bytes') {
    throw new Error('message-bus batch route must publish exactly one bytes result carrier');
  }
  const carrierEncoding = resolveExternalResultEncoding(
    capability.route.resultEncoding, artifact, carrierTypes, 'message-bus route result carrier',
  );
  let packed: Uint8Array;
  if (carrierEncoding === 'evm-abi-v1') {
    const outer = decodeEvmInvocationResultPrefix(commitment, carrierTypes, artifact.structs, artifact.enums);
    if (!outer || outer.bytesConsumed !== commitment.length || !(outer.values[0] instanceof Uint8Array)) {
      throw new Error('message-bus batch result commitment is not one canonical EVM bytes field');
    }
    packed = outer.values[0];
  } else {
    const outer = decodePushdataValue(commitment, 0, 'bytes');
    if (outer.bytesConsumed !== commitment.length || !(outer.value instanceof Uint8Array)) {
      throw new Error('message-bus batch result commitment is not one canonical bytes field');
    }
    packed = outer.value;
  }
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  let offset = 0;
  const decodedRows = plan.results.map((result) => {
    let values: StateValue[];
    if (result.resultEncoding === 'evm-abi-v1') {
      const decoded = decodeEvmInvocationResultPrefix(
        packed.slice(offset), result.types, structs, artifact.enums,
      );
      if (!decoded) throw new Error('message-bus batch result commitment contains malformed EVM ABI result data');
      values = decoded.values;
      offset += decoded.bytesConsumed;
    } else {
      values = [];
      for (const type of result.types) {
        if (offset >= packed.length) {
          throw new Error('message-bus batch result commitment ended before every result field');
        }
        const decoded = decodePushdataValue(packed, offset, type, structs);
        values.push(decoded.value);
        offset += decoded.bytesConsumed;
      }
    }
    return Object.freeze({
      row: result.row,
      type: result.types.length === 1 ? result.types[0] : `(${result.types.join(',')})`,
      value: result.types.length === 1 ? values[0] : values,
    });
  });
  if (offset !== packed.length) {
    throw new Error('message-bus batch result commitment contains an unchecked suffix');
  }
  return Object.freeze(decodedRows);
}
