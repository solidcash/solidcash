import { describe, expect, test } from 'vitest';
import type { PerCallTransaction as ModelledTransaction, TokenShape } from '@solidcash/utils';
import { accepted, decisionOf, laidOut } from './validator-machine.js';
import {
  categoryOf, emptyToken, masterTokenShape, materialise, mutableTokenShape, seedBytes, userLockOf,
} from '../validator/fixture.js';
import { abbaPlan } from '../validator/plans.js';

/**
 * Inputs the plan does not know about, appended to the assembled spend.
 *
 * The parts of a composition outside the witnesses are the builder's too: the input set is the transaction's, and a
 * transcript names only the inputs its own rules are about. This case appends one extra input at a time to the
 * reference composition and asks whether anything refuses it:
 *
 * - a second state UTXO of a contract the transcript settles is refused, because a settlement's spent state UTXOs
 *   are exactly the ones it lists (`V7_STATE_INPUTS_MISMATCH`, carried by the shipped program);
 * - a second minting input of a settled contract is refused, because that contract's masters are the covered set
 *   (`V7_MASTER_NOT_COVERED`, carried by the shipped program);
 * - an input carrying a mutable token of a contract the transcript does not settle, an input carrying another
 *   contract's minting token, and a tokenless input are all accepted, which is the finding this file records: no
 *   script in the transaction pins the input set itself. The only bound on it is the user's own signature, which
 *   commits to every input under `SIGHASH_ALL` (the fixture's signatures are filler, so the machine cannot show it).
 *
 * The reference `A.f -> B.g -> A.k -> B.g -> A.f` composition, where `A` has two masters and is settled while `B`
 * has one and is not, is the spend these are appended to.
 */

const FOREIGN = categoryOf('unsolicited input foreign');

/** One more input the plan does not list, described by the token it carries. */
function appended(modelled: ModelledTransaction, token: TokenShape): ModelledTransaction {
  const index = modelled.inputs.length;
  return {
    ...modelled,
    inputs: [
      ...modelled.inputs,
      {
        index,
        value: 5_000n,
        // A stranger's input: a user lock, with the filler spend the fixture's users carry.
        lockingBytecode: userLockOf(`extra:${index}`),
        unlockingBytecode: new Uint8Array([0x51]),
        token,
        outpointTransactionHash: seedBytes(`outpoint:extra:${index}`, 32),
        outpointIndex: 0,
      },
    ],
  };
}

describe('an input the plan does not list', () => {
  test('accepts the reference composition, so the verdicts below are about the extra input', () => {
    const composition = laidOut(abbaPlan());
    const modelled = materialise(composition);
    expect(decisionOf(modelled, composition.validatorIndex).accepted).toBe(true);
    expect(accepted(modelled, composition.validatorIndex)).toBe(true);
  });

  test('refuses a second state UTXO of a settled contract', () => {
    const composition = laidOut(abbaPlan());
    const modelled = appended(
      materialise(composition), mutableTokenShape(categoryOf('A'), seedBytes('extra-record', 6)),
    );
    const decision = decisionOf(modelled, composition.validatorIndex);
    expect(decision.rejection?.reason).toBe('V7_STATE_INPUTS_MISMATCH');
    expect(accepted(modelled, composition.validatorIndex)).toBe(false);
  });

  test('refuses a second minting input of a settled contract', () => {
    const composition = laidOut(abbaPlan());
    const modelled = appended(materialise(composition), masterTokenShape(categoryOf('A')));
    const decision = decisionOf(modelled, composition.validatorIndex);
    expect(decision.rejection?.reason).toBe('V7_MASTER_NOT_COVERED');
    expect(accepted(modelled, composition.validatorIndex)).toBe(false);
  });

  test('accepts a state UTXO of a contract the transcript does not settle: no rule refuses it', () => {
    // `B` has one master and is a context no frame borrows, so the transcript does not settle it. Nothing in the
    // transaction requires `B`'s records to be settled here, so the extra one passes: a finding, not a defect of
    // these bytes. Bounds on it come from outside the scripts (the signed input).
    const composition = laidOut(abbaPlan());
    const modelled = appended(
      materialise(composition), mutableTokenShape(categoryOf('B'), seedBytes('extra-b-record', 6)),
    );
    expect(decisionOf(modelled, composition.validatorIndex).accepted).toBe(true);
    expect(accepted(modelled, composition.validatorIndex)).toBe(true);
  });

  test('accepts a stranger contract\'s minting input: no rule refuses it', () => {
    // A master of some other contract is not a master of anything the transcript covers, and nothing else reads the
    // input set. A finding.
    const composition = laidOut(abbaPlan());
    const modelled = appended(materialise(composition), masterTokenShape(FOREIGN));
    expect(accepted(modelled, composition.validatorIndex)).toBe(true);
  });

  test('accepts a tokenless input: no rule refuses it', () => {
    // Plain BCH added to the transaction changes no token fact any rule is about. A finding.
    const composition = laidOut(abbaPlan());
    const modelled = appended(materialise(composition), emptyToken());
    expect(decisionOf(modelled, composition.validatorIndex).accepted).toBe(true);
    expect(accepted(modelled, composition.validatorIndex)).toBe(true);
  });
});
