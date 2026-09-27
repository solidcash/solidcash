import { describe, expect, test } from 'vitest';
import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import { FrameKind, encodeTranscript } from '@solidcash/utils';
import { accepted, expectRefusal, laidOut, reference, withTranscript } from './validator-machine.js';
import { materialise, selectorOf, type CompositionPlan } from '../validator/fixture.js';
import { abbaPlan, userPlan } from '../validator/plans.js';

/** The reference plan with a second user-entered root in the other contract. */
function twoRootPlan(): CompositionPlan {
  const base = abbaPlan();
  return {
    ...base,
    users: [...base.users, userPlan('U2')],
    masters: [
      ...base.masters,
      {
        id: 'B.enter',
        contract: 'B',
        kind: FrameKind.ROOT,
        caller: 'U2',
        selector: selectorOf('enter'),
        args: [],
        children: [],
        segments: [{ touches: [] }],
        retval: new Uint8Array(0),
      },
    ],
  };
}

/**
 * The shipped validator program refusing a transcript whose listed masters and roots do not match the covered
 * masters a user entered, at the machine.
 */
describe('the shipped validator program holds the transcript to the covered masters and roots', () => {
  test('accepts the reference composition, so every refusal below is the program refusing real bytes', () => {
    const { transaction, index } = reference();
    expect(accepted(transaction, index)).toBe(true);
  });

  test('accepts the two-root composition its root refusals below are built on', () => {
    const composition = laidOut(twoRootPlan());
    expect(accepted(materialise(composition), composition.validatorIndex)).toBe(true);
  });

  test('refuses a listed master that does not point at this validator', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.validatorRef = 0xffff;
    expectRefusal(materialise(composition), index, 'V3_MASTER_NOT_POINTING_HERE');
  });

  test('refuses a listed master that names a real input other than this validator', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const elsewhere = composition.slotIndex.get('DA')!;
    expect(elsewhere).not.toBe(index);
    composition.blocks.get('B.g')!.validatorRef = elsewhere;
    expectRefusal(materialise(composition), index, 'V3_MASTER_NOT_POINTING_HERE');
  });

  test('refuses a minting input that points here but the transcript does not list', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const listed = composition.transcript.masters;
    expect(listed.length).toBeGreaterThan(1);
    const tampered = withTranscript(composition, encodeTranscript({ ...composition.transcript, masters: listed.slice(1) }));
    expectRefusal(tampered, index, 'V3_MASTERS_MISSING');
  });

  test('refuses a master the transcript lists twice', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const listed = composition.transcript.masters;
    const tampered = withTranscript(composition, encodeTranscript({ ...composition.transcript, masters: [listed[0]!, ...listed] }));
    expectRefusal(tampered, index, 'V3_DUPLICATE_MASTER');
  });

  test('refuses a root the transcript lists twice', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.transcript.roots[0]!;
    const tampered = withTranscript(composition, encodeTranscript({ ...composition.transcript, roots: [root, root] }));
    expectRefusal(tampered, index, 'V4_DUPLICATE_ROOT');
  });

  test('refuses a user-entered master the transcript does not list as a root', () => {
    const composition = laidOut(twoRootPlan());
    const index = composition.validatorIndex;
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      roots: composition.transcript.roots.slice(0, 1),
    }));
    expectRefusal(tampered, index, 'V4_ROOT_MISSING');
  });

  test('refuses a root listing of a master a user did not enter', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const called = composition.masterIndex.get('B.g')!;
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      roots: [...composition.transcript.roots, called],
    }));
    expectRefusal(tampered, index, 'V4_ROOT_NOT_A_ROOT');
  });

  test('refuses a root whose caller names no input', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    root.callerRef = composition.inputs.length + 3;
    root.originRef = root.callerRef;
    expectRefusal(materialise(composition), index, 'V4_ROOT_INPUT_MISSING');
  });

  test('refuses a root whose caller is not a user', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const caller = composition.blocks.get('A.f')!.callerRef;
    composition.inputs[caller]!.lockingBytecode = encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(0x44));
    expectRefusal(materialise(composition), index, 'V4_ROOT_CALLER_NOT_P2PKH');
  });

  test('refuses a root whose origin is not its caller', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    root.originRef = root.callerRef === 0 ? 1 : 0;
    expectRefusal(materialise(composition), index, 'V4_ROOT_ORIGIN_MISMATCH');
  });

  test('refuses a called master whose caller is not a covered master', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.callerRef = composition.slotIndex.get('DA')!;
    expectRefusal(materialise(composition), index, 'V4_NON_ROOT_CALLER_NOT_A_MASTER');
  });

  test('refuses a validator whose owner policy names another contract as the first root', () => {
    const composition = laidOut(twoRootPlan());
    const index = composition.validatorIndex;
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      roots: [composition.transcript.roots[1]!, composition.transcript.roots[0]!],
    }));
    expectRefusal(tampered, index, 'V9_ROOT_CATEGORY_MISMATCH');
  });
});
