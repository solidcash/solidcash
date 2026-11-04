/**
 * phase-boundary extract: SC _createBuilder extract — promote delegatecall impl entry ABI metadata.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

export type CreateBuilderEntryCompilerRoute = NonNullable<ExternalCallUtxoGroup['compilerRoute']>;

export type CreateBuilderEntryResolvedCall = {
  type?: string;
  contract?: {
    inner: { artifact: Artifact };
  };
  functionName?: string;
  args?: FunctionArgument[];
  compilerRoute?: CreateBuilderEntryCompilerRoute;
};

export interface ResolveCreateBuilderEntryAbiResult {
  entryAccesses: AbiFunction['entryAccesses'];
  entryAbiFunction: AbiFunction | undefined;
  entryArtifact: Artifact;
  /** Matches `_createBuilder` `args: any[]` so later loop/journal planning can rewrite frames. */
  entryArgs: any[];
  entryCompilerRoute: CreateBuilderEntryCompilerRoute | undefined;
}

/**
 * When `__forward` (or another LLC wrapper) has no entryAccesses, promote the
 * first qualifying delegatecall implementation's entry / journal / compute metadata
 * so entry NFT planning runs against the proxy's grafted collections.
 */
export function resolveCreateBuilderEntryAbi(
  abiFunction: AbiFunction | undefined,
  args: any[],
  ownerArtifact: Artifact,
  resolvedCalls: readonly CreateBuilderEntryResolvedCall[],
): ResolveCreateBuilderEntryAbiResult {
  let entryAccesses = abiFunction?.entryAccesses;
  let entryAbiFunction = abiFunction;
  let entryArtifact: Artifact = ownerArtifact;
  let entryArgs: any[] = args;
  let entryCompilerRoute: CreateBuilderEntryCompilerRoute | undefined;

  // A delegatecall'd impl that writes a mapping does so against the PROXY's grafted collections (this.categoryId).
  // __forward itself has no entryAccesses, so route the impl fn's - the entry machinery below then mints/updates
  // the proxy's entry NFTs at the proxy-block entry slot (reserved via delegateEventSlots).
  if (!entryAccesses?.length && abiFunction?.lowLevelCalls) {
    for (let i = 0; i < abiFunction.lowLevelCalls.length; i++) {
      if (abiFunction.lowLevelCalls[i].callMode !== 'delegatecall') continue;
      const ci = resolvedCalls[i];
      if (ci?.type !== 'stateful' || !ci.contract) continue;
      // Compiler-owned message-bus routes are intentionally removed from the public artifact ABI. The exact
      // route survives on the delegate call descriptor, so prefer it here; looking only in `artifact.abi`
      // silently reduced every route entry slot to a generic funding placeholder.
      const implFn = ci.compilerRoute?.abiFunction
        ?? (ci.contract.inner.artifact.abi as readonly AbiFunction[]).find((f) => f.name === ci.functionName);
      // Dynamic mapping writes (including mapping(K => V[]).push()) may have no fixed entryAccesses at all.
      // They still own the trailing entry-NFT region, so promote their ABI metadata just like a fixed access.
      // Compute sidecars (keccak/ecrecover) are also published only on the implementation ABI: without
      // promoting that metadata, a keccak/ecrecover-only delegate under __forward leaves
      // keccakComputeCoSpendUtxos empty and parks a funder pad in the keccakSideCar slot.
      if (implFn && ((implFn.entryAccesses?.length ?? 0) > 0 || (implFn.entryLoopWrites?.length ?? 0) > 0
        || (implFn.sortedInsertLoopInfo?.length ?? 0) > 0 || (implFn.sortedUpsertLoopInfo?.length ?? 0) > 0
        || (implFn.sortedBatchInfo?.length ?? 0) > 0
        || (implFn.dynamicWrites?.length ?? 0) > 0
        || implFn.keccakCompute === true
        || implFn.ecrecoverCompute === true
        || implFn.ecrecoverEvmFlags?.some(Boolean) === true)) {
        entryAccesses = implFn.entryAccesses;
        entryAbiFunction = implFn;
        entryArtifact = ci.contract.inner.artifact;
        entryCompilerRoute = ci.compilerRoute;
        if (entryCompilerRoute) {
          const compilerRoute = entryCompilerRoute;
          // Compiler routes retain a compact visible-only argument frame. Entry planning indexes arguments by
          // the complete route ABI, so expand that frame by name before resolving collection keys/values.
          // Treating the compact vector as ABI-positioned makes every witness after the first hidden input
          // undefined (or, with a longer frame, assigns an unrelated graph value to the collection key).
          let visibleIndex = 0;
          entryArgs = implFn.inputs.map((input) => {
            if (input.name.startsWith('__internal__')) {
              return compilerRoute.internalArgs?.[input.name];
            }
            const value = compilerRoute.args[visibleIndex];
            visibleIndex += 1;
            return value;
          }) as FunctionArgument[];
        } else {
          entryArgs = ci.args ?? [];
        }
        break;
      }
    }
  }

  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_DELEGATE_ENTRY === '1' && entryAbiFunction !== abiFunction) {
    console.error('delegate-entry-metadata', {
      outer: abiFunction?.name,
      entry: entryAbiFunction?.name,
      blockSize: entryAbiFunction?.blockLayout?.blockSize,
      trailingBase: entryAbiFunction?.blockLayout?.trailingBase,
      dynamicReads: entryAbiFunction?.dynamicReads,
      dynamicWrites: entryAbiFunction?.dynamicWrites,
      keccakCompute: entryAbiFunction?.keccakCompute,
      args: entryArgs.map((arg) => arg instanceof Uint8Array
        ? { bytes: arg.length, head: binToHex(arg).slice(0, 16), tail: binToHex(arg).slice(-16) }
        : typeof arg === 'string' && arg.startsWith('0x')
          ? { hexChars: arg.length - 2, head: arg.slice(2, 18), tail: arg.slice(-16) }
          : typeof arg),
    });
  }

  return {
    entryAccesses,
    entryAbiFunction,
    entryArtifact,
    entryArgs,
    entryCompilerRoute,
  };
}
