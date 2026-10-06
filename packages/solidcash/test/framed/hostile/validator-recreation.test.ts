import { describe, expect, test } from 'vitest';
import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import type { FramedTransaction as ModelledTransaction } from '../../../../solidc/src/framed/validator/index.js';
import { accepted, expectRefusal, reference } from './validator-machine.js';
import { categoryOf, mutableTokenShape } from '../validator/fixture.js';

/**
 * The shipped validator program refusing a validator whose output does not recreate it, or that has no output at
 * its own index, at the machine. A decreased value and a transaction with no master of the validator's category are
 * refused in `validator/script.test.ts`.
 */
describe('the shipped validator program recreates the validator', () => {
  test('accepts the reference composition, so every refusal below is the program refusing real bytes', () => {
    const { transaction, index } = reference();
    expect(accepted(transaction, index)).toBe(true);
  });

  test('refuses a validator whose output does not recreate it', () => {
    const { transaction, index } = reference();
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

  test('refuses a transaction with no output at the validator\'s own index', () => {
    const { transaction, index } = reference();
    // Outputs are addressed by position, so the array has to end before the validator's own index.
    const tampered: ModelledTransaction = { ...transaction, outputs: transaction.outputs.slice(0, index) };
    expectRefusal(tampered, index, 'V1_VALIDATOR_OUTPUT_MISSING');
  });
});
