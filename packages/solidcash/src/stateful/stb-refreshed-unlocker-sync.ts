/**
 * phase-boundary extract: STB class-body extract — refresh master unlocker, sync builder inputs from
 * flattened allInputs, and mirror refreshed carrier masters.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { isContractUnlocker } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo, Unlocker } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { syncBuilderInputsFromAllInputs } from './persist-predecessor-layout.js';

export interface RefreshedUnlockerSyncHost {
  /** Mutable flattened input list — callers rewrite slots after unlocker refresh. */
  readonly allInputs: UnlockableUtxo[];
  readonly coordinateBase?: number;
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
  // Nested readers may precede a growing root continuation band. Their oracle index names the
  // final selected physical input, so an earlier block-relative coordinate is provisional.
  for (const input of builder.inputs) {
    const { unlocker } = input;
    if (!isContractUnlocker(unlocker)) continue;
    const position = unlocker.abiFunction.inputs.findIndex((parameter) =>
      parameter.name === '__internal__blockOracleInputIndex');
    if (position < 0) continue;
    const lock = unlocker.contract.blockOracleLock;
    if (lock === undefined) throw new Error('Block oracle reader has no bound oracle lock');
    const lockHex = binToHex(lock);
    const matches = builder.inputs.flatMap((candidate, index) => (
      candidate.token?.nft?.capability === 'mutable'
        && binToHex(candidate.unlocker.generateLockingBytecode()) === lockHex ? [index] : []
    ));
    if (matches.length !== 1) throw new Error('Block oracle reader requires one authenticated oracle input');
    const oracleInputIndex = BigInt((host.coordinateBase ?? 0) + matches[0]);
    if (unlocker.params[position] === oracleInputIndex) continue;
    unlocker.params[position] = oracleInputIndex;
    unlocker.syncEncodedArgsFromParams?.([position]);
  }

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
