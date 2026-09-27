import { describe, expect, test } from 'vitest';
import { FrameKind } from '@solidcash/utils';
import { accepted, expectRefusal, laidOut } from './validator-machine.js';
import {
  categoryOf,
  contractLockOf,
  materialise,
  seedBytes,
  selectorOf,
  type CompositionPlan,
} from '../validator/fixture.js';
import { userPlan } from '../validator/plans.js';

/** One contract, three masters: the entry calls a read-only frame, which calls a second read-only frame. */
function readOnlyChainPlan(): CompositionPlan {
  const contract = {
    id: 'A',
    category: categoryOf('ro-A'),
    masterLock: contractLockOf(seedBytes('code:ro-A', 8)),
    stateLock: contractLockOf(seedBytes('state:ro-A', 8)),
    eventLock: contractLockOf(seedBytes('event:ro-A', 8)),
  };
  const read = { touches: [{ slot: 'S' }] };
  return {
    contracts: [contract],
    users: [userPlan('U')],
    stateSlots: [{ id: 'S', contract: 'A', commitment: seedBytes('S:0', 6), value: 3_000n }],
    createdSlots: [],
    masters: [
      {
        id: 'A.go',
        contract: 'A',
        kind: FrameKind.ROOT,
        caller: 'U',
        selector: selectorOf('go'),
        args: [],
        children: ['A.mid'],
        callKinds: [FrameKind.STATIC],
        callValues: [0n],
        segments: [read, read],
        retval: new Uint8Array(0),
      },
      {
        id: 'A.mid',
        contract: 'A',
        kind: FrameKind.STATIC,
        caller: 'A.go',
        selector: selectorOf('mid'),
        args: [],
        children: ['A.leaf'],
        callKinds: [FrameKind.STATIC],
        callValues: [0n],
        segments: [read, read],
        retval: new Uint8Array(0),
      },
      {
        id: 'A.leaf',
        contract: 'A',
        kind: FrameKind.STATIC,
        caller: 'A.mid',
        selector: selectorOf('leaf'),
        args: [],
        children: [],
        segments: [read],
        retval: new Uint8Array(0),
      },
    ],
    changeUser: 'U',
  };
}

/**
 * The shipped validator program refusing a read-only frame whose call carries value, or names a frame that is not
 * read-only, at the machine.
 */
describe('the shipped validator program holds a read-only frame to its own calls', () => {
  test('accepts the read-only chain the refusals below are built on', () => {
    const composition = laidOut(readOnlyChainPlan());
    expect(accepted(materialise(composition), composition.validatorIndex)).toBe(true);
  });

  test('refuses a read-only frame whose call carries value', () => {
    const composition = laidOut(readOnlyChainPlan());
    const index = composition.validatorIndex;
    // A plain call carries value, so the edge's own value rule is satisfied and the read-only rule is what objects.
    // A call that stays read-only can never carry value: the edge rule requires it to be zero first.
    composition.blocks.get('A.mid')!.calls[0]!.kind = FrameKind.CALL;
    composition.blocks.get('A.mid')!.calls[0]!.value = 1n;
    composition.blocks.get('A.leaf')!.kind = FrameKind.CALL;
    composition.blocks.get('A.leaf')!.value = 1n;
    expectRefusal(materialise(composition), index, 'V10_STATIC_VALUE_CALL');
  });

  test('refuses a read-only frame whose call names a frame that is not read-only', () => {
    const composition = laidOut(readOnlyChainPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('A.mid')!.calls[0]!.kind = FrameKind.CALL;
    composition.blocks.get('A.leaf')!.kind = FrameKind.CALL;
    expectRefusal(materialise(composition), index, 'V10_STATIC_NON_STATIC_CALL');
  });
});
