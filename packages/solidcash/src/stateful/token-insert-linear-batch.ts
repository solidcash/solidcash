/**
 * phase-boundary extract: Token-insert NEW/P' reassert + linear sorted-batch entry lock layout.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import type { FunctionBlockLayout } from '@solidcash/utils';
import { isEmptyValueEntryCommitment, encodeEntryCommitment } from './SortedList.js';
import {
  SLOT_HEX,
  isSortedEntryHeadCommitment,
  isSortedEntryNodeCommitment,
  synthesizePredNewCommitment,
} from './sorted-entry-commitment.js';
import {
  commitmentHexOf,
  cloneToken,
  outputMatchesLock,
} from './stb-output-utils.js';
import {
  isDisposableAlignmentPad,
  isViewReturnTailOutput,
} from './value-chunk-band-helpers.js';
import type { CompilerTokenWriterGroup } from './value-chunk-geometry.js';

/** Same-index mutable jobEvents entry UTXOs. View tails must not replace these. */
export function jobEventsEntryOneToOneIndices(
  inputs: ReadonlyArray<{
    token?: { nft?: { capability?: string } };
    unlocker?: { generateLockingBytecode: () => Uint8Array };
  }>,
  entryLock: Uint8Array | undefined,
): number[] {
  if (!entryLock || entryLock.length !== 35 || entryLock[0] !== 0xaa) return [];
  const wanted = binToHex(entryLock);
  const indices: number[] = [];
  for (const [index, input] of inputs.entries()) {
    if (input?.token?.nft?.capability !== 'mutable' || !input.unlocker) continue;
    const lock = input.unlocker.generateLockingBytecode();
    if (lock.length === 35 && binToHex(lock) === wanted) indices.push(index);
  }
  return indices;
}

/** Same-index mutable collection entry UTXOs. View tails must not replace these. */
export const collectionEntryOneToOneIndices = jobEventsEntryOneToOneIndices;

/**
 * Recreate a nested minting master at its input index. Inserting would shift
 * assigned view tails and the jobs suffix; drop one later alignment pad so
 * those absolute indices stay put (MD minting at 15, tails 38-40, jobs 45-46).
 */
/**
 * Minting uniqueness: one minting output per minting input. Extra same-category
 * minting clones (fixture FakeToken at 27 while the master is at 28) make the
 * conservation helper leave -1 on the stack (0x81) so `0 GTE VERIFY` fails.
 */
/**
 * FakeToken.transferFrom lays out P' at master+2 and NEW at master+4 (pred+2).
 * A later same-category mapping (allowance) can occupy +4 with a different
 * collection lock; the covenant EQUALVERIFYs OUTPUTBYTECODE[+4] against P'.
 */
export function reassertTokenInsertNewLock(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; amount?: bigint; nft?: { capability?: string; commitment?: string | Uint8Array } };
  }>,
  masterIndex: number,
  categoryId: string,
  predOffset = 2,
  newOffset = 4,
): boolean {
  const pred = outputs[masterIndex + predOffset];
  const neu = outputs[masterIndex + newOffset];
  if (!pred?.token || pred.token.category !== categoryId || pred.token.nft?.capability !== 'mutable') {
    return false;
  }
  if (!neu?.token || neu.token.category !== categoryId || neu.token.nft?.capability !== 'mutable') {
    return false;
  }
  const predLock = pred.to instanceof Uint8Array ? pred.to : undefined;
  const newLock = neu.to instanceof Uint8Array ? neu.to : undefined;
  if (!predLock || !newLock || predLock.length !== newLock.length) return false;
  if (predLock.every((byte, offset) => byte === newLock[offset])) return false;
  outputs[masterIndex + newOffset] = {
    ...neu,
    to: predLock,
  };
  return true;
}

/**
 * When TrailingCount/planned inserts are lost, the NEW node commitment can land on the
 * predecessor output (master+predOffset). Rebuild P' there and move NEW to master+newOffset.
 */
