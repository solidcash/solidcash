/**
 * phase-boundary extract: SC _createBuilder extract — project delegate fixed slots into proxy block.
 */

import type { AbiFunction, BlockSlotKind, FunctionBlockLayout } from '@solidcash/utils';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { physicalDelegateSlotOffset } from './writer-event-delegate-layout.js';

export type ProjectCreateBuilderDelegateSlotsResult = {
  delegateEventSlots: Array<{
    kind: BlockSlotKind;
    offset: number;
    slotIndex?: number;
  }>;
  delegateReturnEventOffset: number | undefined;
  returnEmitBlockOffset: number | undefined;
  returnEmitOutputIndex: number;
  returnMaterializationOutputIndex: number | undefined;
};

/**
 * Project non-route delegatecall fixed/output-only slots into the caller's
 * `delegateEventSlots`, and rebase the forwarder return-event witness when the
 * co-spent implementation owns a returnEvent slot.
 */
export function projectCreateBuilderDelegateSlots(params: {
  lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  nestedDelegateProxyGroupByLowLevel: ReadonlyMap<number, number>;
  abiFunction: AbiFunction | undefined;
  delegateEventSlots: Array<{
    kind: BlockSlotKind;
    offset: number;
    slotIndex?: number;
  }>;
  delegateReturnEventOffset: number | undefined;
  returnEmitOutputIndex: number;
  returnEmitBlockOffset: number | undefined;
  returnMaterializationOutputIndex: number | undefined;
  overrides: { blockBase?: number; omitLocalFeeTail?: boolean } | undefined;
  timing?: (label: string) => void;
}): ProjectCreateBuilderDelegateSlotsResult {
  const {
    lowLevelCallUtxoGroups, nestedDelegateProxyGroupByLowLevel, abiFunction,
    overrides, timing,
  } = params;
  const delegateEventSlots = [...params.delegateEventSlots];
  let delegateReturnEventOffset = params.delegateReturnEventOffset;
  let returnEmitBlockOffset = params.returnEmitBlockOffset;
  let returnEmitOutputIndex = params.returnEmitOutputIndex;
  let returnMaterializationOutputIndex = params.returnMaterializationOutputIndex;

  for (const [groupIndex, g] of lowLevelCallUtxoGroups.entries()) {
    if (g.callMode !== 'delegatecall') continue;
    if (nestedDelegateProxyGroupByLowLevel.has(groupIndex)) continue;
    if (g.compilerRoute?.abiFunction.blockLayout) continue;
    const gFn = (g.externalContract.inner.artifact.abi as readonly {
      name: string; blockLayout?: FunctionBlockLayout;
    }[]).find((f) => f.name === g.functionName);
    const extra = (gFn?.blockLayout?.slots ?? []).filter((s) => s.kind !== 'master' && s.kind !== 'dataNft');
    const projectableKinds = new Set<BlockSlotKind>([
      'blockhashOracle', 'keccakSideCar', 'ecrecoverSideCar',
      'entry', 'event', 'returnEvent',
    ]);
    if (extra.length === 0 || !extra.every((slot) => projectableKinds.has(slot.kind))) continue;
    const existingCallSlot = abiFunction?.blockLayout?.slots.find((s) => s.kind === 'lowLevelCall');
    const callOffset = existingCallSlot?.offset ?? (abiFunction?.blockLayout?.blockSize ?? 1);
    if (!existingCallSlot && !delegateEventSlots.some((s) => s.kind === 'lowLevelCall')) {
      delegateEventSlots.push({ kind: 'lowLevelCall', offset: callOffset });
    }
    const implIsDelegateOnly = g.externalContract.inner.artifact.delegateOnly === true;
    for (const s of extra) {
      const offset = callOffset + physicalDelegateSlotOffset(
        gFn?.blockLayout, s.offset, implIsDelegateOnly,
      );
      if (s.kind === 'returnEvent') { delegateReturnEventOffset = offset; continue; }
      delegateEventSlots.push({
        kind: s.kind,
        offset,
        ...(s.slotIndex !== undefined && { slotIndex: s.slotIndex }),
      });
    }
  }
  timing?.('delegate-slot-projection-complete');
  if (delegateReturnEventOffset !== undefined && returnEmitOutputIndex >= 0) {
    returnEmitBlockOffset = delegateReturnEventOffset;
    returnEmitOutputIndex = (overrides?.blockBase ?? 0) + returnEmitBlockOffset;
    returnMaterializationOutputIndex = overrides?.omitLocalFeeTail
      ? returnEmitBlockOffset : returnEmitOutputIndex;
  }

  return {
    delegateEventSlots,
    delegateReturnEventOffset,
    returnEmitBlockOffset,
    returnEmitOutputIndex,
    returnMaterializationOutputIndex,
  };
}
