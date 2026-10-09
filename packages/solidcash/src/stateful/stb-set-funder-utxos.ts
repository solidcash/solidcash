/**
 * phase-boundary extract: STB public-surface extract — setFunderUtxos input reassembly.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { FunctionBlockLayout } from '@solidcash/utils';
import {
  flattenLlcGroupInputs,
  type EntryNftInfo,
  type ExternalCallUtxoGroup,
  type TokenContainerInfo,
} from './external-call-utxo-group.js';
import { identityAnchorPlacement } from './stb-build-inputs.js';

export interface SetFunderUtxosHost {
  funderUtxos: UnlockableUtxo[];
  allInputs: UnlockableUtxo[];
  readonly entryNfts: readonly EntryNftInfo[];
  readonly tokenContainers: readonly TokenContainerInfo[];
  readonly satoshiContainerUtxo?: UnlockableUtxo;
  readonly externalOutStateUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly blockLayout?: FunctionBlockLayout;
  readonly preserveBlockLayoutWidth?: boolean;
  readonly compilerRouteDelegateBlock?: boolean;
  readonly externalIdentityAnchorUtxos: readonly UnlockableUtxo[];
  readonly logicalIdentityUtxo?: UnlockableUtxo;
  readonly pendingValueChunkPredecessors: readonly UnlockableUtxo[];
  buildInputs(
    entryInputs: UnlockableUtxo[],
    tokenContainerInputs: UnlockableUtxo[],
    satoshiContainerInputs: UnlockableUtxo[],
    externalOutStateInputs: UnlockableUtxo[],
    externalCallInputs: UnlockableUtxo[],
    lowLevelCallInputs: UnlockableUtxo[],
  ): UnlockableUtxo[];
  swapMintingOffValueChunkBand(): void;
  placeValueChunkPredecessorInputs(extras: readonly UnlockableUtxo[]): void;
}

/**
 * Replace funder UTXOs and rebuild the assembled input list (entries, containers, external/LLC
 * blocks, minting-band relocation, predecessors, and identity anchors).
 */
export function setFunderUtxos(
  host: SetFunderUtxosHost,
  funders: UnlockableUtxo[],
): void {
  host.funderUtxos = funders;
  // Rebuild allInputs with new funders
  const entryInputs = host.entryNfts
    .filter((e) => e.exists && e.utxo)
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((e) => e.utxo!);
  const tokenContainerInputs = host.tokenContainers
    .filter((d) => d.exists && d.utxo)
    .sort((a, b) => a.tokenContainerSlotIndex - b.tokenContainerSlotIndex)
    .map((d) => d.utxo!);
  const satoshiContainerInputs = host.satoshiContainerUtxo ? [host.satoshiContainerUtxo] : [];
  // The same order the constructor assembles: B's keccak side-cars follow its data NFTs (its block's slots).
  const externalOutStateInputs: UnlockableUtxo[] = [];
  for (const g of host.externalOutStateUtxoGroups) {
    // Rebuild the same physical band as constructor assembly. Omitting the compute inputs here replaces the
    // callee's keccak slot with a funder while its side-car recreation remains in the matching output slot.
    externalOutStateInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos, ...(g.keccakInputs ?? []));
  }
  const externalCallInputs: UnlockableUtxo[] = [];
  for (const g of host.externalCallUtxoGroups) {
    if (g.sharedGroupIndex !== undefined) continue;
    if (g.blockInputs) {
      externalCallInputs.push(...g.blockInputs);
    } else {
      externalCallInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos);
    }
    externalCallInputs.push(...(g.ordinaryDynamicChunkInputs ?? []).map((chunk) => chunk.utxo));
  }
  const lowLevelCallInputs: UnlockableUtxo[] = [];
  const embeddedDelegateGroups = new Set(host.externalCallUtxoGroups.flatMap((group) => (
    group.delegateEmbeddedInBlock && group.delegateCallGroupIndex !== undefined
      ? [group.delegateCallGroupIndex] : []
  )));
  for (const [groupIndex, g] of host.lowLevelCallUtxoGroups.entries()) {
    if (embeddedDelegateGroups.has(groupIndex)) continue;
    lowLevelCallInputs.push(...flattenLlcGroupInputs(g));
  }
  host.allInputs = host.buildInputs(
    entryInputs, tokenContainerInputs, satoshiContainerInputs,
    externalOutStateInputs, externalCallInputs, lowLevelCallInputs,
  );
  const debugInputAssembly = (stage: string): void => {
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_INPUTS !== '1') return;
    console.error('stateful-input-assembly', {
      stage,
      count: host.allInputs.length,
      routeBlockSize: host.blockLayout?.blockSize,
      trailingCapacity: host.blockLayout?.trailingCapacity,
      preserveBlockLayoutWidth: host.preserveBlockLayoutWidth,
      compilerRouteDelegateBlock: host.compilerRouteDelegateBlock,
      lowLevelCallInputs: lowLevelCallInputs.length,
      externalIdentityAnchors: host.externalIdentityAnchorUtxos.length,
      logicalIdentityAnchor: host.logicalIdentityUtxo !== undefined,
      mutableInputs: host.allInputs.flatMap((input, index) => (
        input.token?.nft?.capability === 'mutable' ? [{
          index,
          outpoint: `${input.txid}:${input.vout}`,
          category: input.token.category.slice(0, 16),
          commitment: input.token.nft.commitment.slice(0, 24),
          lockingBytecode: binToHex(input.unlocker.generateLockingBytecode()).slice(0, 24),
        }] : []
      )),
    });
  };
  debugInputAssembly('refreshed');
  host.swapMintingOffValueChunkBand();
  debugInputAssembly('refresh-minting-band-relocated');
  host.placeValueChunkPredecessorInputs(host.pendingValueChunkPredecessors);
  debugInputAssembly('refresh-predecessors-placed');
  host.allInputs.push(...identityAnchorPlacement(
    host.blockLayout, host.externalIdentityAnchorUtxos, host.logicalIdentityUtxo,
  ).trailing);
  debugInputAssembly('refresh-identity-anchors-appended');
}
