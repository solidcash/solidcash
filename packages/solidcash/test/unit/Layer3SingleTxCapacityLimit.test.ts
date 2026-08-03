import { describe, expect, it } from 'vitest';
import { layer3 } from '../../src/index.js';

describe('controllerless single-transaction admission limit', () => {
  it('publishes and enforces the adjacent measured BCH-2026 participant bound', () => {
    expect(layer3.SINGLE_TX_BUS_CAPACITY).toMatchObject({
      profile: 'self-preserved-verifier-return-chain-bch2026-stock-v4',
      maximumParticipants: 8,
      firstRejectedParticipants: 9,
      operationCostBudgetPerByte: 800,
    });
    expect(() => layer3.assertSingleTxParticipantCapacity(8)).not.toThrow();
    expect(() => layer3.assertSingleTxParticipantCapacity(9)).toThrow(expect.objectContaining({
      code: 'L3_PARTICIPANT_LIMIT', context: { measured: 9, limit: 8 },
    }));
  });

  it.each([0, 1, 1.5, Number.NaN])('refuses non-protocol participant count %s', (participants) => {
    expect(() => layer3.assertSingleTxParticipantCapacity(participants)).toThrow(expect.objectContaining({
      code: 'L3_PARTICIPANT_LIMIT',
    }));
  });
});
