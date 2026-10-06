import { describe, expect, test } from 'vitest';
import { accepted, expectRefusal, laidOut } from './validator-machine.js';
import { materialise, seedBytes } from '../validator/fixture.js';
import { singleContractPlan } from '../validator/plans.js';

/**
 * The shipped validator program refusing a read-only frame that changes a record or emits an event, at the machine.
 * A transcript that settles one category twice and a read-only frame that pays an output are refused in
 * `validator/script.test.ts`.
 */
describe('the shipped validator program holds read-only frames to their rules', () => {
  test('accepts the composition with a read-only frame its refusals below are built on', () => {
    const composition = laidOut(singleContractPlan());
    expect(accepted(materialise(composition), composition.validatorIndex)).toBe(true);
  });

  test('refuses a read-only frame that changes a record it reads', () => {
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const slot = composition.slotIndex.get('S')!;
    const changed = seedBytes('changed:S', 6);
    // The read-only frame leaves a new commitment; the segment after it and the record's output follow, so the
    // chain is whole and only the read-only rule objects.
    composition.blocks.get('A.more')!.segments[0]!.find((entry) => entry.in === slot)!.viewOut = changed;
    const after = composition.blocks.get('A.go')!.segments[1]!.find((entry) => entry.in === slot)!;
    after.viewIn = changed;
    after.viewOut = changed;
    composition.outputs[slot] = {
      ...composition.outputs[slot]!, token: { ...composition.outputs[slot]!.token, nftCommitment: changed },
    };
    expectRefusal(materialise(composition), index, 'V10_STATIC_RECORD_CHANGED');
  });

  test('refuses a read-only frame that emits an event', () => {
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('A.more')!.events = [composition.outputs.length - 1];
    expectRefusal(materialise(composition), index, 'V10_STATIC_EVENT');
  });
});
