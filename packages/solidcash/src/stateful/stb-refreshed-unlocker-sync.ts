/**
 * phase-boundary extract: STB class-body extract — refresh master unlocker, sync builder inputs from
 * flattened allInputs, and mirror refreshed carrier masters.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo, Unlocker } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { syncBuilderInputsFromAllInputs } from './persist-predecessor-layout.js';

export interface RefreshedUnlockerSyncHost {
  /** Mutable flattened input list — callers rewrite slots after unlocker refresh. */
  readonly allInputs: UnlockableUtxo[];
  masterUtxo: UnlockableUtxo;
  masterUnlockerRefresher?: (builder?: TransactionBuilder) => Unlocker;
}

export function refreshMasterUnlocker(
  host: RefreshedUnlockerSyncHost,
  builder?: TransactionBuilder,
): void {
  if (!host.masterUnlockerRefresher) return;
  const prior = host.masterUtxo;
  host.masterUtxo = { ...prior, unlocker: host.masterUnlockerRefresher(builder) };
  const inputIndex = host.allInputs.findIndex((input) => (
    input.txid.toLowerCase() === prior.txid.toLowerCase() && input.vout === prior.vout
  ));
  if (inputIndex >= 0) host.allInputs[inputIndex] = host.masterUtxo;
}

/** Copy refreshed unlockers onto an already-materialized TransactionBuilder. */
export function syncBuilderUnlockers(
  host: RefreshedUnlockerSyncHost,
  builder: TransactionBuilder,
): void {
  const next = syncBuilderInputsFromAllInputs(builder.inputs, host.allInputs);
  builder.inputs.splice(0, builder.inputs.length, ...next);
  // Hidden physical-coordinate arguments must inspect the finalized input ordering, not the materialized
  // builder's previous ordering. Refresh the master only after synchronizing that ordering, then copy the
  // rebuilt master unlocker back into the materialized input list.
  refreshMasterUnlocker(host, builder);
  const refreshed = syncBuilderInputsFromAllInputs(builder.inputs, host.allInputs);
  builder.inputs.splice(0, builder.inputs.length, ...refreshed);
}

/** Mirror refreshed carrier masters into both the flattened and materialized input lists. */
export function syncRefreshedCarrierMasters(
  host: RefreshedUnlockerSyncHost,
  builder: TransactionBuilder,
  carriers: Iterable<ExternalCallUtxoGroup>,
): void {
  for (const carrier of carriers) {
    // Shared logical calls reuse their owner's physical master and must not overwrite its top-level unlocker.
    if (carrier.sharedGroupIndex !== undefined) continue;
    const master = carrier.masterUtxo as UnlockableUtxo | undefined;
    if (!master?.unlocker) continue;
    const inputIndex = host.allInputs.findIndex((input) => (
      input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout
    ));
    if (inputIndex >= 0) host.allInputs[inputIndex] = master;
  }
  syncBuilderUnlockers(host, builder);
}
