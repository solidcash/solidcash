import { describe, expect, test } from 'vitest';
import { accepted, decisionOf, laidOut } from './validator-machine.js';
import { categoryOf, materialise } from '../validator/fixture.js';
import { abbaPlan } from '../validator/plans.js';

/**
 * A validator transcript that settles a contract whose settlement nothing requires.
 *
 * A transcript states which contracts the validator settles, and V8 makes that list exactly the contracts that
 * need settling: one a covered master shares with another master, or one a delegate/internal frame runs on. An
 * entry for a contract that needs no settlement is refused off chain as `V8_SETTLE_NOT_REQUIRED`.
 *
 * The program now enforces the same rule: the validator's facet carries the converse of the membership walk
 * (`emitSettlementNecessity`), so a validator may no longer claim to settle a contract nothing needs it to settle.
 * This case pins that the derivation and the program refuse the same bytes.
 *
 * The reference `A.f -> B.g -> A.k -> B.g -> A.f` composition settles `A` (two masters) and not `B` (one), so an
 * entry for `B` is the mutation.
 */

describe('a transcript that settles a contract whose settlement nothing requires', () => {
  test('accepts the reference composition, so the entry below is the only difference', () => {
    const composition = laidOut(abbaPlan());
    const modelled = materialise(composition);
    expect(decisionOf(modelled, composition.validatorIndex).accepted).toBe(true);
    expect(accepted(modelled, composition.validatorIndex)).toBe(true);
  });

  test('is refused by the derivation and by the program: the facet enforces the rule', () => {
    const composition = laidOut(abbaPlan());
    // `B` has one master and no delegate frame borrows its records, so V8's needed set holds only `A`.
    const declared = composition.transcript.settles.map((entry) => Buffer.from(entry.category).toString('hex'));
    expect(declared).toStrictEqual([Buffer.from(categoryOf('A')).toString('hex')]);
    composition.transcript.settles = [
      ...composition.transcript.settles,
      { category: categoryOf('B'), stateInputs: [composition.slotIndex.get('DB')!] },
    ];
    const modelled = materialise(composition);

    expect(decisionOf(modelled, composition.validatorIndex).rejection?.reason).toBe('V8_SETTLE_NOT_REQUIRED');
    // The program refuses the same bytes: the facet's necessity walk rejects the extra settlement.
    expect(accepted(modelled, composition.validatorIndex)).toBe(false);
    expect(accepted(modelled, composition.validatorIndex + 1)).toBe(false);
  });
});
