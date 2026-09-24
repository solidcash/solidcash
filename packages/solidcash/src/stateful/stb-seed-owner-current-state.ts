/**
 * phase-boundary extract: STB build-phase extract — seed owner currentState from data NFTs + stateUpdates.
 */

import {
  parsePushdataCommitment,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';

export interface SeedOwnerCurrentStateHost {
  readonly requiredNftIndices: readonly number[];
  readonly dataNftUtxos: readonly UnlockableUtxo[];
  readonly stateLayout: StateLayout;
  readonly stateUpdates: ReadonlyMap<string, StateValue>;
}

/**
 * Read owner data-NFT commitments into a mutable state map, then apply explicit stateUpdates.
 */
export function seedOwnerCurrentState(
  host: SeedOwnerCurrentStateHost,
): Record<string, StateValue> {
  const currentState: Record<string, StateValue> = {};
  for (let i = 0; i < host.requiredNftIndices.length; i++) {
    const nftIdx = host.requiredNftIndices[i];
    const nftUtxo = host.dataNftUtxos[i];
    if (nftUtxo?.token?.nft?.commitment) {
      const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, host.stateLayout, nftIdx);
      for (const [key, value] of Object.entries(parsed)) {
        currentState[key] = value;
      }
    }
  }
  for (const [name, value] of host.stateUpdates) {
    currentState[name] = value;
  }
  return currentState;
}
