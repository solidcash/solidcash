import { bigIntToVmNumber, binToHex, hexToBin, utf8ToBin, vmNumberToBigInt } from '@bitauth/libauth';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, decodePushdataValue, encodePushdataValue, scriptToBytecode,
  MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN, sha256, buildEventNftCovenantScript,
  buildAnonymousEventNftCovenantScript, computeEventNameHash, parseArrayTypeString,
  buildInitialStateCommitments, bytecodeToScript, scriptToAsm, AddressType, BytesType, FixedType, IntType,
  parseTypeStrict, PrimitiveType,
  childStateLayoutDigest,
  validateChildDeploymentGenesisState,
} from '@solidcash/utils';
import type { Artifact, ChildDeploymentValueRecipe } from '@solidcash/utils';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import type {
  ContractUnlocker, Output, TokenDetails, TransactionDetails, UnlockableUtxo, Unlocker, Utxo,
} from '../interfaces.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { Contract } from '../Contract.js';
import { addressToLockScript, scriptToLockingBytecode } from '../utils.js';
import {
  decodeEvmReturnValue, evalComputedKey, isCanonicalEvmScalarReturnVector,
  StatefulContract, StatefulFunctionCall,
} from '../stateful/StatefulContract.js';
import { valueChunkIndexFromCommitment } from '../stateful/StatefulTransactionBuilder.js';
import { artifactUsesSolidityAbi } from '../stateful/solidityAbi.js';
import {
  resolveLogicalIdentity, type ResolvedLogicalIdentity,
} from '../stateful/logical-identity.js';
import { canApplyRepairedNftCommitment } from '../stateful/computed-output-repair.js';
import { tryParseEventCommitment } from '../stateful/StateReader.js';
import { getDataNftAddress } from '../stateful/covenant-helpers.js';
import {
  createMessageBusVerifierUnlocker, getMessageBusVerifierLockingBytecodeForArtifact,
} from '../stateful/covenant-helpers.js';
import { encodeAtomicMessageBusCallManifest, encodeAtomicMessageEnvelope } from './atomic.js';
import { assertAtomicParticipantCapacity } from './capacity.js';
import {
  finalizeAtomicInvocationGraph, graphInvocationCallerIdentity, selectedGraphEventOffsets,
  type AtomicDeploymentSlotEffect, type AtomicEventSlotEffect, type AtomicResourceSlotEffect,
  type AtomicSidecarSlotEffect, type AtomicTokenSlotEffect, type AtomicValueSlotEffect,
} from './graph.js';
import { encodeMessageBatch } from './message-bus.js';
import {
  convergeMessageBusComputedResourceOutputs, finalizedByteGateOptionsForProvider, preflightMessageBusTransaction,
} from './preflight.js';
import { convergeMessageBusComputedValueChunkOutputs } from './computed-value-chunks.js';
import { deriveCompiledGraphPlan, type WorklistParticipant } from './worklist.js';

export interface AtomicMessageBusFunder {
  utxo: Utxo;
  unlocker: Unlocker;
}

export interface ComposeAtomicMessageBusOptions {
  /** Root call followed by the concrete calls reached in compiler-authored depth-first order. */
  calls?: readonly StatefulFunctionCall[];
  /** @internal Resolved calls used by transparent SDK graph promotion. */
  preparedCalls?: readonly PreparedAtomicMessageBusCall[];
  /** The one ordinary fee input. Its unlocker signs only after the messageEnvelope and all blocks are final. */
  funder: AtomicMessageBusFunder | UnlockableUtxo;
  changeAddress: string | Uint8Array;
  feeRate?: number;
  /** One token-free vout-0 genesis input for each selected compiler-published deployment site. */
  childDeployments?: readonly {
    invocationIndex: number;
    siteIndex: number;
    funder: AtomicMessageBusFunder | UnlockableUtxo;
  }[];
}

export interface PreparedAtomicMessageBusCall {
  contract: StatefulContract;
  functionName: string;
  args: readonly FunctionArgument[];
  /** @internal Compiler-stable identity of this invocation in its parent function. */
  callsiteId?: number;
  /** @internal Source-template identity for one runtime row of a collapsed repeated-call batch. */
  batchLogicalIndex?: number;
  /** @internal Source loop occurrence represented by this runtime batch row. */
  batchOccurrenceIndex?: number;
  /** Exact address value evaluated by the parent call expression, encoded as locking-bytecode hex. */
  targetLockingBytecode?: string;
  /** Delegate route artifact executed against `contract`'s state/category. */
  executionArtifact?: Artifact;
  /** Pinned delegate executor co-spent inside this participant's block. */
  executor?: StatefulContract;
  /** Authenticated same-layout replacement selected for this participant's upgrade row. */
  upgradeTarget?: {
    artifact: Artifact;
    constructorArgs: readonly ConstructorArgument[];
  };
  /**
   * Return-event commitment already derived while discovering this call graph. This is only an optimistic
   * fixed-point seed: the composed transaction still has to expose the same result and pass every covenant.
   */
  provisionalResultCommitment?: Uint8Array;
  /** @internal Rebuild complete arguments from authenticated sibling results, keyed by parent-local callsite. */
  resolveArgsFromResults?: (
    results: ReadonlyMap<number, FunctionArgument>,
  ) => readonly FunctionArgument[] | undefined;
}

const recipeType = (
  recipe: ChildDeploymentValueRecipe,
  inputTypes: readonly string[],
): string => recipe.resultType
  ?? (recipe.kind === 'handlerInput' ? inputTypes[recipe.inputIndex] : undefined)
  ?? (() => { throw new Error('messageBus: deployment recipe has no result type'); })();

const numericRecipeValue = (value: FunctionArgument, typeName: string, solidityAbi: boolean): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'boolean') return value ? 1n : 0n;
  if (typeof value === 'string' && /^(?:-?\d+|0x[0-9a-f]+)$/i.test(value)) return BigInt(value);
  if (value instanceof Uint8Array) {
    const type = parseTypeStrict(typeName);
    const bytes = solidityAbi && type instanceof BytesType && type.bound !== undefined
      ? value.slice().reverse() : value;
    const decoded = vmNumberToBigInt(bytes);
    if (typeof decoded !== 'bigint') {
      throw new Error(`messageBus: deployment recipe has a non-minimal numeric ${typeName}`);
    }
    return decoded;
  }
  throw new Error(`messageBus: deployment recipe expected a scalar numeric ${typeName}`);
};

const fixedVmNumber = (value: bigint, width: number): Uint8Array => {
  const minimal = bigIntToVmNumber(value);
  if (minimal.length > width) throw new Error(`messageBus: deployment recipe value does not fit bytes${width}`);
  if (minimal.length === width) return minimal;
  const result = new Uint8Array(width);
  result.set(minimal);
  if (value < 0n && minimal.length > 0) {
    result[minimal.length - 1] &= 0x7f;
    result[width - 1] |= 0x80;
  }
  return result;
};

const coerceRecipeValue = (
  value: FunctionArgument,
  sourceTypeName: string,
  resultTypeName: string,
  solidityAbi: boolean,
): FunctionArgument => {
  const sourceType = parseTypeStrict(sourceTypeName);
  const resultType = parseTypeStrict(resultTypeName);
  if (resultType === PrimitiveType.BOOL) {
    return numericRecipeValue(value, sourceTypeName, solidityAbi) !== 0n;
  }
  if (resultType === PrimitiveType.BIGINT || resultType instanceof IntType || resultType instanceof FixedType) {
    let numeric = numericRecipeValue(value, sourceTypeName, solidityAbi);
    if ((sourceType === PrimitiveType.BIGINT || sourceType instanceof IntType)
      && resultType instanceof FixedType) numeric *= resultType.scaleFactor;
    if (sourceType instanceof FixedType
      && (resultType === PrimitiveType.BIGINT || resultType instanceof IntType)) numeric /= sourceType.scaleFactor;
    if (sourceType instanceof FixedType && resultType instanceof FixedType) {
      numeric = resultType.decimals > sourceType.decimals
        ? numeric * 10n ** BigInt(resultType.decimals - sourceType.decimals)
        : numeric / 10n ** BigInt(sourceType.decimals - resultType.decimals);
    }
    if ((resultType instanceof IntType || resultType instanceof FixedType)
      && (numeric < resultType.minValue || numeric > resultType.maxValue)) {
      throw new Error(`messageBus: deployment recipe value ${numeric} is out of bounds for ${resultTypeName}`);
    }
    return numeric;
  }
  if (resultType instanceof BytesType) {
    if (value instanceof Uint8Array) {
      if (resultType.bound === undefined) return value;
      if (!(sourceType instanceof BytesType)) {
        throw new Error(`messageBus: deployment recipe cannot cast ${sourceTypeName} to ${resultTypeName}`);
      }
      return value.length > resultType.bound
        ? value.slice(0, resultType.bound)
        : Uint8Array.from([...value, ...new Uint8Array(resultType.bound - value.length)]);
    }
    const numeric = numericRecipeValue(value, sourceTypeName, solidityAbi);
    if (resultType.bound === undefined) return bigIntToVmNumber(numeric);
    const encoded = fixedVmNumber(numeric, resultType.bound);
    return solidityAbi ? encoded.reverse() : encoded;
  }
  throw new Error(`messageBus: deployment recipe type ${resultTypeName} is not materializable`);
};

const canonicalRecipeEqualityValue = (
  value: FunctionArgument,
  typeName: string,
  solidityAbi: boolean,
): bigint | string => {
  const type = parseTypeStrict(typeName);
  if (type === PrimitiveType.BOOL || type === PrimitiveType.BIGINT
    || type instanceof IntType || type instanceof FixedType) {
    return numericRecipeValue(value, typeName, solidityAbi);
  }
  if (type === PrimitiveType.STRING) {
    if (typeof value === 'string') return binToHex(utf8ToBin(value));
    if (value instanceof Uint8Array) return binToHex(value);
    throw new Error('messageBus: deployment recipe expected string');
  }
  if (type instanceof AddressType || type instanceof BytesType
    || type === PrimitiveType.PUBKEY || type === PrimitiveType.DATASIG) {
    let bytesValue = value;
    if (typeof bytesValue === 'string' && type instanceof AddressType && bytesValue.includes(':')) {
      bytesValue = addressToLockScript(bytesValue);
    } else if (typeof bytesValue === 'string' && type instanceof AddressType && /^(?:0x)?0*$/i.test(bytesValue)) {
      bytesValue = new Uint8Array(0);
    } else if (typeof bytesValue === 'string') {
      bytesValue = hexToBin(bytesValue.startsWith('0x') ? bytesValue.slice(2) : bytesValue);
    }
    if (!(bytesValue instanceof Uint8Array)) {
      throw new Error(`messageBus: deployment recipe expected byte sequence ${typeName}`);
    }
    return binToHex(bytesValue);
  }
  throw new Error(`messageBus: deployment recipe equality type ${typeName} is not materializable`);
};

export const evaluateChildDeploymentRecipe = (
  recipe: ChildDeploymentValueRecipe,
  args: readonly FunctionArgument[],
  inputTypes: readonly string[],
  solidityAbi: boolean,
): FunctionArgument => {
  const resultType = recipeType(recipe, inputTypes);
  if (recipe.kind === 'handlerInput') {
    if (recipe.inputIndex < 0 || recipe.inputIndex >= args.length) {
      throw new Error(`messageBus: deployment recipe input ${recipe.inputIndex} is out of range`);
    }
    return args[recipe.inputIndex];
  }
  if (recipe.kind === 'intLiteral') return coerceRecipeValue(BigInt(recipe.value), 'bigint', resultType, solidityAbi);
  if (recipe.kind === 'boolLiteral') return coerceRecipeValue(recipe.value, 'bool', resultType, solidityAbi);
  if (recipe.kind === 'bytesLiteral') {
    return coerceRecipeValue(hexToBin(recipe.value), `bytes${recipe.value.length / 2}`, resultType, solidityAbi);
  }
  if (recipe.kind === 'cast') {
    const operand = evaluateChildDeploymentRecipe(recipe.operand, args, inputTypes, solidityAbi);
    return coerceRecipeValue(operand, recipeType(recipe.operand, inputTypes), resultType, solidityAbi);
  }
  if (recipe.kind === 'unary') {
    const operand = evaluateChildDeploymentRecipe(recipe.operand, args, inputTypes, solidityAbi);
    const numeric = numericRecipeValue(operand, recipeType(recipe.operand, inputTypes), solidityAbi);
    if (recipe.operator === '!') return coerceRecipeValue(numeric === 0n, 'bool', resultType, solidityAbi);
    if (recipe.operator === '-') return coerceRecipeValue(-numeric, 'bigint', resultType, solidityAbi);
    throw new Error(`messageBus: unsupported deployment recipe unary operator ${recipe.operator}`);
  }
  const leftValue = evaluateChildDeploymentRecipe(recipe.left, args, inputTypes, solidityAbi);
  const leftType = recipeType(recipe.left, inputTypes);
  if (recipe.operator === '&&' || recipe.operator === '||') {
    const left = numericRecipeValue(leftValue, leftType, solidityAbi) !== 0n;
    if (recipe.operator === '&&' && !left) return false;
    if (recipe.operator === '||' && left) return true;
    const rightValue = evaluateChildDeploymentRecipe(recipe.right, args, inputTypes, solidityAbi);
    const right = numericRecipeValue(rightValue, recipeType(recipe.right, inputTypes), solidityAbi) !== 0n;
    return recipe.operator === '&&' ? left && right : left || right;
  }
  const rightValue = evaluateChildDeploymentRecipe(recipe.right, args, inputTypes, solidityAbi);
  const rightType = recipeType(recipe.right, inputTypes);
  if (recipe.operator === '==' || recipe.operator === '!=') {
    const equal = canonicalRecipeEqualityValue(leftValue, leftType, solidityAbi)
      === canonicalRecipeEqualityValue(rightValue, rightType, solidityAbi);
    return recipe.operator === '==' ? equal : !equal;
  }
  const left = numericRecipeValue(leftValue, leftType, solidityAbi);
  const right = numericRecipeValue(rightValue, rightType, solidityAbi);
  let value: bigint | boolean;
  switch (recipe.operator) {
    case '+': value = left + right; break;
    case '-': value = left - right; break;
    case '*': value = left * right; break;
    case '/':
      if (right === 0n) throw new Error('messageBus: division by zero in deployment recipe');
      value = left / right; break;
    case '%':
      if (right === 0n) throw new Error('messageBus: modulo by zero in deployment recipe');
      value = left % right; break;
    case '<': value = left < right; break;
    case '<=': value = left <= right; break;
    case '>': value = left > right; break;
    case '>=': value = left >= right; break;
    default: throw new Error(`messageBus: unsupported deployment recipe binary operator ${recipe.operator}`);
  }
  return coerceRecipeValue(value, typeof value === 'boolean' ? 'bool' : 'bigint', resultType, solidityAbi);
};

interface CallDescriptor extends PreparedAtomicMessageBusCall {
  artifact: Artifact;
}

const evmStaticResultType = (type: string): boolean => type === 'bool'
  || type === 'int' || type === 'uint' || type === 'bigint'
  || /^u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)$/.test(type)
  || /^u?fixed(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)x\d+$/.test(type)
  || type === 'address' || type === 'address payable'
  || /^bytes(?:[1-9]|[12][0-9]|3[0-2])$/.test(type);

const evmWord = (value: number): Uint8Array => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('messageBus: invalid EVM ABI word value');
  const word = new Uint8Array(32);
  let rest = BigInt(value);
  for (let index = word.length - 1; index >= 0; index -= 1) {
    word[index] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  if (rest !== 0n) throw new Error('messageBus: EVM ABI word value is too large');
  return word;
};

interface EvmResultLayout {
  type: string;
  kind: 'scalar' | 'bytes' | 'array' | 'struct';
  dynamic: boolean;
  staticSize: number;
  bound?: number;
  children: readonly EvmResultLayout[];
}

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array =>
  Uint8Array.from(parts.flatMap((part) => [...part]));

/** Resolve the compiler's named result types against the artifact ABI into recursive Solidity layouts. */
const evmResultLayout = (
  artifact: Artifact, type: string, activeStructs = new Set<string>(),
): EvmResultLayout | undefined => {
  if (type === 'bytes' || type === 'string') {
    return { type, kind: 'bytes', dynamic: true, staticSize: 0, children: [] };
  }
  if (evmStaticResultType(type) || artifact.enums?.some((candidate) => candidate.name === type)) {
    return { type, kind: 'scalar', dynamic: false, staticSize: 32, children: [] };
  }
  const array = parseArrayTypeString(type);
  if (array) {
    const child = evmResultLayout(artifact, array.elementType, activeStructs);
    if (!child) return undefined;
    const dynamic = array.bound === undefined || child.dynamic;
    return {
      type, kind: 'array', dynamic, staticSize: dynamic ? 0 : array.bound! * child.staticSize,
      ...(array.bound !== undefined && { bound: array.bound }), children: [child],
    };
  }
  const struct = artifact.structs?.find((candidate) => candidate.name === type);
  if (!struct || activeStructs.has(type)) return undefined;
  const nested = new Set(activeStructs); nested.add(type);
  const children = struct.fields.map((field) => evmResultLayout(artifact, field.type, nested));
  if (children.some((child) => child === undefined)) return undefined;
  const fields = children as EvmResultLayout[];
  const dynamic = fields.some((field) => field.dynamic);
  return {
    type, kind: 'struct', dynamic,
    staticSize: dynamic ? 0 : fields.reduce((sum, field) => sum + field.staticSize, 0), children: fields,
  };
};

const evmTupleHeadSize = (fields: readonly EvmResultLayout[]): number =>
  fields.reduce((sum, field) => sum + (field.dynamic ? 32 : field.staticSize), 0);

