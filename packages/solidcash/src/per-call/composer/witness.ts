/**
 * Witness assembly.
 *
 * A master carries its whole witness block as the first push of its own unlocking bytecode, followed by the
 * function's argument pushes and its redeem script. A validator carries its transcript as the first push,
 * followed by its redeem script. Both are encoded with the frozen composition codecs, so a program that re-reads
 * its own first push sees exactly the block its witnesses were built from.
 */

import { encodeDataPush } from '@bitauth/libauth';
import {
  type CallRecord,
  type FrameKindValue,
  type RecordEntry,
  type Transcript,
  type WitnessBlock,
  buildMasterUnlockingBytecode,
  buildValidatorUnlockingBytecode,
} from '@solidcash/utils';

/** The three values every frame carries, before the transaction-wide references are resolved. */
export interface FrameWitness {
  readonly kind: FrameKindValue;
  readonly sender: Uint8Array;
  readonly self: Uint8Array;
  readonly value: bigint;
}

/** Everything a master's witness block holds. */
export interface MasterWitnessInput {
  readonly frame: FrameWitness;
  /** Input index of the caller: a signed P2PKH input for a root, otherwise the caller's master. */
  readonly callerRef: number;
  /** Input index of the root user's signed input, which is `tx.origin` for this execution. */
  readonly originRef: number;
  /** Input index of the covering validator, or `INDEX_NONE` when the execution is standalone. */
  readonly validatorRef: number;
  /** Calls made, in execution order. */
  readonly calls: readonly CallRecord[];
  /** The value returned, in the canonical result encoding; empty when the function returns nothing. */
  readonly retval: Uint8Array;
  /** One entry list per segment; `segments.length === calls.length + 1`. */
  readonly segments: readonly (readonly RecordEntry[])[];
  readonly events: readonly number[];
  readonly sends: readonly number[];
  /** The function's argument pushes, in parameter order. */
  readonly argumentPushes: readonly Uint8Array[];
  /** The master's redeem script: the category pin followed by the contract code. */
  readonly redeemScript: Uint8Array;
}

/** A master's assembled witness: the block, and the unlocking bytecode that introduces it. */
export interface MasterWitness {
  readonly block: WitnessBlock;
  readonly unlockingBytecode: Uint8Array;
}

/** Builds a master's witness block and unlocking bytecode from its resolved participants. */
export function assembleMasterWitness(input: MasterWitnessInput): MasterWitness {
  const block: WitnessBlock = {
    kind: input.frame.kind,
    callerRef: input.callerRef,
    originRef: input.originRef,
    validatorRef: input.validatorRef,
    sender: input.frame.sender,
    self: input.frame.self,
    value: input.frame.value,
    retval: input.retval,
    calls: [...input.calls],
    segments: input.segments.map((segment) => [...segment]),
    events: [...input.events],
    sends: [...input.sends],
  };
  return {
    block,
    unlockingBytecode: buildMasterUnlockingBytecode(block, input.argumentPushes, input.redeemScript),
  };
}

/** Everything a validator's unlocking bytecode holds. */
export interface ValidatorWitnessInput {
  readonly transcript: Transcript;
  /** The validator's redeem script: the category pin followed by the validator program. */
  readonly redeemScript: Uint8Array;
}

/** A validator's assembled witness: the transcript, and the unlocking bytecode that introduces it. */
export interface ValidatorWitness {
  readonly transcript: Transcript;
  readonly unlockingBytecode: Uint8Array;
}

/** Builds a validator's unlocking bytecode: the transcript push, then its redeem script. */
export function assembleValidatorWitness(input: ValidatorWitnessInput): ValidatorWitness {
  return {
    transcript: input.transcript,
    unlockingBytecode: buildValidatorUnlockingBytecode(input.transcript, input.redeemScript, encodeDataPush),
  };
}
