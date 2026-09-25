/**
 * Reading a transaction the way a validator program reads it.
 *
 * The program finds its own transcript as the first push of its input's unlocking bytecode, and reads every covered
 * master's witness block the same way. Both are push-only by consensus, so this module splits push prefixes rather
 * than scanning for opcodes: the split is the VM's.
 *
 * A callee's call data sits between its witness block push and its redeem script push. The first push of that
 * region is the 4-byte dispatcher selector and the rest are the argument pushes, which is what `argsHash` hashes.
 * The spec states the hash (`SHA256(selector || args)`) but not the byte placement of the selector; this is the
 * placement today's SDK already emits and the one the frozen `argsHash(selector, argumentPushes)` helper implies.
 */

import {
  PerCallEncodingError,
  bytesEqual,
  decodeTranscript,
  decodeWitnessBlock,
  splitFirstPush,
  validatorAddress,
  validatorRedeemScript,
  type Transcript,
  type WitnessBlock,
} from '@solidcash/utils';
import { hasCategory, isMutableNft, type InputView, type PerCallTransaction, type ValidatorContext } from './model.js';
import { ValidatorReason, type ValidatorCheck, type ValidatorReasonName } from './reasons.js';

/** A named rejection raised inside the derivation, carrying the check that raised it. */
export class CheckFailure extends Error {
  constructor(
    readonly check: ValidatorCheck,
    readonly reason: ValidatorReasonName,
    readonly index?: number,
    readonly detail?: string,
  ) {
    super(`${check}: ${reason}${index === undefined ? '' : ` (index ${index})`}`);
    this.name = 'CheckFailure';
  }
}

/**
 * Decodes a master's witness block.
 *
 * The layout is section 16's, field for field: a call record is
 * `kind:u8 target:lp16 value:u64 calleeRef:u16 argsHash:32 result:lp32`. This decoder is written here because the
 * frozen codec's `decodeWitnessBlock` reads a call record as `kind, calleeRef, target, value, ...`, which is
 * neither the order its own encoder writes nor the order section 16 states, so it cannot read back a version 1
 * block that contains a call (`packages/utils/src/per-call/witness-block.ts`, encoder lines 130-137 against decoder
 * lines 174-191). Every other part of the frozen interface is used as it stands.
 */
/**
 * Decodes a master's witness block by delegating to the frozen codec.
 *
 * One decoder exists for this format. A second implementation inside a consumer is what lets a master's own reading
 * of its block drift from the reading a validator applies to the same bytes, which is precisely the divergence the
 * format is designed to make impossible, so consumers call the codec rather than restating its layout.
 */
export function decodeWitnessBlockPayload(payload: Uint8Array): WitnessBlock {
  return decodeWitnessBlock(payload);
}

/** Splits a push-only unlocking bytecode into its pushes. A non-push opcode is a rejection. */
export function splitPushes(unlockingBytecode: Uint8Array): Uint8Array[] {
  const pushes: Uint8Array[] = [];
  let rest = unlockingBytecode;
  while (rest.length > 0) {
    const { payload, rest: next } = splitFirstPush(rest);
    pushes.push(payload);
    rest = next;
  }
  return pushes;
}

/** Decodes an input's witness block, or returns undefined when its first push is not one. */
export function readWitnessBlock(input: InputView): WitnessBlock | undefined {
  try {
    return decodeWitnessBlockPayload(splitFirstPush(input.unlockingBytecode).payload);
  } catch (error) {
    if (error instanceof PerCallEncodingError) return undefined;
    throw error;
  }
}

/** The selector and argument pushes a master's unlocking bytecode carries. */
export interface CallData {
  readonly selector: Uint8Array;
  /** The argument pushes as bytes: each argument's minimal push, concatenated. This is what `argsHash` hashes. */
  readonly argumentPushes: Uint8Array;
}

/**
 * The call data of the master at `index`.
 *
 * A callee's unlocking bytecode is `<witness block> <selector> <argument pushes> <redeem script>`. The selector is
 * the payload of the push after the witness block, and the argument pushes are the bytes between the selector and
 * the redeem script, exactly as section 17 states them ("the concatenation of each argument's minimal push"): a
 * value pushed as `OP_3` contributes the opcode, not the one-byte `0x03`, so the bytes are taken from the unlocking
 * bytecode rather than re-encoded from decoded payloads.
 */
