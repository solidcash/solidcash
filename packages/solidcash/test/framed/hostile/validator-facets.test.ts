import { describe, expect, test } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import { concatBytes, encodeTranscript, type Transcript } from '@solidcash/utils';
import type { FramedTransaction as ModelledTransaction } from '../../../../solidc/src/framed/validator/index.js';
import { accepted, decisionOf, inputAccepted, reference } from './validator-machine.js';
import { categoryOf, emptyToken, mutableTokenShape, seedBytes, userLockOf } from '../validator/fixture.js';
import { validatorSpend } from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * The validator's head holds the facet it binds (spec section 24).
 *
 * The head requires the input and the output at `head + 1` to be the facet's lock, the output worth at least the
 * input, and the facet reads the transcript from the input below it. So a facet can be neither dropped nor drained,
 * nor made to check another transcript than the one its head runs. Each case mutates the reference composition,
 * whose head and facet both accept. The derivation knows no facets, so where it accepts, the binding refuses.
 */

/** The reference composition, and its transcript with a settle the composition does not need. */
function setting(): {
  transaction: ModelledTransaction;
  index: number;
  honest: Transcript;
  hostile: Transcript;
  redeem: Uint8Array;
} {
  const { composition, transaction, index } = reference();
  const honest = composition.transcript;
  // `B` has one master, which settles its own record, so only the facet's settle rule objects to settling it here.
  const extra = { category: categoryOf('B'), stateInputs: [composition.slotIndex.get('DB')!] };
  const hostile = { ...honest, settles: [...honest.settles, extra] };
  return { transaction, index, honest, hostile, redeem: composition.inputs[index]!.validator!.redeemScript };
}

/** The transaction with the head spent by the given pushes, its redeem script last. */
function headSpending(transaction: ModelledTransaction, index: number, pushes: readonly Uint8Array[]): ModelledTransaction {
  const unlockingBytecode = concatBytes(pushes.map((push) => encodeDataPush(push)));
  return {
    ...transaction,
    inputs: transaction.inputs.map((input) => (input.index === index ? { ...input, unlockingBytecode } : input)),
  };
}

describe('the shipped validator head holds the facet it binds', () => {
  test('accepts the reference composition, its facet at head + 1', () => {
    const { transaction, index } = reference();
    expect(accepted(transaction, index)).toBe(true);
  });

  test('refuses a facet whose output is not its recreation', () => {
    const { transaction, index } = reference();
    const facet = index + 1;
    const tampered: ModelledTransaction = {
      ...transaction,
      outputs: transaction.outputs.map((output) => (output.index === facet
        ? { ...output, lockingBytecode: userLockOf('facet spent away') }
        : output)),
    };
    expect(decisionOf(tampered, index).accepted).toBe(true);
    expect(inputAccepted(tampered, index)).toBe(false);
  });

  test('refuses a facet recreated with less value than it held', () => {
    const { transaction, index } = reference();
    const facet = index + 1;
    const tampered: ModelledTransaction = {
      ...transaction,
      outputs: transaction.outputs.map((output) => (output.index === facet
        ? { ...output, value: transaction.inputs[facet]!.value - 1n }
        : output)),
    };
    expect(decisionOf(tampered, index).accepted).toBe(true);
    expect(inputAccepted(tampered, index)).toBe(false);
  });

  test('refuses, at the facet alone, a transcript settling a contract that needs no settlement', () => {
    // The premise of the two cases below: the head accepts this transcript and only its facet refuses it.
    const { transaction, index, hostile, redeem } = setting();
    const spent = headSpending(transaction, index, [encodeTranscript(hostile), redeem]);
    expect(decisionOf(spent, index).rejection?.reason).toBe('V8_SETTLE_NOT_REQUIRED');
    expect(inputAccepted(spent, index)).toBe(true);
    expect(inputAccepted(spent, index + 1)).toBe(false);
  });

  test('refuses a head whose facet was moved to read another head\'s transcript', () => {
    // The head runs that transcript, and the facet is moved behind another validator's head carrying the honest one,
    // its own slot taken by a plain input. The moved facet accepts what it reads; the head refuses, its slot empty.
    // With the facet left in its slot, the same transaction is refused by the facet instead.
    const { transaction, index, honest, hostile, redeem } = setting();
    const facet = index + 1;
    const decoy = transaction.inputs.length;
    const other = categoryOf('another head');
    const second = validatorSpend(other, honest);
    const spent = headSpending(transaction, index, [encodeTranscript(hostile), redeem]);
    const withFacetSlot = (slot: ModelledTransaction['inputs'][number]): ModelledTransaction => ({
      inputs: [
        ...spent.inputs.map((input) => (input.index === facet ? slot : input)),
        {
          ...spent.inputs[index]!,
          index: decoy,
          lockingBytecode: second.lock,
          unlockingBytecode: second.unlockingBytecode,
          token: mutableTokenShape(other, seedBytes('validator:another head', 8)),
          outpointTransactionHash: seedBytes('outpoint:another head', 32),
        },
        { ...spent.inputs[facet]!, index: decoy + 1, outpointTransactionHash: seedBytes('outpoint:moved facet', 32) },
      ],
      outputs: [...spent.outputs, { ...spent.outputs[facet]!, index: decoy + 1 }],
    });

    const kept = withFacetSlot(spent.inputs[facet]!);
    expect(inputAccepted(kept, index)).toBe(true);
    expect(inputAccepted(kept, facet)).toBe(false);

    const moved = withFacetSlot({
      ...spent.inputs[facet]!,
      lockingBytecode: userLockOf('facet slot'),
      unlockingBytecode: concatBytes([encodeDataPush(seedBytes('sig', 65)), encodeDataPush(seedBytes('pub', 33))]),
      token: emptyToken(),
    });
    expect(inputAccepted(moved, decoy + 1)).toBe(true);
    expect(inputAccepted(moved, index)).toBe(false);
  });

  test('refuses a head whose unlocking carries another transcript ahead of the one it runs', () => {
    // A facet reads the first push of its head's unlocking bytecode, and the head runs on the push its redeem script
    // follows. An honest transcript pushed first is what the facet checks and accepts, while the head runs the one
    // only a facet refuses; the machine refuses the head for the extra item its run leaves on the stack.
    const { transaction, index, honest, hostile, redeem } = setting();
    const spent = headSpending(transaction, index, [encodeTranscript(honest), encodeTranscript(hostile), redeem]);
    expect(inputAccepted(spent, index + 1)).toBe(true);
    expect(inputAccepted(spent, index)).toBe(false);
  });
});
