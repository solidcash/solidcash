/**
 * V5's argument digest over a callee whose pushes take each length form.
 *
 * The facet that weighs the call tree finds a callee's call data by walking the pushes past its witness block to the
 * last one, the redeem script, and hashes the selector and the argument pushes before it. A program longer than
 * 65,535 bytes, which a lifted stack item limit admits, is pushed with `OP_PUSHDATA4`. The walk read that opcode as a
 * one-byte push and ran on into the program, so the facet refused every call to such a callee: the EACC marketplace's
 * masters are about 77 and 91 kB. The machine here lifts the limit as that lane does.
 */

import { describe, expect, test } from 'vitest';
import {
  buildValidatorFacets,
  type FramedTransaction as ModelledTransaction,
} from '../../../../solidc/src/framed/validator/index.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { decisionOf, laidOut, toVm } from '../hostile/validator-machine.js';
import { materialise, seedBytes, type Composition } from './fixture.js';
import { abbaPlan } from './plans.js';

/** Past 65,535 bytes, so its push is `OP_PUSHDATA4`. */
const WIDE = 70_000;

const WIDE_PROGRAM = seedBytes('program:wide', WIDE);

const FACET_COUNT = buildValidatorFacets().length;

const vm = compositionMachine();

/**
 * The reference composition with its first callee's arguments and program replaced. The caller's record is laid out
 * over the arguments; the program is set after, since the fixture's master lock does not derive from it.
 */
function withCallee(
  args: readonly Uint8Array[] | undefined, program: Uint8Array,
): { composition: Composition; callee: number } {
  const plan = abbaPlan();
  const composition = laidOut({
    ...plan,
    masters: plan.masters.map((master) => (master.id === 'B.g' && args !== undefined ? { ...master, args } : master)),
  });
  const callee = composition.masterIndex.get('B.g')!;
  composition.inputs[callee]!.master!.redeemScript = program;
  return { composition, callee };
}

/** The validator inputs the machine refuses, by offset from the head: 0 for the head, `k` for facet `k`. */
function refusedOffsets(transaction: ModelledTransaction, head: number): number[] {
  const { transaction: spent, sourceOutputs } = toVm(transaction);
  const refused: number[] = [];
  for (let offset = 0; offset <= FACET_COUNT; offset += 1) {
    const state = vm.evaluate({ inputIndex: head + offset, sourceOutputs, transaction: spent });
    if (vm.stateSuccess(state) !== true) refused.push(offset);
  }
  return refused;
}

describe('V5: the argument digest over a callee whose pushes take each length form', () => {
  test.each([
    { shape: 'a program longer than 65,535 bytes', args: undefined, program: WIDE_PROGRAM },
    { shape: 'an argument over 255 bytes before that program', args: [seedBytes('arg:300', 300)], program: WIDE_PROGRAM },
    // The first scan reads 512 bytes, and the program's push opens at 510 with its length bytes past them.
    {
      shape: 'that program opening at the end of the first scan',
      args: [seedBytes('arg:502', 502)],
      program: WIDE_PROGRAM,
    },
    {
      shape: 'arguments past the first scan before that program',
      args: [seedBytes('arg:600', 600)],
      program: WIDE_PROGRAM,
    },
    {
      shape: 'an argument longer than 65,535 bytes',
      args: [seedBytes('arg:wide', WIDE)],
      program: seedBytes('program:24', 24),
    },
    {
      shape: 'a program and an argument over 255 bytes',
      args: [seedBytes('arg:300', 300)],
      program: seedBytes('program:4000', 4_000),
    },
  ])('accepts $shape', ({ args, program }) => {
    const { composition } = withCallee(args, program);
    const transaction = materialise(composition);
    const head = composition.validatorIndex;
    expect(decisionOf(transaction, head).accepted).toBe(true);
    expect(refusedOffsets(transaction, head)).toEqual([]);
  });

  test('refuses a push hidden between the arguments and a program longer than 65,535 bytes', () => {
    const { composition, callee } = withCallee(undefined, WIDE_PROGRAM);
    const master = composition.inputs[callee]!.master!;
    // The caller's record was laid out over the arguments alone.
    master.args = [...master.args, seedBytes('arg:hidden', 33)];
    const transaction = materialise(composition);
    const head = composition.validatorIndex;
    expect(decisionOf(transaction, head).rejection?.reason).toBe('V5_ARGS_HASH_MISMATCH');
    expect(refusedOffsets(transaction, head)).toEqual([1]);
  });
});
