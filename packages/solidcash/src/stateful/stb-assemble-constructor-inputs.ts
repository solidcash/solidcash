/**
 * phase-boundary extract: STB constructor extract — flatten participant bands and assemble allInputs.
 */

import { binToHex } from '@bitauth/libauth';
import type { UnlockableUtxo } from '../interfaces.js';
import type { FunctionBlockLayout, StateLayout } from '@solidcash/utils';
import {
  flattenLlcGroupInputs,
  type EntryNftInfo,
  type ExternalCallUtxoGroup,
  type TokenContainerInfo,
} from './external-call-utxo-group.js';
import { identityAnchorPlacement } from './stb-build-inputs.js';

export interface AssembleConstructorInputsHost {
  readonly stateLayout: StateLayout;
  readonly externalOutStateUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly entryNfts: readonly EntryNftInfo[];
  readonly tokenContainers: readonly TokenContainerInfo[];
  readonly satoshiContainerUtxo?: UnlockableUtxo;
  readonly externalIdentityAnchorUtxos: readonly UnlockableUtxo[];
  readonly logicalIdentityUtxo?: UnlockableUtxo;
  readonly pendingJobEventsPredecessors: readonly UnlockableUtxo[];
  readonly blockLayout?: FunctionBlockLayout;
  readonly preserveBlockLayoutWidth: boolean;
  readonly compilerRouteDelegateBlock: boolean;
  requiredNftIndices: readonly number[];
  allInputs: UnlockableUtxo[];
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
 * After constructor field assignment: default NFT indices, flatten outState/call/LLC bands,
 * build the ordered input list, relocate minting off the value-chunk band, place jobEvents
 * predecessors, then append identity anchors (caller last).
 */
export function assembleConstructorInputs(
  host: AssembleConstructorInputsHost,
  requiredNftIndicesOption?: readonly number[],
): void {
  // Default to all NFT indices if not specified
  host.requiredNftIndices = requiredNftIndicesOption
    ? [...requiredNftIndicesOption]
    : Array.from({ length: host.stateLayout.dataNftCount }, (_, i) => i);

  // Flatten external outState inputs: [B1's master, B1's data NFTs, B1's keccak side-cars, ...] - the keccak
  // side-cars follow B's data NFTs (B's block-layout order: master < dataNft < keccakSideCar) so B's covenant
  // reads them at their slot.
  const externalOutStateInputs: UnlockableUtxo[] = [];
  for (const group of host.externalOutStateUtxoGroups) {
    externalOutStateInputs.push(group.masterUtxo as UnlockableUtxo);
    externalOutStateInputs.push(...group.dataNftUtxos);
    if (group.keccakInputs) externalOutStateInputs.push(...group.keccakInputs);
  }

  // Flatten external call inputs - use full block when available
  const externalCallInputs: UnlockableUtxo[] = [];
  for (const group of host.externalCallUtxoGroups) {
    if (group.sharedGroupIndex !== undefined) continue;
    if (group.blockInputs) {
      // Full block: master + dataNfts + entries + SC + TCs + funders (all ordered by blockLayout)
      externalCallInputs.push(...group.blockInputs);
    } else {
      // Legacy: just master + dataNfts
      externalCallInputs.push(group.masterUtxo as UnlockableUtxo);
      externalCallInputs.push(...group.dataNftUtxos);
    }
  }

  // Flatten low-level call inputs (stateful groups + raw UTXOs). Prefer the full
  // blockInputs band when present (master + data/funders + entry + event) so nested
  // publishJobEvent keeps UTXOBYTECODE(INPUTINDEX+entry) on the collection lock.
  const lowLevelCallInputs: UnlockableUtxo[] = [];
  const embeddedDelegateGroups = new Set(host.externalCallUtxoGroups.flatMap((group) => (
    group.delegateEmbeddedInBlock && group.delegateCallGroupIndex !== undefined
      ? [group.delegateCallGroupIndex] : []
  )));
  for (const [groupIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
    if (embeddedDelegateGroups.has(groupIndex)) continue;
    lowLevelCallInputs.push(...flattenLlcGroupInputs(group));
  }

  // Add master UTXO as first input, then data NFT UTXOs, then read-only NFTs,
  // then outState NFTs, then external call NFTs, then low-level call NFTs,
  // then entry NFTs, then token container UTXOs, then satoshi container UTXO
  const entryInputs = host.entryNfts
    .filter((e) => e.exists && e.utxo)
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((e) => e.utxo!);

  const tokenContainerInputs = host.tokenContainers
    .filter((d) => d.exists && d.utxo)
    .sort((a, b) => a.tokenContainerSlotIndex - b.tokenContainerSlotIndex)
    .map((d) => d.utxo!);

  const satoshiContainerInputs = host.satoshiContainerUtxo ? [host.satoshiContainerUtxo] : [];

  host.allInputs = host.buildInputs(
    entryInputs, tokenContainerInputs, satoshiContainerInputs,
    externalOutStateInputs, externalCallInputs,
    lowLevelCallInputs,
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
  debugInputAssembly('constructed');
  host.swapMintingOffValueChunkBand();
  debugInputAssembly('minting-band-relocated');
  host.placeJobEventsPredecessorInputs(host.pendingJobEventsPredecessors);
  debugInputAssembly('predecessors-placed');
  // Published identity slots are already populated by buildInputs. Only legacy/unrepresented anchors remain
  // in the post-block tail, with the caller's logical identity last.
  host.allInputs.push(...identityAnchorPlacement(
    host.blockLayout, host.externalIdentityAnchorUtxos, host.logicalIdentityUtxo,
  ).trailing);
  debugInputAssembly('identity-anchors-appended');
}
