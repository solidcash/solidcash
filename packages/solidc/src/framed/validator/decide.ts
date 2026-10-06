/**
 * The composition validator's decision procedure.
 *
 * `decideValidator` runs V1-V11 in the spec's order against a parsed transaction and the validator program's own
 * bytes. The first check that rejects stops the derivation, exactly as the program fails at its first unsatisfied
 * requirement, and the decision reports every check: accepted, rejected with a named reason and an offending index,
 * or never reached. Nothing here touches a VM, a network or a filesystem.
 */

import { inputAt, type FramedTransaction, type ValidatorContext } from './model.js';
import {
  checkV1,
  checkV10,
  checkV11,
  checkV2,
  checkV3,
  checkV4,
  checkV5,
  checkV6,
  checkV7,
  checkV8,
  checkV9,
  createDerivationState,
  type DerivationState,
} from './checks.js';
import { CheckFailure } from './reading.js';
import {
  VALIDATOR_CHECKS,
  type CheckOutcome,
  type ValidatorCheck,
  type ValidatorDecision,
  type ValidatorRejection,
} from './reasons.js';

const PROCEDURE: ReadonlyArray<readonly [ValidatorCheck, (state: DerivationState) => void]> = [
  ['V1', checkV1],
  ['V2', checkV2],
  ['V3', checkV3],
  ['V4', checkV4],
  ['V5', checkV5],
  ['V6', checkV6],
  ['V7', checkV7],
  ['V8', checkV8],
  ['V9', checkV9],
  ['V10', checkV10],
  ['V11', checkV11],
];

/**
 * Decides V1-V11 for one validator input of one transaction.
 *
 * `context.validatorInputIndex` is the input the program runs on (`OP_INPUTINDEX`), so the caller states which
 * validator it is asking about.
 */
export function decideValidator(
  transaction: FramedTransaction,
  context: ValidatorContext,
): ValidatorDecision {
  const state = createDerivationState(transaction, context);
  state.validatorInput = inputAt(transaction, context.validatorInputIndex);
  const outcomes: CheckOutcome[] = [];

  for (const [index, [name, run]] of PROCEDURE.entries()) {
    try {
      run(state);
      outcomes.push({ check: name, status: 'accepted' });
    } catch (error) {
      if (!(error instanceof CheckFailure)) throw error;
      const failure = error as CheckFailure;
      outcomes.push({
        check: name,
        status: 'rejected',
        reason: failure.reason,
        index: failure.index,
        detail: failure.detail,
      });
      for (const [rest] of PROCEDURE.slice(index + 1)) {
        outcomes.push({ check: rest, status: 'notReached' });
      }
      const rejection: ValidatorRejection = {
        check: name,
        reason: failure.reason,
        index: failure.index,
        detail: failure.detail,
      };
      return { accepted: false, rejection, outcomes, order: state.order };
    }
  }

  return { accepted: true, outcomes, order: state.order };
}

export { VALIDATOR_CHECKS };