const provisionalEvmValue = (layout: EvmResultLayout): Uint8Array => {
  if (layout.kind === 'scalar') {
    const word = new Uint8Array(32);
    // Preserve the existing optimistic boolean seed at every recursively addressable result position.
    if (layout.type === 'bool') word[31] = 1;
    return word;
  }
  if (layout.kind === 'bytes' || (layout.kind === 'array' && layout.bound === undefined)) return evmWord(0);
  if (layout.kind === 'array') {
    return provisionalEvmTuple(Array.from({ length: layout.bound! }, () => layout.children[0]));
  }
  return provisionalEvmTuple(layout.children);
};

const provisionalEvmTuple = (fields: readonly EvmResultLayout[]): Uint8Array => {
  const head: Uint8Array[] = [];
  const tails: Uint8Array[] = [];
  let tailOffset = evmTupleHeadSize(fields);
  for (const field of fields) {
    const encoded = provisionalEvmValue(field);
    if (field.dynamic) {
      head.push(evmWord(tailOffset));
      tails.push(encoded);
      tailOffset += encoded.length;
    } else {
      head.push(encoded);
    }
  }
  return concatBytes([...head, ...tails]);
};

/** @internal Optimistic, type-correct seed used during fixed-point assembly and schema conformance tests. */
export const provisionalInvocationResult = (
  artifact: Artifact, resultTypes: readonly string[],
): string => {
  if (!artifactUsesSolidityAbi(artifact)) {
    return binToHex(Uint8Array.from(resultTypes.flatMap((type) => [
      // A transaction signature used as result data is a compact byte string, not a deferred signer. Seed it
      // with canonical empty bytes; passing numeric zero to the byte encoder is neither typed nor encodable.
      ...encodePushdataValue(type === 'bool' ? true : type === 'sig' ? new Uint8Array() : 0n,
        type, artifact.structs),
    ])));
  }
  const layouts = resultTypes.map((type) => evmResultLayout(artifact, type));
  const unsupported = layouts.findIndex((layout) => layout === undefined);
  if (unsupported >= 0) throw new Error(
    `messageBus: EVM ABI result type '${resultTypes[unsupported]}' has no canonical provisional encoding`,
  );
  return binToHex(provisionalEvmTuple(layouts as EvmResultLayout[]));
};

const decodeEvmWord = (bytes: Uint8Array, offset: number): number => {
  if (offset < 0 || offset + 32 > bytes.length) throw new Error('messageBus: truncated EVM ABI result word');
  let value = 0n;
  for (const byte of bytes.slice(offset, offset + 32)) value = (value << 8n) | BigInt(byte);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('messageBus: EVM ABI result offset is too large');
  return Number(value);
};

const canonicalEvmScalar = (word: Uint8Array, layout: EvmResultLayout, artifact: Artifact): boolean => {
  const enumeration = artifact.enums?.find((candidate) => candidate.name === layout.type);
  if (!enumeration) return isCanonicalEvmScalarReturnVector(word, [layout.type]);
  if (!isCanonicalEvmScalarReturnVector(word, ['uint8'])) return false;
  const value = word.reduce((result, byte) => (result << 8n) | BigInt(byte), 0n);
  return enumeration.members.some((member) => BigInt(member.value) === value);
};

const canonicalEvmValueLength = (
  vector: Uint8Array, start: number, layout: EvmResultLayout, artifact: Artifact,
): number | undefined => {
  if (layout.kind === 'scalar') {
    if (start + 32 > vector.length) return undefined;
    return canonicalEvmScalar(vector.slice(start, start + 32), layout, artifact) ? 32 : undefined;
  }
  if (layout.kind === 'bytes') {
    const length = decodeEvmWord(vector, start);
    if (length === undefined) return undefined;
    const padded = Math.ceil(length / 32) * 32;
    const end = start + 32 + padded;
    if (!Number.isSafeInteger(end) || end > vector.length) return undefined;
    const padding = vector.slice(start + 32 + length, end);
    return padding.every((byte) => byte === 0) ? 32 + padded : undefined;
  }
  if (layout.kind === 'array' && layout.bound === undefined) {
    const count = decodeEvmWord(vector, start);
    if (count === undefined || count > Math.floor(vector.length / 32)) return undefined;
    const fields = Array.from({ length: count }, () => layout.children[0]);
    const tupleLength = canonicalEvmTupleLength(vector, start + 32, fields, artifact);
    return tupleLength === undefined ? undefined : 32 + tupleLength;
  }
  const fields = layout.kind === 'array'
    ? Array.from({ length: layout.bound! }, () => layout.children[0]) : layout.children;
  return canonicalEvmTupleLength(vector, start, fields, artifact);
};

const canonicalEvmTupleLength = (
  vector: Uint8Array, start: number, fields: readonly EvmResultLayout[], artifact: Artifact,
): number | undefined => {
  const headLength = evmTupleHeadSize(fields);
  if (!Number.isSafeInteger(headLength) || start + headLength > vector.length) return undefined;
  let headOffset = 0;
  let tailOffset = headLength;
  for (const field of fields) {
    if (field.dynamic) {
      const relative = decodeEvmWord(vector, start + headOffset);
      if (relative !== tailOffset || relative % 32 !== 0) return undefined;
      const length = canonicalEvmValueLength(vector, start + relative, field, artifact);
      if (length === undefined) return undefined;
      tailOffset += length;
      headOffset += 32;
    } else {
      const length = canonicalEvmValueLength(vector, start + headOffset, field, artifact);
      if (length !== field.staticSize) return undefined;
      headOffset += field.staticSize;
    }
  }
  return tailOffset;
};

/** @internal Length of one canonical ABI tuple within a concatenated route result vector. */
export const evmInvocationResultLength = (
  vector: Uint8Array, cursor: number, resultTypes: readonly string[], artifact: Artifact,
): number => {
  const layouts = resultTypes.map((type) => evmResultLayout(artifact, type));
  const unsupported = layouts.findIndex((layout) => layout === undefined);
  if (unsupported >= 0) throw new Error(`messageBus: cannot split EVM ABI result type '${resultTypes[unsupported]}'`);
  const length = canonicalEvmTupleLength(vector, cursor, layouts as EvmResultLayout[], artifact);
  if (length === undefined) throw new Error('messageBus: malformed or non-canonical EVM ABI result');
  return length;
};

/** Accept either a raw invocation vector or the one-push aggregate used by participant return events. */
const preparedInvocationResult = (
  commitment: Uint8Array | undefined, artifact: Artifact, resultTypes: readonly string[],
): string | undefined => {
  if (!commitment) return undefined;
  const consumesExactly = (candidate: Uint8Array): boolean => {
    try {
      if (artifactUsesSolidityAbi(artifact)) {
        return evmInvocationResultLength(candidate, 0, resultTypes, artifact) === candidate.length;
      }
      let cursor = 0;
      for (const type of resultTypes) {
        cursor += decodePushdataValue(candidate, cursor, type, artifact.structs).bytesConsumed;
      }
      return cursor === candidate.length;
    } catch {
      return false;
    }
  };
  if (consumesExactly(commitment)) return binToHex(commitment);
  try {
    const outer = decodePushdataValue(commitment, 0, 'bytes');
    if (outer.value instanceof Uint8Array
      && outer.bytesConsumed === commitment.length
      && consumesExactly(outer.value)) return binToHex(outer.value);
  } catch {
    // The caller below reports one stable error for malformed prepared data.
  }
  throw new Error('messageBus: prepared return commitment does not match the invocation result schema');
};

const delegateParticipantArtifacts = new WeakMap<Artifact, Map<number, Artifact>>();
const ownerParticipantArtifacts = new WeakMap<Artifact, Map<number, Artifact>>();

/** Add logical-identity anchors which are distinct from an owner route's physical master. */
const ownerParticipantArtifact = (artifact: Artifact, identityAnchorCount: number): Artifact => {
  if (identityAnchorCount === 0) return artifact;
  const cached = ownerParticipantArtifacts.get(artifact)?.get(identityAnchorCount);
  if (cached) return cached;
  const capability = artifact.messageBus;
  const layout = capability?.route.blockLayout;
  if (!capability || !layout) throw new Error('messageBus: owner route publishes no block layout');
  const identitySlots = Array.from({ length: identityAnchorCount }, (_unused, index) => ({
    kind: 'identityAnchor' as const,
    offset: layout.blockSize + index,
  }));
  const effective = {
    ...artifact,
    messageBus: {
      ...capability,
      route: {
        ...capability.route,
        blockLayout: {
          ...layout,
          blockSize: layout.blockSize + identityAnchorCount,
          slots: [...layout.slots, ...identitySlots],
          fixedSuffix: (layout.fixedSuffix ?? 0) + identityAnchorCount,
        },
      },
    },
  } as Artifact;
  const variants = ownerParticipantArtifacts.get(artifact) ?? new Map<number, Artifact>();
  variants.set(identityAnchorCount, effective);
  ownerParticipantArtifacts.set(artifact, variants);
  return effective;
};

/** Add the proxy-specific implementation input to compiler-authored delegate route geometry. */
const delegateParticipantArtifact = (artifact: Artifact, identityAnchorCount: number): Artifact => {
  const cached = delegateParticipantArtifacts.get(artifact)?.get(identityAnchorCount);
  if (cached) return cached;
  const capability = artifact.messageBus;
  const layout = capability?.route.blockLayout;
  if (!capability || !layout) throw new Error('messageBus: delegate route publishes no block layout');
  // The implementation executor and optional identity anchors follow the compiler-owned route block. Preserve
  // that block's bounded runtime-resource region: moving trailingBase to the executor loses every route chunk.
  const existingExecutor = layout.slots.find((slot) => slot.kind === 'lowLevelCall');
  const executorOffset = existingExecutor?.offset ?? layout.blockSize;
  const executorSlots = existingExecutor ? [] : [
    { kind: 'lowLevelCall' as const, offset: executorOffset, slotIndex: 0 },
  ];
  const baseBlockSize = layout.blockSize + executorSlots.length;
  const identitySlots = Array.from({ length: identityAnchorCount }, (_unused, index) => ({
    kind: 'identityAnchor' as const,
    offset: baseBlockSize + index,
  }));
  const slots = [
    ...layout.slots,
    ...executorSlots,
    ...identitySlots,
  ];
  const blockSize = baseBlockSize + identityAnchorCount;
  const effective = {
    ...artifact,
    messageBus: {
      ...capability,
      route: {
        ...capability.route,
        blockLayout: {
          ...layout,
          blockSize,
          slots,
          fixedSuffix: (layout.fixedSuffix ?? 0) + executorSlots.length + identityAnchorCount,
        },
      },
    },
  } as Artifact;
  const variants = delegateParticipantArtifacts.get(artifact) ?? new Map<number, Artifact>();
  variants.set(identityAnchorCount, effective);
  delegateParticipantArtifacts.set(artifact, variants);
  return effective;
};

const funderUtxo = (funder: AtomicMessageBusFunder | UnlockableUtxo): UnlockableUtxo =>
  ('utxo' in funder ? { ...funder.utxo, unlocker: funder.unlocker } : funder);

const participantOf = (
  descriptor: CallDescriptor,
  unboundRouteWitnesses: Readonly<Record<string, FunctionArgument>> = {},
  outputLockingBytecode?: string,
): WorklistParticipant => {
  const logicalLockingBytecode = binToHex(addressToLockScript(descriptor.contract.target));
  const representedLogicalIdentity = [
    descriptor.contract.inner.lockingBytecode,
    descriptor.executor?.inner.lockingBytecode,
  ].includes(logicalLockingBytecode);
  const identityAnchorCount = descriptor.contract._logicalAddress && !representedLogicalIdentity ? 1 : 0;
  const effectiveArtifact = descriptor.executor
    ? delegateParticipantArtifact(descriptor.artifact, identityAnchorCount)
    : ownerParticipantArtifact(descriptor.artifact, identityAnchorCount);
  const effectiveLayout = effectiveArtifact.messageBus?.route?.blockLayout;
  if (!effectiveLayout) {
    throw new Error(
      `messageBus: participant '${descriptor.artifact.contractName}' function '${descriptor.functionName}' has no compiled route`,
    );
  }
  const executorOffset = descriptor.executor
    ? effectiveLayout.slots.find((slot) => slot.kind === 'lowLevelCall')?.offset
    : undefined;
  const logicalIdentityOffset = logicalLockingBytecode === descriptor.contract.inner.lockingBytecode
    ? 0
    : descriptor.executor?.inner.lockingBytecode === logicalLockingBytecode
      ? executorOffset
      : identityAnchorCount === 1
        ? effectiveLayout.blockSize - 1
        : undefined;
  if (logicalIdentityOffset === undefined) {
    throw new Error('messageBus: logical call target has no authenticated participant slot');
  }
  if (descriptor.executor && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
    console.error('delegate-participant-identity', {
      logical: descriptor.contract._logicalAddress,
      logicalLockingBytecode,
      ownerLockingBytecode: descriptor.contract.inner.lockingBytecode,
      executorLockingBytecode: descriptor.executor.inner.lockingBytecode,
      represented: representedLogicalIdentity,
    });
  }
  return {
    artifact: effectiveArtifact,
    lockingBytecode: descriptor.contract.inner.lockingBytecode,
    ...(outputLockingBytecode !== undefined && { outputLockingBytecode }),
    ...(logicalLockingBytecode !== descriptor.contract.inner.lockingBytecode && {
      logicalLockingBytecode,
      logicalIdentityOffset,
    }),
    ...(descriptor.executor && {
      executionKind: 'delegate' as const,
      executorLockingBytecode: descriptor.executor.inner.lockingBytecode,
    }),
    constructorArgs: descriptor.contract.inner.constructorArgs as FunctionArgument[],
    ...(Object.keys(unboundRouteWitnesses).length > 0 && { unboundRouteWitnesses }),
  };
};

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
};

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
const framed = (value: Uint8Array): Uint8Array => concat(uint16(value.length), value);
const semanticJson = (value: unknown): string => JSON.stringify(
  value, (_key, field) => typeof field === 'bigint' ? field.toString() : field,
);

const sameStateGeometry = (previous: Artifact, replacement: Artifact): boolean => {
  if (!previous.stateLayout || !replacement.stateLayout) return false;
  const comparable = (artifact: Artifact): unknown => {
    const layout = artifact.stateLayout;
    if (!layout) return undefined;
    return {
      dataNftCount: layout.dataNftCount,
      commitmentLimit: layout.commitmentLimit,
      variables: layout.variables,
      collections: layout.collections ?? [],
      mappings: layout.mappings ?? [],
      structs: layout.structs ?? [],
    };
  };
  return semanticJson(comparable(previous)) === semanticJson(comparable(replacement));
};

interface DeferredComputeController {
  hasUnresolved(): boolean;
  resolve(
    program: ReturnType<TransactionBuilder['buildLibauthProgram']>, executionInput: number, inputBase: number,
  ): boolean;
  refresh(): TransactionBuilder;
}

interface ComputedValueChunkClaim {
  participant: number;
  offset: number;
  lockingBytecodeHex: string;
  tokenCategory: string;
  commitment: string;
}

type DeferredComputeBuilder = TransactionBuilder & {
  __messageBusDeferredCompute?: DeferredComputeController;
};

const graphRouteContext = (
  finalized: ReturnType<typeof finalizeAtomicInvocationGraph>, participant: number,
): Readonly<Record<string, FunctionArgument>> => {
  const execution = finalized.plan.participants[participant];
  const rows = finalized.callManifest.rows;
  const emissions = rows.map((row, invocation) => ({ row, invocation }))
    .filter(({ row }) => row.kind === 0 && row.parent !== 0xffff && row.owner === participant)
    .map(({ row, invocation }) => {
      const plannedInvocation = finalized.plan.invocations[invocation];
      if (!plannedInvocation || plannedInvocation.callee !== row.consumer) {
        throw new Error('messageBus: invocation row order disagrees with the compiled graph plan');
      }
      // The transcript binds the exact address evaluated by this call edge. Settlement remains keyed by the
      // physical participant in `row.consumer`, while a public/SCID address is authenticated at targetOffset.
      const targetLbc = hexToBin(plannedInvocation.targetLockingBytecode);
      const args = hexToBin(row.argsHex);
      const result = hexToBin(row.resultHex);
      const selector = hexToBin(row.selectorHex);
      return concat(framed(targetLbc), Uint8Array.of(row.mode), selector, framed(args), framed(result));
    });
  const ownedRows = rows.filter((row) => row.kind === 0 && row.consumer === participant);
  const callers = ownedRows.map((row) => framed(hexToBin(row.subjectHex)));
  const completions = ownedRows.map((row) => uint16(row.position));
  // Older/smaller routes authenticate one scalar caller category instead of the per-row graph caller stream.
  // They remain composable when every row has the same physical caller. Contract calls identify that caller by
  // its state-token category; root calls use the all-zero sentinel and resolve to authenticated tx.origin.
  const needsScalarCaller = execution.artifact.messageBus?.route.inputs.some(
    (input) => input.name === '__internal__msgSenderCategory',
  ) === true;
  const needsUpgradeBytecode = execution.artifact.messageBus?.route.inputs.some(
    (input) => input.name === '__internal__upgradeBytecode',
  ) === true;
  const scalarCallerCategories = !needsScalarCaller ? [] : [...new Set(ownedRows.map((row) => {
    if (row.sourceOffset === 0xffff) return '00'.repeat(32);
    const caller = finalized.callManifest.participants[row.owner];
    if (!caller) throw new Error(`messageBus: participant ${participant} row names an absent caller ${row.owner}`);
    return caller.stateCategory;
  }))];
  if (scalarCallerCategories.length > 1) {
    throw new Error(
      `messageBus: participant ${participant} requires per-row caller context for multiple physical callers`,
    );
  }
  const settlementTable = finalized.plan.participants.flatMap((owner) => [
    framed(hexToBin(owner.lockingBytecode)),
    uint16(finalized.layout.participantInputs[owner.participant]),
    uint16(owner.settlementBoundary),
  ]);
  const blockhashSlot = execution.blockLayout?.slots.find((slot) => slot.kind === 'blockhashOracle');
  const blockhashParameter = execution.artifact.messageBus?.route.graphBlockhashOracle?.inputBaseParameter;
  return Object.freeze({
    __internal__activeVerifierIndex: BigInt(finalized.layout.verifierInputs[participant]),
    __internal__graphFixedSize: BigInt(finalized.callManifest.participants[participant].fixedSize),
    __internal__returnOutputIdx: BigInt(
      finalized.callManifest.participants[participant].returnOffset === 0xffff
        ? -1 : finalized.layout.participantInputs[participant]
          + finalized.callManifest.participants[participant].returnOffset,
    ),
    __internal__graphBlockSize: BigInt(finalized.callManifest.participants[participant].maximumSize),
    __internal__graphEmissions: concat(...emissions),
    __internal__graphCallers: concat(...callers),
    __internal__graphSettlementBoundary: BigInt(execution.settlementBoundary),
    __internal__graphCompletionPositions: concat(...completions),
    __internal__graphSettlementTable: concat(...settlementTable),
    ...(needsScalarCaller ? {
      __internal__msgSenderCategory: hexToBin(scalarCallerCategories[0] ?? '00'.repeat(32)),
    } : {}),
    ...(needsUpgradeBytecode ? {
      __internal__upgradeBytecode: hexToBin(execution.outputLockingBytecode ?? execution.lockingBytecode),
    } : {}),
    ...(execution.executionKind === 1 ? {
      // The delegate route executes against the owner block rooted at this participant's physical master. The
      // distinct implementation executor is pinned by executorOffset; it is not the state/master identity.
      __internal__proxyMasterIndex: BigInt(finalized.layout.participantInputs[participant]),
    } : {}),
    ...(blockhashSlot !== undefined && blockhashParameter !== undefined ? {
      [blockhashParameter]: BigInt(finalized.layout.participantInputs[participant] + blockhashSlot.offset),
    } : {}),
  });
};

