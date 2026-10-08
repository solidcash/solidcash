/**
 * phase-boundary extract: STB class-body extract — restore planned delegate loop-entry commitments at
 * compiler-owned coordinates, including compact-return-event helpers.
 */

import type { AbiFunction, FunctionBlockLayout } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { addressToLockScript, calculateDust } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { commitmentHexOf } from './stb-output-utils.js';
import { shouldReassertLegacyDelegateLoopEntries } from './stb-materialize-trailing-frame-and-pending.js';

export type DelegateLoopEntryVar = {
  collection: string;
  lockingBytecode: Uint8Array;
  categoryId?: string;
  delegate?: boolean;
  chunkable?: boolean;
};

export interface DelegateLoopEntriesHost {
  readonly loopEntryVars: readonly DelegateLoopEntryVar[];
  readonly categoryId: string;
  readonly insertLoopPredecessorInputs: readonly UnlockableUtxo[];
  readonly blockLayout?: FunctionBlockLayout;
  readonly plannedReturnOutputIndex: number;
  readonly activeDelegateGroupIndex?: number;
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly allInputs: readonly UnlockableUtxo[];
  readonly dynamicChunkInputs: readonly UnlockableUtxo[];
  readonly trailingDisposalInputs: readonly UnlockableUtxo[];
  readonly compilerRouteDelegateBlock: boolean;
  readonly iterationEntryInputs: readonly UnlockableUtxo[];
  readonly loopEntryCommitments: ReadonlyMap<string, readonly string[]>;
  getLoopEntryOutputBase(): number;
}

/** Read `__internal__returnOutputIdx` from one unlocker, or undefined when absent. */
export function returnOutputIdxFromUnlocker(unlocker: {
  abiFunction?: { inputs?: ReadonlyArray<{ name: string }> };
  params?: readonly unknown[];
} | undefined): number | undefined {
  const inputs = unlocker?.abiFunction?.inputs;
  const params = unlocker?.params;
  if (!inputs || !params) return undefined;
  const pos = inputs.findIndex((param) => param.name === '__internal__returnOutputIdx');
  if (pos < 0 || pos >= params.length) return undefined;
  const raw = params[pos];
  const value = typeof raw === 'bigint' ? Number(raw)
    : typeof raw === 'number' ? raw
      : typeof raw === 'string' && raw !== '' ? Number(raw) : Number.NaN;
  return Number.isInteger(value) ? value : undefined;
}

export function unmaterializedReturnEventCompact(
  host: DelegateLoopEntriesHost,
  layout?: { trailingBase?: number; slots?: ReadonlyArray<{ kind: string }> },
  ownerUnlocker?: {
    abiFunction?: { inputs?: ReadonlyArray<{ name: string }> };
    params?: readonly unknown[];
  },
): number {
  const effective = layout ?? host.blockLayout;
  if (!effective) return 0;
  if (effective.trailingBase !== undefined) return 0;
  if (!(effective.slots?.some((slot) => slot.kind === 'returnEvent') ?? false)) return 0;
  const owned = returnOutputIdxFromUnlocker(ownerUnlocker);
  if (owned !== undefined) return owned < 0 ? 1 : 0;
  if (host.plannedReturnOutputIndex >= 0) return 0;
  return 1;
}

export function delegateLoopEntryVars(
  host: DelegateLoopEntriesHost,
): DelegateLoopEntryVar[] {
  return host.loopEntryVars.filter((lv) => lv.delegate === true);
}

/**
 * A runtime mapping loop emits both recreations (an UPDATE or re-pointed predecessor P') and genuinely new
 * entries through the same trailing commitment list. Match recreations by their authenticated entry slot and
 * covenant address so they retain the consumed NFT's satoshis; only NEW entries should be funded at dust.
 */
export function loopEntryTransitionSatoshis(
  host: DelegateLoopEntriesHost,
  variable: DelegateLoopEntryVar,
  commitment: string,
): bigint | undefined {
  const outputCommitment = commitment.toLowerCase();
  if (outputCommitment.length < 64) return undefined;
  const categoryId = variable.categoryId ?? host.categoryId;
  const lockingBytecode = binToHex(variable.lockingBytecode);
  const input = host.insertLoopPredecessorInputs.find((candidate) => {
    const inputCommitment = commitmentHexOf(candidate.token?.nft?.commitment).toLowerCase();
    return candidate.token?.category === categoryId
      && candidate.token.nft?.capability === 'mutable'
      && inputCommitment.length >= 64
      && inputCommitment.slice(0, 64) === outputCommitment.slice(0, 64)
      && binToHex(candidate.unlocker.generateLockingBytecode()) === lockingBytecode;
  });
  return input?.satoshis;
}

