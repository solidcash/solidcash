import { describe, expect, test } from 'vitest';
import { hash256, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import type { PerCallTransaction as ModelledTransaction, TokenShape } from '@solidcash/utils';
import { accepted, decisionOf, laidOut } from './validator-machine.js';
import {
  categoryOf, emptyToken, masterTokenShape, materialise, mutableTokenShape, seedBytes,
} from '../validator/fixture.js';
import { abbaPlan, singleContractPlan } from '../validator/plans.js';

/**
 * An input whose lock no frame settles.
 *
 * The input set is the transaction's, not any frame's: a transcript names the inputs its own rules are about, and
 * a builder may append one that is outside every contract's reach. Such an input belongs to nobody the machine
 * speaks for — its lock is not a contract address the program derives, and the token it carries (none, or one no
 * contract of the composition owns) is not a fact any rule reads. Every script in the composition ignores it, so
 * the derivation accepts the transcript and the machine accepts every input it runs.
 *
 * This is by construction, not a hole: a builder-authored input no rule claims grants the builder nothing. It must
 * be funded by the builder and spent under its owner's own signature, and no covenant in the composition reads it,
 * so it can move no covenant's value or state. The test pins the accepted transcript for two shapes of such an
 * input on the reference composition and on the one-contract composition, so a later change that starts refusing
 * one is caught. The boundary is stated too: an input that *does* carry a category the composition settles is
 * refused, because the settlement's spent state UTXOs are exactly the ones its transcript lists.
 */

const STRANGER = categoryOf('input outside every frame');

/** A lock the program derives for no contract: P2SH32 over code no block hosts. */
const UNSETTLED_LOCK = encodeLockingBytecodeP2sh32(hash256(seedBytes('lock no frame settles', 8)));

/** The reference composition with one more input appended that no frame settles. */
function appended(plan: ReturnType<typeof abbaPlan> | ReturnType<typeof singleContractPlan>, token: TokenShape): {
  transaction: ModelledTransaction;
  index: number;
} {
  const composition = laidOut(plan);
  const modelled = materialise(composition);
  const index = modelled.inputs.length;
  const transaction: ModelledTransaction = {
    ...modelled,
    inputs: [
      ...modelled.inputs,
      {
        index,
        value: 5_000n,
        lockingBytecode: UNSETTLED_LOCK,
        unlockingBytecode: new Uint8Array([0x51]),
        token,
        outpointTransactionHash: seedBytes(`outpoint:unsettled:${index}`, 32),
        outpointIndex: 0,
      },
    ],
  };
  return { transaction, index: composition.validatorIndex };
}

describe('an input whose lock no frame settles', () => {
  for (const [label, plan] of [
    ['the reference composition', abbaPlan()],
    ['the one-contract composition', singleContractPlan()],
  ] as const) {
    test(`accepts a tokenless one appended to ${label}: a builder-authored input no rule claims`, () => {
      const composition = laidOut(plan);
      const reference = materialise(composition);
      const { transaction, index } = appended(plan, emptyToken());

      // The derivation accepts the transcript, and the machine accepts every input the validator program runs.
      expect(decisionOf(transaction, index).accepted).toBe(true);
      expect(accepted(transaction, index)).toBe(true);
      // The appended input changed nothing else: the transcript is the accepted one plus that input.
      expect(transaction.outputs).toStrictEqual(reference.outputs);
      expect(transaction.inputs.slice(0, reference.inputs.length)).toStrictEqual(reference.inputs);
      expect(transaction.inputs).toHaveLength(reference.inputs.length + 1);
    });

    test(`accepts one carrying a stranger's minting token appended to ${label}`, () => {
      const composition = laidOut(plan);
      const reference = materialise(composition);
      const { transaction, index } = appended(plan, masterTokenShape(STRANGER));

      // No contract of the composition owns the stranger's category, so no rule is about it either.
      expect(decisionOf(transaction, index).accepted).toBe(true);
      expect(accepted(transaction, index)).toBe(true);
      expect(transaction.outputs).toStrictEqual(reference.outputs);
      expect(transaction.inputs.slice(0, reference.inputs.length)).toStrictEqual(reference.inputs);
    });
  }

  test('refuses an appended input that carries a category the reference composition settles', () => {
    // The boundary of the property: a rule that decides a settlement's spent state UTXOs does claim an input of a
    // settled contract's category, so the same append is refused when its token is one of those records.
    const composition = laidOut(abbaPlan());
    const reference = materialise(composition);
    const index = composition.validatorIndex;
    const transaction: ModelledTransaction = {
      ...reference,
      inputs: [
        ...reference.inputs,
        {
          index: reference.inputs.length,
          value: 5_000n,
          lockingBytecode: UNSETTLED_LOCK,
          unlockingBytecode: new Uint8Array([0x51]),
          token: mutableTokenShape(categoryOf('A'), seedBytes('unsettled record', 6)),
          outpointTransactionHash: seedBytes('outpoint:unsettled:settled', 32),
          outpointIndex: 0,
        },
      ],
    };

    expect(decisionOf(transaction, index).rejection?.reason).toBe('V7_STATE_INPUTS_MISMATCH');
    expect(accepted(transaction, index)).toBe(false);
  });
});
