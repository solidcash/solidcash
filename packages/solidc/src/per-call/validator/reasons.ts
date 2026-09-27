/**
 * The checks a validator decides, and the named reasons it can reject with.
 *
 * Checks run in the spec's order V1-V11 and the first rejection stops the derivation, exactly as the on-chain
 * program fails at its first unsatisfied requirement. A decision reports every check: the ones that were accepted,
 * the one that rejected (with a reason and the offending index), and the ones the derivation never reached.
 */

/** The checks of spec section 7.2, named as the spec names them. */
export type ValidatorCheck =
  | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9' | 'V10' | 'V11';

/** Every check, in the order the derivation runs them. */
export const VALIDATOR_CHECKS: readonly ValidatorCheck[] = [
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11',
];

/** The named rejection reasons. One name per distinct rule that can fail. */
export const ValidatorReason = {
  // V1: the validator input itself.
  V1_VALIDATOR_INPUT_MISSING: 'V1_VALIDATOR_INPUT_MISSING',
  V1_VALIDATOR_NOT_A_MUTABLE_NFT: 'V1_VALIDATOR_NOT_A_MUTABLE_NFT',
  V1_VALIDATOR_OUTPUT_MISSING: 'V1_VALIDATOR_OUTPUT_MISSING',
  V1_VALIDATOR_OUTPUT_NOT_RECREATED: 'V1_VALIDATOR_OUTPUT_NOT_RECREATED',
  V1_VALIDATOR_OUTPUT_VALUE_DECREASED: 'V1_VALIDATOR_OUTPUT_VALUE_DECREASED',
  V1_NO_MASTER_OF_OWN_CATEGORY: 'V1_NO_MASTER_OF_OWN_CATEGORY',

  // V2: parsing the transcript and every covered master's witness block.
  V2_VALIDATOR_UNLOCKING_MALFORMED: 'V2_VALIDATOR_UNLOCKING_MALFORMED',
  V2_VALIDATOR_REDEEM_SCRIPT_MISMATCH: 'V2_VALIDATOR_REDEEM_SCRIPT_MISMATCH',
  V2_VALIDATOR_LOCK_NOT_DERIVED: 'V2_VALIDATOR_LOCK_NOT_DERIVED',
  V2_TRANSCRIPT_MALFORMED: 'V2_TRANSCRIPT_MALFORMED',
  V2_ROOT_INDEX_OUT_OF_RANGE: 'V2_ROOT_INDEX_OUT_OF_RANGE',
  V2_MASTER_INDEX_OUT_OF_RANGE: 'V2_MASTER_INDEX_OUT_OF_RANGE',
  V2_STATE_INPUT_INDEX_OUT_OF_RANGE: 'V2_STATE_INPUT_INDEX_OUT_OF_RANGE',
  V2_MASTER_WITNESS_BLOCK_MALFORMED: 'V2_MASTER_WITNESS_BLOCK_MALFORMED',

  // V3: completeness.
  V3_DUPLICATE_MASTER: 'V3_DUPLICATE_MASTER',
  V3_MASTERS_MISSING: 'V3_MASTERS_MISSING',
  V3_MASTER_NOT_POINTING_HERE: 'V3_MASTER_NOT_POINTING_HERE',

  // V4: roots and the forest they seed.
  V4_DUPLICATE_ROOT: 'V4_DUPLICATE_ROOT',
  V4_ROOT_MISSING: 'V4_ROOT_MISSING',
  V4_ROOT_NOT_A_ROOT: 'V4_ROOT_NOT_A_ROOT',
  V4_ROOT_INPUT_MISSING: 'V4_ROOT_INPUT_MISSING',
  V4_ROOT_CALLER_NOT_P2PKH: 'V4_ROOT_CALLER_NOT_P2PKH',
  V4_ROOT_ORIGIN_MISMATCH: 'V4_ROOT_ORIGIN_MISMATCH',
  V4_NON_ROOT_CALLER_NOT_A_MASTER: 'V4_NON_ROOT_CALLER_NOT_A_MASTER',

  // V5: edges.
  V5_CALLEE_NOT_A_MASTER: 'V5_CALLEE_NOT_A_MASTER',
  V5_CALLEE_CALL_DATA_MALFORMED: 'V5_CALLEE_CALL_DATA_MALFORMED',
  V5_CALLER_MISMATCH: 'V5_CALLER_MISMATCH',
  V5_KIND_MISMATCH: 'V5_KIND_MISMATCH',
  V5_ORIGIN_MISMATCH: 'V5_ORIGIN_MISMATCH',
  V5_VALUE_MISMATCH: 'V5_VALUE_MISMATCH',
  V5_SENDER_MISMATCH: 'V5_SENDER_MISMATCH',
  V5_SELF_NOT_TARGET: 'V5_SELF_NOT_TARGET',
  V5_SELF_NOT_CALLER_SELF: 'V5_SELF_NOT_CALLER_SELF',
  V5_DELEGATE_TARGET_MISMATCH: 'V5_DELEGATE_TARGET_MISMATCH',
  V5_INTERNAL_CATEGORY_MISMATCH: 'V5_INTERNAL_CATEGORY_MISMATCH',
  V5_CONTEXT_UNRESOLVED: 'V5_CONTEXT_UNRESOLVED',
  V5_CONTEXT_NOT_SETTLED: 'V5_CONTEXT_NOT_SETTLED',
  V5_RETVAL_MISMATCH: 'V5_RETVAL_MISMATCH',
  V5_ARGS_HASH_MISMATCH: 'V5_ARGS_HASH_MISMATCH',
  V5_MASTER_UNREACHED_BY_A_CALL: 'V5_MASTER_UNREACHED_BY_A_CALL',
  V5_MASTER_CALLED_TWICE: 'V5_MASTER_CALLED_TWICE',

  // V6: the derived execution order.
  V6_MASTER_VISITED_TWICE: 'V6_MASTER_VISITED_TWICE',
  V6_MASTER_UNREACHABLE: 'V6_MASTER_UNREACHABLE',

  // V7: settlement.
  V7_SETTLE_CATEGORY_DUPLICATE: 'V7_SETTLE_CATEGORY_DUPLICATE',
  V7_MASTER_NOT_COVERED: 'V7_MASTER_NOT_COVERED',
  V7_STATE_INPUTS_MISMATCH: 'V7_STATE_INPUTS_MISMATCH',
  V7_TOUCHED_RECORDS_MISMATCH: 'V7_TOUCHED_RECORDS_MISMATCH',
  V7_CHAIN_START_MISMATCH: 'V7_CHAIN_START_MISMATCH',
  V7_CHAIN_BROKEN: 'V7_CHAIN_BROKEN',
  V7_CHAIN_END_MISMATCH: 'V7_CHAIN_END_MISMATCH',
  V7_CHAIN_MIDDLE_DELETE: 'V7_CHAIN_MIDDLE_DELETE',
  V7_RECORD_OUTPUT_NOT_A_RECORD: 'V7_RECORD_OUTPUT_NOT_A_RECORD',
  V7_CENSUS_MINTING_NOT_RECREATED: 'V7_CENSUS_MINTING_NOT_RECREATED',
  V7_CENSUS_UNEXPECTED_MUTABLE: 'V7_CENSUS_UNEXPECTED_MUTABLE',
  V7_CENSUS_UNEXPECTED_IMMUTABLE: 'V7_CENSUS_UNEXPECTED_IMMUTABLE',
  V7_CENSUS_OWN_FUNGIBLE: 'V7_CENSUS_OWN_FUNGIBLE',
  V7_EVENT_OUTPUT_OUT_OF_RANGE: 'V7_EVENT_OUTPUT_OUT_OF_RANGE',
  V7_EVENT_OUTPUT_SHARED: 'V7_EVENT_OUTPUT_SHARED',
  V7_SEND_OUTPUT_OUT_OF_RANGE: 'V7_SEND_OUTPUT_OUT_OF_RANGE',
  V7_RECORD_VALUE_DECREASED: 'V7_RECORD_VALUE_DECREASED',

  // V8: which contracts the validator settles.
  V8_SETTLE_NOT_REQUIRED: 'V8_SETTLE_NOT_REQUIRED',
  V8_SETTLE_REQUIRED_MISSING: 'V8_SETTLE_REQUIRED_MISSING',

  // V9: owner policy.
  V9_NO_ROOT: 'V9_NO_ROOT',
  V9_ROOT_CATEGORY_MISMATCH: 'V9_ROOT_CATEGORY_MISMATCH',

  // V10: read-only frames.
  V10_STATIC_RECORD_CHANGED: 'V10_STATIC_RECORD_CHANGED',
  V10_STATIC_EVENT: 'V10_STATIC_EVENT',
  V10_STATIC_SEND: 'V10_STATIC_SEND',
  V10_STATIC_VALUE_CALL: 'V10_STATIC_VALUE_CALL',
  V10_STATIC_NON_STATIC_CALL: 'V10_STATIC_NON_STATIC_CALL',

  // V11: addresses.
  V11_SELF_NOT_CONTRACT_ADDRESS: 'V11_SELF_NOT_CONTRACT_ADDRESS',
} as const;

