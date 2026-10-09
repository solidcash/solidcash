/**
 * phase-boundary extract: SC _createBuilder extract — alias-conditional skip slots, delete/soft-delete
 * slot sets, and per-collection entry NFT locking bytecodes.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import {
  buildEntryNftCovenantScript,
  computeCollectionHash,
  type AbiFunction,
} from '@solidcash/utils';
import { scriptToLockingBytecode } from '../utils.js';

export type FinalizeCreateBuilderEntryDeleteSlotsHost = {
  readonly categoryId: string;
  readonly inner: any;
  keysMatch: (...args: any[]) => boolean;
  [key: string]: any;
};

export type FinalizeCreateBuilderEntryDeleteSlotsResult = {
  entryNfts: any[];
  aliasSkipSlots: Set<number>;
  entryDeleteSlots: Set<number>;
  condSoftDeleteSlots: Set<number>;
  entryNftLockingBytecodes: Map<string, Uint8Array>;
};

export function finalizeCreateBuilderEntryDeleteSlots(
  host: FinalizeCreateBuilderEntryDeleteSlotsHost,
  params: {
    entryNfts: any[];
    entryAccesses: readonly any[] | undefined;
    entryAccessForSlot: (slotIndex: number) => any;
    entryOperations: (slotIndex: number) => readonly string[];
    runtimeMessageBusAliasSkipSlots: Iterable<number> | Set<number>;
    abiFunction: AbiFunction | undefined;
    stateLayout: any;
    [key: string]: any;
  },
): FinalizeCreateBuilderEntryDeleteSlotsResult {
  let { entryNfts } = params;
  const {
    entryAccesses, entryAccessForSlot, entryOperations,
    runtimeMessageBusAliasSkipSlots, abiFunction, stateLayout,
  } = params;

  // Alias-conditional writes (swap-remove of the LAST key): a write slot whose runtime key equals the aliasing
  // delete slot's key backs the SAME entry NFT. Co-spending it at two input offsets is invalid; the covenant
  // gates the write off, so fund this slot (no co-spend, no output) - the delete slot owns the entry.
  const aliasSkipSlots = new Set<number>(runtimeMessageBusAliasSkipSlots);
  if (entryAccesses) {
    for (const e of entryNfts) {
      if (aliasSkipSlots.has(e.slotIndex)) {
        e.exists = false;
        e.utxo = undefined;
        continue;
      }
      const aliasSlot = entryAccessForSlot(e.slotIndex)?.aliasCondDeleteSlot;
      if (aliasSlot === undefined) continue;
      const other = entryNfts.find((o: any) => o.slotIndex === aliasSlot);
      if (other && e.collection === other.collection
        && host.keysMatch(e.keyValue, other.keyValue, e.keyType)) {
        aliasSkipSlots.add(e.slotIndex);
        e.exists = false;
        e.utxo = undefined;
      }
    }
  }

  // Determine which entry slots the compiler expects to be deleted (no output)
  // A delete inside a branch (`if(guard) return; delete m[k];`) is lowered to an existence-gated SOFT-DELETE
  // WRITE by the compiler: the entry keeps an output (the type default when the delete ran, the preserved input
  // otherwise) iff it exists. So a conditional delete slot is a WRITE here, not a hard delete - it is co-spent
  // and recreated with the derived commitment, never dropped. Only an UNCONDITIONAL delete drops the entry.
  const entryDeleteSlots = new Set<number>(aliasSkipSlots);
  const condSoftDeleteSlots = new Set<number>();
  if (entryAccesses) {
    for (let accessIndex = 0; accessIndex < entryAccesses.length; accessIndex++) {
      const access = entryAccesses[accessIndex];
      const slotIndex = access.slotIndex ?? accessIndex;
      const softDelete = abiFunction?.blockLayout?.slots.some(
        (s) => s.kind === 'entry' && s.slotIndex === slotIndex && s.softDelete,
      );
      if (softDelete) {
        condSoftDeleteSlots.add(slotIndex);
      } else if (entryOperations(slotIndex).includes('delete')
        && !stateLayout.collections?.find((collection: any) =>
          collection.name === access.collection)?.sorted) {
        entryDeleteSlots.add(slotIndex);
      }
    }
  }

  // Compute per-collection entry NFT locking bytecodes for new entries
  const entryNftLockingBytecodes = new Map<string, Uint8Array>();
  if (entryNfts.length > 0 && stateLayout.collections) {
    for (const coll of stateLayout.collections) {
      const collectionHash = computeCollectionHash(coll.signature);
      const covenantScript = buildEntryNftCovenantScript(hexToBin(host.categoryId), collectionHash);
      entryNftLockingBytecodes.set(coll.name, scriptToLockingBytecode(
        covenantScript, host.inner.addressType,
      ));
    }
  }


  return {
    entryNfts,
    aliasSkipSlots,
    entryDeleteSlots,
    condSoftDeleteSlots,
    entryNftLockingBytecodes,
  };
}
