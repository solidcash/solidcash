/**
 * The composition validator's pure derivation.
 *
 * Given a parsed transaction (inputs with locking bytecode, token facts, commitments and unlocking bytecode, and
 * outputs likewise) and the validator program's own template bytes, `decideValidator` decides checks V1-V11 and
 * reports each one. The transaction model lives here so the derivation can be exercised without a VM.
 */

export {
  categoryKey,
  hasCategory,
  inputAt,
  isImmutableNft,
  isMasterToken,
  isMintingNft,
  isMutableNft,
  isP2pkhLock,
  noToken,
  outputAt,
  sameCategory,
  tokenShape,
  type InputView,
  type OutputView,
  type PerCallTransaction,
  type TokenShape,
  type ValidatorContext,
} from './model.js';

export {
  CheckFailure,
  decodeWitnessBlockPayload,
  isValidatorInput,
  readCallData,
  readValidator,
  readWitnessBlock,
  splitPushes,
  type CallData,
  type ParsedValidator,
} from './reading.js';

export { decideValidator, VALIDATOR_CHECKS } from './decide.js';

export {
  ValidatorReason,
  type CheckOutcome,
  type CheckStatus,
  type ExecutionStep,
  type ValidatorCheck,
  type ValidatorDecision,
  type ValidatorReasonName,
  type ValidatorRejection,
} from './reasons.js';
