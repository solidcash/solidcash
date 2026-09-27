import { describe, expect, test } from 'vitest';
import { FrameKind } from '@solidcash/utils';
import { accepted, expectRefusal, laidOut, reference } from './validator-machine.js';
import { materialise } from '../validator/fixture.js';
import { abbaPlan } from '../validator/plans.js';

/**
 * The shipped validator program refusing a call record that does not match the covered master it names, and a
 * covered master no walk from the roots can enter, at the machine.
 */
describe('the shipped validator program holds every call record to the covered callee it names', () => {
  test('accepts the reference composition, so every refusal below is the program refusing real bytes', () => {
    const { transaction, index } = reference();
    expect(accepted(transaction, index)).toBe(true);
  });

  test('refuses a call whose callee is not a covered master', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('A.f')!.calls[0]!.calleeRef = composition.slotIndex.get('DA')!;
    expectRefusal(materialise(composition), index, 'V5_CALLEE_NOT_A_MASTER');
  });

  test('refuses a callee that records a different caller', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.callerRef = composition.masterIndex.get('A.k')!;
    expectRefusal(materialise(composition), index, 'V5_CALLER_MISMATCH');
  });

  test('refuses a callee whose frame kind is not the kind the call recorded', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.kind = FrameKind.STATIC;
    expectRefusal(materialise(composition), index, 'V5_KIND_MISMATCH');
  });

  test('refuses a callee whose origin is not its caller\'s origin', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const callee = composition.blocks.get('B.g')!;
    callee.originRef = callee.callerRef;
    expectRefusal(materialise(composition), index, 'V5_ORIGIN_MISMATCH');
  });

  test('refuses a covered master that no call names', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    root.calls = [];
    root.segments = [[]];
    expectRefusal(materialise(composition), index, 'V5_MASTER_UNREACHED_BY_A_CALL');
  });

  test('refuses a covered master named by two calls', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    const call = root.calls[0]!;
    root.calls = [call, { ...call }];
    root.segments = [[], [], []];
    expectRefusal(materialise(composition), index, 'V5_MASTER_CALLED_TWICE');
  });

  test('refuses a callee whose value is not the value the call recorded', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.value = 7n;
    expectRefusal(materialise(composition), index, 'V5_VALUE_MISMATCH');
  });

  test('refuses a callee whose sender is not the caller\'s address', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.sender = new Uint8Array(25).fill(0x22);
    expectRefusal(materialise(composition), index, 'V5_SENDER_MISMATCH');
  });

  test('refuses a call whose target is not the callee\'s address', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const calleeIndex = composition.masterIndex.get('B.g')!;
    composition.blocks.get('A.f')!.calls.find((call) => call.calleeRef === calleeIndex)!.target
      = new Uint8Array(35).fill(0x33);
    expectRefusal(materialise(composition), index, 'V5_SELF_NOT_TARGET');
  });

  test('refuses an internal frame whose address is not its caller\'s address', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const caller = composition.blocks.get('A.f')!;
    const callee = composition.blocks.get('B.g')!;
    const calleeIndex = composition.masterIndex.get('B.g')!;
    caller.calls.find((call) => call.calleeRef === calleeIndex)!.kind = FrameKind.INTERNAL;
    callee.kind = FrameKind.INTERNAL;
    callee.sender = caller.sender;
    callee.value = caller.value;
    callee.self = new Uint8Array(35).fill(0x46);
    expectRefusal(materialise(composition), index, 'V5_SELF_NOT_CALLER_SELF');
  });

  test('refuses a callee whose result is not the result the call recorded', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.retval = new Uint8Array([0x99]);
    expectRefusal(materialise(composition), index, 'V5_RETVAL_MISMATCH');
  });

  test('refuses a call whose argument digest is not the callee\'s pushes', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('A.f')!.calls[0]!.argsHash = new Uint8Array(32).fill(0x44);
    expectRefusal(materialise(composition), index, 'V5_ARGS_HASH_MISMATCH');
  });

  test('refuses a covered master no walk from the roots can enter', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    const middle = composition.blocks.get('B.g')!;
    const leaf = composition.blocks.get('A.k')!;
    const middleIndex = composition.masterIndex.get('B.g')!;
    const leafIndex = composition.masterIndex.get('A.k')!;
    const call = root.calls.find((item) => item.calleeRef === middleIndex)!;
    leaf.calls = [{ ...call, calleeRef: middleIndex }];
    leaf.segments = [[], []];
    middle.callerRef = leafIndex;
    middle.sender = leaf.self;
    middle.originRef = leaf.originRef;
    root.calls = [];
    root.segments = [[]];
    expectRefusal(materialise(composition), index, 'V6_MASTER_UNREACHABLE');
  });
});