export function reassertDelegateLoopEntries(
  host: DelegateLoopEntriesHost,
  builder: TransactionBuilder,
): void {
  if (!shouldReassertLegacyDelegateLoopEntries(host.compilerRouteDelegateBlock)) return;
  const delegateLoopVars = delegateLoopEntryVars(host);
  if (delegateLoopVars.length === 0) return;
  const delegateFunction = (group: ExternalCallUtxoGroup): AbiFunction | undefined => (
    group.compilerRoute?.abiFunction
    ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
      .find((candidate) => candidate.name === group.functionName)
  );
  const activeDelegate = host.activeDelegateGroupIndex === undefined
    ? undefined : host.lowLevelCallUtxoGroups[host.activeDelegateGroupIndex];
  const delegateGroupIndex = host.activeDelegateGroupIndex !== undefined
    ? (activeDelegate && (delegateFunction(activeDelegate)?.sortedUpsertLoopInfo?.length ?? 0) > 0
      ? host.activeDelegateGroupIndex : -1)
    : host.lowLevelCallUtxoGroups.findIndex((group) => group.callMode === 'delegatecall'
      && (delegateFunction(group)?.sortedUpsertLoopInfo?.length ?? 0) > 0);
  const delegateGroup = delegateGroupIndex < 0 ? undefined : host.lowLevelCallUtxoGroups[delegateGroupIndex];
  const delegateAbiFunction = delegateGroup === undefined ? undefined : delegateFunction(delegateGroup);
  const delegateMaster = delegateGroup?.masterUtxo as UnlockableUtxo | undefined;
  const delegateOutputIndex = delegateMaster ? builder.outputs.findIndex((output) => (
    binToHex(typeof output.to === 'string' ? addressToLockScript(output.to) : output.to)
      === binToHex(delegateMaster.unlocker.generateLockingBytecode())
    && output.token?.category === delegateMaster.token?.category
  )) : -1;
  const delegateBase = delegateOutputIndex >= 0 ? delegateOutputIndex
    : host.blockLayout?.slots.find((slot) => slot.kind === 'lowLevelCall')?.offset;
  const delegateBlockSize = delegateAbiFunction?.blockLayout?.blockSize ?? 1;
  const ownerUnlocker = (delegateMaster as { unlocker?: {
    abiFunction?: { inputs?: ReadonlyArray<{ name: string }> };
    params?: readonly unknown[];
  } } | undefined)?.unlocker
    ?? (delegateBase !== undefined
      ? (host.allInputs[delegateBase] as { unlocker?: {
        abiFunction?: { inputs?: ReadonlyArray<{ name: string }> };
        params?: readonly unknown[];
      } } | undefined)?.unlocker
      : undefined);
  const compact = unmaterializedReturnEventCompact(host,
    delegateAbiFunction?.blockLayout, ownerUnlocker,
  );
  // Inputs keep the returnEvent pad; outputs compact it away. Balanced P' indices past that
  // pad must shift down by `compact` so entries occupy the compiler's compacted coordinates.
  const returnEventAbs = delegateBase !== undefined
    ? (() => {
      const offset = delegateAbiFunction?.blockLayout?.slots?.find((slot) => slot.kind === 'returnEvent')?.offset;
      return offset === undefined ? undefined : delegateBase + offset;
    })()
    : undefined;
  const mapPredToCompactedOutput = (predInputIndex: number): number => {
    if (predInputIndex < 0) return predInputIndex;
    let outputIndex = predInputIndex;
    if (compact > 0 && returnEventAbs !== undefined && predInputIndex > returnEventAbs) {
      outputIndex -= compact;
    }
    // Written dynamic chunks and reclaimed continuation chunks are consumed storage inputs. Their replacements
    // live in the authenticated suffix, so they do not reserve corresponding positions in the compact output
    // band. Compact only resources physically preceding this predecessor; disposal inputs can be positioned
    // after it by a balanced trailing layout.
    const inputOnlyResources = new Set([...host.dynamicChunkInputs, ...host.trailingDisposalInputs]);
    for (let index = 0; index < predInputIndex; index += 1) {
      if (inputOnlyResources.has(host.allInputs[index])) outputIndex -= 1;
    }
    return outputIndex;
  };
  let outputIndex = host.compilerRouteDelegateBlock
    ? host.getLoopEntryOutputBase()
    : delegateBase !== undefined
      ? delegateBase + delegateBlockSize - compact
      : host.getLoopEntryOutputBase();
  if (!host.compilerRouteDelegateBlock) outputIndex += host.iterationEntryInputs.length;
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_PAD_HOLE === '1') {
    const ownedIdx = returnOutputIdxFromUnlocker(ownerUnlocker);
    console.error('reassert-compact', {
      compact,
      ownedIdx,
      plannedReturnOutputIndex: host.plannedReturnOutputIndex,
      delegateBase,
      delegateBlockSize,
      returnEventAbs,
      trailingBase: delegateAbiFunction?.blockLayout?.trailingBase,
      hasReturnEvent: delegateAbiFunction?.blockLayout?.slots?.some((s) => s.kind === 'returnEvent'),
      compilerRouteDelegateBlock: host.compilerRouteDelegateBlock,
      iterEntries: host.iterationEntryInputs.length,
      dynChunks: host.dynamicChunkInputs.length,
      trailingDisposal: host.trailingDisposalInputs.length,
      outputIndex,
      outLen: builder.outputs.length,
      out6: builder.outputs[6]
        ? {
          to: typeof builder.outputs[6].to === 'string'
            ? builder.outputs[6].to
            : binToHex(builder.outputs[6].to as Uint8Array),
          token: builder.outputs[6].token?.category,
          cap: builder.outputs[6].token?.nft?.capability,
          commit: String(builder.outputs[6].token?.nft?.commitment ?? '').slice(0, 24),
        }
        : null,
    });
  }
  for (const lv of delegateLoopVars) {
    for (const commitment of host.loopEntryCommitments.get(lv.collection) ?? []) {
      if (commitment === '' || commitment === '00') continue;
      const categoryId = lv.categoryId ?? host.categoryId;
      const lockHex = binToHex(lv.lockingBytecode);
      const outputCommitment = commitment.toLowerCase();
      // P' keeps the predecessor's slot prefix and must occupy that input's balanced index.
      // Parking both predecessor and new entry on the trailing band can make
      // INPUTINDEX+N introspection read funder pads through a proxy forwarder.
      const predInputIndex = outputCommitment.length >= 64
        ? host.allInputs.findIndex((input) => {
          const inputCommitment = commitmentHexOf(input.token?.nft?.commitment).toLowerCase();
          return input.token?.category === categoryId
            && input.token.nft?.capability === 'mutable'
            && inputCommitment.length >= 64
            && inputCommitment.slice(0, 64) === outputCommitment.slice(0, 64)
            && binToHex(input.unlocker.generateLockingBytecode()) === lockHex;
        })
        : -1;
      const compactedPred = mapPredToCompactedOutput(predInputIndex);
      const targetIndex = compactedPred >= 0 ? compactedPred : outputIndex;
      while (targetIndex >= builder.outputs.length) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
      }
      const occupant = builder.outputs[targetIndex];
      const occupantCommit = String(occupant?.token?.nft?.commitment ?? '');
      if (occupantCommit.toLowerCase() === outputCommitment
        && occupant?.token?.category === categoryId) {
        if (compactedPred >= 0) {
          // NEW must follow P' even when P' reused the predecessor's balanced index.
          outputIndex = Math.max(outputIndex, compactedPred + 1);
        } else {
          outputIndex += 1;
        }
        continue;
      }
      const entryOutput = {
        to: lv.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: categoryId,
          nft: { capability: 'mutable' as const, commitment },
        },
      };
      entryOutput.amount = loopEntryTransitionSatoshis(host, lv, commitment)
        ?? BigInt(Math.max(1200, calculateDust(entryOutput)));
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_PAD_HOLE === '1') {
        console.error('reassert-loop-entry', {
          targetIndex, predInputIndex, compactedPred, outputIndex,
          commitment: outputCommitment.slice(0, 24),
        });
      }
      builder.outputs[targetIndex] = entryOutput;
      if (compactedPred >= 0) {
        outputIndex = Math.max(outputIndex, compactedPred + 1);
      } else {
        outputIndex += 1;
      }
    }
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_PAD_HOLE === '1') {
    const summarize = (index: number): Record<string, unknown> | null => {
      const out = builder.outputs[index];
      if (!out) return null;
      return {
        to: typeof out.to === 'string' ? out.to : binToHex(out.to as Uint8Array),
        token: out.token?.category,
        cap: out.token?.nft?.capability,
        commit: String(out.token?.nft?.commitment ?? '').slice(0, 24),
      };
    };
    console.error('reassert-after', {
      out5: summarize(5),
      out6: summarize(6),
      out7: summarize(7),
      out8: summarize(8),
    });
  }
}
