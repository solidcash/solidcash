import { binToHex, hexToBin, sha256 } from '@bitauth/libauth';
import {
  decodePushdataValue, scriptToBytecode, type Artifact, type DelegateForwardingAbi,
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

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
const framed = (value: Uint8Array): Uint8Array => concat(uint16(value.length), value);

const coordinate = (value: unknown, label: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 0xffff) {
    throw new Error(`${label} must be a uint16 transaction coordinate`);
  }
  return value as number;
};

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

  const payload = parameters[forwarding.payloadInput as number];
  if (!(payload instanceof Uint8Array)) throw new Error('delegate forwarding payload must be bytes');
  if (!sameBytes(payload, frame.forwardedCalldata)) {
    throw new Error('delegate forwarding calldata does not match the selected payload input');
  }

  let target: string;
  if (forwarding.targetBinding.kind === 'constructorArg') {
    exactKeys(forwarding.target, ['kind', 'name'], 'delegate forwarding target');
    exactKeys(forwarding.targetBinding, ['kind', 'input', 'name'], 'delegate forwarding target binding');
    if (forwarding.target.kind !== 'constructorArg'
      || typeof forwarding.target.name !== 'string' || forwarding.target.name.length === 0
      || forwarding.targetBinding.name !== forwarding.target.name
      || !Number.isSafeInteger(forwarding.targetBinding.input)
      || (forwarding.targetBinding.input as number) < 0) {
      throw new Error('delegate forwarding constructor target binding is inconsistent');
    }
    target = canonicalHex(
      constructorArgs[forwarding.targetBinding.input as number],
      'delegate forwarding constructor target',
    );
  } else if (forwarding.targetBinding.kind === 'literal') {
    exactKeys(forwarding.target, ['kind'], 'delegate forwarding target');
    exactKeys(forwarding.targetBinding, ['kind', 'lockingBytecode'], 'delegate forwarding target binding');
    if (forwarding.target.kind !== 'literal') {
      throw new Error('delegate forwarding literal target binding is inconsistent');
    }
    target = canonicalHex(forwarding.targetBinding.lockingBytecode, 'delegate forwarding literal target');
  } else {
    throw new Error('delegate forwarding target binding is unsupported');
  }

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
  let cursor = 4;
  for (const input of visibleInputs) {
    const decoded = decodePushdataValue(payload, cursor, input.type, structs);
    args.push(decoded.value as FunctionArgument);
    cursor += decoded.bytesConsumed;
  }
  if (cursor !== payload.length) {
    throw new Error('delegate forwarding payload has trailing or non-canonical implementation arguments');
  }
  const encoded = args.map((argument, index) =>
    encodeFunctionArgument(argument, visibleInputs[index]!.type, structs));
  if (encoded.some((argument) => !(argument instanceof Uint8Array))) {
    throw new Error('delegate forwarding payload cannot carry a detached transaction signature');
  }
  const canonicalPayload = concat(hexToBin(selector), scriptToBytecode(encoded as Uint8Array[]));
  if (!sameBytes(canonicalPayload, payload)) {
    throw new Error('delegate forwarding payload is not the canonical implementation ABI encoding');
  }

  const transcript = concat(
    hexToBin('4b444631'), // `KDF1`
    uint16(binding.participantInputIndex), uint16(binding.participantOutputIndex),
    uint16(binding.executorInputIndex),
    framed(hexToBin(binding.ownerLockingBytecode)), hexToBin(binding.stateCategory),
    framed(hexToBin(binding.executorLockingBytecode)), hexToBin(selector), framed(payload),
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
  if (!sameBytes(requestedPayload, forwardedCalldata)) {
    throw new Error('delegate forwarding request does not match the proxy payload');
  }
  return resolved;
}
