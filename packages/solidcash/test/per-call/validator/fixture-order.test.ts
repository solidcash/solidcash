import { describe, expect, it } from 'vitest';
import { singleContractPlan, abbaPlan } from './plans.js';
import { materialise, planComposition, type CompositionPlan } from './fixture.js';

/**
 * The fixture's transaction lists are in index order.
 *
 * `materialise` gives each output the position it occupies in the list rather than the index the fixture allocated,
 * so a list that is not sorted by index would silently hand the machine one output's content under another's index.
 * That is what a check reading `OP_OUTPUTVALUE` would then see.
 */
const layouts: Array<{ name: string; plan: CompositionPlan }> = [
  { name: 'single-contract', plan: singleContractPlan() },
  { name: 'reference', plan: abbaPlan() },
];

describe('the fixture transaction lists', () => {
  for (const { name, plan } of layouts) {
    it(`lists the ${name} composition's outputs in index order`, () => {
      const composition = planComposition(plan);
      const indexes = composition.outputs.map((output) => output.index);
      expect(indexes).toStrictEqual([...indexes].sort((left, right) => left - right));
      expect(new Set(indexes).size).toBe(indexes.length);
    });

    it(`lists the ${name} composition's inputs in index order`, () => {
      const composition = planComposition(plan);
      const indexes = composition.inputs.map((input) => input.index);
      expect(indexes).toStrictEqual([...indexes].sort((left, right) => left - right));
    });
  }

  it('puts each frame\'s send value at the index the frame lists', () => {
    // The value a check reads for a send is the transaction's, so the fixture and the transaction must agree.
    const plan = singleContractPlan();
    const composition = planComposition(plan);
    const modelled = materialise(composition);
    const sends = composition.blocks.get('A.go')!.sends;
    const planned = plan.sendValues!['A.go']!;
    expect(sends.length).toBe(planned.length);
    for (const [at, index] of sends.entries()) {
      expect(modelled.outputs[index]!.value).toBe(planned[at]);
    }
  });
});
