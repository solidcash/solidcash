/**
 * phase-boundary extract: STB build-phase extract — owner entry NFTs, satoshi/token containers, and transfers.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import { getDustThreshold } from '@mem-cash/validation';
import {
  buildEntryCommitment,
  buildEntryCommitmentMultiKey,
  getDefaultStateValue,
  type FunctionBlockLayout,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import type {
  EntryNftInfo,
  RuntimeLoopTransferOutput,
  TokenContainerInfo,
  TokenContainerTransferData,
  TokenContainerTransferNftData,
  TransferData,
} from './external-call-utxo-group.js';
import { assignBalancedOutputAtOffset } from './writer-event-delegate-layout.js';

export interface MaterializeOwnerEntriesContainersTransfersHost {
  readonly blockLayout?: FunctionBlockLayout;
  readonly categoryId: string;
  readonly stateLayout: StateLayout;
  readonly entryNfts: readonly EntryNftInfo[];
  readonly entryDeletes: ReadonlySet<number>;
  readonly entryUpdates: ReadonlyMap<number, StateValue>;
  readonly entryRawCommitments: ReadonlyMap<number, string>;
  readonly entryNftLockingBytecodes: ReadonlyMap<string, Uint8Array>;
  readonly satoshiContainerUtxo?: UnlockableUtxo;
  readonly satoshiContainerLockingBytecode?: Uint8Array;
  readonly tokenContainers: readonly TokenContainerInfo[];
  readonly tokenContainerLockingBytecodes: ReadonlyMap<string, Uint8Array>;
  readonly pendingTransfers: readonly TransferData[];
  readonly pendingTokenContainerTransfers: readonly TokenContainerTransferData[];
  readonly pendingTokenContainerTransferNfts: readonly TokenContainerTransferNftData[];
  readonly pendingTokenContainerDeposits: ReadonlyMap<string, bigint>;
  readonly runtimeLoopTransferOutputs: readonly RuntimeLoopTransferOutput[];
  readonly containerDepositAmount: bigint;
  entryPlaceholderFillThreshold(): number;
  isTokenContainerDrained(categoryId: string): boolean;
}

/**
 * Emit owner entry NFT outputs (with placeholders), satoshi/token container preservation,
 * plain transfers, and token-container FT/NFT transfers.
 */