export function readCallData(transaction: PerCallTransaction, index: number): CallData {
  const input = transaction.inputs[index];
  const unlocking = input === undefined ? new Uint8Array(0) : input.unlockingBytecode;
  let selector: Uint8Array;
  let cursor: Uint8Array;
  try {
    // The witness block, then the selector push.
    const witness = splitFirstPush(unlocking);
    const afterWitness = splitFirstPush(witness.rest);
    selector = afterWitness.payload;
    cursor = afterWitness.rest;
  } catch (error) {
    if (error instanceof PerCallEncodingError) {
      throw new CheckFailure('V5', ValidatorReason.V5_CALLEE_CALL_DATA_MALFORMED, index, error.message);
    }
    throw error;
  }
  if (selector.length !== 4) {
    throw new CheckFailure('V5', ValidatorReason.V5_CALLEE_CALL_DATA_MALFORMED, index);
  }

  const frameLengths: number[] = [];
  let rest = cursor;
  try {
    while (rest.length > 0) {
      const next = splitFirstPush(rest);
      frameLengths.push(rest.length - next.rest.length);
      rest = next.rest;
    }
  } catch (error) {
    if (error instanceof PerCallEncodingError) {
      throw new CheckFailure('V5', ValidatorReason.V5_CALLEE_CALL_DATA_MALFORMED, index, error.message);
    }
    throw error;
  }
  // The last frame is the redeem script; everything before it is the argument pushes.
  if (frameLengths.length < 1) {
    throw new CheckFailure('V5', ValidatorReason.V5_CALLEE_CALL_DATA_MALFORMED, index);
  }
  const argumentLength = frameLengths.slice(0, -1).reduce((total, length) => total + length, 0);
  return { selector, argumentPushes: cursor.subarray(0, argumentLength) };
}

/** A parsed validator input: its own category, transcript and redeem script. */
export interface ParsedValidator {
  readonly input: InputView;
  readonly category: Uint8Array;
  readonly transcript: Transcript;
  readonly redeemScript: Uint8Array;
}

/**
 * Parses the validator input itself: its own category, the transcript as the first push of its unlocking bytecode,
 * and `pin(category) || V_TEMPLATE` as its redeem script. Its lock must be the address that script derives, which is
 * what P2SH32 consensus guarantees on chain.
 */
export function readValidator(transaction: PerCallTransaction, context: ValidatorContext): ParsedValidator {
  const input = transaction.inputs[context.validatorInputIndex];
  const index = context.validatorInputIndex;
  if (input === undefined) {
    throw new CheckFailure('V2', ValidatorReason.V2_VALIDATOR_UNLOCKING_MALFORMED, index);
  }
  const category = input.token.category;
  const expectedRedeem = validatorRedeemScript(category, context.validatorTemplate);
  const expectedLock = validatorAddress(category, context.validatorTemplate);

  let pushes: Uint8Array[];
  try {
    pushes = splitPushes(input.unlockingBytecode);
  } catch (error) {
    if (error instanceof PerCallEncodingError) {
      throw new CheckFailure('V2', ValidatorReason.V2_VALIDATOR_UNLOCKING_MALFORMED, index, error.message);
    }
    throw error;
  }
  if (pushes.length !== 2) {
    throw new CheckFailure('V2', ValidatorReason.V2_VALIDATOR_UNLOCKING_MALFORMED, index);
  }
  const redeemScript = pushes[1]!;
  if (!bytesEqual(redeemScript, expectedRedeem)) {
    throw new CheckFailure('V2', ValidatorReason.V2_VALIDATOR_REDEEM_SCRIPT_MISMATCH, index);
  }
  if (!bytesEqual(input.lockingBytecode, expectedLock)) {
    throw new CheckFailure('V2', ValidatorReason.V2_VALIDATOR_LOCK_NOT_DERIVED, index);
  }

  let transcript: Transcript;
  try {
    transcript = decodeTranscript(pushes[0]!);
  } catch (error) {
    if (error instanceof PerCallEncodingError) {
      throw new CheckFailure('V2', ValidatorReason.V2_TRANSCRIPT_MALFORMED, index, error.message);
    }
    throw error;
  }
  return { input, category, transcript, redeemScript };
}

/**
 * Whether an input is a validator: it holds a mutable NFT with a category, its unlocking bytecode is a transcript
 * push followed by the pinned program, and its lock is the address that program derives. A state UTXO is not one,
 * because its unlocking bytecode is a single push.
 */
export function isValidatorInput(input: InputView, template: Uint8Array): boolean {
  const token = input.token;
  if (!hasCategory(token) || !isMutableNft(token)) return false;
  let pushes: Uint8Array[];
  try {
    pushes = splitPushes(input.unlockingBytecode);
  } catch {
    return false;
  }
  if (pushes.length !== 2) return false;
  if (!bytesEqual(pushes[1]!, validatorRedeemScript(token.category, template))) return false;
  return bytesEqual(input.lockingBytecode, validatorAddress(token.category, template));
}
