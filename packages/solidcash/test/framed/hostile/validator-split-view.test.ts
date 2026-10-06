import { describe, expect, test } from 'vitest';
import type { FramedTransaction as ModelledTransaction } from '../../../../solidc/src/framed/validator/index.js';
import { accepted, expectRefusal, laidOut } from './validator-machine.js';
import { categoryOf, materialise, mutableTokenShape, seedBytes } from '../validator/fixture.js';
import { abbaPlan } from '../validator/plans.js';
import { validatorSpend } from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * The shipped validator program keeps one contract inside one validator.
 *
 * A master names the validator that covers it, and a transcript lists exactly the masters that name it. A builder
 * that hands one contract's masters to two validators leaves each validator with a master it lists that does not
 * point at it, so the contract's view is not split: the validator that still lists the master refuses it.
 *
 * The reference `A.f -> B.g -> A.k -> B.g -> A.f` composition, where `A` has two masters, is the faithful spend
 * below. The attack adds a second validator for `A` and points `A.k` at it, so `A`'s view would span both.
 */
describe('the shipped validator program keeps one contract inside one validator', () => {
  test('accepts the reference composition, so the refusal below is not a malformed frame', () => {
    const composition = laidOut(abbaPlan());
    expect(accepted(materialise(composition), composition.validatorIndex)).toBe(true);
  });

  test('refuses a contract whose masters are split across two validators', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const leaf = composition.masterIndex.get('A.k')!;
    const category = categoryOf('A');
    // The second validator sits at the contract's address, carries its category, and lists the master the first
    // validator already lists. Only the master's own `validatorRef` moves, so the first validator's listing is what
    // no longer matches the set of masters that point at it. It is appended, so every other index is untouched.
    const secondIndex = composition.inputs.length;
    composition.blocks.get('A.k')!.validatorRef = secondIndex;
    const modelled = materialise(composition);
    const second = validatorSpend(category, { roots: [], masters: [leaf], settles: [] });
    const withSecondValidator: ModelledTransaction = {
      ...modelled,
      inputs: [
        ...modelled.inputs,
        {
          index: secondIndex,
          value: 10_000n,
          lockingBytecode: second.lock,
          unlockingBytecode: second.unlockingBytecode,
          token: mutableTokenShape(category, seedBytes('second-validator:A', 8)),
          outpointTransactionHash: seedBytes(`outpoint:${secondIndex}`, 32),
          outpointIndex: 0,
        },
      ],
    };
    expectRefusal(withSecondValidator, index, 'V3_MASTER_NOT_POINTING_HERE');
  });
});
