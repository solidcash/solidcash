import { describe, expect, test } from 'vitest';
import { encodeTranscript } from '@solidcash/utils';
import { accepted, expectRefusal, laidOut, reference, withTranscript } from './validator-machine.js';
import { materialise, seedBytes } from '../validator/fixture.js';
import { abbaPlan, singleContractPlan } from '../validator/plans.js';

/**
 * The shipped validator program refusing a transcript that settles one category twice, and a read-only frame that
 * changes a record, emits an event or pays an output, at the machine.
 */
describe('the shipped validator program holds settlement and read-only frames to their rules', () => {
  test('accepts the reference composition, so every refusal below is the program refusing real bytes', () => {
    const { transaction, index } = reference();
    expect(accepted(transaction, index)).toBe(true);
  });

  test('accepts the composition with a read-only frame its refusals below are built on', () => {
    const composition = laidOut(singleContractPlan());
    expect(accepted(materialise(composition), composition.validatorIndex)).toBe(true);
  });

  test('refuses a transcript that settles the same category twice', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const transcript = composition.transcript;
    const first = transcript.settles[0]!;
    const tampered = withTranscript(composition, encodeTranscript({
      ...transcript,
      settles: [...transcript.settles, first],
    }));
    expectRefusal(tampered, index, 'V7_SETTLE_CATEGORY_DUPLICATE');
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
    composition.outputs[slot]!.token = { ...composition.outputs[slot]!.token, nftCommitment: changed };
    expectRefusal(materialise(composition), index, 'V10_STATIC_RECORD_CHANGED');
  });

  test('refuses a read-only frame that emits an event', () => {
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('A.more')!.events = [composition.outputs.length - 1];
    expectRefusal(materialise(composition), index, 'V10_STATIC_EVENT');
  });

  test('refuses a read-only frame that pays an output', () => {
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('A.more')!.sends = [composition.outputs.length - 1];
    expectRefusal(materialise(composition), index, 'V10_STATIC_SEND');
  });
});
