/**
 * phase-boundary extract: STB public-surface extract — persisted value-chunk continuation restore.
 */

import { binToHex, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import type { TransactionBuilderOptions } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { Contract } from '../Contract.js';
import { getNetworkPrefix } from '../utils.js';
import { createValueChunkUnlocker } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { ChunkableValueWriteGroups } from './stb-chunkable-write-planning.js';
import {
  isCompilerDescribedMintingBandWriter,
  shouldRestorePersistedContinuationInputs,
} from './value-chunk-geometry.js';
import {
  persistedCompatibilityContinuation,
  persistedJobEventsUnlockRecipe,
  persistedValueChunkWriteState,
  rememberJobEventsUnlockRecipe,
  rememberValueChunkUnlockRecipe,
  settlement,
  valueChunkWriteIdentity,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';

export interface EnsurePersistedValueChunkInputsHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly builderOptions: TransactionBuilderOptions;
  readonly allInputs: readonly UnlockableUtxo[];
  setPendingValueChunkPredecessors(extras: UnlockableUtxo[]): void;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  persistedValueChunkCategory(): string | undefined;
  chunkableValueWriteCategory(): string | undefined;
  isInitialChunkableValueWrite(): boolean;
  isPersistedChunkableValueWriteReady(): boolean;
  persistedValueChunkWrite(categoryId: string): ValueChunkWriteDescriptor | null | undefined;
  hasChunkableValueWriteMetadata(): boolean;
  permitsLegacyNamedValueChunkFallback(): boolean;
  chunkableValueWriteGroups(): ChunkableValueWriteGroups;
  findMintingInputIndex(categoryId: string): number;
  placeValueChunkPredecessorInputs(extras: UnlockableUtxo[]): void;
}

/**
 * After extraTransfer, persist predecessors are often missing from `allInputs`.
 * Fetch the last successful value-chunk spends and pin them on the live band.
 */
export async function ensurePersistedValueChunkInputs(
  host: EnsurePersistedValueChunkInputsHost,
): Promise<void> {
  const tokenWriterPresent = host.externalCallUtxoGroups.some((group) =>
    isCompilerDescribedMintingBandWriter(group, true, host.messageBusConvention));
  const band = host.getChunkableValueWriteBand();
  const categoryId = host.persistedValueChunkCategory() ?? host.chunkableValueWriteCategory();
  if (!shouldRestorePersistedContinuationInputs({
    initialWrite: host.isInitialChunkableValueWrite(),
    mintingBandWriter: tokenWriterPresent,
    persisted: host.isPersistedChunkableValueWriteReady(),
    hasBand: band !== undefined,
    hasCategory: categoryId !== undefined,
  })) return;
  // Keep the concrete values narrowed for the resource-loading code below.
  if (!band || !categoryId) return;
  const write = host.persistedValueChunkWrite(categoryId);
  const exactState = write ? persistedValueChunkWriteState(write) : undefined;
  const legacyFallback = write === undefined && !host.hasChunkableValueWriteMetadata()
    && host.permitsLegacyNamedValueChunkFallback();
  const compatibility = legacyFallback ? persistedCompatibilityContinuation(categoryId) : undefined;
  const persistLock = exactState?.lockingBytecode ?? (legacyFallback
    ? compatibility?.lockingBytecode : undefined);
  const persistValue = exactState?.value ?? (legacyFallback
    ? compatibility?.value : undefined);
  const spends = write
    ? (settlement().persistedValueChunkSpends.get(valueChunkWriteIdentity(write)) ?? [])
    : (compatibility?.spends ?? []);
  const extras: UnlockableUtxo[] = [];
  const selectedWriter = host.chunkableValueWriteGroups();
  const publish = selectedWriter.external ?? selectedWriter.lowLevel;
  const contract = publish?.externalContract?.inner as Contract<any, any> | undefined;
  if (persistValue && persistLock) {
    if (write) rememberValueChunkUnlockRecipe(write, persistValue, persistLock);
    else if (write === undefined) rememberJobEventsUnlockRecipe(categoryId);
  }
  const recipe = write === null
    ? undefined
    : (write ? persistedValueChunkWriteState(write)?.recipe
      : (legacyFallback ? persistedJobEventsUnlockRecipe(categoryId) : undefined));
  const unlockCategory = recipe?.categoryId ?? categoryId;
  const unlockMaster = host.findMintingInputIndex(unlockCategory);
  const unlocker = contract && unlockMaster >= 0 && recipe
    ? createValueChunkUnlocker(
      contract, unlockMaster, unlockCategory, recipe.collection, recipe.slot, recipe.root,
    )
    : undefined;
  const unlockerLock = unlocker?.generateLockingBytecode();
  if (unlocker) {
    for (const spend of spends) {
      const spendLock = spend.lockingBytecode;
      // An unlocker and its source locking bytecode are one cryptographic identity. Never pair a cached
      // outpoint with a recipe for another P2SH script: changing only generateLockingBytecode makes the source
      // output look plausible but guarantees a redeem-script hash failure at consensus validation.
      if (!unlockerLock || binToHex(spendLock) !== binToHex(unlockerLock)) continue;
      extras.push({
        txid: spend.txid,
        vout: spend.vout,
        satoshis: spend.satoshis,
        token: spend.token,
        unlocker,
      });
    }
  }
  if (extras.length === 0 && unlocker && unlockerLock && host.builderOptions.provider) {
    try {
      const encoded = lockingBytecodeToCashAddress({
        bytecode: unlockerLock,
        prefix: getNetworkPrefix(host.builderOptions.provider.network),
        tokenSupport: true,
      });
      const address = typeof encoded === 'string' ? undefined : encoded.address;
      if (address) {
        const fetched = await host.builderOptions.provider.getUtxos(address);
        for (const utxo of fetched.filter((item) => item.token?.category === unlockCategory
          && item.token?.nft?.capability === 'mutable')) {
          extras.push({ ...utxo, unlocker });
        }
      }
    } catch { /* persist fetch is best-effort */ }
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
    console.error('jobevents-persist-inputs', {
      categoryId,
      band,
      persistValue: persistValue?.length ?? 0,
      persistLock: persistLock ? binToHex(persistLock).slice(0, 20) : '',
      recipe: recipe ? binToHex(recipe.slot).slice(0, 16) : '',
      spends: spends.length,
      extras: extras.length,
      unlockCategory: unlockCategory.slice(0, 16),
      unlockMaster,
      hasContract: !!contract,
    });
  }
  host.setPendingValueChunkPredecessors(extras);
  host.placeValueChunkPredecessorInputs(extras);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1' && band) {
    console.error('jobevents-band-inputs', {
      start: band.start,
      slots: Array.from({ length: band.nNew }, (_, offset) => {
        const input = host.allInputs[band.start + offset];
        const lock = input && 'unlocker' in input && input.unlocker
          ? binToHex(input.unlocker.generateLockingBytecode()).slice(0, 20) : '';
        return {
          index: band.start + offset,
          lock,
          cap: input?.token?.nft?.capability ?? 'plain',
          cat: String(input?.token?.category ?? '').slice(0, 8),
          commit: String(input?.token?.nft?.commitment ?? '').slice(0, 16),
        };
      }),
    });
  }
}