export function materializeOwnerEntriesContainersTransfers(
  host: MaterializeOwnerEntriesContainersTransfersHost,
  builder: TransactionBuilder,
  embeddedEntrySlots: ReadonlySet<number>,
  delegateTransferSlotsConsumed: number,
  debugAtomicOutputStage: (stage: string) => void,
): void {
  // Create entry NFT outputs (written/preserved entries, excluding deleted ones). Entry outputs occupy
  // consecutive block-layout offsets; the covenant reads each existing/written slot's output at its FIXED
  // offset. A slot that produces no output (soft-delete of an ABSENT key, or an alias-skipped write) would
  // shift a later real output down and desync that fixed read, so emit a plain placeholder output for any
  // skipped slot below the fill threshold (see entryPlaceholderFillThreshold).
  const sortedEntries = [...host.entryNfts].sort((a, b) => a.slotIndex - b.slotIndex);
  const fillThreshold = host.entryPlaceholderFillThreshold();
  // The covenant reads every existing/written entry at its own FIXED block offset, so an entry belongs at the
  // offset its layout slot declares - not merely somewhere in the trailing band in slot order. Appending them
  // happens to agree while nothing else occupies the band, but a lane whose block also carries value chunks,
  // callee participants or return events pushes the entry past its coordinate and the covenant then compares an
  // unrelated output. A declared entry slot is therefore authoritative on its own, independent of the
  // block-width preservation flag that exists for a different purpose (holding skipped offsets open).
  // The covenant reads every existing/written entry at its own FIXED block offset, so an entry belongs at the
  // offset its layout slot declares - not merely somewhere in the trailing band in slot order. Appending them
  // happens to agree while nothing else occupies the band, but a lane whose block also carries value chunks,
  // callee participants or return events pushes the entry past its coordinate and the covenant then compares an
  // unrelated output. A declared entry slot is therefore authoritative on its own, independent of the
  // block-width preservation flag that exists for a different purpose (holding skipped offsets open).
  const layoutEntrySlots = host.blockLayout?.slots.some((slot) => slot.kind === 'entry')
    ? host.blockLayout.slots.filter((slot) => slot.kind === 'entry')
      .sort((left, right) => left.offset - right.offset)
    : undefined;
  const entriesBySlot = new Map(host.entryNfts.map((entry) => [entry.slotIndex, entry]));
  const placeholderEntryOutput = (): Output => ({ to: Uint8Array.of(0x51), amount: 1000n });
  const buildEntryOutput = (entry: typeof sortedEntries[number]): Output | undefined => {
    if (embeddedEntrySlots.has(entry.slotIndex)) return undefined;
    if (host.entryDeletes.has(entry.slotIndex)) {
      // Position-holding placeholder: neutral OP_TRUE, outside the collection address namespace. The covenant
      // existence-gates this absent slot away, so it is never verified; using the entry address here would
      // incorrectly increase vmap's exact collection-output cardinality.
      return entry.slotIndex < fillThreshold ? placeholderEntryOutput() : undefined;
    }

    const value = host.entryUpdates.get(entry.slotIndex);
    const rawCommitment = host.entryRawCommitments.get(entry.slotIndex);
    // Priority: manual setEntry() > auto-derived raw commitment > UTXO preservation > default
    let commitment: string;
    const isMultiKey = entry.keyTypes && entry.keyValues && entry.keyTypes.length > 1;
    const structs = host.stateLayout.structs;
    if (value !== undefined) {
      if (isMultiKey) {
        commitment = buildEntryCommitmentMultiKey(
          entry.keyValues!, entry.keyTypes!, value, entry.valueType, structs,
        );
      } else {
        commitment = buildEntryCommitment(entry.keyValue, entry.keyType, value, entry.valueType, structs);
      }
    } else if (rawCommitment !== undefined) {
      commitment = rawCommitment;
    } else if (entry.exists && entry.utxo?.token?.nft?.commitment) {
      // Preserve current commitment unchanged
      commitment = entry.utxo.token.nft.commitment;
    } else {
      // New entry without explicit value - use type default
      const defaultValue = getDefaultStateValue(entry.valueType, structs);
      if (isMultiKey) {
        commitment = buildEntryCommitmentMultiKey(
          entry.keyValues!, entry.keyTypes!, defaultValue, entry.valueType, structs,
        );
      } else {
        commitment = buildEntryCommitment(entry.keyValue, entry.keyType, defaultValue, entry.valueType, structs);
      }
    }

    // Entry NFT output uses the per-collection entry covenant's locking bytecode
    const lockingBytecode = entry.exists && entry.utxo
      ? entry.utxo.unlocker.generateLockingBytecode()
      : host.entryNftLockingBytecodes.get(entry.collection);

    if (!lockingBytecode) {
      throw new Error('Cannot determine locking bytecode for entry NFT output');
    }

    return {
      to: lockingBytecode,
      amount: entry.utxo?.satoshis ?? 1200n,
      token: {
        amount: 0n,
        category: host.categoryId,
        nft: {
          capability: 'mutable',
          commitment,
        },
      },
    };
  };
  const emitEntryOutput = (entry: typeof sortedEntries[number]): void => {
    const output = buildEntryOutput(entry);
    if (output) builder.addOutput(output);
  };
  if (layoutEntrySlots) {
    for (const slot of layoutEntrySlots) {
      while (builder.outputs.length < slot.offset) {
        builder.addOutput(placeholderEntryOutput());
      }
      const entry = slot.slotIndex !== undefined ? entriesBySlot.get(slot.slotIndex) : undefined;
      const output = entry ? buildEntryOutput(entry) : placeholderEntryOutput();
      if (!output) continue;
      if (builder.outputs.length === slot.offset) builder.addOutput(output);
      else assignBalancedOutputAtOffset(builder.outputs, slot.offset, output);
    }
  } else {
    for (const entry of sortedEntries) emitEntryOutput(entry);
  }
  debugAtomicOutputStage('layout-entries');

  // Create satoshi container preservation output (after entries, before transfers)
  // Skip when fully drained (all satoshis transferred out)
  if (host.satoshiContainerUtxo) {
    const totalTransferAmount = host.pendingTransfers
      .filter((t) => t.lockingBytecode.length > 0)
      .reduce((sum, t) => sum + t.amount, 0n)
      + host.runtimeLoopTransferOutputs
        .filter((transfer) => (transfer.kind ?? 'bch') === 'bch')
        .reduce((sum, transfer) => sum + transfer.amount, 0n);
    if (totalTransferAmount > host.satoshiContainerUtxo.satoshis + host.containerDepositAmount) {
      throw new Error(
        `Total transfer amount (${totalTransferAmount}) exceeds satoshi container balance `
        + `(${host.satoshiContainerUtxo.satoshis}${host.containerDepositAmount > 0n ? ` + ${host.containerDepositAmount} deposit` : ''})`,
      );
    }

    const remainingAmount = host.satoshiContainerUtxo.satoshis - totalTransferAmount + host.containerDepositAmount;
    const satoshiContainerLockingBytecode = host.satoshiContainerLockingBytecode
      ?? host.satoshiContainerUtxo.unlocker.generateLockingBytecode();
    // Exact dust threshold for the satoshi-container output (token-aware; plain P2SH32 => 576).
    const DUST_MINIMUM = getDustThreshold({ lockingBytecode: satoshiContainerLockingBytecode });
    if (remainingAmount > 0n && remainingAmount < DUST_MINIMUM) {
      throw new Error(
        `Satoshi container remaining balance (${remainingAmount}) is below dust threshold (${DUST_MINIMUM}). `
        + 'Either transfer all satoshis (fully drain) or leave at least the dust minimum.',
      );
    }
    if (remainingAmount >= DUST_MINIMUM) {
      builder.addOutput({
        to: satoshiContainerLockingBytecode,
        amount: remainingAmount,
      });
    } else {
      // Drained: insert a 0-satoshi OP_RETURN placeholder to maintain block layout
      // output positions. The compiler's covenant verification detects the mismatched
      // locking bytecode and treats this slot as drained.
      builder.addOutput({ to: Uint8Array.from([0x6a]), amount: 0n });
    }
  }

  // Create token container preservation outputs (before transfers/tcTransfers/events
  // so that input-bearing tokenContainer slots are contiguous and match blockLayout offsets).
  // Skip drained containers (all FTs transferred + NFT transferred if present)
  for (const container of [...host.tokenContainers].sort((a, b) => a.tokenContainerSlotIndex - b.tokenContainerSlotIndex)) {
    if (!container.exists || !container.utxo) continue;
    if (host.isTokenContainerDrained(container.tokenContainerCategoryId)) {
      // Drained: insert a 0-satoshi OP_RETURN placeholder to maintain block layout
      // output positions. The compiler's covenant verification detects the absence of
      // tokens at this output and skips preservation checks.
      builder.addOutput({ to: Uint8Array.from([0x6a]), amount: 0n });
      continue;
    }

    const lockingBytecode = host.tokenContainerLockingBytecodes.get(container.tokenContainerCategoryId)
      ?? container.utxo.unlocker.generateLockingBytecode();

    // Compute remaining FT amount after transfers
    const transferredFtAmount = host.pendingTokenContainerTransfers
      .filter((s) => s.tokenContainerCategoryId === container.tokenContainerCategoryId)
      .reduce((sum, s) => sum + s.amount, 0n)
      + host.runtimeLoopTransferOutputs
        .filter((transfer) => transfer.kind === 'token'
          && transfer.tokenContainerCategoryId === container.tokenContainerCategoryId)
        .reduce((sum, transfer) => sum + transfer.amount, 0n);

    const inputFtAmount = container.utxo.token?.amount ?? 0n;
    if (transferredFtAmount > inputFtAmount) {
      throw new Error(
        `Total fungible token transfer amount (${transferredFtAmount}) exceeds token container balance (${inputFtAmount}) for category ${container.tokenContainerCategoryId}`,
      );
    }

    const depositedFtAmount = host.pendingTokenContainerDeposits
      .get(container.tokenContainerCategoryId) ?? 0n;
    const remainingFtAmount = inputFtAmount - transferredFtAmount + depositedFtAmount;

    // Check if NFT was transferred out
    const nftWasTransferred = host.pendingTokenContainerTransferNfts.some(
      (s) => s.tokenContainerCategoryId === container.tokenContainerCategoryId,
    ) || host.runtimeLoopTransferOutputs.some((transfer) => transfer.kind === 'nft'
      && transfer.tokenContainerCategoryId === container.tokenContainerCategoryId);

    builder.addOutput({
      to: lockingBytecode,
      amount: container.utxo.satoshis,
      token: {
        amount: remainingFtAmount,
        category: container.tokenContainerCategoryId,
        // Preserve NFT if it wasn't transferred, strip it if it was
        ...(!nftWasTransferred && container.utxo.token?.nft && {
          nft: container.utxo.token.nft,
        }),
      },
    });
  }

  // Create transfer outputs (plain BCH, no tokens). A graph route reserves a fixed per-row transfer frame;
  // inactive sites remain OP_TRUE outputs so later participant blocks cannot slide into the gaps.
  const reservedTransferSlots = host.blockLayout?.slots.filter((slot) => slot.kind === 'transfer').length
    ?? host.pendingTransfers.length;
  for (let transferSlot = delegateTransferSlotsConsumed;
    transferSlot < reservedTransferSlots; transferSlot += 1) {
    const transfer = host.pendingTransfers[transferSlot];
    if (!transfer || transfer.lockingBytecode.length === 0) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
    } else {
      builder.addOutput({
        to: transfer.lockingBytecode,
        amount: transfer.amount,
      });
    }
  }

  // Create token container transfer outputs (FT and NFT interleaved in source-code order)
  // The compiler assigns sequential transfer indices in source order, so the SDK must
  // produce outputs in the same order to match covenant verification expectations.
  const allTcTransfers: Array<{ type: 'ft'; data: TokenContainerTransferData } | { type: 'nft'; data: TokenContainerTransferNftData }> = [
    ...host.pendingTokenContainerTransfers.map((d) => ({ type: 'ft' as const, data: d })),
    ...host.pendingTokenContainerTransferNfts.map((d) => ({ type: 'nft' as const, data: d })),
  ];
  allTcTransfers.sort((a, b) => a.data.insertionOrder - b.data.insertionOrder);
  const tcTransferBySlot = new Map(allTcTransfers.map((entry) => [entry.data.insertionOrder, entry]));

  const reservedTokenTransferSlots = host.blockLayout?.slots.filter((slot) => slot.kind === 'tcTransfer').length
    ?? allTcTransfers.length;
  for (let transferSlot = 0; transferSlot < reservedTokenTransferSlots; transferSlot += 1) {
    const entry = tcTransferBySlot.get(transferSlot);
    if (!entry) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      continue;
    }
    if (entry.type === 'ft') {
      builder.addOutput({
        to: entry.data.lockingBytecode,
        amount: 1200n,
        token: {
          amount: entry.data.amount,
          category: entry.data.tokenContainerCategoryId,
        },
      });
    } else {
      builder.addOutput({
        to: entry.data.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: entry.data.tokenContainerCategoryId,
          nft: {
            capability: entry.data.capability,
            commitment: binToHex(entry.data.commitment),
          },
        },
      });
    }
  }
}
