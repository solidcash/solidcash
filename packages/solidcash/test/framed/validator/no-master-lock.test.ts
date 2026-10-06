/**
 * A structural property of the derivation: masters are identified by category and minting capability only, never by
 * their locking bytecode.
 *
 * The validator program identifies a master by category and capability rather than by its locking bytecode, which
 * must reach the same decision whether a master sits at `P2SH32(code_X)`, at a loader lock, or at a different lock
 * per master. The test drives the derivation twice — and once more with a distinct lock per master — over the same
 * composition and requires byte-identical decisions, with a non-rejecting baseline so the equality is not one of two
 * rejections.
 */

import { describe, expect, test } from 'vitest';
import { validatorAddress } from '@solidcash/utils';
import {
  contractLockOf,
  materialise,
  planComposition,
  seedBytes,
  type Composition,
  type CompositionPlan,
} from './fixture.js';
import { abbaComposition, abbaPlan, singleContractPlan } from './plans.js';
import { decideBoth, disagreement, VALIDATOR_TEMPLATE } from './harness.js';

/** The same plan with every contract's masters at `lock`. */
function withMasterLock(plan: CompositionPlan, lock: Uint8Array): CompositionPlan {
  return { ...plan, contracts: plan.contracts.map((contract) => ({ ...contract, masterLock: lock })) };
}

/** The indices of the inputs that are masters, in the composition's own order. */
function masterInputIndices(composition: Composition): number[] {
  return composition.inputs
    .map((input, index) => (input.master === undefined ? -1 : index))
    .filter((index) => index >= 0);
}

/** Moves every master — input and the output that recreates it — to `locks[i]`. */
function placeMastersAt(composition: Composition, locks: readonly Uint8Array[]): void {
  for (const [at, index] of masterInputIndices(composition).entries()) {
    const lock = locks[at]!;
    composition.inputs[index]!.lockingBytecode = lock;
    composition.outputs[index] = { ...composition.outputs[index]!, lockingBytecode: lock };
  }
}

describe('masters are identified by category and minting capability only', () => {
  test('the derivation decides identically under two different master locks', () => {
    const contract = abbaComposition().inputs[0]!.lockingBytecode;
    const loader = contractLockOf(seedBytes('loader-code', 12));
    const other = contractLockOf(seedBytes('a-second-loader-code', 12));

    // The locks really are different, and neither is the contract's own or its derived address.
    expect(loader).not.toEqual(contract);
    expect(other).not.toEqual(contract);
    expect(other).not.toEqual(loader);
    const category = abbaComposition().inputs[0]!.token.category;
    const address = validatorAddress(category, VALIDATOR_TEMPLATE);
    expect(loader).not.toEqual(address);

    const asDeployed = planComposition(abbaPlan());
    const underLoader = planComposition(withMasterLock(abbaPlan(), loader));
    const underOther = planComposition(withMasterLock(abbaPlan(), other));

    const first = decideBoth(materialise(asDeployed), asDeployed.validatorIndex);
    const second = decideBoth(materialise(underLoader), underLoader.validatorIndex);
    const third = decideBoth(materialise(underOther), underOther.validatorIndex);

    expect(first.derivation.accepted).toBe(true);
    expect(disagreement(first)).toBeUndefined();
    expect(disagreement(second)).toBeUndefined();
    expect(disagreement(third)).toBeUndefined();
    expect(second.derivation).toEqual(first.derivation);
    expect(third.derivation).toEqual(first.derivation);
  });

  test('the derivation decides identically with a distinct lock per master', () => {
    const baseline = planComposition(singleContractPlan());
    const baselineDecision = decideBoth(materialise(baseline), baseline.validatorIndex).derivation;
    expect(baselineDecision.accepted).toBe(true);

    const composition = planComposition(singleContractPlan());
    const locks = masterInputIndices(composition)
      .map((index) => contractLockOf(seedBytes(`loader-code-for-${index}`, 12)));
    placeMastersAt(composition, locks);
    const decisions = decideBoth(materialise(composition), composition.validatorIndex);

    expect(disagreement(decisions)).toBeUndefined();
    expect(decisions.derivation).toEqual(baselineDecision);
    // Every master really moved.
    for (const index of masterInputIndices(composition)) {
      expect(composition.inputs[index]!.lockingBytecode).not.toEqual(baseline.inputs[index]!.lockingBytecode);
    }
  });
});
