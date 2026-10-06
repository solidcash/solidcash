import { describe, expect, test } from 'vitest';
import { accepted, expectRefusal, laidOut } from './validator-machine.js';
import { materialise } from '../validator/fixture.js';
import { ABBA_COMMITMENTS, abbaPlan } from '../validator/plans.js';

/**
 * The shipped validator program refuses a record declaration that reads the record at a view it no longer holds.
 *
 * A frame declares, per segment, the commitment a record holds when the segment starts and the one it leaves. The
 * declarations have to chain along the derived execution order: the first starts at the commitment the transaction
 * spends, each later one carries on from the view the one before it left, and the last writes the commitment the
 * transaction writes. Declaring a read at a value an intervening write has already passed is a stale view, so the
 * chain does not carry on from the declaration before it.
 *
 * The reference `A.f -> B.g -> A.k -> B.g -> A.f` composition is the faithful spend below, and `A.k` writes record
 * `DA` between `A.f`'s two segments, so a stale read of `DA` in `A.f`'s last segment shows up.
 */
describe('the shipped validator program refuses a stale record view', () => {
  test('accepts the reference composition, so the refusal below is not a malformed frame', () => {
    const composition = laidOut(abbaPlan());
    expect(accepted(materialise(composition), composition.validatorIndex)).toBe(true);
  });

  test('refuses a declaration that reads a record back before the write it passed', () => {
    // `A.f`'s last segment runs after `A.k` wrote `DA`. Declaring its read at the value from before that write is a
    // stale view: the segment claims to start where `A.f`'s first segment ended, so it continues from nothing the
    // declaration before it left.
    const composition = laidOut(abbaPlan());
    const block = composition.blocks.get('A.f')!;
    block.segments[1]![0]!.viewIn = ABBA_COMMITMENTS.countAfterIncrement;
    expectRefusal(materialise(composition), composition.validatorIndex, 'V7_CHAIN_BROKEN');
  });
});
