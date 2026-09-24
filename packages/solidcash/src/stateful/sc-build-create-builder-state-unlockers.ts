/**
 * phase-boundary extract: SC _createBuilder extract — build state-input unlocker + data-NFT unlockers.
 */

import type { AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Unlocker, Utxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

export type BuildCreateBuilderStateUnlockersHost = {
  readonly categoryId: string;
  readonly inner: any;
  canonicalAbiFunctionSignature: (fn: AbiFunction) => string;
};

export type BuildCreateBuilderStateUnlockersResult = {
  stateInputUnlocker: Unlocker;
  buildStateInputUnlocker: () => Unlocker;
  refreshPhysicalDelegateInputIndex: ((
    builder: StatefulTransactionBuilder, materialized?: TransactionBuilder,
  ) => Unlocker) | undefined;
  dataNftUnlockers: Unlocker[];
  blockBase: number;
  topLevelDynamicChunkArgumentIndex: number;
};

/**
 * Construct the master-state unlocker (and optional physical-delegate refresh
 * closure) plus per-data-NFT unlockers after synthetic args are finalized.
 */
export function buildCreateBuilderStateUnlockers(
  host: BuildCreateBuilderStateUnlockersHost,
  params: {
    functionName: string;
    abiFunction: AbiFunction | undefined;
    physicalAbiFunction: AbiFunction | undefined;
    finalArgs: FunctionArgument[];
    args: readonly FunctionArgument[];
    activeDelegateGroupIndex: number | undefined;
    delegateInputArgumentIndex: number;
    lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
    lowLevelCallInputBase: number;
    filteredDataNftUtxos: readonly Utxo[];
    overrides: any;
  },
): BuildCreateBuilderStateUnlockersResult {
  let {
    functionName, abiFunction, physicalAbiFunction, finalArgs, args,
    activeDelegateGroupIndex, delegateInputArgumentIndex, lowLevelCallUtxoGroups,
    lowLevelCallInputBase, filteredDataNftUtxos, overrides,
  } = params;

  const unlockName = functionName === '__fallback' ? 'fallback'
    : functionName === '__receive' ? 'receive' : functionName;
  const exactUnlockName = overrides?.abiFunction
    && host.inner.artifact.abi.filter((candidate: AbiFunction) => candidate.name === overrides.abiFunction!.name).length > 1
    ? host.canonicalAbiFunctionSignature(overrides.abiFunction)
    : undefined;
  let buildStateInputUnlocker: () => Unlocker;
  let refreshPhysicalDelegateInputIndex: ((
    builder: StatefulTransactionBuilder, materialized?: TransactionBuilder,
  ) => Unlocker) | undefined;
  const topLevelDynamicChunkArgumentIndex = abiFunction?.inputs.findIndex(
    (input) => input.name === '__internal__dynamicChunkInputBase',
  ) ?? -1;
  if (overrides?.compilerRouteSelector && abiFunction && physicalAbiFunction
    && physicalAbiFunction !== abiFunction) {
    // A compiler route executed through a proxy has two distinct ABIs: the route ABI determines the complete
    // participant layout, while the physical proxy ABI determines the master input's unlocking stack. Encode
    // the latter from its visible call arguments and resolve its hidden geometry witnesses by name. Feeding the
    // route frame to the proxy places the proxy selector in the delegate-index slot and makes OP_UTXO interpret
    // those four selector bytes as a (usually negative) transaction index.
    let visibleIndex = 0;
    let physicalDelegateGroupIndex = -1;
    let physicalDelegateArgumentIndex = -1;
    const physicalArgs = physicalAbiFunction.inputs.map((input, inputIndex) => {
      if (!input.name.startsWith('__internal__')) return args[visibleIndex++];
      if (input.name === '__internal__delegateInputIndex') {
        const delegateGroupIdx = activeDelegateGroupIndex
          ?? lowLevelCallUtxoGroups.findIndex((group) => group.callMode === 'delegatecall');
        physicalDelegateGroupIndex = delegateGroupIdx;
        physicalDelegateArgumentIndex = inputIndex;
        const delegateAbsoluteBase = (overrides.blockBase ?? 0) + lowLevelCallInputBase;
        return BigInt(delegateGroupIdx < 0 ? delegateAbsoluteBase
          : delegateAbsoluteBase + lowLevelCallUtxoGroups.slice(0, delegateGroupIdx)
            .reduce((sum, group) => sum + 1 + group.dataNftUtxos.length, 0));
      }
      throw new Error(
        `Internal error: cannot resolve physical route witness '${input.name}' for function '${functionName}'.`,
      );
    });
    const physicalUnlockFn = (exactUnlockName && (host.inner.unlock as any)[exactUnlockName])
      ?? (host.inner.unlock as any)[unlockName]
      ?? (host.inner.unlock as any)[functionName];
    buildStateInputUnlocker = () => physicalUnlockFn(...physicalArgs);
    if (physicalDelegateGroupIndex >= 0 && physicalDelegateArgumentIndex >= 0) {
      refreshPhysicalDelegateInputIndex = (builder, materialized) => {
        const target = lowLevelCallUtxoGroups[physicalDelegateGroupIndex]?.masterUtxo;
        const materializedIndex = target && materialized?.inputs.findIndex((input) => (
          input.txid.toLowerCase() === target.txid.toLowerCase() && input.vout === target.vout
        ));
        // A graph participant is built in isolation, so a materialized index is participant-local. The proxy
        // covenant executes in the final aggregate and must authenticate the absolute delegate input.
        const localIndex = materializedIndex !== undefined && materializedIndex >= 0
          ? materializedIndex
          : builder.getLowLevelCallMasterInputIndex(physicalDelegateGroupIndex);
        physicalArgs[physicalDelegateArgumentIndex] = BigInt((overrides.blockBase ?? 0) + localIndex);
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_FORWARD_ARGS === '1') {
          console.error('physical-delegate-input-refresh', {
            functionName,
            groupIndex: physicalDelegateGroupIndex,
            materializedIndex,
            selectedIndex: String(physicalArgs[physicalDelegateArgumentIndex]),
            materializedInputs: materialized?.inputs.length,
          });
        }
        return physicalUnlockFn(...physicalArgs);
      };
    }
  } else {
    const unlockFn = overrides?.compilerRouteSelector && abiFunction
      ? host.inner.createCompilerRouteUnlocker(abiFunction, overrides.compilerRouteSelector)
      : ((exactUnlockName && (host.inner.unlock as any)[exactUnlockName])
        ?? (host.inner.unlock as any)[unlockName] ?? (host.inner.unlock as any)[functionName]);
    buildStateInputUnlocker = () => unlockFn(...finalArgs);
    if (activeDelegateGroupIndex !== undefined && delegateInputArgumentIndex >= 0) {
      refreshPhysicalDelegateInputIndex = (builder, materialized) => {
        const target = lowLevelCallUtxoGroups[activeDelegateGroupIndex!]?.masterUtxo;
        const materializedIndex = target && materialized?.inputs.findIndex((input) => (
          input.txid.toLowerCase() === target.txid.toLowerCase() && input.vout === target.vout
        ));
        const localIndex = materializedIndex !== undefined && materializedIndex >= 0
          ? materializedIndex
          : builder.getLowLevelCallMasterInputIndex(activeDelegateGroupIndex!);
        finalArgs[delegateInputArgumentIndex] = BigInt((overrides?.blockBase ?? 0) + localIndex);
        return unlockFn(...finalArgs);
      };
    }
  }
  let stateInputUnlocker = buildStateInputUnlocker();
  const blockBase = overrides?.blockBase ?? 0;
  const dataNftUnlockers = filteredDataNftUtxos.map(
    () => createDataNftUnlocker(host.inner, blockBase, host.categoryId),
  );

  return {
    stateInputUnlocker,
    buildStateInputUnlocker,
    refreshPhysicalDelegateInputIndex,
    dataNftUnlockers,
    blockBase,
    topLevelDynamicChunkArgumentIndex,
  };
}
