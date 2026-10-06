import { describe, expect, test } from 'vitest';
import { encodeWitnessBlock } from '@solidcash/utils';
import { accepted, expectRefusal, reference, withMasterBlockPayload } from './validator-machine.js';

/**
 * The shipped validator program refusing a covered master's witness block with a byte after the frame it states,
 * or one cut short. The other transcript and witness-block refusals are in `validator/script.test.ts`, one per rule.
 */
describe('the shipped validator program reads its own transcript and its covered witness blocks', () => {
  test('accepts the reference composition, so every refusal below is the program refusing real bytes', () => {
    const { transaction, index } = reference();
    expect(accepted(transaction, index)).toBe(true);
  });

  test('refuses a witness block with a byte after the frame it states, or one cut short', () => {
    const { composition, index } = reference();
    const master = composition.transcript.masters[0]!;
    const encoded = encodeWitnessBlock(composition.inputs[master]!.master!.block);
    const trailing = withMasterBlockPayload(composition, master, new Uint8Array([...encoded, 0x00]));
    expectRefusal(trailing, index, 'V2_MASTER_WITNESS_BLOCK_MALFORMED');
    const truncated = withMasterBlockPayload(composition, master, encoded.subarray(0, encoded.length - 1));
    expectRefusal(truncated, index, 'V2_MASTER_WITNESS_BLOCK_MALFORMED');
  });
});