export function reassertTokenInsertCommitments(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; amount?: bigint; nft?: { capability?: string; commitment?: string | Uint8Array } };
  }>,
  inputs: Array<{
    token?: { category?: string; nft?: { capability?: string; commitment?: string | Uint8Array } };
    unlocker?: { generateLockingBytecode?: () => Uint8Array };
  }>,
  masterIndex: number,
  categoryId: string,
  predOffset = 2,
  newOffset = 4,
  transferAmount?: bigint,
  proofInputOffset?: number,
): boolean {
  const proofOffset = proofInputOffset ?? predOffset;
  const predInput = inputs[masterIndex + proofOffset];
  const predOut = outputs[masterIndex + predOffset];
  const newOut = outputs[masterIndex + newOffset];
  if (!predInput?.token || predInput.token.category !== categoryId
    || predInput.token.nft?.capability !== 'mutable') {
    return false;
  }
  // P' output may still be an OP_TRUE pad or foreign collection before repair.
  if (!predOut) return false;
  const commitHex = (value: Uint8Array | string | undefined): string => (
    value instanceof Uint8Array ? binToHex(value) : (value ?? '')
  );
  const inputCommit = commitHex(predInput.token.nft?.commitment);
  const predOutCommit = commitHex(predOut.token?.nft?.commitment);
  if (!isSortedEntryHeadCommitment(inputCommit) && !isSortedEntryNodeCommitment(inputCommit)) {
    return false;
  }
  const predSlot = inputCommit.slice(0, SLOT_HEX).toLowerCase();
  const predOutLooksLikePred = predOutCommit.toLowerCase().startsWith(predSlot)
    && predOutCommit.length > SLOT_HEX
    && predOutCommit.slice(SLOT_HEX, SLOT_HEX * 2).toLowerCase() !== predSlot;
  const predLock = predOut.to instanceof Uint8Array
    ? predOut.to
    : predInput.unlocker?.generateLockingBytecode?.();
  if (!predLock) return false;
  const newOutCommit = commitHex(newOut?.token?.nft?.commitment);
  const newOutLock = newOut?.to instanceof Uint8Array ? newOut.to : undefined;
  const newOutHasBalancesLock = !!newOutLock
    && newOutLock.length === predLock.length
    && newOutLock.every((byte, offset) => byte === predLock[offset]);
  if (predOutLooksLikePred) {
    // P' is already correct. Ensure NEW exists at newOffset with the inserted slot.
    const insertedSlot = predOutCommit.slice(SLOT_HEX, SLOT_HEX * 2).toLowerCase();
    if (insertedSlot.length !== SLOT_HEX || insertedSlot === predSlot) return false;
    if (newOutHasBalancesLock && newOutCommit.toLowerCase().startsWith(insertedSlot)) return false;
    // Prefer a previously misplaced NEW commitment (full value tail). Otherwise derive the
    // transferred amount from the predecessor debit (input value - P' value) or the call arg.
    const decodeVm = (hex: string): bigint => {
      if (!hex) return 0n;
      const bytes = hexToBin(hex);
      let value = 0n;
      for (let i = bytes.length - 1; i >= 0; i -= 1) value = (value << 8n) | BigInt(bytes[i]!);
      if (bytes.length > 0 && (bytes[bytes.length - 1]! & 0x80) !== 0) {
        value = -(value & ~(0x80n << BigInt(8 * (bytes.length - 1))));
      }
      return value;
    };
    let amount = transferAmount;
    if (amount === undefined
      && inputCommit.length > SLOT_HEX * 2
      && predOutCommit.length > SLOT_HEX * 2) {
      const delta = decodeVm(inputCommit.slice(SLOT_HEX * 2)) - decodeVm(predOutCommit.slice(SLOT_HEX * 2));
      if (delta > 0n) amount = delta;
    }
    let newCommitment = amount !== undefined
      ? binToHex(encodeEntryCommitment(
        hexToBin(insertedSlot), new Uint8Array(32), bigIntToVmNumber(amount),
      ))
      : `${insertedSlot}${'00'.repeat(SLOT_HEX / 2)}`;
    for (const [index, output] of outputs.entries()) {
      if (index === masterIndex + predOffset) continue;
      if (output?.token?.category !== categoryId || output.token.nft?.capability !== 'mutable') continue;
      const commit = commitHex(output.token.nft?.commitment).toLowerCase();
      if (commit.startsWith(insertedSlot) && commit.length > SLOT_HEX * 2) {
        newCommitment = commit;
        break;
      }
    }
    outputs[masterIndex + newOffset] = {
      to: predLock,
      amount: newOut?.amount ?? 1200n,
      token: {
        amount: 0n,
        category: categoryId,
        nft: { capability: 'mutable', commitment: newCommitment },
      },
    };
    return true;
  }
  if (!isSortedEntryNodeCommitment(predOutCommit)) return false;
  const newSlot = predOutCommit.slice(0, SLOT_HEX);
  const newOutLooksLikePred = newOut?.token?.category === categoryId
    && newOut.token.nft?.capability === 'mutable'
    && newOutCommit.toLowerCase().startsWith(predSlot)
    && newOutCommit.length > SLOT_HEX
    && newOutCommit.slice(SLOT_HEX, SLOT_HEX * 2).toLowerCase() === newSlot.toLowerCase();
  // Prefer an already-materialized P' (may include the debited value tail) over
  // re-synthesizing from the pre-state input commitment.
  const predNew = newOutLooksLikePred
    ? newOutCommit
    : synthesizePredNewCommitment(inputCommit, newSlot);
  outputs[masterIndex + predOffset] = {
    ...predOut,
    to: predLock,
    token: {
      amount: predOut.token?.amount ?? 0n,
      category: categoryId,
      nft: { capability: 'mutable', commitment: predNew },
    },
  };
  outputs[masterIndex + newOffset] = {
    to: predLock,
    amount: newOut?.amount ?? 1200n,
    token: {
      amount: newOut?.token?.amount ?? 0n,
      category: categoryId,
      nft: { capability: 'mutable', commitment: predOutCommit },
    },
  };
  return true;
}

