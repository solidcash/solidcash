/**
 * The golden composition: the `A -> B -> B -> A` transaction of spec section 5, laid out from section 5.1 and
 * decided by both modules. Section 8 walks the same transaction, and the order it derives there
 * (`(0,0), (4,0), (1,0), (4,1), (0,1)`) is asserted here.
 *
 * The builders are also shared with the hostile and differential suites, so this file exposes the two canonical
 * plans: the two-contract `ABBA` composition, and a smaller one-contract composition with a created record, an
 * event and a value send.
 */

import { FrameKind } from '@solidcash/utils';
import {
  categoryOf,
  contractLockOf,
  planComposition,
  seedBytes,
  selectorOf,
  userLockOf,
  type CompositionPlan,
  type Composition,
  type ContractPlan,
} from './fixture.js';

/** The contracts of the section 5 example: `A` with two masters, `B` with one. */
export function abbaContracts(): ContractPlan[] {
  return [
    {
      id: 'A',
      category: categoryOf('A'),
      masterLock: contractLockOf(seedBytes('code:A', 8)),
      stateLock: contractLockOf(seedBytes('state:A', 8)),
      eventLock: contractLockOf(seedBytes('event:A', 8)),
    },
    {
      id: 'B',
      category: categoryOf('B'),
      masterLock: contractLockOf(seedBytes('code:B', 8)),
      stateLock: contractLockOf(seedBytes('state:B', 8)),
      eventLock: contractLockOf(seedBytes('event:B', 8)),
    },
  ];
}

/** The user of the section 5 example. */
export function userPlan(id = 'U'): { id: string; lock: Uint8Array; value: bigint } {
  return { id, lock: userLockOf(id), value: 500_000n };
}

/** The commitments of the section 5 example's two records. */
export const ABBA_COMMITMENTS = {
  countBefore: seedBytes('DA:count=5', 6),
  countAfterIncrement: seedBytes('DA:count=6', 6),
  countAfterHits: seedBytes('DA:count=6,hits=1', 8),
  final: seedBytes('DA:count=6,hits=1,last=20', 10),
  totalBefore: seedBytes('DB:total=10', 6),
  totalAfter: seedBytes('DB:total=14', 6),
};

/** `A.f -> B.g -> A.k -> B.g -> A.f`, the composition of section 5. */
export function abbaPlan(): CompositionPlan {
  return {
    contracts: abbaContracts(),
    users: [userPlan()],
    stateSlots: [
      { id: 'DA', contract: 'A', commitment: ABBA_COMMITMENTS.countBefore, value: 2_000n },
      { id: 'DB', contract: 'B', commitment: ABBA_COMMITMENTS.totalBefore, value: 2_000n },
    ],
    createdSlots: [],
    masters: [
      {
        id: 'A.f',
        contract: 'A',
        kind: FrameKind.ROOT,
        caller: 'U',
        selector: selectorOf('f'),
        args: [seedBytes('arg:3', 1)],
        children: ['B.g'],
        callKinds: [FrameKind.CALL],
        callValues: [0n],
        segments: [
          { touches: [{ slot: 'DA', viewOut: ABBA_COMMITMENTS.countAfterIncrement }] },
          { touches: [{ slot: 'DA', viewOut: ABBA_COMMITMENTS.final }] },
        ],
        events: 1,
        retval: new Uint8Array(0),
      },
      {
        id: 'B.g',
        contract: 'B',
        kind: FrameKind.CALL,
        caller: 'A.f',
        selector: selectorOf('g'),
        args: [seedBytes('arg:3', 1)],
        children: ['A.k'],
        callKinds: [FrameKind.CALL],
        callValues: [0n],
        segments: [
          { touches: [{ slot: 'DB', viewOut: ABBA_COMMITMENTS.totalAfter }] },
          { touches: [{ slot: 'DB' }] },
        ],
        retval: seedBytes('ret:20', 1),
      },
      {
        id: 'A.k',
        contract: 'A',
        kind: FrameKind.CALL,
        caller: 'B.g',
        selector: selectorOf('k'),
        args: [],
        children: [],
        segments: [{ touches: [{ slot: 'DA', viewOut: ABBA_COMMITMENTS.countAfterHits }] }],
        retval: seedBytes('ret:6', 1),
      },
    ],
    changeUser: 'U',
  };
}

/** One contract, two masters, a created record, an event and a value send. */
export function singleContractPlan(): CompositionPlan {
  const contract: ContractPlan = {
    id: 'A',
    category: categoryOf('solo-A'),
    masterLock: contractLockOf(seedBytes('code:solo-A', 8)),
    stateLock: contractLockOf(seedBytes('state:solo-A', 8)),
    eventLock: contractLockOf(seedBytes('event:solo-A', 8)),
  };
  return {
    contracts: [contract],
    users: [userPlan('U1'), userPlan('U2')],
    stateSlots: [{ id: 'S', contract: 'A', commitment: seedBytes('S:0', 6), value: 3_000n }],
    createdSlots: [{ id: 'E', contract: 'A', commitment: seedBytes('E:0', 6), value: 1_500n }],
    masters: [
      {
        id: 'A.go',
        contract: 'A',
        kind: FrameKind.ROOT,
        caller: 'U1',
        selector: selectorOf('go'),
        args: [seedBytes('arg:1', 1)],
        children: ['A.more'],
        callKinds: [FrameKind.STATIC],
        callValues: [0n],
        // The frozen witness codec refuses a record created by an execution's first segment, so the created record
        // first appears in the segment after the call.
        segments: [
          { touches: [{ slot: 'S', viewOut: seedBytes('S:1', 6) }] },
          { touches: [{ slot: 'S' }, { slot: 'E' }] },
        ],
        events: 1,
        sends: 1,
        retval: new Uint8Array(0),
      },
      {
        id: 'A.more',
        contract: 'A',
        kind: FrameKind.STATIC,
        caller: 'A.go',
        selector: selectorOf('more'),
        args: [],
        children: [],
        segments: [{ touches: [{ slot: 'S' }] }],
        retval: seedBytes('ret:solo', 1),
      },
    ],
    changeUser: 'U1',
    sendValues: { 'A.go': [1_000n] },
  };
}

/** The golden `ABBA` composition, laid out. */
export function abbaComposition(): Composition {
  return planComposition(abbaPlan());
}
