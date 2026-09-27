import { describe, expect, test } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import { encodeTranscript, encodeWitnessBlock } from '@solidcash/utils';
import {
  accepted,
  expectRefusal,
  laidOut,
  reference,
  withMasterBlockPayload,
  withTranscript,
} from './validator-machine.js';
import { materialise } from '../validator/fixture.js';
import { abbaPlan } from '../validator/plans.js';

/**
 * The shipped validator program refusing a transcript it cannot read, or a master whose witness block it cannot.
 */
describe('the shipped validator program reads its own transcript and its covered witness blocks', () => {
  test('accepts the reference composition, so every refusal below is the program refusing real bytes', () => {
    const { transaction, index } = reference();
    expect(accepted(transaction, index)).toBe(true);
  });

  test('refuses a validator whose unlocking bytecode is not a transcript and its program', () => {
    const { composition, index } = reference();
    const modelled = materialise(composition);
    const redeem = composition.inputs[index]!.validator!.redeemScript;
    const tampered = {
      ...modelled,
      inputs: modelled.inputs.map((input) => (input.index === index
        ? { ...input, unlockingBytecode: encodeDataPush(redeem) }
        : input)),
    };
    expectRefusal(tampered, index, 'V2_VALIDATOR_UNLOCKING_MALFORMED');
  });

  test('refuses a validator whose program is not the one its address commits to', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.inputs[index]!.validator!.redeemScript = new Uint8Array([0x51]);
    expectRefusal(materialise(composition), index, 'V2_VALIDATOR_REDEEM_SCRIPT_MISMATCH');
  });

  test('refuses a validator whose lock is not the address of its program', () => {
    const { transaction, index } = reference();
    const wrong = encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(0x44));
    const tampered = {
      ...transaction,
      inputs: transaction.inputs.map((input) => (input.index === index ? { ...input, lockingBytecode: wrong } : input)),
      outputs: transaction.outputs.map((output) => (output.index === index ? { ...output, lockingBytecode: wrong } : output)),
    };
    expectRefusal(tampered, index, 'V2_VALIDATOR_LOCK_NOT_DERIVED');
  });

  test('refuses a transcript that does not carry the wire name and version', () => {
    const { composition, index } = reference();
    // The wire name, version and the rest, with the name replaced by bytes no decoder accepts.
    const garbage = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
    expectRefusal(withTranscript(composition, garbage), index, 'V2_TRANSCRIPT_MALFORMED');
  });

  test('refuses a root that names no input', () => {
    const { composition, index } = reference();
    const beyondTheEnd = composition.inputs.length + 3;
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      roots: [composition.transcript.roots[0]!, beyondTheEnd],
    }));
    expectRefusal(tampered, index, 'V2_ROOT_INDEX_OUT_OF_RANGE');
  });

  test('refuses a master that names no input', () => {
    const { composition, index } = reference();
    const beyondTheEnd = composition.inputs.length + 3;
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      masters: [beyondTheEnd, ...composition.transcript.masters],
    }));
    expectRefusal(tampered, index, 'V2_MASTER_INDEX_OUT_OF_RANGE');
  });

  test('refuses a covered master whose first push is not a witness block', () => {
    const { composition, index } = reference();
    const master = composition.transcript.masters[0]!;
    const modelled = materialise(composition);
    const tampered = {
      ...modelled,
      inputs: modelled.inputs.map((input) => (input.index === master
        ? { ...input, unlockingBytecode: encodeDataPush(new Uint8Array([0x01, 0x02, 0x03])) }
        : input)),
    };
    expectRefusal(tampered, index, 'V2_MASTER_WITNESS_BLOCK_MALFORMED');
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

  test('refuses a settled state input that names no input', () => {
    const { composition, index } = reference();
    const beyondTheEnd = composition.inputs.length + 3;
    const category = composition.transcript.settles[0]?.category ?? new Uint8Array(32).fill(0x11);
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      settles: [{ category, stateInputs: [beyondTheEnd] }],
    }));
    expectRefusal(tampered, index, 'V2_STATE_INPUT_INDEX_OUT_OF_RANGE');
  });
});