/** One named reason. */
export type ValidatorReasonName = (typeof ValidatorReason)[keyof typeof ValidatorReason];

/** How one check ended. */
export type CheckStatus = 'accepted' | 'rejected' | 'notReached';

/** One check's outcome. */
export interface CheckOutcome {
  readonly check: ValidatorCheck;
  readonly status: CheckStatus;
  /** A named reason, present only when the check rejected. */
  readonly reason?: ValidatorReasonName;
  /** The offending input or output index, when the rule names one. */
  readonly index?: number;
  /** A human-readable note, for diagnostics. */
  readonly detail?: string;
}

/** The first rejection, with the check that raised it. */
export interface ValidatorRejection {
  readonly check: ValidatorCheck;
  readonly reason: ValidatorReasonName;
  readonly index?: number;
  readonly detail?: string;
}

/** One step of the derived execution order: a segment of one master. */
export interface ExecutionStep {
  readonly master: number;
  readonly segment: number;
}

/** The structured decision. */
export interface ValidatorDecision {
  readonly accepted: boolean;
  /** Present exactly when `accepted` is false. */
  readonly rejection?: ValidatorRejection;
  /** One entry per check, in V1-V11 order. */
  readonly outcomes: readonly CheckOutcome[];
  /** The derived execution order, present once V6 accepted. */
  readonly order?: readonly ExecutionStep[];
}
