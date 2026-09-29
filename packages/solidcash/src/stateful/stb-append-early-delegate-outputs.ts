/**
 * phase-boundary extract: STB build-phase extract — early delegate preservation band before external callees.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { returnEventNftCommitment } from './return-event-nft-commitment.js';

export type DeferredDelegateReturnEvent = {
  categoryId: string;
  commitment: Uint8Array;
  identity: string;
  provisional?: boolean;
};

export interface AppendEarlyDelegateOutputsHost {
  readonly delegateEntriesAfterLowLevel: boolean;
  readonly delegateReturnEventAfterEvents: boolean;
  readonly categoryId: string;
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly pendingReturnEventOutputs: readonly DeferredDelegateReturnEvent[];
}

/**
 * When delegate entries precede low-level callees, place each LLC group's associated delegate
 * outputs, optionally defer proxy return events, then append the implementation's loop-entry band.
 */
export function appendEarlyDelegateOutputs(
  host: AppendEarlyDelegateOutputsHost,
  builder: TransactionBuilder,
  helpers: {
    associatedDelegateOutputs: { has(groupIndex: number): boolean };
    appendDelegateGroupOutputs: (groupIndex: number) => void;
    appendDelegateLoopEntries: () => void;
  },
  addReturnOutput: (
    builder: TransactionBuilder,
    identity: string,
    output: {
      to: Uint8Array;
      amount: bigint;
      token: {
        amount: bigint;
        category: string;
        nft: { capability: 'none'; commitment: string };
      };
    },
  ) => void,
  deferredDelegateReturnEvents: DeferredDelegateReturnEvent[],
): void {
  if (!host.delegateEntriesAfterLowLevel) return;
  host.lowLevelCallUtxoGroups.forEach((_group, groupIndex) => {
    if (!helpers.associatedDelegateOutputs.has(groupIndex)) {
      helpers.appendDelegateGroupOutputs(groupIndex);
    }
  });
  const proxyReturnEvents = host.pendingReturnEventOutputs
    .filter((returnEvent) => returnEvent.categoryId === host.categoryId);
  if (host.delegateReturnEventAfterEvents) {
    deferredDelegateReturnEvents.push(...proxyReturnEvents);
  } else {
    for (const returnEvent of proxyReturnEvents) {
      addReturnOutput(builder, returnEvent.identity, {
        to: new Uint8Array([0x51]), amount: 800n,
        token: {
          amount: 0n, category: returnEvent.categoryId,
          nft: { capability: 'none', commitment: returnEventNftCommitment(returnEvent.commitment) },
        },
      });
    }
  }
  // The implementation owns this runtime-loop region: its covenant addresses it at
  // implementationInput + implementationBlockSize. Keep it adjacent to the implementation band even when
  // the same delegate also places dynamic-storage chunks in the reverse-indexed transaction suffix.
  helpers.appendDelegateLoopEntries();
}
