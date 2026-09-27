import { describe, expect, test } from 'vitest';
import { FrameKind } from '@solidcash/utils';
import { accepted, laidOut } from './validator-machine.js';
import { materialise, selectorOf, type CompositionPlan } from '../validator/fixture.js';
import { abbaPlan } from '../validator/plans.js';

/**
 * The shipped validator program accepts two roots entered by one signed input.
 *
 * A root frame's `callerRef` names the signed user input that entered it, and both master and validator bind the
 * frame to that input's lock. Nothing ties one signed input to one root: a second root may name the same input, so
 * one signature authorizes both executions. This is the documented residual while call records are not receipts —
 * the outputs are signed, so the effects are fixed, and a wallet must decode every master's witness to show the
 * calls made in the user's name. The case records the acceptance, so adopting receipts later flips it to a refusal.
 *
 * The reference `A.f -> B.g -> A.k -> B.g -> A.f` composition is the faithful spend beside it.
 */
describe('the shipped validator program lets one signed input enter more than one root', () => {
  test('accepts the reference composition, so the acceptance below is not an accident of the fixture', () => {
    const composition = laidOut(abbaPlan());
    expect(accepted(materialise(composition), composition.validatorIndex)).toBe(true);
  });

  test('accepts an extra root that names an already-used signed input', () => {
    const plan: CompositionPlan = {
      ...abbaPlan(),
      masters: [
        ...abbaPlan().masters,
        {
          id: 'A.enter',
          contract: 'A',
          kind: FrameKind.ROOT,
          // `U` is the user that already entered `A.f`; both roots resolve to the same signed input.
          caller: 'U',
          selector: selectorOf('enter'),
          args: [],
          children: [],
          segments: [{ touches: [] }],
          retval: new Uint8Array(0),
        },
      ],
    };
    const composition = laidOut(plan);
    // The two roots really name one input, so it is one signature authorizing both executions.
    expect(composition.blocks.get('A.enter')!.callerRef).toBe(composition.blocks.get('A.f')!.callerRef);
    expect(accepted(materialise(composition), composition.validatorIndex)).toBe(true);
  });
});
