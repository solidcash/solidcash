import { describe, expect, it } from 'vitest';
import { messageBus } from '../../../src/index.js';

describe('atomic single-transaction admission limit', () => {
  it('publishes and enforces the adjacent measured BCH-2026 participant bound', () => {
    expect(messageBus.ATOMIC_MESSAGE_BUS_CAPACITY).toMatchObject({
      profile: 'self-preserved-verifier-return-chain-bch2026-stock-v5',
      maximumParticipants: 8,
      firstRejectedParticipants: 9,
      operationCostBudgetPerByte: 800,
    });
    expect(() => messageBus.assertAtomicParticipantCapacity(8)).not.toThrow();
    expect(() => messageBus.assertAtomicParticipantCapacity(9)).toThrow(expect.objectContaining({
      code: 'L3_PARTICIPANT_LIMIT', context: { measured: 9, limit: 8 },
    }));
  });

  it.each([0, 1, 1.5, Number.NaN])('refuses non-protocol participant count %s', (participants) => {
    expect(() => messageBus.assertAtomicParticipantCapacity(participants)).toThrow(expect.objectContaining({
      code: 'L3_PARTICIPANT_LIMIT',
    }));
  });
});