export type EntryInsertLockRepair = {
  collection: string;
  predecessorOffset: number;
  candidateInsertedOffsets: number[];
  insertedSlot: string;
  /** When set, the co-spent predecessor input is at master+proofInputOffset (may differ from P' output). */
  proofInputOffset?: number;
};

export type LinearSortedBatchEntryBand = { collection: string; offsets: number[] };

/** Resolve each compiler-described linear sorted batch onto its exact physical entry offsets. */
export function linearSortedBatchEntryBands(group: CompilerTokenWriterGroup & {
  blockLayout?: FunctionBlockLayout;
}): LinearSortedBatchEntryBand[] {
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const logicalName = group.logicalFunctionName ?? group.functionName;
  const abiFunction = group.compilerRoute?.abiFunction
    ?? artifact?.abi?.find((candidate) => candidate.name === logicalName);
  const layout = abiFunction?.blockLayout ?? group.blockLayout;
  if (!abiFunction?.entryAccesses || !layout) return [];
  return (abiFunction.sortedBatchInfo ?? []).flatMap((batch) => {
    if (batch.linear !== true || batch.slotIndices.length === 0
      || new Set(batch.slotIndices).size !== batch.slotIndices.length) return [];
    const offsets = batch.slotIndices.flatMap((slotIndex) => {
      const access = abiFunction.entryAccesses?.[slotIndex];
      const slots = layout.slots.filter((slot) => slot.kind === 'entry' && slot.slotIndex === slotIndex);
      if (!access || access.collection !== batch.collection || !access.operations.includes('write')
        || slots.length !== 1) return [];
      return [slots[0].offset];
    });
    if (offsets.length !== batch.slotIndices.length || new Set(offsets).size !== offsets.length) return [];
    return [{ collection: batch.collection, offsets: offsets.sort((left, right) => left - right) }];
  });
}

/** Resolve the compiler-authenticated parameter subtracted from a linear batch entry. The downstream repair can
 * only reconstruct a debit (`inputValue - amount`), so direct values, credits, and unsupported expressions remain
 * trace/commitment-owned rather than being guessed from ABI shape. */
export function linearSortedBatchValueArgument(
  group: CompilerTokenWriterGroup & { functionArgs?: readonly unknown[]; logicalFunctionArgs?: readonly unknown[] },
  collection: string,
): unknown {
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const logicalName = group.logicalFunctionName ?? group.functionName;
  const abiFunction = group.compilerRoute?.abiFunction
    ?? artifact?.abi?.find((candidate) => candidate.name === logicalName);
  if (!abiFunction || !linearSortedBatchEntryBands(group).some((band) => band.collection === collection)) {
    return undefined;
  }
  const batch = abiFunction.sortedBatchInfo?.find((candidate) => (
    candidate.linear === true && candidate.collection === collection
  ));
  if (!batch) return undefined;
  const debitParameters = new Set(batch.slotIndices.flatMap((slotIndex) => {
    const source = abiFunction.entryAccesses?.[slotIndex]?.valueSource;
    const match = source?.match(/^binop:-\(entry,id:([A-Za-z_$][A-Za-z0-9_$]*)\)$/);
    return match ? [match[1]] : [];
  }));
  if (debitParameters.size !== 1) return undefined;
  const parameter = [...debitParameters][0];
  const visibleInputs = abiFunction.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const inputIndex = visibleInputs.findIndex((input) => (
    input.name === parameter && /^(u?int)([0-9]+)?$/.test(input.type)
  ));
  if (inputIndex < 0) return undefined;
  return (group.logicalFunctionArgs ?? group.functionArgs)?.[inputIndex];
}

