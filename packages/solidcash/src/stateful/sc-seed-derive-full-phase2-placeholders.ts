/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase-2 probe placeholder pre-population.
 */

import { encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import type { EmitAbi } from '@solidcash/utils';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

export type DeriveFullTokenContainerTransferOp = {
  type: 'transfer' | 'transferNft';
  categoryId: string;
  outputSlot?: number;
};

export type DeriveFullPhase2PlaceholderSeed = {
  dummyLbc: Uint8Array;
  satoshiTransferCount: number;
  ftOps: DeriveFullTokenContainerTransferOp[];
  nftOps: DeriveFullTokenContainerTransferOp[];
};

/**
 * Seed event and transfer placeholders so the Phase-2 probe transaction has the
 * correct output count before iterative commitment derivation.
 */
export function seedDeriveFullPhase2Placeholders(
  stb: StatefulTransactionBuilder,
  emitInfos: readonly EmitAbi[] | undefined,
  transferCount: number | undefined,
  tokenContainerTransferOps: readonly DeriveFullTokenContainerTransferOp[] | undefined,
): DeriveFullPhase2PlaceholderSeed {
  // Pre-populate event placeholders so the probe transaction has event outputs
  if (emitInfos && emitInfos.length > 0) {
    for (const emitInfo of emitInfos) {
      stb.addEventPlaceholder(emitInfo.eventSignature, emitInfo.emitIndex);
    }
  }

  // Pre-populate transfer placeholders so the probe transaction has correct output count.
  const dummyLbc = encodeLockingBytecodeP2pkh(new Uint8Array(20));
  const satoshiTransferCount = transferCount ?? 0;
  if (satoshiTransferCount > 0) {
    for (let i = 0; i < satoshiTransferCount; i++) stb.addTransfer(dummyLbc, 1000n);
  }
  const ftOps = tokenContainerTransferOps?.filter((o) => o.type === 'transfer') ?? [];
  const nftOps = tokenContainerTransferOps?.filter((o) => o.type === 'transferNft') ?? [];
  for (const op of ftOps) {
    stb.addTokenContainerTransfer(op.categoryId, dummyLbc, 1n, op.outputSlot);
  }
  for (const op of nftOps) {
    // An immutable NFT is conserved by category + commitment. Seeding an empty placeholder commitment
    // makes token conservation fail before the VM can reveal the handler-authored transfer arguments.
    // Start from the co-spent container's NFT identity; mutable/minting identities also admit this
    // preservation-shaped probe and are replaced from the trace once execution reaches transferNft.
    const inputNft = stb.getTokenContainerInfos().find((container) =>
      container.tokenContainerCategoryId === op.categoryId)?.utxo?.token?.nft;
    stb.addTokenContainerTransferNft(
      op.categoryId, dummyLbc, hexToBin(inputNft?.commitment ?? ''), inputNft?.capability ?? 'none',
      op.outputSlot,
    );
  }

  return { dummyLbc, satoshiTransferCount, ftOps, nftOps };
}
