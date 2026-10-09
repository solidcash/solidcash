import { sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  decodePushdataValue, scriptToBytecode,
  type AbiFunction, type Artifact, type DelegateForwardingAbi,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';

interface FrameIdentity {
  lockingBytecode: string;
  stateCategory: string;
}

/** Physical values that a future kernel delegate verifier must bind in one transcript. */
export interface KernelDelegateForwardingFrame {
  participantInputIndex: number;
  participantOutputIndex: number;
  executorInputIndex: number;
  participantInput: FrameIdentity;
  participantOutput: FrameIdentity;
  executorLockingBytecode: string;
  /** Calldata actually presented to the implementation executor. */
  forwardedCalldata: Uint8Array;
}

export interface ResolvedKernelDelegateForwarding {
  participantInputIndex: number;
  participantOutputIndex: number;
  executorInputIndex: number;
  ownerLockingBytecode: string;
  stateCategory: string;
  executorLockingBytecode: string;
  forwardedCalldata: Uint8Array;
}

export interface ResolvedKernelDelegateExecution extends ResolvedKernelDelegateForwarding {
  functionName: string;
  selector: string;
  args: readonly FunctionArgument[];
  /** Canonical future-verifier frame: owner/output coordinates, identities, and exact implementation payload. */
  transcript: Uint8Array;
  commitment: Uint8Array;
}

export interface KernelDelegateExecutionTarget {
  artifact: Artifact;
  /** Instantiated implementation covenant identity; must be the exact executor input selected by the frame. */
  lockingBytecode: string;
}

/** Compiler-authored physical target for one singular delegate-forwarding edge. */
export interface ResolvedKernelDelegateForwardingTarget {
  callIndex: number;
  lockingBytecode: string;
}

export interface KernelDelegatePromotionInput {
  forwarding: unknown;
  proxyParameters: readonly FunctionArgument[];
  proxyConstructorArgs: readonly FunctionArgument[];
  proxyLockingBytecode: string;
  stateCategory: string;
  implementation: KernelDelegateExecutionTarget;
  requestedFunctionName: string;
  requestedArgs: readonly FunctionArgument[];
}

export type KernelDelegateForwardingMetadata = DelegateForwardingAbi;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const exactKeys = (value: UnknownRecord, keys: readonly string[], label: string): void => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has an unsupported schema`);
  }
};

const canonicalHex = (value: unknown, label: string): string => {
  if (typeof value === 'string' && /^(?:[0-9a-fA-F]{2})+$/.test(value)) return value.toLowerCase();
  if (value instanceof Uint8Array && value.length > 0) {
    return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  throw new Error(`${label} must be non-empty canonical bytecode`);
};

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean => (
  left.length === right.length && left.every((byte, index) => byte === right[index])
);

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    result.set(part, cursor);
    cursor += part.length;
  }
  return result;
};

/** Decode one argument from the outer unlocking-script frame. Arrays and structs are serialized as one value
 * blob and then pushed as one ABI argument, so their inner decoder must run on the pushed bytes rather than on
 * the outer PUSHDATA opcode. Scalar encodings already are their own canonical script item. */
const decodeForwardedArgument = (
  payload: Uint8Array,
  cursor: number,
  type: string,
  structs: Artifact['structs'],
): { value: FunctionArgument; bytesConsumed: number } => {
  const aggregate = type.endsWith(']') || structs?.some((candidate) => candidate.name === type) === true;
  if (!aggregate) {
    const decoded = decodePushdataValue(payload, cursor, type, structs);
    return { value: decoded.value as FunctionArgument, bytesConsumed: decoded.bytesConsumed };
  }
  const outer = decodePushdataValue(payload, cursor, 'bytes');
  if (!(outer.value instanceof Uint8Array)) {
    throw new Error('delegate forwarding aggregate argument is not one canonical pushed value');
  }
  // A top-level empty dynamic array deliberately uses push1(0) for its inner count. OP_0 would collapse to an
  // empty stack item when the complete argument is pushed by an unlocking template, losing the count field.
  // This is the one canonical exception documented by encodeFunctionArgument's array encoding.
  if (type.endsWith('[]') && outer.value.length === 2
    && outer.value[0] === 0x01 && outer.value[1] === 0x00) {
    return { value: [], bytesConsumed: outer.bytesConsumed };
  }
  const decoded = decodePushdataValue(outer.value, 0, type, structs);
  if (decoded.bytesConsumed !== outer.value.length) {
    throw new Error('delegate forwarding aggregate argument has trailing inner bytes');
  }
  return { value: decoded.value as FunctionArgument, bytesConsumed: outer.bytesConsumed };
};

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
const framed = (value: Uint8Array): Uint8Array => concat(uint16(value.length), value);

const coordinate = (value: unknown, label: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 0xffff) {
    throw new Error(`${label} must be a uint16 transaction coordinate`);
  }
  return value as number;
};

interface ValidatedKernelDelegateForwardingMetadata {
  forwarding: UnknownRecord;
  callIndex: number;
  payloadInput: number;
}

const validateKernelDelegateForwardingMetadata = (
  forwarding: unknown,
): ValidatedKernelDelegateForwardingMetadata => {
  if (!isRecord(forwarding)) throw new Error('delegate forwarding metadata must be an object');
  exactKeys(forwarding, [
    'version', 'callIndex', 'payloadInput', 'target', 'targetBinding', 'frame', 'terminalRequire',
  ], 'delegate forwarding metadata');
  if (forwarding.version !== 1 || forwarding.callIndex !== 0 || forwarding.terminalRequire !== true) {
    throw new Error('delegate forwarding metadata is not the singular version-1 frame');
  }
  if (!Number.isSafeInteger(forwarding.payloadInput) || (forwarding.payloadInput as number) < 0) {
    throw new Error('delegate forwarding payload input is invalid');
  }
  if (!isRecord(forwarding.frame)) throw new Error('delegate forwarding frame must be an object');
  exactKeys(forwarding.frame, ['stateOwner', 'executor', 'calldata', 'outputOwner'], 'delegate forwarding frame');
  if (forwarding.frame.stateOwner !== 'participant'
    || forwarding.frame.executor !== 'target-input'
    || forwarding.frame.calldata !== 'payload-input'
    || forwarding.frame.outputOwner !== 'participant') {
    throw new Error('delegate forwarding frame authority is not canonical');
  }
  if (!isRecord(forwarding.target) || !isRecord(forwarding.targetBinding)) {
    throw new Error('delegate forwarding target metadata is incomplete');
  }
  return {
    forwarding,
    callIndex: forwarding.callIndex as number,
    payloadInput: forwarding.payloadInput as number,
  };
};

const resolveValidatedKernelDelegateForwardingTarget = (
  metadata: ValidatedKernelDelegateForwardingMetadata,
  constructorArgs: readonly FunctionArgument[],
): ResolvedKernelDelegateForwardingTarget => {
  const { forwarding } = metadata;
  let lockingBytecode: string;
  if ((forwarding.targetBinding as UnknownRecord).kind === 'constructorArg') {
    exactKeys(forwarding.target as UnknownRecord, ['kind', 'name'], 'delegate forwarding target');
    exactKeys(
      forwarding.targetBinding as UnknownRecord,
      ['kind', 'input', 'name'],
      'delegate forwarding target binding',
    );
    const target = forwarding.target as UnknownRecord;
    const binding = forwarding.targetBinding as UnknownRecord;
    if (target.kind !== 'constructorArg'
      || typeof target.name !== 'string' || target.name.length === 0
      || binding.name !== target.name
      || !Number.isSafeInteger(binding.input)
      || (binding.input as number) < 0) {
      throw new Error('delegate forwarding constructor target binding is inconsistent');
    }
    lockingBytecode = canonicalHex(
      constructorArgs[binding.input as number],
      'delegate forwarding constructor target',
    );
  } else if ((forwarding.targetBinding as UnknownRecord).kind === 'literal') {
    exactKeys(forwarding.target as UnknownRecord, ['kind'], 'delegate forwarding target');
    exactKeys(
      forwarding.targetBinding as UnknownRecord,
      ['kind', 'lockingBytecode'],
      'delegate forwarding target binding',
    );
    const target = forwarding.target as UnknownRecord;
    const binding = forwarding.targetBinding as UnknownRecord;
    if (target.kind !== 'literal') {
      throw new Error('delegate forwarding literal target binding is inconsistent');
    }
    lockingBytecode = canonicalHex(binding.lockingBytecode, 'delegate forwarding literal target');
  } else {
    throw new Error('delegate forwarding target binding is unsupported');
  }
  return Object.freeze({ callIndex: metadata.callIndex, lockingBytecode });
};

/**
 * Resolve only the compiler-committed executor identity for a forwarding edge.
 *
 * Constructor arguments should be their ABI-encoded values: an `address` may be supplied publicly as a
 * CashAddress string, while its encoded value is the exact locking bytecode committed by the proxy covenant.
 */
export function resolveKernelDelegateForwardingTarget(
  forwarding: unknown,
  constructorArgs: readonly FunctionArgument[],
): ResolvedKernelDelegateForwardingTarget {
  return resolveValidatedKernelDelegateForwardingTarget(
    validateKernelDelegateForwardingMetadata(forwarding), constructorArgs,
  );
}

/**
 * Resolve the exact compiler-authored forwarding recipe against one physical frame.
 *
 * This is intentionally a prerequisite, not an admission switch. It rejects unknown or extended schemas and
 * binds the four values a covenant must compare: owner, state category, executor target, and calldata. State
 * commitment transitions remain the implementation route's responsibility.
 */
export function planKernelDelegateForwarding(
  forwarding: unknown,
  parameters: readonly FunctionArgument[],
  constructorArgs: readonly FunctionArgument[],
  frame: KernelDelegateForwardingFrame,
): ResolvedKernelDelegateForwarding {
  const metadata = validateKernelDelegateForwardingMetadata(forwarding);

  const payload = parameters[metadata.payloadInput];
  if (!(payload instanceof Uint8Array)) throw new Error('delegate forwarding payload must be bytes');
  if (!sameBytes(payload, frame.forwardedCalldata)) {
    throw new Error('delegate forwarding calldata does not match the selected payload input');
  }

  const target = resolveValidatedKernelDelegateForwardingTarget(metadata, constructorArgs).lockingBytecode;

  const ownerInput = canonicalHex(frame.participantInput.lockingBytecode, 'delegate participant input owner');
  const ownerOutput = canonicalHex(frame.participantOutput.lockingBytecode, 'delegate participant output owner');
  const inputCategory = canonicalHex(frame.participantInput.stateCategory, 'delegate participant input category');
  const outputCategory = canonicalHex(frame.participantOutput.stateCategory, 'delegate participant output category');
  const executor = canonicalHex(frame.executorLockingBytecode, 'delegate executor input');
  if (ownerInput !== ownerOutput || inputCategory !== outputCategory) {
    throw new Error('delegate forwarding output does not preserve the participant owner and state category');
  }
  if (executor !== target) throw new Error('delegate executor input does not match the committed forwarding target');

  const participantInputIndex = coordinate(frame.participantInputIndex, 'participant input index');
  const participantOutputIndex = coordinate(frame.participantOutputIndex, 'participant output index');
  const executorInputIndex = coordinate(frame.executorInputIndex, 'executor input index');
  if (participantInputIndex !== participantOutputIndex) {
    throw new Error('delegate participant input/output coordinates must preserve the balanced block offset');
  }
  if (executorInputIndex === participantInputIndex) {
    throw new Error('delegate executor input must be distinct from the participant state owner');
  }

  return Object.freeze({
    participantInputIndex,
    participantOutputIndex,
    executorInputIndex,
    ownerLockingBytecode: ownerInput,
    stateCategory: inputCategory,
    executorLockingBytecode: executor,
    forwardedCalldata: payload,
  });
}

/**
 * Resolve a forwarding payload to the one implementation handler it canonically encodes.
 *
 * The returned transcript is the complete bridge still missing from the deployed verifier: the existing
 * atomic participant/resource rows authenticate each identity independently, while this commitment joins those
 * identities to the proxy payload and the selected implementation selector. No caller-supplied function name
 * or decoded argument is trusted.
 */
export function resolveKernelDelegateExecution(
  forwarding: unknown,
  parameters: readonly FunctionArgument[],
  constructorArgs: readonly FunctionArgument[],
  frame: KernelDelegateForwardingFrame,
  implementation: KernelDelegateExecutionTarget,
  detachedArguments?: readonly FunctionArgument[],
): ResolvedKernelDelegateExecution {
  const binding = planKernelDelegateForwarding(forwarding, parameters, constructorArgs, frame);
  if (canonicalHex(implementation.lockingBytecode, 'delegate implementation identity')
    !== binding.executorLockingBytecode) {
    throw new Error('delegate implementation artifact is not attached to the authenticated executor input');
  }
  const artifact = implementation.artifact;
  const payload = binding.forwardedCalldata;
  if (payload.length < 4) throw new Error('delegate forwarding payload omits the implementation selector');
  const selector = binToHex(payload.slice(0, 4));
  const candidates = artifact.abi.filter((candidate) => candidate.selector?.toLowerCase() === selector);
  if (candidates.length !== 1) {
    throw new Error('delegate forwarding payload does not select exactly one implementation ABI function');
  }
  const fn = candidates[0]!;
  if (!(fn.modifiers ?? []).includes('delegate')) {
    throw new Error('delegate forwarding payload selects a function that is not a delegate implementation');
  }
  const handler = artifact.messageBus?.handlers.filter((candidate) =>
    candidate.selector.toLowerCase() === selector) ?? [];
  if (artifact.messageBus?.convention !== 'kernel-row-loop'
    || handler.length !== 1 || handler[0]!.eligible !== true) {
    throw new Error('delegate forwarding payload selects no unique eligible kernel implementation handler');
  }
  const visibleInputs = fn.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  const args: FunctionArgument[] = [];
  const selectorOnly = payload.length === 4;
  if (selectorOnly && detachedArguments === undefined) {
    throw new Error('delegate forwarding payload omits canonical implementation arguments');
  }
  const encodedDetached = selectorOnly
    ? detachedArguments!.map((argument, index) => (
      index < visibleInputs.length ? encodeFunctionArgument(argument, visibleInputs[index]!.type, structs) : argument
    ))
    : undefined;
  if (encodedDetached?.some((argument) => !(argument instanceof Uint8Array))) {
    throw new Error('delegate forwarding payload cannot carry a detached transaction signature');
  }
  const argumentPayload = selectorOnly
    ? scriptToBytecode(encodedDetached as Uint8Array[])
    : payload.slice(4);
  let cursor = 0;
  for (const input of visibleInputs) {
    let decoded: ReturnType<typeof decodeForwardedArgument>;
    try {
      decoded = decodeForwardedArgument(argumentPayload, cursor, input.type, structs);
    } catch (error) {
      throw new Error(
        `delegate forwarding argument '${input.name}' (${input.type}) is not canonical: `
        + (error instanceof Error ? error.message : String(error)),
      );
    }
    args.push(decoded.value);
    cursor += decoded.bytesConsumed;
  }
  if (cursor !== argumentPayload.length || args.length !== visibleInputs.length) {
    throw new Error('delegate forwarding payload has trailing or non-canonical implementation arguments');
  }
  const encoded = args.map((argument, index) =>
    encodeFunctionArgument(argument, visibleInputs[index]!.type, structs));
  if (encoded.some((argument) => !(argument instanceof Uint8Array))) {
    throw new Error('delegate forwarding payload cannot carry a detached transaction signature');
  }
  const canonicalArguments = scriptToBytecode(encoded as Uint8Array[]);
  const canonicalPayload = concat(hexToBin(selector), canonicalArguments);
  if (!sameBytes(canonicalArguments, argumentPayload)
    || (!selectorOnly && !sameBytes(canonicalPayload, payload))) {
    throw new Error('delegate forwarding payload is not the canonical implementation ABI encoding');
  }

  const transcript = concat(
    hexToBin(selectorOnly ? '4b444632' : '4b444631'), // `KDF2` binds separately-carried row args; `KDF1` is unchanged.
    uint16(binding.participantInputIndex), uint16(binding.participantOutputIndex),
    uint16(binding.executorInputIndex),
    framed(hexToBin(binding.ownerLockingBytecode)), hexToBin(binding.stateCategory),
    framed(hexToBin(binding.executorLockingBytecode)), hexToBin(selector), framed(payload),
    ...(selectorOnly ? [framed(canonicalArguments)] : []),
  );
  return Object.freeze({
    ...binding,
    functionName: fn.name,
    selector,
    args: Object.freeze(args),
    transcript,
    commitment: sha256.hash(transcript),
  });
}

/**
 * Resolve the narrow compiler-published forwarding form into an existing kernel delegate participant.
 *
 * The forwarding source admits arbitrary bytes, but fixes the executor in the proxy's address-committed
 * constructor/literal data. This helper proves that the implementation call selected by `withDelegatecall` is
 * exactly those bytes. The physical composer later replaces these normalized coordinates with its authenticated
 * participant/executor layout; no application or generated proxy function name participates in the decision.
 */
export function resolveKernelDelegatePromotion(
  input: KernelDelegatePromotionInput,
): ResolvedKernelDelegateExecution {
  if (!isRecord(input.forwarding)
    || !Number.isSafeInteger(input.forwarding.payloadInput)
    || (input.forwarding.payloadInput as number) < 0) {
    throw new Error('delegate forwarding payload input is invalid');
  }
  const forwardedCalldata = input.proxyParameters[input.forwarding.payloadInput as number];
  if (!(forwardedCalldata instanceof Uint8Array)) {
    throw new Error('delegate forwarding payload must be bytes');
  }
  const resolved = resolveKernelDelegateExecution(
    input.forwarding,
    input.proxyParameters,
    input.proxyConstructorArgs,
    {
      participantInputIndex: 0,
      participantOutputIndex: 0,
      executorInputIndex: 1,
      participantInput: {
        lockingBytecode: input.proxyLockingBytecode,
        stateCategory: input.stateCategory,
      },
      participantOutput: {
        lockingBytecode: input.proxyLockingBytecode,
        stateCategory: input.stateCategory,
      },
      executorLockingBytecode: input.implementation.lockingBytecode,
      forwardedCalldata,
    },
    input.implementation,
    input.requestedArgs,
  );
  if (resolved.functionName !== input.requestedFunctionName) {
    throw new Error('delegate forwarding payload selects a different implementation function');
  }
  const fn = input.implementation.artifact.abi.find((candidate) =>
    candidate.selector?.toLowerCase() === resolved.selector);
  const visibleInputs = fn?.inputs.filter((parameter) => !parameter.name.startsWith('__internal__')) ?? [];
  if (visibleInputs.length !== input.requestedArgs.length) {
    throw new Error('delegate forwarding request has a different implementation arity');
  }
  const structs = input.implementation.artifact.structs ?? input.implementation.artifact.stateLayout?.structs;
  const encoded = input.requestedArgs.map((argument, index) =>
    encodeFunctionArgument(argument, visibleInputs[index]!.type, structs));
  if (encoded.some((argument) => !(argument instanceof Uint8Array))) {
    throw new Error('delegate forwarding request cannot carry a detached transaction signature');
  }
  const requestedPayload = concat(hexToBin(resolved.selector), scriptToBytecode(encoded as Uint8Array[]));
  if (forwardedCalldata.length !== 4 && !sameBytes(requestedPayload, forwardedCalldata)) {
    throw new Error('delegate forwarding request does not match the proxy payload');
  }
  return resolved;
}

/** @internal Resolve one compiler-authored terminal forwarding edge for atomic delegate promotion. */
export function resolvePreparedKernelDelegateExecution(input: {
  proxyFunction: Pick<AbiFunction, 'name' | 'delegateForwarding'>;
  callIndex: number;
  proxyParameters: readonly FunctionArgument[];
  proxyConstructorArgs: readonly FunctionArgument[];
  proxyLockingBytecode: string;
  stateCategory: string;
  implementationArtifact: Artifact;
  implementationLockingBytecode: string;
  requestedFunctionName: string;
  requestedArgs: readonly FunctionArgument[];
}): ReturnType<typeof resolveKernelDelegatePromotion> | undefined {
  if (input.proxyFunction.delegateForwarding?.callIndex !== input.callIndex) return undefined;
  return resolveKernelDelegatePromotion({
    forwarding: input.proxyFunction.delegateForwarding,
    proxyParameters: input.proxyParameters,
    proxyConstructorArgs: input.proxyConstructorArgs,
    proxyLockingBytecode: input.proxyLockingBytecode,
    stateCategory: input.stateCategory,
    implementation: {
      artifact: input.implementationArtifact,
      lockingBytecode: input.implementationLockingBytecode,
    },
    requestedFunctionName: input.requestedFunctionName,
    requestedArgs: input.requestedArgs,
  });
}

/**
 * Bind a promoted delegate execution to its exact logical ABI owner.
 *
 * A compiler route and its logical handler can have equally plausible argument counts. Once forwarding promotion
 * has authenticated the implementation selector, nested calls must resolve against that handler and its decoded
 * arguments rather than rediscovering a frame by function name or arity.
 */
export function resolvePreparedKernelDelegateOwnerFrame(input: {
  execution: NonNullable<ReturnType<typeof resolveKernelDelegatePromotion>>;
  implementationAbi: readonly AbiFunction[];
}): { abiFunction: AbiFunction; args: FunctionArgument[] } {
  const selector = input.execution.selector.toLowerCase();
  const matches = input.implementationAbi.filter((candidate) => (
    candidate.selector?.toLowerCase() === selector
    && candidate.name === input.execution.functionName
  ));
  if (matches.length !== 1) {
    throw new Error(
      `Promoted delegate selector ${selector} does not identify exactly one logical implementation handler.`,
    );
  }
  const abiFunction = matches[0]!;
  const visibleInputs = abiFunction.inputs.filter((candidate) => !candidate.name.startsWith('__internal__'));
  if (visibleInputs.length !== input.execution.args.length) {
    throw new Error(
      `Promoted delegate selector ${selector} decoded ${input.execution.args.length} arguments, `
      + `but its logical implementation handler declares ${visibleInputs.length}.`,
    );
  }
  return { abiFunction, args: [...input.execution.args] };
}

type KernelDelegateForwardingGroupIdentity = {
  callMode?: string;
  externalContract: { inner: { lockingBytecode: string } };
  masterUtxo?: unknown;
};

/**
 * Select the one physical executor committed by a compiler-authored forwarding edge.
 *
 * Candidate order and application names are deliberately irrelevant. The caller scopes candidates to the
 * forwarding function's physical owner; duplicate bytecode within that scope remains ambiguous until the graph
 * carries an owner-scoped callsite identity and must fail closed.
 */
export function selectKernelDelegateForwardingGroupIndex(input: {
  forwarding: unknown;
  encodedProxyConstructorArgs: readonly FunctionArgument[];
  groups: readonly KernelDelegateForwardingGroupIdentity[];
  candidateIndexes?: readonly number[];
}): number {
  const target = resolveKernelDelegateForwardingTarget(
    input.forwarding, input.encodedProxyConstructorArgs,
  );
  const candidateIndexes = input.candidateIndexes
    ?? input.groups.map((_, index) => index);
  const matching = candidateIndexes.filter((index) => {
    const group = input.groups[index];
    if (!group || group.callMode !== 'delegatecall') return false;
    const contractLock = group.externalContract.inner.lockingBytecode.toLowerCase();
    const generatedLock = (group.masterUtxo as {
      unlocker?: { generateLockingBytecode(): Uint8Array };
    } | undefined)?.unlocker?.generateLockingBytecode();
    if (generatedLock && binToHex(generatedLock) !== contractLock) {
      throw new Error(`Delegate executor group ${index} has inconsistent physical locking bytecode`);
    }
    return contractLock === target.lockingBytecode;
  });
  if (matching.length === 0) {
    throw new Error('Compiler-authenticated delegate forwarding target is not materialized');
  }
  if (matching.length !== 1) {
    throw new Error('Compiler-authenticated delegate forwarding target is ambiguous');
  }
  return matching[0]!;
}
