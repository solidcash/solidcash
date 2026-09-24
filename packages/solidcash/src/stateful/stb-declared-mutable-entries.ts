/**
 * phase-boundary extract: STB class-body extract — compiler-declared mutable entry slot discovery and restore.
 */

import type { AbiFunction, FunctionBlockLayout } from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { reassertDeclaredMutableSlotLock } from './mutable-output-reassert.js';
import { writerBlockOccupancyEnd } from './persist-predecessor-layout.js';
import { cloneToken } from './stb-output-utils.js';
import {
  isDisposableAlignmentPad,
  isViewReturnTailOutput,
} from './value-chunk-band-helpers.js';

export interface DeclaredMutableEntryHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly masterUtxo: Utxo;
  readonly blockLayout?: FunctionBlockLayout;
  readonly categoryId: string;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  getExternalCallOutputBase(groupIndex: number): number;
  getLowLevelCallMasterInputIndex(index: number): number;
  findMintingInputIndex(categoryId: string): number;
  externalEntryLockingBytecode(
    group: ExternalCallUtxoGroup,
    slot: FunctionBlockLayout['slots'][number],
  ): Uint8Array | undefined;
}

/** Compiler-declared entries preserve input/output coordinates one-to-one. */
export function declaredMutableEntrySlots(
  host: DeclaredMutableEntryHost,
): Array<{ outputIndex: number; inputIndex: number }> {
  const slots = new Set<number>();
  const addLayout = (
    masterIndex: number,
    layout: FunctionBlockLayout | undefined,
    ownerCategoryId: string | undefined,
    expectedLockForSlot?: (slot: FunctionBlockLayout['slots'][number]) => Uint8Array | undefined,
  ): void => {
    if (masterIndex < 0 || !layout) return;
    for (const slot of layout.slots) {
      if (slot.kind !== 'entry') continue;
      const index = masterIndex + slot.offset;
      const input = host.allInputs[index];
      const expectedLock = expectedLockForSlot?.(slot);
      const inputLock = input?.unlocker?.generateLockingBytecode();
      if (input?.token?.nft?.capability === 'mutable' && input.unlocker
        && (ownerCategoryId === undefined || input.token.category === ownerCategoryId)
        && (expectedLock === undefined || (inputLock !== undefined
          && expectedLock.length === inputLock.length
          && expectedLock.every((byte, offset) => byte === inputLock[offset])))) {
        slots.add(index);
      }
    }
  };
  const rootIndex = host.allInputs.findIndex((input) => input.txid.toLowerCase() === host.masterUtxo.txid.toLowerCase()
    && input.vout === host.masterUtxo.vout);
  addLayout(rootIndex, host.blockLayout, host.categoryId);
  for (const [groupIndex, group] of host.externalCallUtxoGroups.entries()) {
    if (group.sharedGroupIndex !== undefined) continue;
    addLayout(
      host.getExternalCallOutputBase(groupIndex),
      group.blockLayout ?? group.compilerRoute?.abiFunction?.blockLayout,
      group.categoryId,
      (slot) => host.externalEntryLockingBytecode(group, slot),
    );
  }
  for (const [groupIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
    const fn = group.compilerRoute?.abiFunction
      ?? group.externalContract?.inner?.artifact.abi.find((candidate: AbiFunction) =>
        candidate.name === (group.logicalFunctionName ?? group.functionName));
    const proxyOwner = host.externalCallUtxoGroups.find((candidate) => (
      candidate.delegateCallGroupIndex === groupIndex
    ));
    addLayout(
      host.getLowLevelCallMasterInputIndex(groupIndex),
      fn?.blockLayout ?? group.blockLayout,
      proxyOwner?.categoryId ?? group.categoryId,
    );
  }
  return [...slots]
    .sort((left, right) => left - right)
    .map((index) => ({ outputIndex: index, inputIndex: index }));
}

export function declaredMutableEntrySlotIndices(
  host: DeclaredMutableEntryHost,
): number[] {
  return declaredMutableEntrySlots(host).map(({ outputIndex }) => outputIndex);
}

/** Restore compiler-declared entry ownership after output-only materializers. */
export function restoreDeclaredMutableEntrySlots(
  host: DeclaredMutableEntryHost,
  builder: TransactionBuilder,
): void {
  const occupancyEnd = writerBlockOccupancyEnd(
    host.externalCallUtxoGroups,
    (categoryId) => host.findMintingInputIndex(categoryId),
  );
  const entrySlots = declaredMutableEntrySlots(host);
  const entryIndices = entrySlots.map(({ outputIndex }) => outputIndex);
  for (const { outputIndex: index, inputIndex } of entrySlots) {
    const output = builder.outputs[index];
    const input = host.allInputs[inputIndex];
    if (reassertDeclaredMutableSlotLock(output, input)) continue;
    const lockBytes = output?.to instanceof Uint8Array ? output.to : undefined;
    const opTrue = !!lockBytes && lockBytes.length === 1 && lockBytes[0] === 0x51;
    if (!opTrue && !isViewReturnTailOutput(output)) continue;
    if (!input || !('unlocker' in input) || !input.unlocker || !input.token) continue;
    let dest = Math.max(occupancyEnd, index + 1);
    while (dest < builder.outputs.length && (
      builder.outputs[dest]?.token || entryIndices.includes(dest)
    )) dest += 1;
    if (dest < builder.outputs.length && isDisposableAlignmentPad({
      to: builder.outputs[dest]?.to instanceof Uint8Array
        ? builder.outputs[dest]!.to as Uint8Array : undefined,
      token: builder.outputs[dest]?.token,
    })) {
      builder.outputs[dest] = output;
    }
    builder.outputs[index] = {
      to: input.unlocker.generateLockingBytecode(),
      amount: input.satoshis,
      token: cloneToken(input.token),
    };
  }
}
