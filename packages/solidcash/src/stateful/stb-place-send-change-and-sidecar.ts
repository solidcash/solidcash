/**
 * phase-boundary extract: STB send-phase extract — place fee change before late suffix and optional library sidecar.
 */

import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

export interface PlaceSendChangeAndSidecarHost {
  readonly funderChangeAddress?: Uint8Array;
  readonly sidecarUtxo?: UnlockableUtxo;
  readonly lateValueChunkOutputs: readonly unknown[];
  readonly delegateDynamicChunksAtSuffix?: boolean;
  accountingFunderUtxos(): readonly UnlockableUtxo[];
  dynamicChunkOutputCount(): number;
  insertBeforeLateValueSuffix(
    builder: TransactionBuilder,
    output: Output,
    options: { rebindAbsoluteWitnesses?: boolean },
  ): unknown;
}

/**
 * Place accounting-funder change before the authenticated late-chunk suffix, then recreate the
 * external-library sidecar as the last output when build() did not already emit it.
 */
export function placeSendChangeAndSidecar(
  host: PlaceSendChangeAndSidecarHost,
  finalBuilder: TransactionBuilder,
  neededFee: bigint,
  dustMinimum: bigint,
): UnlockableUtxo[] {
  const accountingFunders = host.accountingFunderUtxos();
  const accountingFunderByOutpoint = new Map<string, UnlockableUtxo>(accountingFunders.map((funder) => (
    [`${funder.txid.toLowerCase()}:${funder.vout}`, funder] as const
  )));
  const serializedAccountingFunders = [...new Map(finalBuilder.inputs.flatMap((input) => {
    const key = `${input.txid.toLowerCase()}:${input.vout}`;
    const funder = accountingFunderByOutpoint.get(key);
    return funder ? [[key, funder] as const] : [];
  })).values()];
  if (serializedAccountingFunders.length > 0) {
    // A structural funder can already occupy a nested participant coordinate and therefore must not be
    // re-added to the local placement pool. It still owns its contributed value; default change to the first
    // exact funding claim when no explicit common destination was supplied.
    const changeTo = host.funderChangeAddress
      ?? serializedAccountingFunders[0].unlocker.generateLockingBytecode();
    const funderOutpoints = new Set(serializedAccountingFunders.map(
      (funder) => `${funder.txid.toLowerCase()}:${funder.vout}`,
    ));
    const actualFunderInputs = finalBuilder.inputs.filter((input) => (
      funderOutpoints.has(`${input.txid.toLowerCase()}:${input.vout}`)
    ));
    // A configured block-layout funder can be displaced by a covenant input at the same physical offset.
    // Only inputs that are actually serialized may contribute to change; counting the configured pool would
    // create value whenever a slot is occupied by a delegate/data input.
    const funderTotal = actualFunderInputs.reduce((sum, input) => sum + input.satoshis, 0n);
    const covenantInputTotal = finalBuilder.inputs
      .filter((input) => !funderOutpoints.has(`${input.txid.toLowerCase()}:${input.vout}`))
      .reduce((sum, input) => sum + input.satoshis, 0n);
    const covenantOutputTotal = finalBuilder.outputs.reduce((sum, o) => sum + o.amount, 0n);
    const available = funderTotal - (covenantOutputTotal - covenantInputTotal);
    const changeAmount = available - neededFee;

    // Exact-dust auto-change has no adjustable value: any late signature or witness growth makes the finalized
    // transaction underfunded. Leave that dust in the fee instead. Larger, configured change remains available
    // to the exact finalizer below and is returned except for the bytes actually required by serialization.
    if (changeAmount > dustMinimum) {
      const changeOutput = { to: changeTo, amount: changeAmount };
      // Keep [late chunks][one terminal suffix] contiguous at the end. The compiler authenticates chunk i by
      // counting backward from OP_TXOUTPUTCOUNT, so fee change must precede the entire suffix region.
      host.insertBeforeLateValueSuffix(finalBuilder, changeOutput, { rebindAbsoluteWitnesses: true });
    }
  }

  // Recreate the side-car as the LAST output (its self-preservation verifies the last output).
  // With late chunks it was already emitted by build() as their single terminal suffix.
  if (host.sidecarUtxo && host.lateValueChunkOutputs.length === 0
    && !(host.delegateDynamicChunksAtSuffix && host.dynamicChunkOutputCount() > 0)) {
    finalBuilder.addOutput({
      to: host.sidecarUtxo.unlocker.generateLockingBytecode(),
      amount: host.sidecarUtxo.satoshis,
    });
  }
  return serializedAccountingFunders;
}
