import { describe, expect, test } from 'vitest';
import { accepted, decisionOf, laidOut } from './validator-machine.js';
import { materialise } from '../validator/fixture.js';
import { singleContractPlan } from '../validator/plans.js';

/**
 * The send list a master's witness block carries.
 *
 * A send entry is one output index the frame paid, and the block lists them in the order the execution made them.
 * The validator's rules are about the indices themselves: two frames may not list one output (`V7_SEND_OUTPUT_SHARED`)
 * and an index must name an output (`V7_SEND_OUTPUT_OUT_OF_RANGE`), and the value a send pays enters the contract's
 * own conservation rule (spec 4b). Which output a send *is* — its recipient lock and the value the body computed —
 * is only in the body that made it, which pins both at the listed index; the composer refuses a send that shares an
 * output with a record or an event before any transaction is built (composer/settlement.test.ts's occupancy rules).
 *
 * This case mutates exactly the send index in the assembled spend. The one-contract composition has a frame that
 * sends, and its send output is the one the fixture placed; the range and sharing rules are what the refusal below
 * pins, and `V7_SEND_OUTPUT_OUT_OF_RANGE` is worth noting: it is a derivation reason the shipped program does not
 * name (see `VALIDATOR_PROGRAM_REASONS`), so the on-chain refusal at that index is the program's own read failing
 * rather than the rule being emitted.
 */
describe('the send list a frame carries', () => {
  test('accepts the composition whose send names the output the fixture placed', () => {
    const composition = laidOut(singleContractPlan());
    const modelled = materialise(composition);
    const block = composition.blocks.get('A.go')!;
    expect(block.sends).toHaveLength(1);
    expect(decisionOf(modelled, composition.validatorIndex).accepted).toBe(true);
    expect(accepted(modelled, composition.validatorIndex)).toBe(true);
  });

  test('refuses a send that names no output of the transaction', () => {
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('A.go')!.sends = [materialise(composition).outputs.length + 3];
    const modelled = materialise(composition);
    expect(decisionOf(modelled, index).rejection?.reason).toBe('V7_SEND_OUTPUT_OUT_OF_RANGE');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses two sends that name one output', () => {
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const block = composition.blocks.get('A.go')!;
    block.sends = [block.sends[0]!, block.sends[0]!];
    const modelled = materialise(composition);
    expect(decisionOf(modelled, index).rejection?.reason).toBe('V7_SEND_OUTPUT_SHARED');
    expect(accepted(modelled, index)).toBe(false);
  });
});
