/**
 * phase-boundary extract: STB class-body extract — reassert compiler-described sorted-batch INSERT/UPDATE
 * entry geometry without shifting output tails.
 */

import { binToHex, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { stripSurplusInvalidCollectionLockOutputs } from './collection-lock-strip.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { reassertBatchPredecessorOutputsAtDeclaredSlots } from './mutable-output-reassert.js';
import {
  entryCommitmentLacksValue,
  resolveRestoredBalancesEntryCommitment,
} from './same-index-twin-emit.js';
import { SLOT_HEX } from './sorted-entry-commitment.js';
import {
  entryInsertLockRepairs,
  linearSortedBatchValueArgument,
  reassertDescribedEntryInsertLocks,
  reassertTokenInsertCommitments,
  reorderLinearBatchProofSuccessor,
} from './token-insert-linear-batch.js';
import { syncDeclaredBatchPredOutWitnesses } from './writer-event-delegate-layout.js';

export interface TokenInsertNewLocksHost {
  /** Mutable flattened inputs — token-insert commitment repair may rewrite unlockers. */
  readonly allInputs: UnlockableUtxo[];
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly entryRawCommitments: ReadonlyMap<number, string>;
  readonly externalCallEntryOutputs: ReadonlyMap<string, ReadonlyMap<number, string>>;
  findMintingInputIndex(categoryId: string): number;
}

/** Reassert compiler-described sorted-batch INSERT and UPDATE entry geometry without shifting output tails. */
export function reassertTokenInsertNewLocks(
  host: TokenInsertNewLocksHost,
  builder: TransactionBuilder,
): void {
  const repairedMasters = new Set<number>();
  const groups = [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups];
  for (const group of groups) {
    // Shared logical views still need their described entry-lock repair; resolve them to the physical owner.
    const physical = ('sharedGroupIndex' in group && group.sharedGroupIndex !== undefined)
      ? groups[group.sharedGroupIndex] ?? group
      : group;
    if (!physical.categoryId) continue;
    const master = host.findMintingInputIndex(physical.categoryId);
    if (master < 0 || repairedMasters.has(master)) continue;
    repairedMasters.add(master);
    const repairGroup = physical === group ? group : {
      ...physical,
      // Prefer the logical view that still carries entry descriptors when the physical owner is a shared shell.
      ...(entryInsertLockRepairs(group).length > 0 ? group : {}),
    };
    const debugTokenInsert = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_TOKEN_INSERT === '1';
    if (debugTokenInsert) {
      console.error('token-insert-repair', {
        master,
        categoryId: physical.categoryId,
        functionName: repairGroup.functionName ?? repairGroup.logicalFunctionName,
        shared: 'sharedGroupIndex' in group ? group.sharedGroupIndex : undefined,
        repairs: entryInsertLockRepairs(repairGroup),
        batchPred: (repairGroup.batchPredecessorOutputs ?? []).map((predecessor) => ({
          slot: predecessor.outputBlockSlot,
          lock: binToHex(predecessor.lockingBytecode).slice(0, 28),
          commitLen: String(predecessor.commitment).length,
          commit: String(predecessor.commitment).slice(0, 80),
        })),
        predOutArgs: Object.entries({
          ...repairGroup.compilerRoute?.internalArgs,
          ...repairGroup.internalArgs,
        }).filter(([name]) => name.includes('PredOut')),
        locks: [2, 3, 4, 8, 9].map((rel) => {
          const output = builder.outputs[master + rel];
          const lock = output?.to instanceof Uint8Array ? binToHex(output.to).slice(0, 28) : '';
          const commit = String(output?.token?.nft?.commitment ?? '');
          return { rel, abs: master + rel, lock, commitLen: commit.length, commit: commit.slice(0, 80) };
        }),
      });
    }
    // A sorted INSERT can lose its trailing-count/planned-insert projection after physical block relocation,
    // leaving NEW on a predecessor output. Restore only coordinates published by the repair descriptor.
    let repaired = false;
    const predOutArgs = Object.entries({
      ...repairGroup.compilerRoute?.internalArgs,
      ...repairGroup.internalArgs,
    });
    const hasTrailingPred = (repairGroup.batchPredecessorOutputs?.length ?? 0) > 0
      || predOutArgs.some(([, value]) => typeof value === 'bigint' && value >= 0n);
    // A pure UPDATE batch has no trailing predecessor. Skip INSERT surgery for that flow.
    const hasInsert = hasTrailingPred
      || (repairGroup.plannedEntryInserts?.length ?? 0) > 0;
    // In-block P'/NEW lock copy is only safe when P' is in-band. With a trailing PredOut, NEW is
    // already at the first collection entry; copying its lock onto an unrelated collection slot would fail
    // output-token commitment verification.
    if (!hasTrailingPred && hasInsert) {
      reassertDescribedEntryInsertLocks(builder.outputs, master, physical.categoryId, repairGroup);
    }
    let lastRepairAmount: bigint | undefined;
    for (const repair of entryInsertLockRepairs(repairGroup)) {
      const amountArg = linearSortedBatchValueArgument(repairGroup, repair.collection);
      let amount: bigint | undefined = typeof amountArg === 'bigint' ? amountArg
        : typeof amountArg === 'number' ? BigInt(amountArg)
          : undefined;
      if (amount === undefined && amountArg instanceof Uint8Array && amountArg.length > 0) {
        const decoded = vmNumberToBigInt(amountArg, { requireMinimalEncoding: false });
        if (typeof decoded === 'bigint') amount = decoded;
      }
      lastRepairAmount = amount;
      if (hasTrailingPred) {
        // With a trailing P', NEW stays at the first described entry. Do not run in-block P'/NEW surgery;
        // restore only the planned predecessor clone and described same-collection entry locks.
        if ((repairGroup.batchPredecessorOutputs?.length ?? 0) > 0) {
          // Refuse PredOut placement until `master` is the minting head. A drifted master
          // (e.g. 4) writes P' at master+8=12; the real FakeToken block later lands at 22
          // and leaves the pre-block balances clone that fails OUTPUTBYTECODE 04vs03.
          const masterOut = builder.outputs[master];
          const masterIsMinting = masterOut?.token?.category === physical.categoryId
            && masterOut.token?.nft?.capability === 'minting';
          if (masterIsMinting) {
            const balLockHex = binToHex(repairGroup.batchPredecessorOutputs![0]!.lockingBytecode);
            const snapBal = (label: string): void => {
              if (!debugTokenInsert) return;
              const idxs = builder.outputs.flatMap((output, index) => (
                output?.to instanceof Uint8Array && binToHex(output.to) === balLockHex
                  ? [index] : []
              ));
              if (idxs.includes(12) || label === 'before-pred' || label === 'after-offsets') {
                console.error('token-insert-bal-snap', { label, master, idxs });
              }
            };
            snapBal('before-pred');
            if (reassertBatchPredecessorOutputsAtDeclaredSlots(
              builder.outputs,
              master,
              physical.categoryId,
              repairGroup.batchPredecessorOutputs!,
            ) > 0) repaired = true;
            snapBal('after-pred');
            // Keep PredOut witnesses on the same absolute outputs we just reasserted.
            const predOutUpdates = syncDeclaredBatchPredOutWitnesses({
              masterIndex: master,
              batchPredecessorOutputs: repairGroup.batchPredecessorOutputs,
              internalArgs: repairGroup.internalArgs as Record<string, unknown> | undefined,
              compilerInternalArgs: repairGroup.compilerRoute?.internalArgs as
                Record<string, unknown> | undefined,
              refreshInternalArgs: repairGroup.refreshInternalArgs as
                | ((updates: Record<string, unknown>, options?: { shiftPredOut?: boolean }) => void)
                | undefined,
              setRelocatedPredOutBase: (absolute) => {
                repairGroup.relocatedPredOutBase = absolute;
              },
            });
            if (Object.keys(predOutUpdates).length > 0) repaired = true;
            snapBal('after-predOut-sync');
          }
        }
        // For 1:1 entry slots overwritten by another collection, restore the authenticated input lock and a
        // value-bearing post-debit UPDATE. Slot||next-only batch seeds are not post-state values.
        const balancesLock = builder.outputs[master + repair.predecessorOffset]?.to;
        const layoutSlots = repairGroup.compilerRoute?.abiFunction?.blockLayout?.slots
          ?? repairGroup.blockLayout?.slots
          ?? [];
        // INSERT NEW at predecessorOffset credits the compiler-bound mutation value when available.
        if (amount === undefined && balancesLock instanceof Uint8Array) {
          const newCommit = String(
            builder.outputs[master + repair.predecessorOffset]?.token?.nft?.commitment ?? '',
          ).toLowerCase();
          if (newCommit.length > SLOT_HEX * 2) {
            try {
              const credited = vmNumberToBigInt(
                hexToBin(newCommit.slice(SLOT_HEX * 2)),
                { requireMinimalEncoding: false },
              );
              if (typeof credited === 'bigint' && credited > 0n) amount = credited;
            } catch {
              // ignore non-minimal NEW tails
            }
          }
        }
        lastRepairAmount = amount;
        for (const offset of [repair.predecessorOffset, ...repair.candidateInsertedOffsets]) {
          const input = host.allInputs[master + offset];
          const output = builder.outputs[master + offset];
          if (!(balancesLock instanceof Uint8Array)) continue;
          const outLock = output?.to instanceof Uint8Array ? output.to : undefined;
          const alreadyBalances = !!outLock
            && outLock.length === balancesLock.length
            && outLock.every((byte, index) => byte === balancesLock[index]);
          if (alreadyBalances) continue;
          const inLock = input?.token && 'unlocker' in input && input.unlocker
            ? input.unlocker.generateLockingBytecode()
            : undefined;
          const inputIsBalances = !!inLock
            && inLock.length === balancesLock.length
            && inLock.every((byte, index) => byte === balancesLock[index]);
          // Candidate INSERT/UPDATE offsets may be funder placeholders after proof dedup; still restore
          // the balances lock when the output was overwritten by a foreign collection.
          if (!inputIsBalances && offset === repair.predecessorOffset) continue;
          if (!inputIsBalances && !repair.candidateInsertedOffsets.includes(offset)) continue;
          const layoutSlot = layoutSlots.find((slot) => (
            slot.kind === 'entry' && slot.offset === offset
          ));
          const pinned = layoutSlot?.slotIndex !== undefined
            ? host.entryRawCommitments.get(layoutSlot.slotIndex)
            : undefined;
          const planned = repairGroup.batchEntryCommitments?.get(offset)
            ?? host.externalCallEntryOutputs.get(physical.categoryId)?.get(offset);
          const inputCommitment = inputIsBalances
            ? String(input?.token?.nft?.commitment ?? '')
            : String(planned ?? pinned ?? '');
          const inSlot = inputCommitment.toLowerCase().slice(0, SLOT_HEX);
          const sameSlotCommitments = inSlot.length === SLOT_HEX
            ? builder.outputs.flatMap((candidate, index) => {
              if (index === master + offset) return [];
              const lock = candidate?.to instanceof Uint8Array ? candidate.to : undefined;
              if (!lock || lock.length !== balancesLock.length
                || lock.some((byte, i) => byte !== balancesLock[i])) return [];
              const commit = String(candidate?.token?.nft?.commitment ?? '').toLowerCase();
              return commit.startsWith(inSlot) ? [commit] : [];
            })
            : [];
          // When the co-spent input is a funder, search other inputs for the balances[from] UTXO.
          let resolvedInputCommitment = inputCommitment;
          if (!inputIsBalances && inSlot.length === SLOT_HEX) {
            for (const candidate of host.allInputs) {
              if (!candidate?.token?.nft?.commitment || !('unlocker' in candidate) || !candidate.unlocker) {
                continue;
              }
              const lock = candidate.unlocker.generateLockingBytecode();
              if (lock.length !== balancesLock.length
                || lock.some((byte, index) => byte !== balancesLock[index])) continue;
              const commit = String(candidate.token.nft.commitment).toLowerCase();
              if (commit.startsWith(inSlot) && !entryCommitmentLacksValue(commit)) {
                resolvedInputCommitment = commit;
                break;
              }
            }
          }
          const commitment = resolveRestoredBalancesEntryCommitment({
            planned,
            pinned,
            inputCommitment: resolvedInputCommitment,
            amount,
            sameSlotCommitments,
          });
          // Never keep a foreign-collection or empty-seed commitment under a restored balances lock.
          if (!commitment) continue;
          builder.outputs[master + offset] = {
            to: balancesLock,
            amount: output?.amount && output.amount > 0n
              ? output.amount
              : (input?.satoshis ?? 1200n),
            token: {
              amount: 0n,
              category: physical.categoryId!,
              nft: { capability: 'mutable', commitment },
            },
          };
          repaired = true;
        }
        // After NEW/UPDATE/P' locks are correct, drop pads that reused the collection lock and
        // inflated OUTPUTBYTECODE cardinality (expected 3, got 4 from master+9 `010000` or a
        // pre-block whitelist-shaped duplicate at index 12).
        const collectionLock = repairGroup.batchPredecessorOutputs?.[0]?.lockingBytecode
          ?? (balancesLock instanceof Uint8Array ? balancesLock : undefined);
        if ((repairGroup.batchPredecessorOutputs?.length ?? 0) > 0 && collectionLock
          && physical.categoryId) {
          // Invalid pads only (post1 master+9 `010000`). keepIndices / pre-block valid
          // demotion inside this repair path thrashes (~5GB) when clones reappear.
          const planned = repairGroup.batchPredecessorOutputs!.length
            + 1 + repair.candidateInsertedOffsets.length;
          if (stripSurplusInvalidCollectionLockOutputs(
            builder.outputs, collectionLock, physical.categoryId, planned,
          ) > 0) repaired = true;
        }
      } else if (hasInsert && reassertTokenInsertCommitments(
        builder.outputs,
        host.allInputs,
        master,
        physical.categoryId,
        repair.predecessorOffset,
        repair.candidateInsertedOffsets[0] ?? repair.predecessorOffset + 2,
        amount,
        repair.proofInputOffset,
      )) repaired = true;
      else if (!hasInsert) {
        // Pure UPDATE batch: restore a described entry when another collection overwrote its output lock.
        // There are no NEW/P' coordinates to infer.
        const balancesLock = builder.outputs[master + repair.predecessorOffset]?.to;
        if (balancesLock instanceof Uint8Array) {
          for (const offset of [repair.predecessorOffset, ...repair.candidateInsertedOffsets]) {
            const input = host.allInputs[master + offset];
            const output = builder.outputs[master + offset];
            const outLock = output?.to instanceof Uint8Array ? output.to : undefined;
            const alreadyBalances = !!outLock
              && outLock.length === balancesLock.length
              && outLock.every((byte, index) => byte === balancesLock[index]);
            if (alreadyBalances) continue;
            const inLock = input?.token && 'unlocker' in input && input.unlocker
              ? input.unlocker.generateLockingBytecode()
              : undefined;
            const inputIsBalances = !!inLock
              && inLock.length === balancesLock.length
              && inLock.every((byte, index) => byte === balancesLock[index]);
            if (!inputIsBalances && !repair.candidateInsertedOffsets.includes(offset)) continue;
            const commitment = resolveRestoredBalancesEntryCommitment({
              planned: repairGroup.batchEntryCommitments?.get(offset)
                ?? host.externalCallEntryOutputs.get(physical.categoryId)?.get(offset),
              inputCommitment: inputIsBalances
                ? String(input?.token?.nft?.commitment ?? '')
                : undefined,
              amount,
            });
            if (!commitment) continue;
            builder.outputs[master + offset] = {
              to: balancesLock,
              amount: output?.amount && output.amount > 0n
                ? output.amount
                : (input?.satoshis ?? 1200n),
              token: {
                amount: 0n,
                category: physical.categoryId!,
                nft: { capability: 'mutable', commitment },
              },
            };
            repaired = true;
          }
        }
      }
    }
    if (debugTokenInsert) {
      const balancesLockHex = repairGroup.batchPredecessorOutputs?.[0]
        ? binToHex(repairGroup.batchPredecessorOutputs[0].lockingBytecode) : '';
      console.error('token-insert-repair-after', {
        master,
        amount: lastRepairAmount !== undefined ? lastRepairAmount.toString() : undefined,
        locks: [2, 3, 4, 8, 9].map((rel) => {
          const output = builder.outputs[master + rel];
          const lock = output?.to instanceof Uint8Array ? binToHex(output.to).slice(0, 28) : '';
          const commit = String(output?.token?.nft?.commitment ?? '');
          return {
            rel, abs: master + rel, lock, commitLen: commit.length, commit: commit.slice(0, 80),
            full: rel === 4 ? commit : undefined,
          };
        }),
        allBalancesLockOutputs: balancesLockHex === '' ? [] : builder.outputs.flatMap((output, index) => {
          const lock = output?.to instanceof Uint8Array ? binToHex(output.to) : '';
          if (lock !== balancesLockHex) return [];
          return [{
            index,
            cat: String(output?.token?.category ?? '').slice(0, 16),
            commit: String(output?.token?.nft?.commitment ?? '').slice(0, 24),
          }];
        }),
        allBalancesLockInputs: balancesLockHex === '' ? [] : host.allInputs.flatMap((input, index) => {
          if (!input?.token || !('unlocker' in input) || !input.unlocker) return [];
          const lock = binToHex(input.unlocker.generateLockingBytecode());
          if (lock !== balancesLockHex) return [];
          return [{
            index,
            cat: String(input.token.category ?? '').slice(0, 16),
            commit: String(input.token.nft?.commitment ?? '').slice(0, 24),
          }];
        }),
      });
    }
    // A shared-proof linear batch can leave P' on its proof co-spend while NEW occupies a later described
    // entry. Reorder only when the exact slot/next relationship selects one successor unambiguously.
    if (repaired) {
      for (const repair of entryInsertLockRepairs(repairGroup)) {
        reorderLinearBatchProofSuccessor(
          builder.outputs, host.allInputs, master, physical.categoryId, repair,
        );
      }
    }
  }
}
