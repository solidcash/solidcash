/**
 * phase-boundary extract: STB class-body extract — apply learned probe event commitments onto writer event slots.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { groupLayoutBlockSize } from './writer-event-delegate-layout.js';

export interface ApplyLearnedWriterEventsHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  findMintingInputIndex(categoryId: string): number;
  getExternalCallMasterInputIndex(groupIndex: number): number;
}

/**
 * Materialize non-empty learned event NFT commitments from probe observations onto the
 * corresponding participant event slots (skipping minting carriers and empty/conditional placeholders).
 */
export function applyLearnedWriterEvents(
  host: ApplyLearnedWriterEventsHost,
  builder: TransactionBuilder,
): void {
  for (const group of host.externalCallUtxoGroups) {
    if (group.sharedGroupIndex !== undefined || !group.categoryId || !group.blockLayout) continue;
    let master = host.findMintingInputIndex(group.categoryId);
    if (master < 0) master = host.getExternalCallMasterInputIndex(
      host.externalCallUtxoGroups.indexOf(group),
    );
    if (master < 0) continue;
    // Do not synthesize Approval/Transfer into eventOutputs here. transferFrom's event slots are
    // conditional; when the handler takes the not-taken arm, emitNotTakenEventSlotBinding requires
    // an empty commitment. Fabricating non-empty event NFTs makes that NUMEQUALVERIFY fail even
    // after P'/NEW/allowance outputs are correct. Learned probe commitments still apply below;
    // _clearUnclaimedConditionalEventSlots demotes unresolved conditional slots.
    let eventOrdinal = 0;
    for (const slot of group.blockLayout.slots) {
      if (slot.kind !== 'event') continue;
      const learned = group.eventOutputs?.[eventOrdinal];
      const outputIndex = master + slot.offset;
      eventOrdinal += 1;
      const debugEnv = (globalThis as {
        process?: { env?: Record<string, string> };
      }).process?.env;
      const debugEventIndex = debugEnv?.SOLIDC_DEBUG_EVENT_INDEX === undefined
        ? undefined : Number.parseInt(debugEnv.SOLIDC_DEBUG_EVENT_INDEX, 10);
      if (debugEnv?.SOLIDC_DEBUG_PARTICIPANT_EVENTS === '1'
        && (debugEventIndex === undefined || debugEventIndex === outputIndex)) {
        console.error('participant-event-slot', JSON.stringify({
          group: group.logicalFunctionName ?? group.functionName,
          categoryId: group.categoryId.slice(0, 16),
          master,
          offset: slot.offset,
          outputIndex,
          conditional: slot.conditional,
          blockSize: groupLayoutBlockSize(group),
          relocatedPredOutBase: group.relocatedPredOutBase,
          batchPredecessorOutputs: group.batchPredecessorOutputs,
          predOutArgs: Object.fromEntries(Object.entries({
            ...group.compilerRoute?.internalArgs,
            ...group.internalArgs,
          }).filter(([name]) => /^__internal__vmapBatchPredOut_\d+$/.test(name))
            .map(([name, value]) => [name, String(value)])),
          learned: learned ? {
            eventSignature: learned.eventSignature,
            commitment: String(learned.commitment).slice(0, 32),
          } : undefined,
          before: builder.outputs[master + slot.offset]?.token ? {
            category: builder.outputs[master + slot.offset]!.token!.category.slice(0, 16),
            capability: builder.outputs[master + slot.offset]!.token!.nft?.capability,
            commitment: String(
              builder.outputs[master + slot.offset]!.token!.nft?.commitment ?? '',
            ).slice(0, 32),
          } : undefined,
        }));
      }
      const commitment = String(learned?.commitment ?? '');
      if (!learned || commitment === '' || /^(00)+$/.test(commitment)) continue;
      if (builder.outputs[outputIndex]?.token?.nft?.capability === 'minting') continue;
      builder.outputs[outputIndex] = {
        to: learned.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: group.categoryId,
          nft: { capability: 'none', commitment },
        },
      };
    }
  }
}
