/**
 * phase-boundary extract: STB send-phase extract — wire rebalance → conservation → final-layout reassert closures.
 */

import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import {
  rebalanceFunderSurplus,
  type RebalanceFunderSurplusHost,
} from './stb-rebalance-funder-surplus.js';
import {
  reassertSendFinalConservation,
  type ReassertSendFinalConservationHost,
} from './stb-reassert-send-final-conservation.js';
import {
  reassertSendFinalLayout,
  type ReassertSendFinalLayoutHost,
} from './stb-reassert-send-final-layout.js';

export interface CreateSendFinalLayoutReassertHost {
  readonly funderChangeAddress?: Uint8Array;
  insertBeforeLateValueSuffix(
    builder: TransactionBuilder,
    output: Output,
    options: { rebindAbsoluteWitnesses?: boolean },
  ): unknown;
  buildConservationHost(rebalanceFunderSurplus: () => void): ReassertSendFinalConservationHost;
  buildFinalLayoutHost(reassertFinalConservation: () => void): ReassertSendFinalLayoutHost;
}

/**
 * Build the fixed-point `reassertFinalLayout` callback used after view repack: surplus rebalance,
 * protocol conservation, then final-layout reassert.
 */
export function createSendFinalLayoutReassert(
  host: CreateSendFinalLayoutReassertHost,
  finalBuilder: TransactionBuilder,
  serializedAccountingFunders: readonly UnlockableUtxo[],
  neededFee: bigint,
  dustMinimum: bigint,
): () => void {
  const rebalanceHost: RebalanceFunderSurplusHost = {
    funderChangeAddress: host.funderChangeAddress,
    insertBeforeLateValueSuffix: (builder, output, options) => (
      host.insertBeforeLateValueSuffix(builder, output, options)
    ),
  };
  const rebalanceFunderSurplusCb = (): void => {
    rebalanceFunderSurplus(
      rebalanceHost,
      finalBuilder,
      serializedAccountingFunders,
      neededFee,
      dustMinimum,
    );
  };
  const reassertFinalConservation = (): void => {
    reassertSendFinalConservation(
      host.buildConservationHost(rebalanceFunderSurplusCb),
      finalBuilder,
    );
  };
  const finalLayoutHost = host.buildFinalLayoutHost(reassertFinalConservation);
  return (): void => {
    reassertSendFinalLayout(finalLayoutHost, finalBuilder);
  };
}
