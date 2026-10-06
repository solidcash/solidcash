/**
 * The differential harness: one transaction description, two real decision procedures.
 *
 * Nothing here re-implements a check. It hands the same transaction to the derivation (compiler package) and to the
 * reference model (SDK package) and reports whether they agree on the accept/reject outcome, on the check each
 * rejected with, and on the execution order they derived.
 */

import {
  decideValidator,
  type ExecutionStep,
  type FramedTransaction,
  type ValidatorDecision,
} from '../../../../solidc/src/framed/validator/index.js';
import {
  decideReference,
  type ReferenceDecision,
} from '../../../src/framed/validator/reference/index.js';
import { VALIDATOR_TEMPLATE } from './fixture.js';

/** The template the fixtures run against. */
export { VALIDATOR_TEMPLATE };

/** Both decisions for one transaction. */
export interface BothDecisions {
  readonly derivation: ValidatorDecision;
  readonly reference: ReferenceDecision;
  readonly validatorIndex: number;
}

/** Runs both modules over the same transaction. */
export function decideBoth(transaction: FramedTransaction, validatorIndex: number): BothDecisions {
  return {
    derivation: decideValidator(transaction, { validatorTemplate: VALIDATOR_TEMPLATE, validatorInputIndex: validatorIndex }),
    reference: decideReference(transaction, { validatorTemplate: VALIDATOR_TEMPLATE, validatorInputIndex: validatorIndex }),
    validatorIndex,
  };
}

/** A short, printable form of a step list. */
export function describeOrder(order: readonly ExecutionStep[] | undefined): string {
  if (order === undefined) return 'none';
  return order.map((step) => `(${step.master},${step.segment})`).join(' ');
}

/** How the two modules disagree, or undefined when they agree. */
export function disagreement(both: BothDecisions): string | undefined {
  const { derivation, reference } = both;
  if (derivation.accepted !== reference.accepted) {
    const where = derivation.accepted
      ? `the derivation accepted and the reference rejected with ${reference.check} (${reference.reason})`
      : `the derivation rejected with ${derivation.rejection?.check} (${derivation.rejection?.reason}) and the reference accepted`;
    return `accept/reject differs: ${where}`;
  }
  if (!derivation.accepted && !reference.accepted && derivation.rejection?.check !== reference.check) {
    return `rejection check differs: derivation ${derivation.rejection?.check} `
      + `(${derivation.rejection?.reason}) vs reference ${reference.check} (${reference.reason})`;
  }
  if (derivation.accepted && reference.accepted) {
    const left = describeOrder(derivation.order);
    const right = describeOrder(reference.order);
    if (left !== right) return `derived order differs: derivation ${left} vs reference ${right}`;
  }
  return undefined;
}

/** Requires both modules to agree, with a readable failure. */
export function requireAgreement(both: BothDecisions, what: string): void {
  const difference = disagreement(both);
  if (difference !== undefined) throw new Error(`${what}: ${difference}`);
}

/** The names of the checks a decision accepted, in order. */
export function acceptedChecks(decision: ValidatorDecision): string[] {
  return decision.outcomes.filter((outcome) => outcome.status === 'accepted').map((outcome) => outcome.check);
}
