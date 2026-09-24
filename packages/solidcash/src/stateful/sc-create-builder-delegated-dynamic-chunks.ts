/**
 * phase-boundary extract: SC _createBuilder extract — delegated dynamic read/write chunk co-spends.
 */

import { parseChunkCommitment, type AbiFunction, type StateLayout } from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import type { Contract } from '../Contract.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  createReadOnlyDynamicChunkUnlocker,
  getDynamicChunkAddress,
} from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { OnChainState } from './StateReader.js';

export type CreateBuilderDelegatedDynamicChunksHost = {
  readonly categoryId: string;
  readonly inner: Contract<any, any> & {
    provider: NetworkProvider;
  };
};

export type CreateBuilderDelegatedDynamicChunksResult = {
  iterationEntryInputs: UnlockableUtxo[];
  hasDelegatedDynamicReadChunks: boolean;
  delegatedDynamicWriteChunkCount: number;
  onChainState: OnChainState;
};

/**
 * After nested compose, fetch grafted-state dynamic chunks from co-spent
 * implementations (reads as trailing inputs; writes counted for layout).
 */
export async function createBuilderLoadDelegatedDynamicChunks(
  host: CreateBuilderDelegatedDynamicChunksHost,
  params: {
    lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
    stateLayout: StateLayout;
    dynamicReads: readonly string[];
    iterationEntryInputs: UnlockableUtxo[];
    hasDelegatedDynamicReadChunks: boolean;
    onChainState: OnChainState;
    blockBase: number;
    phaseCheckpoint?: (stage: string) => void;
  },
): Promise<CreateBuilderDelegatedDynamicChunksResult> {
  let {
    iterationEntryInputs,
    hasDelegatedDynamicReadChunks,
    onChainState,
  } = params;
  const {
    lowLevelCallUtxoGroups,
    stateLayout,
    dynamicReads,
    blockBase,
    phaseCheckpoint,
  } = params;

  // A forwarding proxy has no dynamic-read metadata of its own; the co-spent implementation does. Fetch
  // those grafted-state chunks now that delegate groups have been resolved, preserving the same trailing
  // input order used by an ordinary direct dynamic read.
  const delegatedDynamicReads = [...new Set(lowLevelCallUtxoGroups.flatMap((group) => {
    if (group.callMode !== 'delegatecall') return [];
    const delegateFunction = (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
      .find((candidate) => candidate.name === group.functionName);
    const writes = new Set(delegateFunction?.dynamicWrites ?? []);
    return [...(delegateFunction?.dynamicReads ?? [])].filter((name) => !writes.has(name));
  }))];
  phaseCheckpoint?.('delegated-dynamic-read-list');
  for (const varName of delegatedDynamicReads) {
    if (dynamicReads.includes(varName)) continue;
    const dynVar = (stateLayout.variables ?? []).find((variable) => (
      variable.name === varName && variable.dynamic
    ));
    if (!dynVar) continue;
    const chunkAddr = getDynamicChunkAddress(host.inner, host.categoryId, dynVar.name, dynVar.type);
    const chunks = (await host.inner.provider.getUtxos(chunkAddr))
      .filter((utxo) => utxo.token?.category === host.categoryId
        && utxo.token?.nft?.capability === 'mutable'
        && utxo.token?.nft?.commitment && utxo.token.nft.commitment.length > 0)
      .map((utxo) => ({
        utxo,
        chunkIndex: parseChunkCommitment(utxo.token!.nft!.commitment).chunkIndex,
      }))
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
    for (const { utxo } of chunks) {
      hasDelegatedDynamicReadChunks = true;
      iterationEntryInputs.push({
        ...utxo,
        unlocker: createReadOnlyDynamicChunkUnlocker(
          host.inner, blockBase, host.categoryId, dynVar.name, dynVar.type,
        ),
      });
    }
  }
  phaseCheckpoint?.('delegated-dynamic-reads-complete');

  // RMW write chunks occupy the same impl+trailing band as read-only chunks
  // (closeJob jobs at input 10-11). Count them before publishing nested
  // master indices so MarketplaceData stays at 12, not on a jobs chunk.
  const delegatedDynamicWriteNames = [...new Set(lowLevelCallUtxoGroups.flatMap((group) => {
    if (group.callMode !== 'delegatecall') return [];
    const delegateFunction = (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
      .find((candidate) => candidate.name === group.functionName);
    return [...(delegateFunction?.dynamicWrites ?? [])];
  }))];
  let delegatedDynamicWriteChunkCount = 0;
  for (const varName of delegatedDynamicWriteNames) {
    const dynVar = (stateLayout.variables ?? []).find((variable) => (
      variable.name === varName && variable.dynamic
    ));
    if (!dynVar) continue;
    const chunkAddr = getDynamicChunkAddress(host.inner, host.categoryId, dynVar.name, dynVar.type);
    const writeChunks = (onChainState.dynamicChunkUtxos?.[varName]
      ?? await host.inner.provider.getUtxos(chunkAddr))
      .filter((utxo) => utxo.token?.category === host.categoryId
        && utxo.token?.nft?.capability === 'mutable'
        && utxo.token?.nft?.commitment && utxo.token.nft.commitment.length > 0);
    if (!onChainState.dynamicChunkUtxos) onChainState.dynamicChunkUtxos = {};
    onChainState.dynamicChunkUtxos[varName] = writeChunks;
    delegatedDynamicWriteChunkCount += writeChunks.length;
  }

  return {
    iterationEntryInputs,
    hasDelegatedDynamicReadChunks,
    delegatedDynamicWriteChunkCount,
    onChainState,
  };
}
