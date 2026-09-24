/**
 * phase-boundary extract: STB public-surface extract — setFunderUtxos input reassembly.
 */

import { binToHex } from '@bitauth/libauth';
import type { UnlockableUtxo } from '../interfaces.js';
import type { FunctionBlockLayout } from '@solidcash/utils';
import {
  flattenLlcGroupInputs,
  type EntryNftInfo,
  type ExternalCallUtxoGroup,
  type TokenContainerInfo,
} from './external-call-utxo-group.js';

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
  readonly pendingJobEventsPredecessors: readonly UnlockableUtxo[];
  buildInputs(
    entryInputs: UnlockableUtxo[],
    tokenContainerInputs: UnlockableUtxo[],
    satoshiContainerInputs: UnlockableUtxo[],
    externalOutStateInputs: UnlockableUtxo[],
    externalCallInputs: UnlockableUtxo[],
    lowLevelCallInputs: UnlockableUtxo[],
  ): UnlockableUtxo[];
  swapMintingOffValueChunkBand(): void;
  placeJobEventsPredecessorInputs(extras: readonly UnlockableUtxo[]): void;
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
  const externalOutStateInputs: UnlockableUtxo[] = [];
  for (const g of host.externalOutStateUtxoGroups) {
    externalOutStateInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos);
  }
  const externalCallInputs: UnlockableUtxo[] = [];
  for (const g of host.externalCallUtxoGroups) {
    if (g.sharedGroupIndex !== undefined) continue;
    if (g.blockInputs) {
      externalCallInputs.push(...g.blockInputs);
    } else {
      externalCallInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos);
    }
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
  host.placeJobEventsPredecessorInputs(host.pendingJobEventsPredecessors);
  debugInputAssembly('refresh-predecessors-placed');
  // Callee anchors precede the caller's own: emitLogicalMsgSenderAnchorResolution resolves the caller's
  // identity from the LAST input, so that tail position must stay the caller's.
  host.allInputs.push(...host.externalIdentityAnchorUtxos);
  if (host.logicalIdentityUtxo) host.allInputs.push(host.logicalIdentityUtxo);
  debugInputAssembly('refresh-identity-anchors-appended');
}
