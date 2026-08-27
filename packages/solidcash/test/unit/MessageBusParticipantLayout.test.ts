import { describe, expect, it } from 'vitest';
import {
  MESSAGE_BUS_DELEGATE_EXECUTOR_SLOT, messageBusParticipantLayout,
} from '../../src/message-bus/participant-layout.js';

describe('message-bus participant layout', () => {
  const route = {
    blockSize: 5,
    trailingBase: 3,
    trailingCapacity: 2,
    slots: [
      { kind: 'master' as const, offset: 0 },
      { kind: 'dataNft' as const, offset: 1, nftIndex: 0 },
      // A source-level low-level call must not be mistaken for the route executor.
      { kind: 'lowLevelCall' as const, offset: 2, slotIndex: 0 },
      { kind: 'trailing' as const, offset: 3, slotIndex: 0 },
      { kind: 'trailing' as const, offset: 4, slotIndex: 1 },
    ],
  };

  it('places a delegated executor after the complete compiler route prefix', () => {
    const participant = messageBusParticipantLayout(route, { delegated: true });

    expect(participant.executorOffset).toBe(5);
    expect(participant.blockLayout).toMatchObject({
      blockSize: 6,
      trailingBase: 3,
      trailingCapacity: 2,
      fixedSuffix: 1,
    });
    expect(participant.blockLayout.slots.at(-1)).toEqual({
      kind: 'lowLevelCall', offset: 5, slotIndex: MESSAGE_BUS_DELEGATE_EXECUTOR_SLOT,
    });
  });

  it('places identity anchors after the executor without moving the runtime resource band', () => {
    const participant = messageBusParticipantLayout(route, {
      delegated: true, identityAnchorCount: 2,
    });

    expect(participant.blockLayout.blockSize).toBe(8);
    expect(participant.blockLayout.slots.slice(-3)).toEqual([
      { kind: 'lowLevelCall', offset: 5, slotIndex: MESSAGE_BUS_DELEGATE_EXECUTOR_SLOT },
      { kind: 'identityAnchor', offset: 6 },
      { kind: 'identityAnchor', offset: 7 },
    ]);
    expect(participant.blockLayout.trailingBase).toBe(3);
    expect(participant.blockLayout.trailingCapacity).toBe(2);
  });
});
