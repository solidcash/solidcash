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
    finalArgs: FunctionArgument[];
    activeDelegateGroupIndex: number | undefined;
    delegateInputArgumentIndex: number;
    lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
    filteredDataNftUtxos: readonly Utxo[];
    overrides: any;
  },
): BuildCreateBuilderStateUnlockersResult {
  const {
    functionName, abiFunction, finalArgs,
    activeDelegateGroupIndex, delegateInputArgumentIndex, lowLevelCallUtxoGroups,
    filteredDataNftUtxos, overrides,
  } = params;

  const unlockName = functionName === '__fallback' ? 'fallback'
    : functionName === '__receive' ? 'receive' : functionName;
  const exactUnlockName = overrides?.abiFunction
    && host.inner.artifact.abi.filter((candidate: AbiFunction) => candidate.name === overrides.abiFunction!.name).length > 1
    ? host.canonicalAbiFunctionSignature(overrides.abiFunction)
    : undefined;
  let refreshPhysicalDelegateInputIndex: ((
    builder: StatefulTransactionBuilder, materialized?: TransactionBuilder,
  ) => Unlocker) | undefined;
  const topLevelDynamicChunkArgumentIndex = abiFunction?.inputs.findIndex(
    (input) => input.name === '__internal__dynamicChunkInputBase',
  ) ?? -1;
  const unlockFn = (exactUnlockName && (host.inner.unlock as any)[exactUnlockName])
    ?? (host.inner.unlock as any)[unlockName] ?? (host.inner.unlock as any)[functionName];
  const buildStateInputUnlocker = (): Unlocker => unlockFn(...finalArgs);
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
