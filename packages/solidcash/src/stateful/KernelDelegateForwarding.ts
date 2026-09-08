import type { DelegateForwardingAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';

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
