/**
 * The golden composition of spec section 5 (`A -> B -> B -> A`), laid out exactly as section 5.1 lays it out, plus a
 * smaller composition that exercises a created record, a read-only frame, an event and a value send.
 *
 * The golden case is the one composition the spec walks end to end, so its acceptance, its derived order and its
 * indices are all asserted.
 */

import { describe, expect, test } from 'vitest';
import { FrameKind } from '@solidcash/utils';
import { abbaComposition, singleContractPlan } from './plans.js';
import { planComposition, materialise } from './fixture.js';
import { decideBoth, disagreement, describeOrder } from './harness.js';

describe('golden composition', () => {
  test('ABBA is accepted by both models, with the order section 8 derives', () => {
    const composition = abbaComposition();
    const both = decideBoth(materialise(composition), composition.validatorIndex);

    expect(disagreement(both)).toBeUndefined();
    expect(both.derivation.accepted).toBe(true);
    expect(both.derivation.outcomes.map((outcome) => outcome.check)).toEqual([
      'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11',
    ]);
    expect(both.derivation.outcomes.every((outcome) => outcome.status === 'accepted')).toBe(true);

    // Section 8: `(0,0), (4,0), (1,0), (4,1), (0,1)`.
    expect(describeOrder(both.derivation.order)).toBe(describeOrder(both.reference.order));
    expect(both.derivation.order?.map((step) => [step.master, step.segment])).toEqual([
      [0, 0], [4, 0], [1, 0], [4, 1], [0, 1],
    ]);
  });

  test('ABBA is laid out as section 5.1 lays it out', () => {
    const composition = abbaComposition();
    expect(composition.validatorIndex).toBe(2);
    expect(composition.masterIndex.get('A.f')).toBe(0);
    expect(composition.masterIndex.get('A.k')).toBe(1);
    expect(composition.masterIndex.get('B.g')).toBe(4);
    expect(composition.slotIndex.get('DA')).toBe(3);
    expect(composition.slotIndex.get('DB')).toBe(5);
    // One validator covering the masters of A and B: B's single master is covered because its frame is a call.
    expect(composition.transcript.roots).toEqual([0]);
    expect([...composition.transcript.masters].sort((left, right) => left - right)).toEqual([0, 1, 4]);
    expect(composition.transcript.settles.map((settled) => settled.stateInputs)).toEqual([[3]]);
  });

  test('a composition with a created record, a static frame and a send is accepted by both', () => {
    const plan = singleContractPlan();
    const composition = planComposition(plan);
    const both = decideBoth(materialise(composition), composition.validatorIndex);

    expect(disagreement(both)).toBeUndefined();
    expect(both.derivation.accepted).toBe(true);
    expect(both.derivation.outcomes.every((outcome) => outcome.status === 'accepted')).toBe(true);
    expect(both.derivation.order?.map((step) => step.segment)).toEqual([0, 0, 1]);
    expect(plan.masters[1]!.kind).toBe(FrameKind.STATIC);
  });
});
