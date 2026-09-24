/**
 * phase-boundary extract: SC _createBuilder extract — decide full vs master-only on-chain state load.
 */

import type { AbiFunction } from '@solidcash/utils';
import type { OnChainState } from './StateReader.js';

export interface LoadCreateBuilderOnChainStateHost {
  getFullState(): Promise<OnChainState>;
  getMasterOnlyState(): Promise<OnChainState>;
}

/**
 * Load the on-chain state needed for a builder: full state when the ABI frame touches
 * data NFTs / entries / externals / transfers, otherwise master-only.
 */
export async function loadCreateBuilderOnChainState(
  host: LoadCreateBuilderOnChainStateHost,
  requiredNftIndices: readonly number[],
  abiFunction: AbiFunction | undefined,
): Promise<OnChainState> {
  const needsFullState = requiredNftIndices.length > 0
    || (abiFunction?.entryAccesses?.length ?? 0) > 0
    || (abiFunction?.externalReads?.length ?? 0) > 0
    || (abiFunction?.externalCalls?.length ?? 0) > 0
    || (abiFunction?.lowLevelCalls?.length ?? 0) > 0
    || (abiFunction?.tokenContainerAccesses?.length ?? 0) > 0
    || (abiFunction?.collectionIterations?.length ?? 0) > 0
    || (abiFunction?.transferCount ?? 0) > 0;

  if (needsFullState) {
    return host.getFullState();
  }
  return host.getMasterOnlyState();
}
