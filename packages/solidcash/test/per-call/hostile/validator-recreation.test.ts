import { describe, expect, test } from 'vitest';
import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import { TokenCapability, type PerCallTransaction as ModelledTransaction } from '@solidcash/utils';
import { accepted, expectRefusal, reference } from './validator-machine.js';
import { categoryOf, masterTokenShape, mutableTokenShape } from '../validator/fixture.js';

/**
 * The shipped validator program refusing a validator whose output does not recreate it, and one with no master of
 * its own category, at the machine.
 */
describe('the shipped validator program recreates the validator and finds a master of its category', () => {
  test('accepts the reference composition, so every refusal below is the program refusing real bytes', () => {
    const { transaction, index } = reference();
    expect(accepted(transaction, index)).toBe(true);
  });

  test('refuses a validator whose output does not recreate it', () => {
    const { transaction, index } = reference();
    const category = transaction.inputs[index]!.token.category;
    const tampered: ModelledTransaction = {
      ...transaction,
      outputs: transaction.outputs.map((output) => (output.index === index
        ? {
          ...output,
          lockingBytecode: encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(0x77)),
          token: mutableTokenShape(categoryOf('elsewhere'), output.token.nftCommitment),
        }
        : output)),
    };
    expectRefusal(tampered, index, 'V1_VALIDATOR_OUTPUT_NOT_RECREATED');
  });

  test('refuses a validator whose output is worth less than its input', () => {
    const { transaction, index } = reference();
    const tampered: ModelledTransaction = {
      ...transaction,
      outputs: transaction.outputs.map((output) => (output.index === index
        ? { ...output, value: transaction.inputs[index]!.value - 1n }
        : output)),
    };
    expectRefusal(tampered, index, 'V1_VALIDATOR_OUTPUT_VALUE_DECREASED');
  });

  test('refuses a transaction with no master of the validator\'s category', () => {
    const { transaction, index } = reference();
    const elsewhere = categoryOf('no-master-here');
    const tampered: ModelledTransaction = {
      ...transaction,
      inputs: transaction.inputs.map((input) => (input.token.capability === TokenCapability.MINTING
        ? { ...input, token: masterTokenShape(elsewhere) }
        : input)),
    };
    expectRefusal(tampered, index, 'V1_NO_MASTER_OF_OWN_CATEGORY');
  });

  test('refuses a transaction with no output at the validator\'s own index', () => {
    const { transaction, index } = reference();
    // Outputs are addressed by position, so the array has to end before the validator's own index.
    const tampered: ModelledTransaction = { ...transaction, outputs: transaction.outputs.slice(0, index) };
    expectRefusal(tampered, index, 'V1_VALIDATOR_OUTPUT_MISSING');
  });
});