/** Count only the locking bytecodes occupying compiler-owned linear-batch entry slots. */
export function linearSortedBatchPlannedLockCounts(
  outputs: ReadonlyArray<{
    to?: Uint8Array | string;
    token?: { category?: string };
  }>,
  masterIndex: number,
  categoryId: string,
  group: CompilerTokenWriterGroup & { blockLayout?: FunctionBlockLayout },
): ReadonlyMap<string, number> {
  const planned = new Map<string, number>();
  for (const batch of linearSortedBatchEntryBands(group)) {
    for (const offset of batch.offsets) {
      const output = outputs[masterIndex + offset];
      const lock = output?.to instanceof Uint8Array ? binToHex(output.to) : '';
      if (!lock.startsWith('aa20') || output?.token?.category !== categoryId) continue;
      planned.set(lock, (planned.get(lock) ?? 0) + 1);
    }
  }
  return planned;
}

/** Resolve compiler-planned sorted-entry predecessor/new-node lock pairs without relying on function names. */
export function entryInsertLockRepairs(
  group: CompilerTokenWriterGroup & {
    blockLayout?: FunctionBlockLayout;
    plannedEntryInserts?: ReadonlyArray<{
      blockSlot: number; outputBlockSlot: number; newCommitment?: string;
    }>;
  },
): EntryInsertLockRepair[] {
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const logicalName = group.logicalFunctionName ?? group.functionName;
  const abiFunction = group.compilerRoute?.abiFunction
    ?? artifact?.abi?.find((candidate) => candidate.name === logicalName);
  const layout = abiFunction?.blockLayout ?? group.blockLayout;
  const planned = group.plannedEntryInserts;
  if (planned && planned.length > 0 && layout && abiFunction?.entryAccesses) {
    const repairs = new Map<string, EntryInsertLockRepair>();
    for (const insert of planned) {
      if (!Number.isInteger(insert.blockSlot) || insert.blockSlot < 0
        || !Number.isInteger(insert.outputBlockSlot) || insert.outputBlockSlot < 0
        || insert.blockSlot === insert.outputBlockSlot) continue;
      const slot = layout.slots.find((candidate: FunctionBlockLayout['slots'][number]) => (
        candidate.kind === 'entry' && candidate.offset === insert.blockSlot
      ));
      const access = slot?.slotIndex === undefined ? undefined : abiFunction.entryAccesses[slot.slotIndex];
      const insertedSlot = insert.newCommitment?.slice(0, SLOT_HEX).toLowerCase() ?? '';
      if (!access?.operations.includes('write') || insertedSlot.length !== SLOT_HEX) continue;
      // Keep all other entry offsets as candidates so NEW can be found after a foreign
      // collection overwrote its lock (renamed multi-collection descriptors). Cardinality stripping must not
      // treat foreign locks as nodes owned by this batch.
      const candidateInsertedOffsets = layout.slots
        .filter((candidate) => candidate.kind === 'entry' && candidate.offset !== insert.blockSlot)
        .map((candidate) => candidate.offset);
      if (candidateInsertedOffsets.length === 0) continue;
      const repair = {
        collection: access.collection,
        predecessorOffset: insert.blockSlot,
        candidateInsertedOffsets,
        insertedSlot,
      };
      repairs.set(`${repair.collection}:${repair.predecessorOffset}:${repair.insertedSlot}`, repair);
    }
    if (repairs.size > 0) return [...repairs.values()];
  }
  const linearRepairs = linearSortedBatchEntryBands(group).flatMap((batch) => (
    batch.offsets.length < 2 ? [] : [{
      collection: batch.collection,
      predecessorOffset: batch.offsets[0],
      candidateInsertedOffsets: batch.offsets.slice(1),
      insertedSlot: '',
    }]
  ));
  if (linearRepairs.length > 0) return linearRepairs;
  const legacyName = group.functionName ?? group.logicalFunctionName ?? abiFunction?.name;
  // Exact compatibility fence for pre-kernel legacy-unroll artifacts which published no resource geometry.
  if (legacyName === 'transferFrom' && artifact?.messageBus?.convention === 'legacy-unroll'
    && layout === undefined && abiFunction?.entryAccesses === undefined) {
    return [{
      collection: '',
      predecessorOffset: 2,
      candidateInsertedOffsets: [4],
      insertedSlot: '',
    }];
  }
  // Other descriptor-published functions: empty planned inserts must not invent coordinates.
  if (layout !== undefined || abiFunction?.entryAccesses !== undefined) return [];
  return [];
}

