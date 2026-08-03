import { Layer3DiagnosticError } from './diagnostics.js';

/**
 * Measured production admission bound for the self-preserved-verifier SCB1 protocol.
 *
 * The bound is intentionally physical-participant based: repeated invocations of one contract do not consume
 * another participant verifier. Eight participants is the protocol maximum and the largest representative
 * returning chain measured to complete under the stock BCH-2026 operation-density and transaction-size rules.
 * Exact finalized-byte and VM preflight remains authoritative for resource-heavy shapes below this ceiling.
 */
export const SINGLE_TX_BUS_CAPACITY = Object.freeze({
  profile: 'self-preserved-verifier-return-chain-bch2026-stock-v4',
  maximumParticipants: 8,
  firstRejectedParticipants: 9,
  operationCostBudgetPerByte: 800,
  maximumTransactionBytes: 100_000,
});

/** Refuse graphs outside the measured participant envelope before funding or signing their physical blocks. */
export const assertSingleTxParticipantCapacity = (participants: number): void => {
  if (!Number.isSafeInteger(participants) || participants < 2) {
    throw new Layer3DiagnosticError(
      'L3_PARTICIPANT_LIMIT',
      `controllerless composition requires between 2 and ${SINGLE_TX_BUS_CAPACITY.maximumParticipants} `
        + `physical participants; measured ${participants}`,
      { measured: participants, limit: SINGLE_TX_BUS_CAPACITY.maximumParticipants },
    );
  }
  if (participants > SINGLE_TX_BUS_CAPACITY.maximumParticipants) {
    throw new Layer3DiagnosticError(
      'L3_PARTICIPANT_LIMIT',
      `controllerless composition has ${participants} physical participants, exceeding the measured `
        + `BCH-2026 limit of ${SINGLE_TX_BUS_CAPACITY.maximumParticipants}`,
      { measured: participants, limit: SINGLE_TX_BUS_CAPACITY.maximumParticipants },
    );
  }
};