/** One atomic message bus transaction, still mutable only through its explicit build/send methods. */
export class AtomicMessageBusComposition {
  public constructor(
    private readonly options: ComposeAtomicMessageBusOptions,
    private readonly resultPropagationDepth = 0,
  ) {}

  private async _build(): Promise<TransactionBuilder> {
    const descriptors: CallDescriptor[] = this.options.preparedCalls
      ? this.options.preparedCalls.map((call) => ({
        ...call,
        artifact: call.executionArtifact ?? call.contract.inner.artifact,
      }))
      : (this.options.calls ?? []).map((call) => {
        const descriptor = call._messageBusCompositionDescriptor();
        return { ...descriptor, artifact: descriptor.contract.inner.artifact };
      });
    if (descriptors.length < 2) {
      throw new Error('messageBus: atomic composition requires at least two prepared calls');
    }
    const feeFunder = funderUtxo(this.options.funder);
    const rootCaller = feeFunder.unlocker.generateLockingBytecode();
    if (rootCaller.length !== 25 || rootCaller[0] !== 0x76 || rootCaller[1] !== 0xa9
      || rootCaller[2] !== 0x14 || rootCaller[23] !== 0x88 || rootCaller[24] !== 0xac) {
      throw new Error(
        'messageBus: the canonical fee tail must be a bare P2PKH input so the root caller equals authenticated tx.origin',
      );
    }
    const provider = descriptors[0].contract.inner.provider;
    if (descriptors.some((descriptor) => descriptor.contract.inner.provider !== provider)) {
      throw new Error('messageBus: all participants must use the same network provider');
    }
    const upgradeOutputs = new Map<string, string>();
    const upgradeDeclarations = new Map<string, number>();
    for (const descriptor of descriptors) {
      if (!descriptor.upgradeTarget) continue;
      if (descriptor.executor !== undefined || descriptor.executionArtifact !== undefined) {
        throw new Error('messageBus: upgrade targets cannot be attached to delegate execution routes');
      }
      const owner = descriptor.contract.inner.lockingBytecode.toLowerCase();
      const declarations = (upgradeDeclarations.get(owner) ?? 0) + 1;
      upgradeDeclarations.set(owner, declarations);
      if (declarations !== 1) {
        throw new Error('messageBus: an upgraded participant requires exactly one replacement target');
      }
      if (!sameStateGeometry(descriptor.contract.inner.artifact, descriptor.upgradeTarget.artifact)) {
        throw new Error(
          `messageBus: replacement '${descriptor.upgradeTarget.artifact.contractName}' does not have identical state geometry`,
        );
      }
      const replacement = new Contract(
        descriptor.upgradeTarget.artifact,
        [...descriptor.upgradeTarget.constructorArgs] as ConstructorArgument[],
        {
          provider,
          addressType: descriptor.contract.inner.addressType,
          category: hexToBin(descriptor.contract.categoryId),
        },
      );
      const outputLockingBytecode = replacement.lockingBytecode.toLowerCase();
      if (outputLockingBytecode === owner) {
        throw new Error('messageBus: an upgrade replacement must change the participant locking bytecode');
      }
      upgradeOutputs.set(owner, outputLockingBytecode);
    }

    const stateByContract = new Map<StatefulContract, Promise<Record<string, unknown>>>();
    const stateOf = (contract: StatefulContract): Promise<Record<string, unknown>> => {
      let pending = stateByContract.get(contract);
      if (!pending) {
        pending = contract.getState() as Promise<Record<string, unknown>>;
        stateByContract.set(contract, pending);
      }
      return pending;
    };
    const descriptorWitnesses = await Promise.all(descriptors.map(async (descriptor) => {
      const artifact = descriptor.artifact;
      const handler = artifact.messageBus?.handlers.find((candidate) =>
        candidate.name === descriptor.functionName);
      const expressionBindings = handler?.batchKeyWitnesses?.filter((binding) =>
        binding.source === 'expression') ?? [];
      if (expressionBindings.length === 0) return Object.freeze({}) as Readonly<Record<string, FunctionArgument>>;
      const abi = artifact.abi.find((candidate) => candidate.name === descriptor.functionName);
      if (!abi) throw new Error(`messageBus: ABI for '${descriptor.functionName}' is missing`);
      const state = await stateOf(descriptor.contract);
      const witnesses: Record<string, FunctionArgument> = {};
      for (const binding of expressionBindings) {
        const encoded = evalComputedKey(
          binding.expressionLabel,
          [...descriptor.args],
          abi.inputs,
          state as Parameters<typeof evalComputedKey>[3],
        );
        if (!encoded) {
          throw new Error(
            `messageBus: cannot derive computed route witness '${binding.routeInput}' `
            + `from '${binding.expressionLabel ?? '<missing expression>'}'`,
          );
        }
        const routeType = artifact.messageBus?.route.inputs.find((input) =>
          input.name === (binding.perRow ? `${binding.routeInput}_r0` : binding.routeInput))?.type;
        witnesses[binding.routeInput] = routeType === 'bool'
          ? vmNumberToBigInt(encoded) !== 0n
          : routeType === 'bigint' || routeType === 'int' || routeType === 'uint'
            || /^u?int\d+$/.test(routeType ?? '')
            ? vmNumberToBigInt(encoded)
            : encoded;
      }
      return Object.freeze(witnesses);
    }));
    // `planCompiledGraph` interns one participant per locking bytecode and then batches that owner's rows in
    // global invocation order. Aggregate each prepared invocation's derived values into that same owner-local
    // row numbering before planning, so a route input named `_rN` receives the Nth invocation's proven key.
    const ownerWitnesses = new Map<string, Record<string, FunctionArgument>>();
    const ownerRows = new Map<string, number>();
    descriptors.forEach((descriptor, index) => {
      const owner = descriptor.contract.inner.lockingBytecode.toLowerCase();
      const row = ownerRows.get(owner) ?? 0;
      ownerRows.set(owner, row + 1);
      const aggregate = ownerWitnesses.get(owner) ?? {};
      const handler = descriptor.artifact.messageBus?.handlers.find((candidate) =>
        candidate.name === descriptor.functionName);
      for (const binding of handler?.batchKeyWitnesses?.filter((candidate) =>
        candidate.source === 'expression') ?? []) {
        const value = descriptorWitnesses[index][binding.routeInput];
        if (value === undefined) continue;
        const name = binding.perRow ? `${binding.routeInput}_r${row}` : binding.routeInput;
        const prior = aggregate[name];
        if (prior !== undefined && semanticJson(prior) !== semanticJson(value)) {
          throw new Error(`messageBus: derived route witness '${name}' disagrees across prepared calls`);
        }
        aggregate[name] = value;
      }
      ownerWitnesses.set(owner, aggregate);
    });
    // A route publishes the union of every admitted handler's key positions. The selected rows may leave both
    // global keys (an entirely inactive sibling handler) and row-local keys (unused capacity) unbound, but the
    // balanced physical route still needs a typed, collision-free absent-key probe for each slot. These values
    // are compiler-inactive: encodeMessageBatch derives and overrides every active binding, and the route gates
    // inactive entry slots off. Keep strict encodeMessageBatch callers explicit; only the compiler-DAG composer
    // derives these deterministic fillers.
    const filler = (name: string, type: string): FunctionArgument => {
      const digest = sha256(new TextEncoder().encode(`SolidCash message-bus inactive key\0${name}`));
      if (type === 'address' || type === 'address payable') {
        return new Uint8Array([0xaa, 0x20, ...digest, 0x87]);
      }
      const bytes = /^bytes(\d+)$/.exec(type);
      if (bytes) return digest.slice(0, Number(bytes[1]));
      if (type === 'bytes') return digest;
      if (type === 'string') return `__solidcash_inactive_${binToHex(digest)}`;
      if (type === 'bool') return (digest[0] & 1) === 1;
      if (/^(u?int\d*|bigint)$/.test(type)) {
        return digest.slice(0, 8).reduce((value, byte, index) =>
          value | (BigInt(byte) << BigInt(index * 8)), 0n);
      }
      throw new Error(`messageBus: cannot derive an inactive route witness of type '${type}'`);
    };
    for (const descriptor of descriptors) {
      const owner = descriptor.contract.inner.lockingBytecode.toLowerCase();
      const aggregate = ownerWitnesses.get(owner) ?? {};
      for (const input of descriptor.artifact.messageBus?.route.inputs ?? []) {
        if (!input.name.startsWith('__message_bus_key_') || aggregate[input.name] !== undefined) continue;
        // An unrolled route's collection journal initializes every bounded row cache before dispatch. Reuse an
        // actually bound value from the same row-parameter family for unused capacity: those inactive caches then
        // alias one real logical entry and can share its proof safely. A distinct filler per row creates distinct
        // absent targets which often require the same predecessor UTXO, an impossible duplicate transaction input.
        // Entirely inactive handler families retain a deterministic typed filler.
        const family = input.name.replace(/_r\d+$/, '');
        const activeFamilyValue = Object.entries(aggregate).find(([name]) =>
          name.replace(/_r\d+$/, '') === family)?.[1];
        aggregate[input.name] = activeFamilyValue ?? filler(`${owner}:${input.name}`, input.type);
      }
      ownerWitnesses.set(owner, aggregate);
    }
    const workParticipants = descriptors.map((descriptor) => participantOf(
      descriptor,
      Object.freeze(ownerWitnesses.get(descriptor.contract.inner.lockingBytecode.toLowerCase()) ?? {}),
      upgradeOutputs.get(descriptor.contract.inner.lockingBytecode.toLowerCase()),
    ));

    let next = 1;
    const plan = deriveCompiledGraphPlan({
      root: workParticipants[0],
      function: descriptors[0].functionName,
      args: descriptors[0].args,
      rootCaller,
      targets: {},
      target: ({ callsiteId, batchLogicalIndex, occurrence }) => {
        const descriptor = descriptors[next];
        if (!descriptor) return undefined;
        if (descriptor.callsiteId !== undefined && descriptor.callsiteId !== callsiteId) return undefined;
        if (batchLogicalIndex !== undefined
          && descriptor.batchLogicalIndex !== undefined
          && descriptor.batchLogicalIndex !== batchLogicalIndex) return undefined;
        if (batchLogicalIndex !== undefined
          && descriptor.batchOccurrenceIndex !== undefined
          && descriptor.batchOccurrenceIndex !== occurrence) return undefined;
        next += 1;
        return {
          participant: workParticipants[next - 1],
          ...(descriptor.targetLockingBytecode !== undefined && {
            targetLockingBytecode: descriptor.targetLockingBytecode,
          }),
        };
      },
      batchOccurrences: ({ callsiteId, batchLogicalIndex }) => {
        const reached: number[] = [];
        for (let cursor = next; cursor < descriptors.length; cursor += 1) {
          const descriptor = descriptors[cursor];
          if (descriptor.callsiteId !== callsiteId
            || descriptor.batchLogicalIndex !== batchLogicalIndex) break;
          reached.push(descriptor.batchOccurrenceIndex ?? reached.length);
        }
        return reached.length > 0 || this.options.preparedCalls ? reached : undefined;
      },
      occurrence: ({ participant, function: ownerFunction, callsiteId, kind }) => {
        const abiFunction = participant.artifact.abi.find((candidate) => candidate.name === ownerFunction);
        const callsite = abiFunction?.externalCalls?.find((candidate) => candidate.callsiteId === callsiteId);
        if (!callsite) {
          throw new Error(`messageBus: compiler omitted occurrence metadata for callsite ${callsiteId}`);
        }
        const maximum = callsite.maximumOccurrences ?? (kind === 'conditional' ? 1 : 0);
        // Compiler-authored raw edges retain `functionName: __raw__` and publish the decoded concrete selector
        // separately. Prepared calls use that concrete function name, so occurrence matching must do the same.
        let count = 0;
        while (count < maximum) {
          const reached = descriptors[next + count];
          if (!reached) break;
          // Several conditional branches may call the same target method. Method/selector matching alone makes
          // an untaken sibling indistinguishable from the reached branch. Transparent promotion preserves the
          // compiler's parent-local identity, so it is authoritative when present; manually composed calls retain
          // the legacy structural matching below.
          if (reached.callsiteId !== undefined && reached.callsiteId !== callsiteId) break;
          const matches = callsite.rawFunctionName
            ? reached.functionName === callsite.rawFunctionName
            : callsite.rawSelector
              ? reached.artifact.abi.find((candidate) => candidate.name === reached.functionName)
                ?.selector?.toLowerCase() === callsite.rawSelector.toLowerCase()
              : reached.functionName === callsite.functionName;
          if (!matches) break;
          count += 1;
        }
        return count;
      },
      expressionArgument: ({ callsiteId, argument }) => {
        const reached = descriptors[next - 1];
        const value = reached?.args[argument];
        if (value === undefined) {
          throw new Error(
            `messageBus: prepared call omits derived argument ${argument} for callsite ${callsiteId}`,
          );
        }
        return value;
      },
      dynamicCall: ({ callsiteId, kind }) => {
        if (kind !== 'low-level') {
          throw new Error(`messageBus: atomic composer does not yet resolve ${kind} calls`);
        }
        const descriptor = descriptors[next];
        if (!descriptor) throw new Error('messageBus: prepared calls omit a low-level target');
        if (descriptor.callsiteId !== undefined && descriptor.callsiteId !== callsiteId) {
          throw new Error(
            `messageBus: prepared low-level callsite ${descriptor.callsiteId} cannot satisfy callsite ${callsiteId}`,
          );
        }
        next += 1;
        return {
          participant: workParticipants[next - 1],
          function: descriptor.functionName,
          args: descriptor.args,
          ...(descriptor.targetLockingBytecode !== undefined && {
            targetLockingBytecode: descriptor.targetLockingBytecode,
          }),
        };
      },
    });
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ATOMIC_PROMOTION === '1') {
      console.error('atomic-prepared-plan', JSON.stringify({
        descriptors: descriptors.map((descriptor) => ({
          functionName: descriptor.functionName,
          callsiteId: descriptor.callsiteId,
          batchLogicalIndex: descriptor.batchLogicalIndex,
          batchOccurrenceIndex: descriptor.batchOccurrenceIndex,
        })),
        invocations: plan.invocations.map((invocation) => ({
          functionName: invocation.function,
          parent: invocation.parent,
          callsiteId: invocation.consumerCallsiteId,
          argsHex: invocation.argsHex,
        })),
      }));
    }
    if (plan.invocations.length !== descriptors.length) {
      throw new Error(
        `messageBus: prepared ${descriptors.length} call(s), but the compiled graph reaches `
        + `${plan.invocations.length}`,
      );
    }
    if (upgradeOutputs.size > 0) {
      const legacyParticipant = plan.participants.find((participant) =>
        !participant.artifact.messageBus?.atomicMessageBus?.protocolVersions?.includes(2));
      if (legacyParticipant) {
        throw new Error(
          `messageBus: participant '${legacyParticipant.artifact.contractName}' does not advertise atomic V2 support`,
        );
      }
    }
    for (const participant of plan.participants) {
      const owner = participant.lockingBytecode.toLowerCase();
      const selectedHandlers = participant.invocations.map((invocationIndex) => {
        const invocation = plan.invocations[invocationIndex];
        return participant.artifact.messageBus?.handlers.find((candidate) =>
          candidate.selector?.toLowerCase() === invocation.selectorHex.toLowerCase());
      });
      const upgradeRows = selectedHandlers.flatMap((handler, index) =>
        handler?.lifecycle?.kind === 'upgrade' ? [index] : []);
      const hasTarget = upgradeOutputs.has(owner);
      if (upgradeRows.length === 0 && hasTarget) {
        throw new Error('messageBus: a replacement target requires a selected compiler-authored upgrade handler');
      }
      if (upgradeRows.length > 0 && !hasTarget) {
        throw new Error('messageBus: a selected upgrade handler requires exactly one replacement target');
      }
      if (upgradeRows.length > 1) {
        throw new Error('messageBus: an upgraded participant may select exactly one upgrade row');
      }
      if (upgradeRows.length === 1 && upgradeRows[0] !== selectedHandlers.length - 1) {
        throw new Error('messageBus: the participant upgrade row must be its final invocation');
      }
    }
    if (upgradeOutputs.size > 0) {
      const signedInvocation = plan.invocations.find((invocation) => {
        const artifact = plan.participants[invocation.callee].artifact;
        const handler = artifact.messageBus?.handlers.find((candidate) =>
          candidate.selector?.toLowerCase() === invocation.selectorHex.toLowerCase());
        return handler?.usesTransactionSignature === true;
      });
      if (signedInvocation) {
        throw new Error(
          `messageBus: upgrade graphs cannot include transaction-signature checks in '${signedInvocation.function}'`,
        );
      }
    }
    assertAtomicParticipantCapacity(plan.participants.length);
    const hasResultDependentAncestor = (invocationIndex: number): boolean => {
      let parent = plan.invocations[invocationIndex]?.parent;
      while (parent !== null && parent !== undefined) {
        if (descriptors[parent]?.resolveArgsFromResults !== undefined) return true;
        parent = plan.invocations[parent]?.parent;
      }
      return false;
    };
    plan.invocations.forEach((invocation, index) => {
      const supplied = descriptors[index];
      if (!supplied || supplied.functionName !== invocation.function) {
        throw new Error(
          `messageBus: prepared call ${index} is '${supplied?.functionName ?? '<missing>'}', `
          + `expected '${invocation.function}'`,
        );
      }
      const handler = supplied.artifact.messageBus?.handlers.find((candidate) =>
        candidate.name === supplied.functionName);
      const validationWitnesses = Object.fromEntries((handler?.batchKeyWitnesses ?? [])
        .filter((binding) => binding.source === 'expression')
        .map((binding) => [
          binding.perRow ? `${binding.routeInput}_r0` : binding.routeInput,
          descriptorWitnesses[index][binding.routeInput],
        ]).filter((entry): entry is [string, FunctionArgument] => entry[1] !== undefined));
      const participantExecution = plan.participants[invocation.callee];
      const plannedWitnesses = Object.fromEntries(participantExecution.routeInputs
        .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'))
        .map((input, witnessIndex) => [input.name, participantExecution.batch.routeWitnesses[witnessIndex]]));
      const suppliedRow = encodeMessageBatch(supplied.artifact, [{
        function: supplied.functionName,
        args: supplied.args,
        callMode: invocation.callMode,
        ...(invocation.caller !== null && handler?.usesMsgValue && { msgValue: 0n }),
        logicalCaller: invocation.caller === null
          ? rootCaller : hexToBin(graphInvocationCallerIdentity(
            plan.participants, plan.invocations, invocation,
          ).lockingBytecode),
      }], { ...plannedWitnesses, ...validationWitnesses }).rows[0];
      // Once an ancestor's arguments are rebuilt from authenticated sibling returns, ordinary forwarded
      // descendants are re-derived by the compiler worklist too. Their discovery descriptors still describe the
      // preceding fixed-point pass, so comparing those stale bytes here would stop convergence before the
      // participant covenant can expose the next result. Calls outside such a dependency subtree remain strict.
      if (suppliedRow.argsHex !== invocation.argsHex && !hasResultDependentAncestor(index)) {
        throw new Error(
          `messageBus: prepared call ${index} '${invocation.function}' arguments disagree with compiler-derived `
          + `invocation arguments (prepared ${suppliedRow.argsHex}, derived ${invocation.argsHex})`,
        );
      }
    });
    const byLockingBytecode = new Map<string, StatefulContract>();
    const descriptorByLockingBytecode = new Map<string, CallDescriptor>();
    for (const descriptor of descriptors) {
      const lockingBytecode = descriptor.contract.inner.lockingBytecode.toLowerCase();
      byLockingBytecode.set(lockingBytecode, descriptor.contract);
      descriptorByLockingBytecode.set(lockingBytecode, descriptor);
    }
    const categories = plan.participants.map((participant) => {
      const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase());
      if (!contract?.categoryId) throw new Error('messageBus: every participant must have a resolved master category');
      return contract.categoryId;
    });
    // Public CREATE/proxy identities are authenticated by immutable SCID anchors. Resolve each required anchor
    // once per fixed-point assembly pass and supply it explicitly to the local builder: address(this) still comes
    // from the active covenant input, while an ordinary nested msg.sender can select this stable public identity.
    const logicalIdentities = new Map<number, ResolvedLogicalIdentity>();
    await Promise.all(plan.participants.map(async (participant) => {
      if (!participant.blockLayout?.slots.some((slot) => slot.kind === 'identityAnchor')) return;
      const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
      const identity = await resolveLogicalIdentity(provider, contract._logicalAddress ?? contract.target);
      const expected = participant.logicalLockingBytecode?.toLowerCase();
      const actual = binToHex(addressToLockScript(identity.logicalAddress)).toLowerCase();
      if (!expected || actual !== expected) {
        throw new Error('messageBus: resolved logical call target disagrees with its participant identity');
      }
      logicalIdentities.set(participant.participant, identity);
    }));
    const returning = plan.invocations.filter((invocation) => invocation.resultTypes.length > 0);
    const preparedResults = Object.fromEntries(returning.flatMap((invocation) => {
      const artifact = plan.participants[invocation.callee].artifact;
      const prepared = preparedInvocationResult(
        descriptors[invocation.index]?.provisionalResultCommitment,
        artifact,
        invocation.resultTypes,
      );
      return prepared === undefined ? [] : [[invocation.index, prepared] as const];
    }));
    const provisionalResults = Object.fromEntries(returning.map((invocation) => {
      const artifact = plan.participants[invocation.callee].artifact;
      return [invocation.index, preparedResults[invocation.index]
        ?? provisionalInvocationResult(artifact, invocation.resultTypes)];
    }));
    const propagateResultDependentArguments = (
      results: Readonly<Record<number, string>>,
    ): { propagated: boolean; calls: PreparedAtomicMessageBusCall[] } => {
      const resultsByParent = new Map<number, Map<number, FunctionArgument>>();
      for (const invocation of returning) {
        if (invocation.parent === null || invocation.consumerCallsiteId === undefined) continue;
        const resultHex = results[invocation.index];
        if (resultHex === undefined || invocation.resultTypes.length !== 1) continue;
        const artifact = plan.participants[invocation.callee].artifact;
        let value: FunctionArgument | undefined;
        if (artifactUsesSolidityAbi(artifact)) {
          value = decodeEvmReturnValue(hexToBin(resultHex), invocation.resultTypes[0]);
        } else {
          try {
            const bytes = hexToBin(resultHex);
            const decoded = decodePushdataValue(bytes, 0, invocation.resultTypes[0], artifact.structs);
            if (decoded.bytesConsumed === bytes.length) value = decoded.value as FunctionArgument;
          } catch {
            // Unsupported result shapes remain ordinary fixed-point claims; no argument is guessed.
          }
        }
        if (value === undefined) continue;
        const siblings = resultsByParent.get(invocation.parent) ?? new Map<number, FunctionArgument>();
        siblings.set(invocation.consumerCallsiteId, value);
        resultsByParent.set(invocation.parent, siblings);
      }
      let propagated = false;
      const calls = descriptors.map((descriptor, index): PreparedAtomicMessageBusCall => {
        const invocation = plan.invocations[index];
        const siblingResults = invocation.parent === null
          ? undefined : resultsByParent.get(invocation.parent);
        const resolved = siblingResults && descriptor.resolveArgsFromResults?.(siblingResults);
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RESULT_PROPAGATION === '1' && siblingResults
          && descriptor.resolveArgsFromResults) {
          console.error('atomic-result-argument-resolution', JSON.stringify({
            invocation: index,
            functionName: descriptor.functionName,
            callsites: [...siblingResults.keys()],
            resolved: resolved !== undefined,
            changed: resolved !== undefined
              && semanticJson(resolved) !== semanticJson(descriptor.args),
          }));
        }
        let args = descriptor.args;
        if (resolved && semanticJson(resolved) !== semanticJson(descriptor.args)) {
          propagated = true;
          args = resolved;
        }
        return {
          contract: descriptor.contract,
          functionName: descriptor.functionName,
          args,
          ...(descriptor.callsiteId !== undefined && { callsiteId: descriptor.callsiteId }),
          ...(descriptor.targetLockingBytecode !== undefined && {
            targetLockingBytecode: descriptor.targetLockingBytecode,
          }),
          ...(descriptor.executionArtifact && { executionArtifact: descriptor.executionArtifact }),
          ...(descriptor.executor && { executor: descriptor.executor }),
          ...(descriptor.upgradeTarget && { upgradeTarget: descriptor.upgradeTarget }),
          ...(results[index] !== undefined
            ? { provisionalResultCommitment: hexToBin(results[index]) }
            : descriptor.provisionalResultCommitment && {
              provisionalResultCommitment: descriptor.provisionalResultCommitment,
            }),
          ...(descriptor.resolveArgsFromResults && {
            resolveArgsFromResults: descriptor.resolveArgsFromResults,
          }),
        };
      });
      return { propagated, calls };
    };
    // A graph-discovery seed is already semantically available on the first atomic pass. Rebuild expressions
    // which consume it before assembling the call manifest; waiting for the VM to discover a *different* result
    // leaves an unchanged seed permanently paired with the stale pre-discovery argument bytes.
    // Only explicit/precomputed results are available before the first VM discovery pass. Synthetic empty/true
    // seeds exist solely to let the route advance; feeding them into sibling arguments changes source semantics
    // before any covenant has authenticated the value.
    const initialPropagation = propagateResultDependentArguments(preparedResults);
    if (initialPropagation.propagated) {
      if (this.resultPropagationDepth >= descriptors.length) {
        throw new Error('messageBus: authenticated result arguments did not converge');
      }
      return new AtomicMessageBusComposition(
        { ...this.options, preparedCalls: initialPropagation.calls },
        this.resultPropagationDepth + 1,
      )._build();
    }
    const fixedEventSlots = plan.participants.flatMap((participant) =>
      participant.blockLayout!.slots.filter((slot) => slot.kind === 'event').map((slot) => ({
        participant: participant.participant, offset: slot.offset,
      })));
    const runtimeEventSlots = new Map<number, Array<{
      participant: number; offset: number; runtimeRow: number; eventSignature: string;
    }>>();
    const eventSlots = () => [
      ...fixedEventSlots,
      ...[...runtimeEventSlots.values()].flat(),
    ];
    const hasRuntimeLoopEvents = plan.participants.some((participant) => participant.invocations.some(
      (invocationIndex) => {
        const invocation = plan.invocations[invocationIndex];
        return participant.artifact.messageBus?.handlers.some((handler) =>
          handler.name === invocation.function && (handler.runtimeLoopEvents?.length ?? 0) > 0);
      },
    ));
    const resourceSlots = plan.participants.flatMap((participant) =>
      participant.blockLayout!.slots
        .filter((slot) => [
          'dataNft', 'readOnlyDataNft', 'entry', 'satoshiContainer', 'tokenContainer', 'trailing', 'lowLevelCall',
        ].includes(slot.kind))
        .map((slot) => ({
          participant: participant.participant, offset: slot.offset, kind: slot.kind,
        })));
    const valueSlots = plan.participants.flatMap((participant) =>
      participant.blockLayout!.slots.filter((slot) => slot.kind === 'transfer').map((slot) => ({
        participant: participant.participant, offset: slot.offset,
      })));
    const tokenSlots = plan.participants.flatMap((participant) =>
      participant.blockLayout!.slots.filter((slot) => slot.kind === 'tcTransfer').map((slot) => ({
        participant: participant.participant, offset: slot.offset,
      })));
    const sidecarSlots = plan.participants.flatMap((participant) =>
      participant.blockLayout!.slots
        .filter((slot) => ['blockhashOracle', 'keccakSideCar', 'ecrecoverSideCar'].includes(slot.kind))
        .map((slot) => ({
          participant: participant.participant, offset: slot.offset,
          kind: slot.kind as AtomicSidecarSlotEffect['kind'],
        })));
    const hasComputedValueChunks = plan.participants.some((participant) =>
      participant.routeInputs.some((input) => input.name === '__internal__valueChunkOutputBase'));
    const suppliedDeployments = this.options.childDeployments ?? [];
    const usedDeployments = new Set<number>();
    const materializedDeployments = plan.participants.flatMap((participant) => {
      const owner = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
      const deploymentSlots = participant.blockLayout!.slots
        .filter((slot) => slot.kind === 'deploy')
        .sort((left, right) => left.offset - right.offset);
      return participant.invocations.flatMap((invocationIndex, row) => {
        const descriptor = descriptors[invocationIndex];
        const handler = participant.artifact.messageBus?.handlers.find((candidate) =>
          candidate.selector === plan.invocations[invocationIndex].selectorHex);
        const sites = handler?.childDeployments ?? [];
        if (sites.length === 0) return [];
        if (sites.some((site, index) => site.occurrence !== 'once' || site.siteIndex !== index)) {
          throw new Error(`messageBus: invocation ${invocationIndex} has no canonical straight-line deployment sequence`);
        }
        const deploymentSlot = deploymentSlots[row];
        if (deploymentSlot?.slotIndex === undefined) {
          throw new Error(`messageBus: compiler layout has no deployment slot for selected row ${row}`);
        }
        let siteOffset = 0;
        return sites.map((site) => {
          const offset = deploymentSlot.offset + siteOffset;
          siteOffset += 1 + site.dataNftOutputCount;
          const suppliedIndex = suppliedDeployments.findIndex((candidate) =>
            candidate.invocationIndex === invocationIndex && candidate.siteIndex === site.siteIndex);
          if (suppliedIndex < 0) {
            throw new Error(`messageBus: missing child genesis for invocation ${invocationIndex}, site ${site.siteIndex}`);
          }
          if (usedDeployments.has(suppliedIndex)) {
            throw new Error(`messageBus: duplicate child genesis for invocation ${invocationIndex}, site ${site.siteIndex}`);
          }
          usedDeployments.add(suppliedIndex);
          const genesis = funderUtxo(suppliedDeployments[suppliedIndex].funder);
          if (genesis.vout !== 0 || genesis.token) {
            throw new Error(
              `messageBus: child genesis for invocation ${invocationIndex}, site ${site.siteIndex} must be token-free vout 0`,
            );
          }
          const childArtifact = owner._getChild(site.contractName);
          if (!childArtifact?.stateLayout) {
            throw new Error(`messageBus: registered stateful child artifact '${site.contractName}' is required`);
          }
          if (childArtifact.stateLayout.dataNftCount !== site.dataNftOutputCount) {
            throw new Error(
              `messageBus: registered child artifact '${site.contractName}' has deployment state geometry ${childArtifact.stateLayout.dataNftCount}, expected ${site.dataNftOutputCount}`,
            );
          }
          if (site.childLayoutDigest
            && childStateLayoutDigest(childArtifact.stateLayout) !== site.childLayoutDigest.toLowerCase()) {
            throw new Error(
              `messageBus: registered child artifact '${site.contractName}' does not match deployment state layout`,
            );
          }
          if (site.genesisState) {
            try {
              validateChildDeploymentGenesisState(childArtifact.stateLayout, site.genesisState);
            } catch (error) {
              throw new Error(
                `messageBus: invalid constructor genesis for '${site.contractName}': `
                + `${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
          const inputTypes = handler?.inputs.map((input) => input.type) ?? [];
          const solidityAbi = artifactUsesSolidityAbi(participant.artifact);
          const constructorArgs = site.constructorArgs.slice(0, childArtifact.constructorInputs.length).map((source) => {
            if (source.kind === 'expression') {
              throw new Error(`messageBus: child constructor expression at site ${site.siteIndex} is not materializable`);
            }
            return evaluateChildDeploymentRecipe(source, descriptor.args, inputTypes, solidityAbi);
          });
          let salt: Uint8Array | undefined;
          if (site.salt?.kind === 'handlerInput') {
            const value = descriptor.args[site.salt.inputIndex];
            salt = value instanceof Uint8Array ? value
              : typeof value === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(value)
                ? hexToBin(value.replace(/^0x/i, '')) : undefined;
          } else if (site.salt?.kind === 'literal') salt = hexToBin(site.salt.value);
          else if (site.salt?.kind === 'expression') {
            throw new Error(`messageBus: child salt expression at site ${site.siteIndex} is not materializable`);
          } else if (site.salt) {
            const value = evaluateChildDeploymentRecipe(site.salt, descriptor.args, inputTypes, solidityAbi);
            salt = value instanceof Uint8Array ? value
              : typeof value === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(value)
                ? hexToBin(value.replace(/^0x/i, '')) : undefined;
          }
          if (site.salt && !salt) throw new Error(`messageBus: invalid child salt at site ${site.siteIndex}`);
          const effectiveArtifact = {
            ...childArtifact,
            bytecode: scriptToAsm(bytecodeToScript(hexToBin(site.creationBytecode))),
          } as Artifact;
          // Only contract-level parameters are baked into the locking bytecode. Solidity-style constructor
          // parameters are consumed by the authenticated genesis recipe without changing the child's address.
          const child = new Contract(effectiveArtifact, constructorArgs as never[], {
            provider,
            addressType: owner.inner.addressType,
            category: hexToBin(genesis.txid),
            ...(salt && { salt }),
          });
          const genesisState = Object.fromEntries((site.genesisState?.fields ?? []).map((field) => [
            field.name,
            evaluateChildDeploymentRecipe(field.value, descriptor.args, inputTypes, solidityAbi),
          ]));
          const commitments = buildInitialStateCommitments(
            childArtifact.stateLayout, genesisState as never,
            provider.consensusLimits?.maximumNftCommitmentBytes,
          );
          if (commitments.length !== site.dataNftOutputCount) {
            throw new Error(`messageBus: child deployment site ${site.siteIndex} produced incomplete default state`);
          }
          const outputs: Output[] = [{
            to: addressToLockScript(child.address), amount: 1200n,
            token: { category: genesis.txid, amount: 0n, nft: { capability: 'minting', commitment: '' } },
          }];
          const dataAddress = getDataNftAddress(child, genesis.txid);
          for (let nftIndex = 0; nftIndex < site.dataNftOutputCount; nftIndex++) {
            outputs.push({
              to: dataAddress, amount: 1200n,
              token: {
                category: genesis.txid, amount: 0n,
                nft: { capability: 'mutable', commitment: commitments[nftIndex] },
              },
            });
          }
          return {
            participant: participant.participant,
            invocation: invocationIndex,
            siteIndex: site.siteIndex,
            offset,
            slotOffset: offset,
            genesis,
            outputs,
          };
        });
      });
    });
    if (usedDeployments.size !== suppliedDeployments.length) {
      throw new Error('messageBus: child genesis input does not name a selected compiler-published deployment site');
    }
    const genesisOutpoints = new Set(materializedDeployments.map((deployment) =>
      `${deployment.genesis.txid.toLowerCase()}:${deployment.genesis.vout}`));
    if (genesisOutpoints.size !== materializedDeployments.length) {
      throw new Error('messageBus: child deployment genesis outpoints must be unique');
    }
    const deploymentEffects: AtomicDeploymentSlotEffect[] = materializedDeployments.map((deployment) => ({
      participant: deployment.participant,
      invocation: deployment.invocation,
      siteIndex: deployment.siteIndex,
      offset: deployment.offset,
      genesisTransactionHashHex: deployment.genesis.txid,
      genesisOutputIndex: deployment.genesis.vout,
      outputs: deployment.outputs.map((output) => {
        if (!output.token?.nft) throw new Error('messageBus: child deployment output is missing its NFT');
        return {
          lockingBytecodeHex: binToHex(
            typeof output.to === 'string' ? addressToLockScript(output.to) : output.to,
          ),
          tokenCategoryHex: output.token.category,
          capability: output.token.nft.capability as 'minting' | 'mutable',
          commitmentHex: output.token.nft.commitment,
          tokenAmount: output.token.amount,
          value: output.amount,
        };
      }),
    }));
    const provisionalEventEffects: AtomicEventSlotEffect[] = [];
    const provisionalResourceEffects: AtomicResourceSlotEffect[] = [];
    const provisionalValueEffects: AtomicValueSlotEffect[] = [];
    const provisionalTokenEffects: AtomicTokenSlotEffect[] = [];
    const provisionalSidecarEffects: AtomicSidecarSlotEffect[] = [];
    let finalized = finalizeAtomicInvocationGraph(
      plan, categories, provisionalResults, provisionalEventEffects, provisionalResourceEffects,
      provisionalValueEffects,
      provisionalTokenEffects,
      provisionalSidecarEffects,
      undefined,
      deploymentEffects,
    );

    const participantReturnBlob = (
      participant: number, results: Readonly<Record<number, string>>,
    ): Uint8Array | undefined => {
      const vector = plan.participants[participant].invocations
        .filter((invocation) => plan.invocations[invocation].resultTypes.length > 0)
        .map((invocation) => results[invocation] ?? '')
        .join('');
      return vector.length === 0 ? undefined : scriptToBytecode([hexToBin(vector)]);
    };
    const participantReturnCommitment = (blob: Uint8Array | undefined): Uint8Array | undefined =>
      blob === undefined || blob.length <= 128 ? blob : sha256(blob);

    const internalTokenCategory = (token: TokenDetails): string => {
      const category = binToHex(hexToBin(token.category).reverse());
      if (!token.nft) return category;
      const capability = { none: '', mutable: '01', minting: '02' }[token.nft.capability];
      return `${category}${capability}`;
    };

    // Computed side-cars can depend on values which only exist in the complete atomic transaction. Once learned,
    // their fixed participant slots are independent of the graph's semantic claim pass, so retain them rather than
    // re-running the recovery/keccak witness synthesis every time a verifier claim changes.
    const deferredComputeCache = new Map<number, {
      graphKey: string;
      resources: ReadonlyMap<number, { input: UnlockableUtxo; output: Output }>;
    }>();

    const rebalanceFeeTail = (builder: TransactionBuilder, subject: string): void => {
      const tail = builder.outputs.length - 1;
      const totalInput = builder.inputs.reduce((sum, input) => sum + input.satoshis, 0n);
      const fixedOutput = builder.outputs.slice(0, tail).reduce((sum, output) => sum + output.amount, 0n);
      const fee = BigInt(Math.ceil((this.options.feeRate ?? 1) * Number(builder.getTransactionSize())));
      const amount = totalInput - fixedOutput - fee;
      if (amount <= 0n) throw new Error(`messageBus: fee funder cannot cover ${subject}`);
      builder.outputs[tail] = { ...builder.outputs[tail], amount };
    };

    const eventCandidates = (participant: (typeof plan.participants)[number]) => {
      const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
      const category = hexToBin(categories[participant.participant]);
      return participant.invocations.flatMap((invocationIndex) => {
        const invocation = plan.invocations[invocationIndex];
        const handler = participant.artifact.messageBus?.handlers.find((candidate) =>
          candidate.name === invocation.function);
        const signatures = [
          ...(handler?.emits ?? []).map((emitted) => emitted.eventSignature),
          ...(handler?.runtimeLoopEvents ?? []).flatMap((loop) => loop.eventSignatures),
        ];
        return [...new Set(signatures)].flatMap((eventSignature) => {
          const event = participant.artifact.events?.find((candidate) =>
            candidate.signature === eventSignature);
          if (!event) return [];
          const script = event?.anonymous
            ? buildAnonymousEventNftCovenantScript(category)
            : buildEventNftCovenantScript(category, computeEventNameHash(eventSignature));
          return [{ event, lockingBytecode: binToHex(scriptToLockingBytecode(script, contract.inner.addressType)) }];
        });
      });
    };
    const eventLockingBytecodes = (participant: (typeof plan.participants)[number]): string[] =>
      eventCandidates(participant).map((candidate) => candidate.lockingBytecode);
    const eventLockingBytecodeForCommitment = (
      participant: (typeof plan.participants)[number], commitment: string,
    ): string | undefined => {
      const matching = eventCandidates(participant).filter(({ event }) =>
        tryParseEventCommitment(commitment, event, participant.artifact.stateLayout?.structs) !== null);
      const locks = [...new Set(matching.map((candidate) => candidate.lockingBytecode))];
      return locks.length === 1 ? locks[0] : undefined;
    };

    const assemble = async (
      graph: ReturnType<typeof finalizeAtomicInvocationGraph>,
      results: Readonly<Record<number, string>>,
    ): Promise<{
      builder: TransactionBuilder;
      actualSizes: readonly number[];
      incompleteDynamicChunks: readonly {
        participant: number; variable: string; resolved: number; total: number;
      }[];
    }> => {
      // A computed argument may read any authenticated graph value: nested return bytes, an effect output,
      // participant span, or an absolute transaction coordinate. Cache only within the exact finalized graph
      // transcript; participant identity alone would retain witnesses learned from provisional semantic claims.
      const deferredComputeGraphKey = binToHex(sha256(graph.bytes));
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_GRAPH_RESULTS === '1') {
        console.error('atomic-graph-results', graph.callManifest.rows.flatMap((row, index) => row.kind === 0 ? [{
          index,
          function: graph.plan.invocations[index]?.function,
          owner: row.owner,
          consumer: row.consumer,
          resultHex: row.resultHex,
        }] : []));
      }
      // Resource delete rows authorize exact NFT disappearance at participant-owned slots; the generated
      // covenants still reject any unlisted burn through endpoint cardinality and commitment checks.
      const aggregate = new TransactionBuilder({
        provider, allowImplicitNftBurn: true, skipAutomaticCoSpends: true,
      });
      const actualSizes: number[] = [];
      const incompleteDynamicChunks: Array<{
        participant: number; variable: string; resolved: number; total: number;
      }> = [];
      const aggregateOutpoints = new Map<string, { participant: number; localIndex: number }>();
      const deferredBlocks: Array<{
        participant: number;
        inputBase: number;
        executionInput: number;
        local: TransactionBuilder;
        controller: DeferredComputeController;
        offsets: readonly number[];
      }> = [];

      for (const participant of plan.participants) {
        const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
        const descriptor = descriptorByLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
        const blockSize = participant.blockLayout!.blockSize;
        const returnBlob = participantReturnBlob(participant.participant, results);
        const returnCommitment = participantReturnCommitment(returnBlob);
        const localCall = contract._batchRaw(
          participant.batch.blob,
          participant.batch.routeWitnesses as FunctionArgument[],
          graphRouteContext(graph, participant.participant),
          graph.layout.participantInputs[participant.participant],
          returnBlob !== undefined,
          returnCommitment,
          true,
          descriptor.executor ? { artifact: descriptor.artifact, executor: descriptor.executor } : undefined,
          participant.invocations.map((invocationIndex) => {
            const invocation = descriptors[invocationIndex];
            const handler = participant.artifact.abi.find((candidate) =>
              candidate.name === invocation.functionName
              && candidate.selector?.toLowerCase() === plan.invocations[invocationIndex].selectorHex.toLowerCase());
            if (!handler) {
              throw new Error(`messageBus: handler ABI '${invocation.functionName}' is missing`);
            }
            return { args: invocation.args, handler };
          }),
          logicalIdentities.get(participant.participant),
        );
        for (const deployment of materializedDeployments.filter((candidate) =>
          candidate.participant === participant.participant)) {
          localCall._withChildDeployment(
            deployment.slotOffset, deployment.genesis, deployment.outputs,
          );
        }
        // A participant probe is built in isolation while its covenant addresses outputs in the final graph's
        // absolute coordinate space. Forward/literal BCH transfers are already compiler-authenticated in the
        // invocation manifest, so materialize them directly instead of asking the isolated probe to discover an
        // output at a shifted absolute index. The final covenant still verifies recipient and amount in-place.
        for (const invocationIndex of participant.invocations) {
          const invocation = plan.invocations[invocationIndex];
          const handler = participant.artifact.messageBus?.handlers.find(
            (candidate) => candidate.selector === invocation.selectorHex,
          );
          const supplied = descriptors[invocationIndex];
          for (const transfer of handler?.transfers ?? []) {
            const recipient = transfer.recipient.kind === 'forward'
              && transfer.recipient.paramIndex !== undefined
              ? supplied.args[transfer.recipient.paramIndex] : undefined;
            const amountValue = transfer.amount.kind === 'forward' && transfer.amount.paramIndex !== undefined
              ? supplied.args[transfer.amount.paramIndex]
              : transfer.amount.kind === 'literal' && transfer.amount.value !== undefined
                ? BigInt(transfer.amount.value) : undefined;
            if (!(recipient instanceof Uint8Array) || typeof amountValue !== 'bigint') {
              throw new Error(
                `messageBus: BCH transfer in '${invocation.function}' is not a forwarded/literal canonical effect`,
              );
            }
            localCall.transfer(recipient, amountValue);
          }
        }
        let local: TransactionBuilder;
        try {
          local = await localCall.build();
        } catch (error) {
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_ATOMIC_PROMOTION === '1') {
            console.error('atomic-participant-build-error', error);
          }
          throw new Error(
            `messageBus: participant ${participant.participant} '${participant.artifact.contractName}' `
            + `failed to build its balanced block: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
        const authenticatedOutputLockingBytecode = participant.outputLockingBytecode?.toLowerCase();
        if (authenticatedOutputLockingBytecode !== undefined) {
          const masterInput = local.inputs[0];
          const masterOutput = local.outputs[0];
          if (!masterInput || !masterOutput || !masterInput.token || !masterOutput.token
            || masterInput.token.category !== masterOutput.token.category
            || masterInput.token.amount !== masterOutput.token.amount
            || masterInput.token.nft?.capability !== masterOutput.token.nft?.capability
            || masterInput.token.nft?.commitment !== masterOutput.token.nft?.commitment
            || masterInput.satoshis !== masterOutput.amount) {
            throw new Error(
              `messageBus: participant ${participant.participant} master geometry is not preserved across upgrade`,
            );
          }
          local.outputs[0] = { ...masterOutput, to: hexToBin(authenticatedOutputLockingBytecode) };
        }
        // Runtime event occurrences occupy compiler-owned trailing slots, so they cannot appear as fixed
        // `blockLayout.kind === event` coordinates. Preserve the exact row, schema, and physical offset published
        // by the participant builder; later graph passes turn only these observed occurrences into kind-2 rows.
        // This is resource geometry, independent of contract/function/event names.
        const runtimeEvents = (local as TransactionBuilder & {
          __messageBusRuntimeLoopEvents?: readonly {
            eventSignature: string; rowIndex: number; offset: number;
          }[];
        }).__messageBusRuntimeLoopEvents ?? [];
        runtimeEventSlots.set(participant.participant,
          runtimeEvents.map((event) => ({
            participant: participant.participant,
            offset: event.offset,
            runtimeRow: event.rowIndex,
            eventSignature: event.eventSignature,
          })));
        // Event effects are fixed-point claims just like return values and mutable resources. Once a prior pass
        // has authenticated an event commitment, feed it back into the exact compiler-published participant slot;
        // otherwise every assembly pass recreates the empty probe placeholder and convergence can never advance
        // past the handler's OUTPUTTOKENCOMMITMENT equality.
        const fixedEventOffsets = participant.blockLayout!.slots
          .filter((slot) => slot.kind === 'event').map((slot) => slot.offset);
        const eventClaims = graph.callManifest.rows.filter((row) =>
          row.kind === 2 && row.owner === participant.participant && row.mode === 1
          && fixedEventOffsets.includes(row.targetOffset));
        if (eventClaims.length > 0) {
          const eventOffsets = participant.blockLayout!.slots
            .filter((slot) => slot.kind === 'event').map((slot) => slot.offset);
          const eventLocks = eventLockingBytecodes(participant);
          const eventLockSet = new Set(eventLocks);
          const templateOffsets = local.outputs.flatMap((output, offset) => {
            const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            return output.token?.nft?.capability === 'none'
              && eventLockSet.has(binToHex(lockingBytecode))
              ? [offset] : [];
          });
          const inactive = eventOffsets.map((offset) => local.outputs[offset]).find((output) => !output?.token);
          if (eventLocks.length < eventClaims.length || !inactive) {
            throw new Error(
              `messageBus: participant ${participant.participant} cannot materialize its authenticated event frame`,
            );
          }
          for (const offset of new Set([...eventOffsets, ...templateOffsets])) local.outputs[offset] = { ...inactive };
          eventClaims.forEach((row) => {
            local.outputs[row.targetOffset] = {
              to: hexToBin(row.subjectHex),
              amount: inactive.amount,
              token: {
                category: categories[participant.participant], amount: 0n,
                nft: { capability: 'none', commitment: row.effectHex },
              },
            };
          });
        }
        const publishedComputeOffsets = participant.blockLayout!.slots
          .filter((slot) => slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar')
          .map((slot) => slot.offset);
        // A route publishes the union of every eligible handler's compute coordinates. Only slots carrying a
        // mutable sidecar in this selected batch participate in deferred resolution; inactive union slots are
        // balanced funders and intentionally have no kind-6 manifest row.
        const computeOffsets = publishedComputeOffsets.filter((offset) =>
          local.inputs[offset]?.token?.nft?.capability === 'mutable');
        const cachedCompute = deferredComputeCache.get(participant.participant);
        if (cachedCompute?.graphKey === deferredComputeGraphKey) {
          for (const [offset, resource] of cachedCompute.resources) {
            local.inputs[offset] = resource.input;
            local.outputs[offset] = resource.output;
          }
        } else {
          const controller = (local as DeferredComputeBuilder).__messageBusDeferredCompute;
          if (controller?.hasUnresolved()) {
            const inputBase = graph.layout.participantInputs[participant.participant];
            const executionInput = participant.executionKind === 1 && participant.executorOffset !== null
              ? inputBase + participant.executorOffset : inputBase;
            deferredBlocks.push({
              participant: participant.participant,
              inputBase,
              executionInput,
              local,
              controller,
              offsets: computeOffsets,
            });
          }
        }
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN_LAYOUT === '1') {
          const returnSlot = participant.blockLayout!.slots.find((slot) => slot.kind === 'returnEvent');
          const returnOutput = returnSlot ? local.outputs[returnSlot.offset] : undefined;
          const returnLock = returnOutput?.to;
          console.error('atomic-local-return-layout', JSON.stringify({
            participant: participant.participant,
            contract: participant.artifact.contractName,
            returnSlot,
            suppliedBlob: returnBlob && binToHex(returnBlob),
            suppliedCommitment: returnCommitment && binToHex(returnCommitment),
            atSlot: returnOutput && {
              lockingBytecode: binToHex(typeof returnLock === 'string'
                ? addressToLockScript(returnLock) : returnLock!),
              category: returnOutput.token?.category,
              capability: returnOutput.token?.nft?.capability,
              commitment: returnOutput.token?.nft?.commitment,
            },
            immutableCandidates: local.outputs.flatMap((output, index) =>
              output.token?.nft?.capability === 'none' ? [{
                index,
                lockingBytecode: binToHex(typeof output.to === 'string'
                  ? addressToLockScript(output.to) : output.to),
                category: output.token.category,
                commitment: output.token.nft.commitment,
              }] : []),
          }));
        }
        const localIncomplete = (local as TransactionBuilder & {
          __messageBusIncompleteDynamicChunks?: readonly {
            variable: string; resolved: number; total: number;
          }[];
        }).__messageBusIncompleteDynamicChunks ?? [];
        for (const variable of localIncomplete) {
          incompleteDynamicChunks.push({
            participant: participant.participant,
            ...variable,
          });
        }
        if (participant.executionKind === 1 && participant.executorOffset !== null) {
          const executorInput = local.inputs[participant.executorOffset];
          if (!executorInput) throw new Error('messageBus: delegate executor input is absent from its published slot');
          local.outputs[participant.executorOffset] = {
            to: executorInput.unlocker.generateLockingBytecode(),
            amount: executorInput.satoshis,
            ...(executorInput.token && { token: executorInput.token }),
          };
        }
        // Stateful builders normally stamp the provider's current Unix time, but a selected blockhash row can
        // require height-mode CLTV (< 500M). Taking a numeric maximum silently changes the height requirement
        // into timestamp mode and makes the otherwise valid oracle spend fail by type. Preserve a concrete
        // height-mode requirement over ambient timestamp defaults. If another participant genuinely requires a
        // timestamp lock as well, final VM preflight still rejects the inherently incompatible composition.
        const aggregateIsHeight = aggregate.locktime > 0 && aggregate.locktime < 500_000_000;
        const localIsHeight = local.locktime > 0 && local.locktime < 500_000_000;
        if (local.locktime > 0) {
          if (localIsHeight && !aggregateIsHeight) aggregate.locktime = local.locktime;
          else if (localIsHeight === aggregateIsHeight) {
            aggregate.locktime = Math.max(aggregate.locktime, local.locktime);
          }
        }
        while (local.outputs.length < blockSize && local.outputs.length < local.inputs.length) {
          const input = local.inputs[local.outputs.length];
          local.addOutput({
            to: Uint8Array.of(0x51),
            amount: input.satoshis,
          });
        }
        if (local.inputs.length !== blockSize || local.outputs.length !== blockSize) {
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
            const describeInput = (input: typeof local.inputs[number], index: number) => ({
              index,
              lockingBytecode: binToHex(input.unlocker.generateLockingBytecode()),
              category: input.token?.category,
              commitment: input.token?.nft?.commitment,
            });
            const describeOutput = (output: typeof local.outputs[number], index: number) => ({
              index,
              lockingBytecode: binToHex(typeof output.to === 'string'
                ? addressToLockScript(output.to) : output.to),
              category: output.token?.category,
              commitment: output.token?.nft?.commitment,
            });
            console.error('atomic-local-block-suffix', {
              inputTail: local.inputs.slice(Math.max(0, blockSize - 8)).map((input, index) =>
                describeInput(input, Math.max(0, blockSize - 8) + index)),
              outputTail: local.outputs.slice(Math.max(0, blockSize - 8), blockSize + 8)
                .map((output, index) => describeOutput(output, Math.max(0, blockSize - 8) + index)),
              overflowOutputs: local.outputs.slice(blockSize).map((output, index) =>
                describeOutput(output, blockSize + index)),
            });
            console.error('atomic-local-block-mismatch', {
              participant: participant.participant,
              executionKind: participant.executionKind,
              expected: blockSize,
              layout: participant.blockLayout,
              inputs: local.inputs.map((input, index) => ({
                index, lockingBytecode: binToHex(input.unlocker.generateLockingBytecode()),
                category: input.token?.category, commitment: input.token?.nft?.commitment,
              })),
              outputs: local.outputs.map((output, index) => ({
                index, lockingBytecode: binToHex(typeof output.to === 'string'
                  ? addressToLockScript(output.to) : output.to),
                category: output.token?.category, commitment: output.token?.nft?.commitment,
              })),
            });
          }
          throw new Error(
            `messageBus: participant ${participant.participant} built ${local.inputs.length}/${local.outputs.length} `
            + `slots, expected balanced block size ${blockSize}`,
          );
        }
        const fixedSize = participant.blockLayout!.fixedSuffix
          ? blockSize : participant.blockLayout!.trailingBase ?? blockSize;
        let actualSize = blockSize;
        while (actualSize > fixedSize) {
          const input = local.inputs[actualSize - 1];
          const output = local.outputs[actualSize - 1];
          const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          if (input.token !== undefined || output.token !== undefined
            || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
            || binToHex(outputLockingBytecode) !== '51') break;
          actualSize -= 1;
        }
        if (actualSize < blockSize) {
          local.inputs.splice(actualSize, blockSize - actualSize);
          local.outputs.splice(actualSize, blockSize - actualSize);
        }
        const stateInputUnlocker = local.inputs[0].unlocker as Unlocker & {
          abiFunction?: { blockLayout?: NonNullable<typeof participant.blockLayout> };
        };
        if (stateInputUnlocker.abiFunction?.blockLayout !== undefined) {
          const effectiveLayout = participant.blockLayout!;
          const effectiveSlots = effectiveLayout.slots
            .filter((slot) => slot.offset < actualSize)
            .map((slot) => slot.kind === 'returnEvent' && returnBlob === undefined
              ? { ...slot, conditional: true }
              : slot);
          stateInputUnlocker.abiFunction = {
            ...stateInputUnlocker.abiFunction,
            blockLayout: {
              ...effectiveLayout,
              blockSize: actualSize,
              slots: effectiveSlots,
              trailingCapacity: actualSize - fixedSize,
            },
          };
        }
        actualSizes.push(actualSize);
        for (let localIndex = 0; localIndex < local.inputs.length; localIndex++) {
          const input = local.inputs[localIndex];
          const outpoint = `${input.txid.toLowerCase()}:${input.vout}`;
          const prior = aggregateOutpoints.get(outpoint);
          if (prior && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
            console.error('atomic-participant-input-collision', {
              outpoint, participant: participant.participant, localIndex, prior,
              blockBase: graph.layout.participantInputs[participant.participant],
              lockingBytecode: binToHex(input.unlocker.generateLockingBytecode()),
            });
          }
          aggregateOutpoints.set(outpoint, { participant: participant.participant, localIndex });
        }
        aggregate.addInputs(local.inputs);
        aggregate.addOutputs(local.outputs as Output[]);
      }

      const spansMatch = actualSizes.every(
        (size, participant) => size === graph.callManifest.participants[participant].actualSize,
      );
      if (!spansMatch) return { builder: aggregate, actualSizes, incompleteDynamicChunks };

      const verifierDomain = binToHex(MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN);
      const messageEnvelope = encodeAtomicMessageEnvelope(graph.callManifest);
      const callManifest = encodeAtomicMessageBusCallManifest(graph.callManifest);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
        console.error('atomic-graph-summary', JSON.stringify({
          participants: graph.callManifest.participants.map((entry, participant) => ({
            participant,
            base: graph.layout.participantInputs[participant],
            lockingBytecode: entry.lockingBytecode,
            outputLockingBytecode: entry.outputLockingBytecode,
            fixedSize: entry.fixedSize,
            actualSize: entry.actualSize,
            maximumSize: entry.maximumSize,
          })),
          rows: graph.callManifest.rows.map((row, index) => ({
            index,
            kind: row.kind,
            mode: row.mode,
            owner: row.owner,
            consumer: row.consumer,
            sourceOffset: row.sourceOffset,
            targetOffset: row.targetOffset,
            subjectHex: row.subjectHex,
            selectorHex: row.selectorHex,
            parent: row.parent,
            depth: row.depth,
            subtreeEnd: row.subtreeEnd,
          })),
        }));
      }
      for (const participant of plan.participants) {
        const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
        const verifierLock = getMessageBusVerifierLockingBytecodeForArtifact(
          participant.artifact, provider.consensusLimits?.maximumInputBytes ?? 10_000,
        );
        const verifier = (await provider.getUtxosForLockingBytecode(verifierLock)).find((utxo) =>
          utxo.token?.category.toLowerCase() === categories[participant.participant].toLowerCase()
          && utxo.token.nft?.capability === 'mutable'
          && utxo.token.nft.commitment.toLowerCase().startsWith(verifierDomain));
        if (!verifier) {
          throw new Error(
            `messageBus: participant ${participant.participant} has no deployed verifier covenant; `
            + 'deploy with messageBusVerificationInputCount >= 1',
          );
        }
        const verifierProgram = participant.artifact.messageBus!.verifierProgram!;
        // A direct route carries the blob in master param 0, but a proxy master carries only the forwarded
        // selector while its implementation unlocker owns the route arguments. The compiler-planned participant
        // batch is the common canonical source used to build either shape and is what the verifier must bind.
        const batchBlob = participant.batch.blob;
        const routeContext = graphRouteContext(graph, participant.participant);
        const verifierGraphArgumentNames = [
          '__internal__graphFixedSize', '__internal__graphBlockSize', '__internal__graphEmissions',
          '__internal__graphCallers', '__internal__graphSettlementBoundary',
          '__internal__graphCompletionPositions', '__internal__graphSettlementTable',
        ] as const;
        const graphInputNames = new Map<string, typeof verifierGraphArgumentNames[number]>([
          ['suppliedFixedSize', '__internal__graphFixedSize'],
          ['suppliedBlockSize', '__internal__graphBlockSize'],
          ['suppliedEmissions', '__internal__graphEmissions'],
          ['suppliedCallers', '__internal__graphCallers'],
          ['suppliedSettlementBoundary', '__internal__graphSettlementBoundary'],
          ['suppliedCompletionPositions', '__internal__graphCompletionPositions'],
          ['suppliedSettlementTable', '__internal__graphSettlementTable'],
        ]);
        const fixedVerifierArguments: Readonly<Record<string, FunctionArgument>> = {
          activeInputIndex: BigInt(graph.layout.participantInputs[participant.participant]),
          expectedLocalRows: BigInt(batchBlob[6]),
          localBatch: batchBlob,
        };
        const verifierArgs = verifierProgram.inputs.map((input): FunctionArgument => {
          const graphName = graphInputNames.get(input.name);
          const argument = graphName === undefined
            ? fixedVerifierArguments[input.name] ?? routeContext[input.name]
            : routeContext[graphName];
          if (argument === undefined) {
            throw new Error(`messageBus: verifier argument '${input.name}' has no compiler-authored value`);
          }
          return argument;
        });
        // The compiler's binding digest has one stable graph-field order. Lifecycle targets are independently
        // bound by the V2 participant output identity and therefore intentionally do not enter this digest.
        const graphArguments = verifierProgram.inputs.flatMap((input, index) =>
          graphInputNames.has(input.name) ? [verifierArgs[index]] : []);
        const bindingDigestParts = [
          sha256(callManifest),
          uint16(graph.layout.participantInputs[participant.participant]),
          uint16(batchBlob[6]),
          sha256(batchBlob),
        ];
        for (const argument of graphArguments) {
          bindingDigestParts.push(typeof argument === 'bigint'
            ? uint16(Number(argument))
            : sha256(argument as Uint8Array));
        }
        const bindingDigest = sha256(concat(...bindingDigestParts));
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
          console.error('atomic-binding-digest', JSON.stringify({
            participant: participant.participant,
            callManifest: { length: callManifest.length, hash: binToHex(sha256(callManifest)) },
            activeInputIndex: graph.layout.participantInputs[participant.participant],
            localRows: batchBlob[6],
            localBatch: { length: batchBlob.length, hash: binToHex(sha256(batchBlob)) },
            graphArguments: graphArguments.map((argument) => typeof argument === 'bigint'
              ? argument.toString()
              : argument instanceof Uint8Array
                ? { length: argument.length, hash: binToHex(sha256(argument)) }
                : String(argument)),
            digest: binToHex(bindingDigest),
          }));
        }
        const verifierUnlocker = createMessageBusVerifierUnlocker(
          contract.inner, categories[participant.participant], messageEnvelope, verifierArgs, participant.artifact,
        );
        aggregate.addInput(verifier, verifierUnlocker);
        aggregate.addOutput({
          to: verifierLock,
          amount: verifier.satoshis,
          token: {
            category: verifier.token!.category,
            amount: verifier.token!.amount ?? 0n,
            nft: {
              ...verifier.token!.nft!,
              commitment: `${verifier.token!.nft!.commitment.slice(0, 12)}${binToHex(bindingDigest)}`,
            },
          },
        });
      }
      aggregate.addInputs([feeFunder]);
      aggregate.addBchChangeOutputIfNeeded({
        to: this.options.changeAddress,
        feeRate: this.options.feeRate ?? 1,
      });
      if (aggregate.inputs.length !== graph.layout.totalSlots
        || aggregate.outputs.length !== graph.layout.totalSlots) {
        throw new Error(
          'messageBus: composed transaction is not balanced at the fee tail '
          + `(${aggregate.inputs.length} inputs, ${aggregate.outputs.length} outputs)`,
        );
      }

      // The first semantic pass intentionally carries placeholder sidecars so their exact endpoints can be
      // admitted as kind-6 rows. Before those rows exist, the route verifier stops before the compute call and
      // no complete-graph argument can be observed. Resolve only blocks whose sidecar slots are already present
      // in the authenticated manifest; the ordinary effect pass below will add them and rebuild this assembly.
      const resolvableDeferredBlocks = deferredBlocks.filter((block) => block.offsets.every((offset) =>
        graph.callManifest.rows.some((row) => row.kind === 6
          && row.owner === block.participant && row.sourceOffset === offset)));
      if (deferredBlocks.length > 0
        && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_ECRECOVER_READINESS === '1') {
        console.error('atomic-deferred-compute-readiness', {
          deferred: deferredBlocks.map((block) => ({
            participant: block.participant,
            offsets: block.offsets,
            executionInput: block.executionInput,
            inputBase: block.inputBase,
            computeRouteArguments: (() => {
              const relativeExecution = block.executionInput - block.inputBase;
              const unlocker = block.local.inputs[relativeExecution]?.unlocker as {
                abiFunction?: { inputs?: readonly { name: string }[] };
                params?: readonly FunctionArgument[];
              } | undefined;
              return unlocker?.abiFunction?.inputs?.flatMap((input, index) => (
                /(?:ecrecover|keccak|InputIndex)/i.test(input.name)
                  ? [{ name: input.name, value: String(unlocker.params?.[index]) }] : []
              ));
            })(),
            routedUnlockers: block.local.inputs.flatMap((input, localIndex) => {
              const unlocker = input.unlocker as {
                abiFunction?: { name?: string; inputs?: readonly { name: string }[] };
                params?: readonly FunctionArgument[];
              };
              if (!unlocker.abiFunction) return [];
              return [{
                localIndex,
                function: unlocker.abiFunction.name,
                arguments: unlocker.abiFunction.inputs?.flatMap((argument, index) =>
                  /(?:ecrecover|keccak|InputIndex)/i.test(argument.name)
                    ? [{ name: argument.name, value: String(unlocker.params?.[index]) }] : []),
              }];
            }),
            mutableInputs: block.local.inputs.flatMap((input, index) =>
              input.token?.nft?.capability === 'mutable' ? [index] : []),
          })),
          rows: graph.callManifest.rows.filter((row) => row.kind === 6).map((row) => ({
            participant: row.owner,
            offset: row.sourceOffset,
            mode: row.mode,
          })),
          invocations: graph.callManifest.rows.filter((row) => row.kind === 0).map((row) => ({
            owner: row.owner,
            consumer: row.consumer,
            mode: row.mode,
            selector: row.selectorHex,
            sourceOffset: row.sourceOffset,
            targetOffset: row.targetOffset,
            subject: row.subjectHex,
            args: row.argsHex,
            result: row.resultHex,
          })),
          userKeyWitnesses: plan.participants.flatMap((participant) => participant.routeInputs
            .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'))
            .map((input, index) => ({ input, value: participant.batch.routeWitnesses[index] }))
            .filter(({ input }) => input.name.includes('__message_bus_key_users_'))
            .map(({ input, value }) => ({
              participant: participant.participant,
              name: input.name,
              value: value instanceof Uint8Array ? binToHex(value)
                : typeof value === 'bigint' ? value.toString() : value,
            }))),
          participantOneEntries: plan.participants[1]?.blockLayout?.slots
            .filter((slot) => slot.kind === 'entry')
            .map((slot) => {
              const absolute = graph.layout.participantInputs[1] + slot.offset;
              return {
                offset: slot.offset,
                slotIndex: slot.slotIndex,
                commitment: aggregate.inputs[absolute]?.token?.nft?.commitment?.slice(0, 160),
              };
            }),
          participant0Effects: graph.callManifest.rows.filter((row) => row.kind !== 0 && row.owner === 0)
            .map((row) => ({
              kind: row.kind,
              mode: row.mode,
              sourceOffset: row.sourceOffset,
              targetOffset: row.targetOffset,
              subject: row.subjectHex.slice(0, 80),
            })),
          probe54: aggregate.inputs[54] && aggregate.outputs[54] ? {
            slot: plan.participants[0]?.blockLayout?.slots.find((slot) => slot.offset === 54),
            inputLock: binToHex(aggregate.inputs[54].unlocker.generateLockingBytecode()),
            outputLock: binToHex(typeof aggregate.outputs[54].to === 'string'
              ? addressToLockScript(aggregate.outputs[54].to as string) : aggregate.outputs[54].to),
            inputCategory: aggregate.inputs[54].token?.category,
            outputCategory: aggregate.outputs[54].token?.category,
          } : undefined,
          resolvable: resolvableDeferredBlocks.map((block) => block.participant),
        });
      }
      if (resolvableDeferredBlocks.length > 0) {
        const maximumRounds = resolvableDeferredBlocks.reduce((sum, block) => sum + block.offsets.length, 0) + 1;
        for (let round = 0; round < maximumRounds; round += 1) {
          const unresolved = resolvableDeferredBlocks.filter((block) => block.controller.hasUnresolved());
          if (unresolved.length === 0) break;
          const program = aggregate.buildLibauthProgram();
          let progressed = false;
          for (const block of unresolved) {
            if (!block.controller.resolve(program, block.executionInput, block.inputBase)) continue;
            progressed = true;
            const refreshed = block.controller.refresh();
            for (const offset of block.offsets) {
              const input = refreshed.inputs[offset];
              const output = refreshed.outputs[offset];
              if (!input || !output) {
                throw new Error(
                  `messageBus: participant ${block.participant} lost compute resource slot ${offset} while resolving`,
                );
              }
              block.local.inputs[offset] = input;
              block.local.outputs[offset] = output;
              aggregate.inputs[block.inputBase + offset] = input;
              aggregate.outputs[block.inputBase + offset] = output;
            }
            if (!block.controller.hasUnresolved()) {
              deferredComputeCache.set(block.participant, {
                graphKey: deferredComputeGraphKey,
                resources: new Map(block.offsets.map((offset) => [offset, {
                  input: refreshed.inputs[offset], output: refreshed.outputs[offset],
                }])),
              });
            }
          }
          if (!progressed) {
            throw new Error(
              'messageBus: complete graph did not expose arguments for all deferred compute resources',
            );
          }
          rebalanceFeeTail(aggregate, 'resolved compute-sidecar witnesses');
        }
        const unresolved = resolvableDeferredBlocks.filter((block) => block.controller.hasUnresolved());
        if (unresolved.length > 0) {
          throw new Error(
            `messageBus: deferred compute resources did not converge for participant(s) `
            + unresolved.map((block) => block.participant).join(', '),
          );
        }
      }
      return { builder: aggregate, actualSizes, incompleteDynamicChunks };
    };
    const admit = (builder: TransactionBuilder): TransactionBuilder => {
      const convergence = convergeMessageBusComputedResourceOutputs(builder);
      const valueChunkConvergence = convergeMessageBusComputedValueChunkOutputs(builder);
      if (convergence.repairs > 0 || valueChunkConvergence.repairs > 0) {
        throw new Error(
          'messageBus: mutable resources changed after semantic-manifest convergence; refusing a stale manifest',
        );
      }
      preflightMessageBusTransaction(builder, finalizedByteGateOptionsForProvider(builder.provider));
      return builder;
    };
    const actualSpansMatch = (
      graph: ReturnType<typeof finalizeAtomicInvocationGraph>, sizes: readonly number[],
    ): boolean => {
      for (let participant = 0; participant < sizes.length; participant += 1) {
        if (sizes[participant] !== graph.callManifest.participants[participant].actualSize) return false;
      }
      return true;
    };
    const deriveReturnResults = (
      graph: ReturnType<typeof finalizeAtomicInvocationGraph>, provisional: TransactionBuilder,
      priorResults: Readonly<Record<number, string>>, missingParticipants: Set<number>,
    ): Record<number, string> => {
      const derivedResults: Record<number, string> = { ...priorResults };
      // Every participant probe observes the same immutable provisional transaction. Materialize its unlocking
      // bytecode and source-output vector once per derivation pass; rebuilding both for each participant is
      // quadratic in large atomic graphs and cannot change the observed program.
      const probeProgram = provisional.buildLibauthProgram();
      for (const participant of plan.participants) {
        const owned = participant.invocations.filter(
          (invocation) => plan.invocations[invocation].resultTypes.length > 0,
        );
        if (owned.length === 0) continue;
        const returnSlot = participant.blockLayout!.slots.find((slot) => slot.kind === 'returnEvent');
        if (!returnSlot) throw new Error(`messageBus: returning participant ${participant.participant} has no return slot`);
        const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
        const participantBase = graph.layout.participantInputs[participant.participant];
        // A proxy master only pins and invokes its co-spent implementation. The implementation input executes
        // the message-bus route and publishes the return commitment, so probe that input for delegate owners.
        const executionInput = participant.executionKind === 1 && participant.executorOffset !== null
          ? participantBase + participant.executorOffset
          : participantBase;
        const blob = contract._messageBusReturnBlobFromTransaction(
          provisional, participantBase + returnSlot.offset, executionInput, probeProgram,
          {
            resultTypes: owned.flatMap((invocation) => plan.invocations[invocation].resultTypes),
            resultTypeGroups: owned.map((invocation) => plan.invocations[invocation].resultTypes),
            solidityAbi: artifactUsesSolidityAbi(participant.artifact),
          },
        );
        if (!blob) {
          // Progressive probes can stop at an earlier resource/layout claim before the producer reaches its
          // return-output comparison. Keep the exact schema-shaped vector already assembled from this pass's
          // prior claims as a convergence seed. It is not trusted: `admit` executes every ordinary covenant, so
          // a wrong seed either exposes a different return on a later pass or fails final BCH VM preflight.
          const priorBlob = participantReturnBlob(participant.participant, priorResults);
          const materialized = provisional.outputs[participantBase + returnSlot.offset]
            ?.token?.nft?.commitment?.toLowerCase();
          const priorCommitment = participantReturnCommitment(priorBlob);
          if (!priorCommitment || materialized !== binToHex(priorCommitment)) {
            missingParticipants.add(participant.participant);
          }
          continue;
        }
        if (blob.length === 0
          && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
          const output = provisional.outputs[participantBase + returnSlot.offset];
          console.error('atomic-empty-return-blob', JSON.stringify({
            participant: participant.participant,
            contract: participant.artifact.contractName,
            executionInput,
            returnOutput: participantBase + returnSlot.offset,
            outputCommitment: output?.token?.nft?.commitment,
            claimedResults: owned.map((invocation) => [invocation, priorResults[invocation]]),
          }));
        }
        const outer = decodePushdataValue(blob, 0, 'bytes');
        if (!(outer.value instanceof Uint8Array) || outer.bytesConsumed !== blob.length) {
          throw new Error(`messageBus: participant ${participant.participant} exposed a non-canonical return vector`);
        }
        if (outer.value.length === 0
          && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
          const output = provisional.outputs[participantBase + returnSlot.offset];
          console.error('atomic-empty-return-vector', JSON.stringify({
            participant: participant.participant,
            contract: participant.artifact.contractName,
            blob: binToHex(blob),
            outputCommitment: output?.token?.nft?.commitment,
            owned: owned.map((invocation) => ({
              invocation,
              resultTypes: plan.invocations[invocation].resultTypes,
              claimed: priorResults[invocation],
            })),
          }));
        }
        let cursor = 0;
        for (const invocationIndex of owned) {
          const invocation = plan.invocations[invocationIndex];
          const start = cursor;
          if (artifactUsesSolidityAbi(participant.artifact)) {
            cursor += evmInvocationResultLength(
              outer.value, cursor, invocation.resultTypes, participant.artifact,
            );
          } else {
            for (const type of invocation.resultTypes) {
              cursor += decodePushdataValue(outer.value, cursor, type, participant.artifact.structs).bytesConsumed;
            }
          }
          derivedResults[invocationIndex] = binToHex(outer.value.slice(start, cursor));
        }
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
          console.error('atomic-return-vector', JSON.stringify({
            participant: participant.participant,
            contract: participant.artifact.contractName,
            blob: binToHex(blob),
            vector: binToHex(outer.value),
            results: owned.map((invocation) => ({
              invocation,
              types: plan.invocations[invocation].resultTypes,
              value: derivedResults[invocation],
            })),
          }));
        }
        if (cursor !== outer.value.length) {
          throw new Error(`messageBus: participant ${participant.participant} return vector has an unchecked suffix`);
        }
      }
      return derivedResults;
    };

    if (returning.length > 0 || fixedEventSlots.length > 0 || hasRuntimeLoopEvents
      || resourceSlots.length > 0 || hasComputedValueChunks
      || valueSlots.length > 0 || tokenSlots.length > 0 || sidecarSlots.length > 0) {
      let claimedResults: Readonly<Record<number, string>> = provisionalResults;
      let claimedEventEffects: readonly AtomicEventSlotEffect[] = provisionalEventEffects;
      let claimedResourceEffects: readonly AtomicResourceSlotEffect[] = provisionalResourceEffects;
      let claimedValueEffects: readonly AtomicValueSlotEffect[] = provisionalValueEffects;
      let claimedTokenEffects: readonly AtomicTokenSlotEffect[] = provisionalTokenEffects;
      let claimedSidecarEffects: readonly AtomicSidecarSlotEffect[] = provisionalSidecarEffects;
      let claimedComputedValueChunks: readonly ComputedValueChunkClaim[] = [];
      // Every value below is a claim which can feed a later assembly pass. The old
      // `invocations + 5` heuristic counted effect *classes*, so a resource-heavy graph could exhaust the
      // allowance even though another pass reached a valid fixed point. Allow one discovery pass per mutable
      // claim, one pass per returning invocation (results can propagate along the call graph), and one final
      // confirmation pass. Repeated complete states are rejected immediately as cycles.
      const mutableClaimCount = returning.length + fixedEventSlots.length + resourceSlots.length
        + (hasRuntimeLoopEvents ? 1 : 0)
        + valueSlots.length + tokenSlots.length + sidecarSlots.length + (hasComputedValueChunks ? 1 : 0);
      const maximumPasses = mutableClaimCount + 2;
      const seenClaimStates = new Set<string>();
      for (let pass = 0; pass < maximumPasses; pass += 1) {
        const claimState = semanticJson({
          results: claimedResults,
          events: claimedEventEffects,
          resources: claimedResourceEffects,
          values: claimedValueEffects,
          tokens: claimedTokenEffects,
          sidecars: claimedSidecarEffects,
          computedValueChunks: claimedComputedValueChunks,
        });
        if (seenClaimStates.has(claimState)) {
          throw new Error('messageBus: semantic derivation entered a repeated non-final claim state');
        }
        seenClaimStates.add(claimState);
        finalized = finalizeAtomicInvocationGraph(
          plan, categories, claimedResults, claimedEventEffects, claimedResourceEffects, claimedValueEffects,
          claimedTokenEffects,
          claimedSidecarEffects,
          undefined,
          deploymentEffects,
        );
        let assembled = await assemble(finalized, claimedResults);
        if (!actualSpansMatch(finalized, assembled.actualSizes)) {
          finalized = finalizeAtomicInvocationGraph(
            plan, categories, claimedResults, claimedEventEffects, claimedResourceEffects, claimedValueEffects,
            claimedTokenEffects, claimedSidecarEffects, assembled.actualSizes,
            deploymentEffects,
          );
          assembled = await assemble(finalized, claimedResults);
          if (!actualSpansMatch(finalized, assembled.actualSizes)) {
            throw new Error('messageBus: participant spans did not converge after compact assembly');
          }
        }
        const provisional = assembled.builder;
        // Return values are upstream of state/resource derivation. If a pass discovers a new return vector,
        // rebuild immediately before validating outputs which may still contain unresolved chunk placeholders.
        const incompleteParticipants = new Set(
          assembled.incompleteDynamicChunks.map((item) => item.participant),
        );
        const missingReturnParticipants = new Set<number>();
        const derivedResults = deriveReturnResults(
          finalized, provisional, claimedResults, missingReturnParticipants,
        );
        if (returning.some((invocation) =>
          derivedResults[invocation.index] !== claimedResults[invocation.index])) {
          // Some compiler-authored arguments contain an earlier invocation's result inside a larger expression
          // (for example a struct field or abi.encodePacked). Once the VM exposes an updated authenticated result,
          // rebuild those complete expressions and restart planning: argsHex, route-key witnesses, participant
          // batches, and the call manifest all depend on the argument bytes and must change atomically.
          const propagation = propagateResultDependentArguments(derivedResults);
          if (propagation.propagated) {
            if (this.resultPropagationDepth >= descriptors.length) {
              throw new Error('messageBus: authenticated result arguments did not converge');
            }
            return new AtomicMessageBusComposition(
              { ...this.options, preparedCalls: propagation.calls },
              this.resultPropagationDepth + 1,
            )._build();
          }
          claimedResults = derivedResults;
          continue;
        }
        // A resource claim learned on the prior pass must seed the new local probe. Otherwise the verifier sees
        // the old local commitment, rejects it against the new manifest before the implementation executes, and
        // the covenant cannot reach the pin which originally authenticated the claim. Restrict seeding to exact
        // mutable data-NFT lineage and compiler-declared entry coordinates; every other resource class keeps its
        // ordinary derivation path.
        let seededComputedResource = false;
        for (const slot of resourceSlots) {
          if (slot.kind !== 'dataNft' && slot.kind !== 'entry') continue;
          const claim = claimedResourceEffects.find((effect) => effect.participant === slot.participant
            && effect.offset === slot.offset
            && (slot.kind === 'dataNft' ? effect.mode === 0 : effect.mode === 0 || effect.mode === 1));
          if (!claim) continue;
          const absolute = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const input = provisional.inputs[absolute];
          const output = provisional.outputs[absolute];
          if (output?.token?.nft?.capability !== 'mutable') continue;
          if (slot.kind === 'dataNft' && (input?.token?.nft?.capability !== 'mutable'
            || input.token.category !== output.token.category
            || input.token.nft.commitment !== claim.inputCommitmentHex)) continue;
          if (slot.kind === 'entry') {
            const inputMutable = input?.token?.nft?.capability === 'mutable';
            if ((claim.mode === 0 && (!inputMutable || input.token!.category !== output.token.category))
              || (claim.mode === 1 && inputMutable)) continue;
          }
          const proposed = hexToBin(claim.outputCommitmentHex);
          const action = canApplyRepairedNftCommitment({
            capability: output.token.nft.capability,
            currentCommitmentHex: output.token.nft.commitment,
            proposed,
            hasLockingBytecode: false,
            fixedStateSlot: slot.kind === 'dataNft',
            maximumCommitmentBytes: provider.consensusLimits?.maximumNftCommitmentBytes ?? 128,
          });
          if (action === 'skip') continue;
          output.token.nft.commitment = claim.outputCommitmentHex;
          seededComputedResource = true;
        }
        let seededComputedValueChunk = false;
        for (const claim of claimedComputedValueChunks) {
          const participant = finalized.callManifest.participants[claim.participant];
          const trailingBase = plan.participants[claim.participant]?.blockLayout?.trailingBase;
          if (!participant || trailingBase === undefined || claim.offset < trailingBase
            || claim.offset >= participant.actualSize) continue;
          const absolute = finalized.layout.participantInputs[claim.participant] + claim.offset;
          const input = provisional.inputs[absolute];
          const output = provisional.outputs[absolute];
          if (input?.token !== undefined
            || binToHex(input?.unlocker.generateLockingBytecode() ?? new Uint8Array())
              !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
            || output?.token?.category !== claim.tokenCategory
            || output.token.amount !== 0n
            || output.token.nft?.capability !== 'mutable'
            || valueChunkIndexFromCommitment(output.token.nft.commitment)
              !== valueChunkIndexFromCommitment(claim.commitment)) continue;
          const lockingBytecode = hexToBin(claim.lockingBytecodeHex);
          const currentLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          if (binToHex(currentLockingBytecode) !== claim.lockingBytecodeHex) {
            output.to = lockingBytecode;
            seededComputedValueChunk = true;
          }
          if (output.token.nft.commitment !== claim.commitment) {
            output.token.nft.commitment = claim.commitment;
            seededComputedValueChunk = true;
          }
        }
        // State derived by a delegated or cross-participant call is unknowable to the isolated local builders.
        // Converge it on the complete graph before reading resource effects, so the next manifest authenticates
        // the repaired commitment rather than treating the late write as an unclaimed output mutation.
        const resourceConvergence = convergeMessageBusComputedResourceOutputs(provisional);
        const valueChunkConvergence = convergeMessageBusComputedValueChunkOutputs(provisional);
        if (seededComputedResource || seededComputedValueChunk
          || resourceConvergence.repairs > 0 || valueChunkConvergence.repairs > 0) {
          rebalanceFeeTail(provisional, 'converged mutable resource outputs');
        }
        const derivedComputedValueChunks: ComputedValueChunkClaim[] = [];
        for (const absolute of valueChunkConvergence.ownedOutputs) {
          let participant = -1;
          for (let index = 0; index < finalized.layout.participantInputs.length; index += 1) {
            const base = finalized.layout.participantInputs[index];
            if (absolute >= base && absolute < base + finalized.callManifest.participants[index].actualSize) {
              participant = index;
              break;
            }
          }
          if (participant < 0) continue;
          const output = provisional.outputs[absolute];
          const lockingBytecode = output === undefined ? undefined
            : typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          if (lockingBytecode === undefined || output?.token?.nft?.capability !== 'mutable') continue;
          derivedComputedValueChunks.push({
            participant,
            offset: absolute - finalized.layout.participantInputs[participant],
            lockingBytecodeHex: binToHex(lockingBytecode),
            tokenCategory: output.token.category,
            commitment: output.token.nft.commitment,
          });
        }
        if (semanticJson(derivedComputedValueChunks) !== semanticJson(claimedComputedValueChunks)) {
          claimedComputedValueChunks = derivedComputedValueChunks;
          continue;
        }
        const derivedResourceEffects: AtomicResourceSlotEffect[] = [];
        for (const slot of resourceSlots) {
          if (slot.offset >= finalized.callManifest.participants[slot.participant].actualSize) continue;
          const absolute = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const input = provisional.inputs[absolute];
          const output = provisional.outputs[absolute];
          if (!input || !output) throw new Error(`messageBus: resource slot ${slot.participant}:${slot.offset} is absent`);
          const inputToken = input.token;
          const outputToken = output.token;
          // An unresolved dynamic chunk is a first-pass probe placeholder, not a claimed NFT transition. Its
          // participant is independently reported by the builder, and the stable/final gate below rejects any
          // graph which never replaces it with a concrete commitment.
          if (slot.kind === 'trailing' && incompleteParticipants.has(slot.participant)
            && outputToken?.nft?.capability === 'mutable' && outputToken.nft.commitment === '00') continue;
          if (slot.kind === 'satoshiContainer') {
            const inputLockingBytecode = input.unlocker.generateLockingBytecode();
            const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            if (inputToken || outputToken || binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)) {
              throw new Error(`messageBus: satoshi container ${slot.participant}:${slot.offset} is not preserved`);
            }
            derivedResourceEffects.push({
              participant: slot.participant, offset: slot.offset, mode: 3,
              lockingBytecodeHex: binToHex(inputLockingBytecode), tokenCategoryHex: '',
              inputCommitmentHex: '', outputCommitmentHex: '',
              inputValue: input.satoshis, outputValue: output.amount,
            });
            continue;
          }
          if (slot.kind === 'tokenContainer') {
            const inputLockingBytecode = input.unlocker.generateLockingBytecode();
            const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            if (!inputToken || (outputToken && inputToken.category !== outputToken.category)
              || (!outputToken && binToHex(outputLockingBytecode) !== '6a')
              || (outputToken && (input.satoshis !== output.amount
                || binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)))) {
              throw new Error(`messageBus: token container ${slot.participant}:${slot.offset} is invalid`);
            }
            derivedResourceEffects.push({
              participant: slot.participant, offset: slot.offset, mode: 4,
              lockingBytecodeHex: binToHex(inputLockingBytecode),
              tokenCategoryHex: internalTokenCategory(inputToken),
              outputTokenCategoryHex: outputToken ? internalTokenCategory(outputToken) : '',
              inputCommitmentHex: inputToken.nft?.commitment ?? '',
              outputCommitmentHex: outputToken?.nft?.commitment ?? '',
              inputValue: inputToken.amount, outputValue: outputToken?.amount ?? 0n,
            });
            continue;
          }
          if (slot.kind === 'lowLevelCall') {
            const inputLockingBytecode = input.unlocker.generateLockingBytecode();
            const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            if (!inputToken || !outputToken || inputToken.nft?.capability !== 'minting'
              || internalTokenCategory(inputToken) !== internalTokenCategory(outputToken)
              || inputToken.amount !== outputToken.amount
              || inputToken.nft.commitment !== outputToken.nft?.commitment
              || input.satoshis !== output.amount
              || binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)) {
              throw new Error(
                `messageBus: covenant identity ${slot.participant}:${slot.offset} is not preserved exactly`,
              );
            }
            const tokenCategoryHex = internalTokenCategory(inputToken);
            derivedResourceEffects.push({
              participant: slot.participant, offset: slot.offset, mode: 4,
              lockingBytecodeHex: binToHex(inputLockingBytecode),
              tokenCategoryHex, outputTokenCategoryHex: tokenCategoryHex,
              inputCommitmentHex: inputToken.nft.commitment,
              outputCommitmentHex: outputToken.nft.commitment,
              inputValue: inputToken.amount, outputValue: outputToken.amount,
            });
            continue;
          }
          const inputMutable = inputToken?.nft?.capability === 'mutable';
          const outputMutable = outputToken?.nft?.capability === 'mutable';
          if (!inputMutable && !outputMutable) continue;
          const inputLockingBytecode = input.unlocker.generateLockingBytecode();
          const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          const lockingBytecodeChanges = inputMutable && outputMutable
            && binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode);
          const mode = inputMutable ? (outputMutable ? (lockingBytecodeChanges ? 5 : 0) : 2) : 1;
          if (slot.kind !== 'entry' && slot.kind !== 'trailing' && mode !== 0) {
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
              console.error('atomic-fixed-resource-not-preserved', {
                slot,
                absolute,
                inputCategory: inputToken?.category,
                outputCategory: outputToken?.category,
                inputCapability: inputToken?.nft?.capability,
                outputCapability: outputToken?.nft?.capability,
                inputCommitment: inputToken?.nft?.commitment,
                outputCommitment: outputToken?.nft?.commitment,
                inputLockingBytecode: binToHex(input.unlocker.generateLockingBytecode()),
                outputLockingBytecode: binToHex(typeof output.to === 'string'
                  ? addressToLockScript(output.to) : output.to),
              });
            }
            throw new Error(`messageBus: fixed resource slot ${slot.participant}:${slot.offset} is not preserved`);
          }
          const activeToken = inputMutable ? inputToken : outputToken!;
          if (activeToken.amount !== 0n || (inputMutable && outputMutable
            && (inputToken.category !== outputToken!.category || input.satoshis !== output.amount))) {
            throw new Error(`messageBus: resource slot ${slot.participant}:${slot.offset} has an invalid NFT transition`);
          }
          const resourceLockingBytecode = inputMutable ? inputLockingBytecode : outputLockingBytecode;
          derivedResourceEffects.push({
            participant: slot.participant, offset: slot.offset, mode,
            lockingBytecodeHex: binToHex(resourceLockingBytecode),
            ...(mode === 5 && { outputLockingBytecodeHex: binToHex(outputLockingBytecode) }),
            tokenCategoryHex: `${binToHex(hexToBin(activeToken.category).reverse())}01`,
            inputCommitmentHex: inputMutable ? inputToken.nft!.commitment : '',
            outputCommitmentHex: outputMutable ? outputToken!.nft!.commitment : '',
          });
        }
        if (semanticJson(derivedResourceEffects) !== semanticJson(claimedResourceEffects)) {
          claimedResourceEffects = derivedResourceEffects;
          continue;
        }
        const derivedValueEffects: AtomicValueSlotEffect[] = [];
        for (const slot of valueSlots) {
          if (slot.offset >= finalized.callManifest.participants[slot.participant].actualSize) continue;
          const absolute = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const input = provisional.inputs[absolute];
          const output = provisional.outputs[absolute];
          if (!input || !output || input.token || output.token
            || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX) {
            throw new Error(`messageBus: transfer slot ${slot.participant}:${slot.offset} is not canonically funded`);
          }
          const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          if (binToHex(lockingBytecode) === '51') continue;
          derivedValueEffects.push({
            ...slot, lockingBytecodeHex: binToHex(lockingBytecode), amount: output.amount,
          });
        }
        if (semanticJson(derivedValueEffects) !== semanticJson(claimedValueEffects)) {
          claimedValueEffects = derivedValueEffects;
          continue;
        }
        const derivedTokenEffects: AtomicTokenSlotEffect[] = [];
        for (const slot of tokenSlots) {
          if (slot.offset >= finalized.callManifest.participants[slot.participant].actualSize) continue;
          const absolute = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const input = provisional.inputs[absolute];
          const output = provisional.outputs[absolute];
          if (!input || !output || input.token
            || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX) {
            throw new Error(`messageBus: token-transfer slot ${slot.participant}:${slot.offset} is not canonically funded`);
          }
          if (!output.token) {
            const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            if (binToHex(lockingBytecode) === '51') continue;
            throw new Error(`messageBus: token-transfer slot ${slot.participant}:${slot.offset} has no token`);
          }
          const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          derivedTokenEffects.push({
            ...slot, lockingBytecodeHex: binToHex(lockingBytecode),
            tokenCategoryHex: internalTokenCategory(output.token),
            amount: output.token.amount,
            commitmentHex: output.token.nft?.commitment ?? '',
            capability: output.token.nft?.capability ?? 'ft',
          });
        }
        if (semanticJson(derivedTokenEffects) !== semanticJson(claimedTokenEffects)) {
          claimedTokenEffects = derivedTokenEffects;
          continue;
        }
        const derivedSidecarEffects: AtomicSidecarSlotEffect[] = [];
        for (const slot of sidecarSlots) {
          if (slot.offset >= finalized.callManifest.participants[slot.participant].actualSize) continue;
          const absolute = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const input = provisional.inputs[absolute];
          const output = provisional.outputs[absolute];
          if (!input || !output) throw new Error(`messageBus: sidecar slot ${slot.participant}:${slot.offset} is absent`);
          if (!input.token || !output.token) continue;
          const inputLockingBytecode = input.unlocker.generateLockingBytecode();
          const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          if (binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)
            || internalTokenCategory(input.token) !== internalTokenCategory(output.token)
            || input.token.amount !== output.token.amount || input.satoshis !== output.amount) {
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
              console.error('atomic-sidecar-not-recreated', {
                slot,
                absolute,
                inputLockingBytecode: binToHex(inputLockingBytecode),
                outputLockingBytecode: binToHex(outputLockingBytecode),
                inputCategory: internalTokenCategory(input.token),
                outputCategory: internalTokenCategory(output.token),
                inputCommitment: input.token.nft?.commitment,
                outputCommitment: output.token.nft?.commitment,
                inputAmount: input.token.amount,
                outputAmount: output.token.amount,
                inputSatoshis: input.satoshis,
                outputSatoshis: output.amount,
              });
            }
            throw new Error(`messageBus: sidecar slot ${slot.participant}:${slot.offset} is not recreated in place`);
          }
          derivedSidecarEffects.push({
            ...slot, lockingBytecodeHex: binToHex(inputLockingBytecode),
            tokenCategoryHex: internalTokenCategory(input.token),
            inputCommitmentHex: input.token.nft?.commitment ?? '',
            outputCommitmentHex: output.token.nft?.commitment ?? '', value: input.satoshis,
          });
        }
        if (semanticJson(derivedSidecarEffects) !== semanticJson(claimedSidecarEffects)) {
          claimedSidecarEffects = derivedSidecarEffects;
          continue;
        }
        const derivedEventEffects: AtomicEventSlotEffect[] = [];
        const eventProgram = provisional.buildLibauthProgram();
        const discoveredEvents = new Map<number, { commitment: string; lockingBytecode?: string }>();
        for (const participant of plan.participants) {
          const ownedSlots = eventSlots().filter((slot) => slot.participant === participant.participant);
          const participantBase = finalized.layout.participantInputs[participant.participant];
          const eventIndices = ownedSlots.map((slot) => participantBase + slot.offset);
          if (eventIndices.length === 0) continue;
          const executionInput = participant.executionKind === 1 && participant.executorOffset !== null
            ? participantBase + participant.executorOffset : participantBase;
          const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
          for (const [outputIndex, expectation] of contract._messageBusEventCommitmentsFromTransaction(
            provisional, eventIndices, executionInput, eventProgram,
          )) discoveredEvents.set(outputIndex, expectation);
        }
        // The route's unrolled dispatcher owns the physical event site. A compact local probe initially places
        // reached events by logical row, but those coordinates can differ when several selector arms share the
        // route. The complete trace above is the compiler's authority: relocate the SDK's artifact-derived event
        // templates onto the exact event slots introspected by the covenant, and return every other reserved slot
        // to its canonical balanced-output shape. No contract-specific handler or event names participate.
        for (const participant of plan.participants) {
          const participantBase = finalized.layout.participantInputs[participant.participant];
          const selectedEventOffsets = selectedGraphEventOffsets(plan, participant);
          const indices = eventSlots().filter((slot) => slot.participant === participant.participant)
            .map((slot) => participantBase + slot.offset);
          if (indices.length === 0) continue;
          const eventLocks = eventLockingBytecodes(participant);
          const eventLockSet = new Set(eventLocks);
          const participantEnd = participantBase
            + finalized.callManifest.participants[participant.participant].actualSize;
          const active = Array.from({ length: participantEnd - participantBase }, (_unused, offset) =>
            participantBase + offset).filter((index) => {
            const output = provisional.outputs[index];
            const nft = provisional.outputs[index]?.token?.nft;
            const lockingBytecode = output === undefined ? undefined
              : typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            return nft?.capability === 'none' && lockingBytecode !== undefined
              && eventLockSet.has(binToHex(lockingBytecode));
          });
          // Inactive route slots only bind an empty commitment. A relaxed trace can carry that introspection into
          // a neighboring equality and produce a false commitment match, but it cannot invent the event covenant's
          // independently verified locking bytecode. The executing covenant's commitment+lock pair is authoritative
          // for proxy/delegate routes, where the logical handler artifact need not publish the physical event lock.
          const targets = indices.filter((index) => {
            const expectation = discoveredEvents.get(index);
            return (selectedEventOffsets === undefined
              || selectedEventOffsets.has(index - participantBase))
              && (expectation?.commitment.length ?? 0) > 0
              && expectation?.lockingBytecode !== undefined;
          });
          const inactive = indices.map((index) => provisional.outputs[index]).find((output) => !output.token);
          if (!inactive && targets.some((target) => !active.includes(target))) {
            throw new Error('messageBus: event-frame relocation has no canonical inactive output');
          }
          if (!inactive && targets.length === 0 && active.length > 0) {
            throw new Error('messageBus: inactive event frame has no canonical empty output');
          }
          if (targets.length === 0 && active.length === 0) continue;
          const template = inactive ?? provisional.outputs[targets[0]];
          if (!template) throw new Error('messageBus: active event frame has no output template');
          if (inactive) {
            for (const index of new Set([...indices, ...active])) provisional.outputs[index] = { ...inactive };
          }
          targets.forEach((target, index) => {
            const expectation = discoveredEvents.get(target)!;
            // A flattened route trace can expose a sibling event identity beside the reached handler's payload.
            // Prefer the unique event schema published by the selected handlers; retain the trace for genuinely
            // ambiguous same-schema events, where the commitment alone cannot identify a named covenant.
            const decodedLock = eventLockingBytecodeForCommitment(participant, expectation.commitment);
            provisional.outputs[target] = {
              to: hexToBin(decodedLock ?? expectation.lockingBytecode ?? eventLocks[index]),
              amount: template.amount,
              token: {
                category: categories[participant.participant], amount: 0n,
                nft: { capability: 'none', commitment: expectation.commitment },
              },
            };
          });
          rebalanceFeeTail(provisional, 'relocated compiler-authenticated event outputs');
        }
        for (const slot of eventSlots()) {
          const outputIndex = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const output = provisional.outputs[outputIndex];
          if (!output) throw new Error(`messageBus: event slot ${slot.participant}:${slot.offset} has no output`);
          const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          const expectation = discoveredEvents.get(outputIndex);
          const commitment = expectation?.commitment ?? output.token?.nft?.commitment ?? '';
          const active = output.token !== undefined && commitment.length > 0;
          if (active && (output.token!.category !== categories[slot.participant]
            || output.token!.nft?.capability !== 'none')) {
            throw new Error(
              `messageBus: event slot ${slot.participant}:${slot.offset} is not an immutable participant NFT`,
            );
          }
          if (active) {
            derivedEventEffects.push({
              ...slot, active, lockingBytecodeHex: binToHex(lockingBytecode),
              commitmentHex: commitment,
            });
          }
        }
        let stable = true;
        if (JSON.stringify(derivedEventEffects) !== JSON.stringify(claimedEventEffects)) stable = false;
        if (stable) {
          if (missingReturnParticipants.size > 0) {
            throw new Error(
              `messageBus: stable graph did not expose return vectors for participant(s) `
              + [...missingReturnParticipants].join(', '),
            );
          }
          if (assembled.incompleteDynamicChunks.length > 0) {
            const detail = assembled.incompleteDynamicChunks.map((item) =>
              `${item.participant}:${item.variable} (${item.resolved}/${item.total})`).join(', ');
            throw new Error(`messageBus: stable graph retains incomplete dynamic chunks: ${detail}`);
          }
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
            console.error('atomic-composed-layout', {
              participantInputs: finalized.layout.participantInputs,
              actualSizes: assembled.actualSizes,
              participants: plan.participants.map((participant) => ({
                participant: participant.participant,
                lockingBytecode: participant.lockingBytecode,
                invocations: participant.invocations.map((invocation) =>
                  plan.invocations[invocation].function),
                maximumSize: participant.blockLayout?.blockSize,
                trailingBase: participant.blockLayout?.trailingBase,
              })),
            });
          }
          return admit(provisional);
        }
        claimedResults = derivedResults;
        claimedEventEffects = derivedEventEffects;
        claimedResourceEffects = derivedResourceEffects;
        claimedValueEffects = derivedValueEffects;
        claimedTokenEffects = derivedTokenEffects;
      }
      throw new Error(
        `messageBus: semantic derivation did not converge after ${maximumPasses} claim-bounded passes`,
      );
    }
    let assembled = await assemble(finalized, provisionalResults);
    if (!actualSpansMatch(finalized, assembled.actualSizes)) {
      finalized = finalizeAtomicInvocationGraph(
        plan, categories, provisionalResults, provisionalEventEffects, provisionalResourceEffects,
        provisionalValueEffects, provisionalTokenEffects, provisionalSidecarEffects, assembled.actualSizes,
        deploymentEffects,
      );
      assembled = await assemble(finalized, provisionalResults);
      if (!actualSpansMatch(finalized, assembled.actualSizes)) {
        throw new Error('messageBus: participant spans did not converge after compact assembly');
      }
    }
    if (assembled.incompleteDynamicChunks.length > 0) {
      const detail = assembled.incompleteDynamicChunks.map((item) =>
        `${item.participant}:${item.variable} (${item.resolved}/${item.total})`).join(', ');
      throw new Error(`messageBus: final graph retains incomplete dynamic chunks: ${detail}`);
    }
    return admit(assembled.builder);
  }

  /** Build the complete transaction without broadcasting; all signatures are generated from this final shape. */
  build(): Promise<TransactionBuilder> { return this._build(); }

  async send(): Promise<TransactionDetails> { return (await this._build()).send() as Promise<TransactionDetails>; }
}

export function compose(options: ComposeAtomicMessageBusOptions): AtomicMessageBusComposition {
  // Snapshot the caller-owned array so later mutation cannot alter the graph between compose() and send().
  if (!options.calls && !options.preparedCalls) {
    throw new Error('messageBus: composition requires calls or preparedCalls');
  }
  return new AtomicMessageBusComposition({
    ...options,
    ...(options.calls && { calls: Object.freeze([...options.calls]) }),
    ...(options.preparedCalls && { preparedCalls: Object.freeze([...options.preparedCalls]) }),
  });
}