/** Apply exact planned INSERT lock repairs, matching the materialized NEW node by its committed key slot. */
export function reassertDescribedEntryInsertLocks(
  outputs: Parameters<typeof reassertTokenInsertNewLock>[0],
  masterIndex: number,
  categoryId: string,
  group: Parameters<typeof entryInsertLockRepairs>[0],
): number {
  let changed = 0;
  for (const repair of entryInsertLockRepairs(group)) {
    for (const insertedOffset of repair.candidateInsertedOffsets) {
      const commitment = outputs[masterIndex + insertedOffset]?.token?.nft?.commitment;
      const commitmentHex = commitment instanceof Uint8Array ? binToHex(commitment) : commitment ?? '';
      if (repair.insertedSlot !== ''
        && !commitmentHex.toLowerCase().startsWith(repair.insertedSlot)) continue;
      if (reassertTokenInsertNewLock(
        outputs, masterIndex, categoryId, repair.predecessorOffset, insertedOffset,
      )) changed += 1;
      break;
    }
  }
  return changed;
}

/**
 * Put a linear batch's NEW and successor/predecessor commitments into the compiler-described entry order.
 * The proof input and every output coordinate come from the repair descriptor; ambiguous candidates fail closed.
 */
export function reorderLinearBatchProofSuccessor(
  outputs: Parameters<typeof reassertTokenInsertNewLock>[0],
  inputs: ReadonlyArray<{ token?: { nft?: { commitment?: Uint8Array | string } } }>,
  masterIndex: number,
  categoryId: string,
  repair: EntryInsertLockRepair,
): boolean {
  const firstIndex = masterIndex + repair.predecessorOffset;
  const first = outputs[firstIndex];
  const firstCommitment = String(first?.token?.nft?.commitment ?? '');
  const lockingBytecode = first?.to instanceof Uint8Array ? first.to : undefined;
  const proofOffset = repair.proofInputOffset ?? repair.predecessorOffset;
  const proofCommitment = String(inputs[masterIndex + proofOffset]?.token?.nft?.commitment ?? '');
  const proofSlot = proofCommitment.slice(0, SLOT_HEX).toLowerCase();
  if (!lockingBytecode || proofSlot.length !== SLOT_HEX || firstCommitment.length <= SLOT_HEX * 2
    || first?.token?.category !== categoryId
    || !firstCommitment.toLowerCase().startsWith(proofSlot)) return false;
  const candidates = repair.candidateInsertedOffsets.flatMap((offset) => {
    const output = outputs[masterIndex + offset];
    const commitment = String(output?.token?.nft?.commitment ?? '');
    return commitment.length > SLOT_HEX * 2 && output?.token?.category === categoryId
      && firstCommitment.slice(SLOT_HEX, SLOT_HEX * 2).toLowerCase()
        === commitment.slice(0, SLOT_HEX).toLowerCase()
      ? [{ offset, output, commitment }] : [];
  });
  if (candidates.length !== 1) return false;
  const successor = candidates[0];
  outputs[firstIndex] = {
    to: lockingBytecode,
    amount: first.amount ?? 1200n,
    token: {
      amount: 0n,
      category: categoryId,
      nft: { capability: 'mutable', commitment: successor.commitment },
    },
  };
  outputs[masterIndex + successor.offset] = {
    to: lockingBytecode,
    amount: successor.output?.amount ?? 1200n,
    token: {
      amount: 0n,
      category: categoryId,
      nft: { capability: 'mutable', commitment: firstCommitment },
    },
  };
  return true;
}
