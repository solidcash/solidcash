/**
 * phase-boundary extract: SC _createBuilder extract — load external-read UTXOs + caller-identity band.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  buildEntryNftCovenantScript,
  computeCollectionHash,
  parseEntryCommitment,
  type AbiFunction,
  type Artifact,
} from '@solidcash/utils';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { scriptToAddress } from '../utils.js';
import {
  createReadOnlyDataNftUnlocker,
  createReadOnlyEntryNftUnlocker,
} from './covenant-helpers.js';
import { isScidIdentityCommitment } from './logical-identity.js';

export interface LoadCreateBuilderExternalReadsHost {
  readonly artifact: Artifact;
  readonly network: Parameters<typeof scriptToAddress>[1];
  readonly addressType: Parameters<typeof scriptToAddress>[2];
  readonly unlockerContract: Parameters<typeof createReadOnlyDataNftUnlocker>[0];
  resolveExternalCategoryId(er: any, artifact: Artifact): string;
  getExternalDataNftAddress(externalCategoryId: string): string;
  findExternalDataNft(
    dataNftAddress: string,
    externalCategoryId: string,
    nftIndex: number,
  ): Promise<Utxo | undefined>;
  getUtxos(address: string): Promise<Utxo[]>;
  keysMatch(a: unknown, b: unknown, keyType: string): boolean;
}

export interface LoadCreateBuilderExternalReadsOverrides {
  callerIdentityUtxos?: UnlockableUtxo[];
  callerLockingBytecode?: Uint8Array;
  msgSenderCategory?: Uint8Array;
  externalEntryKeyOverrides?: Map<number, bigint | boolean | Uint8Array>;
  returnProbeOnly?: boolean;
  emitReturn?: boolean;
  calls?: readonly unknown[];
}

/**
 * Seed the external-read band with optional caller-identity co-spends, then discover
 * each ABI external-read data/entry NFT as a read-only unlockable UTXO.
 */
export async function loadCreateBuilderExternalReads(
  host: LoadCreateBuilderExternalReadsHost,
  functionName: string,
  abiFunction: AbiFunction | undefined,
  overrides?: LoadCreateBuilderExternalReadsOverrides,
): Promise<UnlockableUtxo[]> {
  const externalReads = abiFunction?.externalReads;
  let externalReadUtxos: UnlockableUtxo[] = [];

  // The caller identity co-spends join the READ band: every band width below is derived from this array, so
  // appending here keeps all absolute input coordinates consistent.
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1' && overrides?.returnProbeOnly === true) {
    // Is this the build path the failing probe takes? Print the identity inputs the overrides carry and what the
    // read band holds before the merge, so a dropped carrier is visible at its source.
    console.error('read-band-merge', JSON.stringify({
      functionName,
      hasCallerIdentityUtxos: overrides?.callerIdentityUtxos !== undefined,
      callerIdentityUtxos: overrides?.callerIdentityUtxos?.length ?? 0,
      hasCallerLock: overrides?.callerLockingBytecode !== undefined,
      hasMsgSenderCategory: overrides?.msgSenderCategory !== undefined,
      externalReadUtxos: externalReadUtxos.length,
    }));
  }
  if (overrides?.callerIdentityUtxos !== undefined) {
    // SCIDs have their own tail band and preservation rules. Keeping one in the ordinary read band lets its
    // 1:1 recreation occupy an event/return coordinate during probe repair.
    externalReadUtxos = [...externalReadUtxos, ...overrides.callerIdentityUtxos.filter((utxo) =>
      !isScidIdentityCommitment(utxo.token?.nft?.commitment))];
  } else if (overrides?.callerLockingBytecode !== undefined && overrides?.msgSenderCategory === undefined
    && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
    // The caller lock arrived without its category, so no synthetic carrier can be built (the resolution scan is
    // by category). Name the build so the annotation that supplies the lock can be extended with the category.
    console.error('caller-identity-missing-category', JSON.stringify({
      functionName, abiFunction: abiFunction?.name,
      emitReturn: overrides?.emitReturn === true,
      returnProbeOnly: overrides?.returnProbeOnly === true,
      calls: overrides?.calls?.length ?? 0,
    }));
  }

  if (externalReads && externalReads.length > 0) {
    const artifact = host.artifact;

    for (let slotIndex = 0; slotIndex < externalReads.length; slotIndex++) {
      const er = externalReads[slotIndex];

      // Resolve external category ID from constructor args using categoryParam
      const externalCategoryId = host.resolveExternalCategoryId(er, artifact);

      if (er.kind === 'data') {
        // Data NFT read: discover the data NFT at the target nftIndex
        const dataNftAddress = host.getExternalDataNftAddress(externalCategoryId);
        const utxo = await host.findExternalDataNft(dataNftAddress, externalCategoryId, er.nftIndex ?? 0);

        if (utxo) {
          const unlocker = createReadOnlyDataNftUnlocker(host.unlockerContract, externalCategoryId);
          externalReadUtxos.push({ ...utxo, unlocker });
        } else {
          throw new Error(
            `External data NFT not found for interface '${er.interfaceName}' `
            + `at nftIndex ${er.nftIndex ?? 0} (category ${externalCategoryId})`,
          );
        }
      } else {
        // Entry NFT read: discover the entry NFT matching the collection
        const externalIface = artifact.externalInterfaces?.find((ei) => ei.name === er.interfaceName);
        const collectionSignature = er.collectionSignature
          ?? externalIface?.stateLayout.collections?.find((c) => c.name === er.collectionName)?.signature;

        if (!collectionSignature) {
          throw new Error(
            `Collection signature not found for external read: ${er.interfaceName}.${er.collectionName}`,
          );
        }

        const collectionHash = computeCollectionHash(collectionSignature);
        const entryCovenantScript = buildEntryNftCovenantScript(hexToBin(externalCategoryId), collectionHash);
        const entryAddress = scriptToAddress(
          entryCovenantScript, host.network, host.addressType, true,
        );

        let entryUtxo: Utxo | undefined;
        try {
          const entryUtxos = await host.getUtxos(entryAddress);
          const externalKeyOverride = overrides?.externalEntryKeyOverrides?.get(slotIndex);
          if (externalKeyOverride !== undefined) {
            // Match entry by key in commitment
            const collection = externalIface?.stateLayout.collections?.find(
              (c) => c.name === er.collectionName,
            );
            for (const u of entryUtxos) {
              if (!u.token?.category || u.token.category !== externalCategoryId) continue;
              if (!u.token?.nft?.commitment || u.token.nft.commitment.length === 0) continue;
              try {
                if (collection) {
                  const parsed = parseEntryCommitment(
                    u.token.nft.commitment, collection.keyType, collection.valueType,
                    externalIface?.stateLayout.structs,
                  );
                  if (host.keysMatch(parsed.key, externalKeyOverride, collection.keyType)) {
                    entryUtxo = u;
                    break;
                  }
                }
              } catch {
                // Commitment doesn't parse - skip
              }
            }
          } else {
            // No key override: find matching UTXOs and error if ambiguous
            const matchingEntries = entryUtxos.filter(
              (u) => u.token?.category === externalCategoryId
                && u.token?.nft?.commitment
                && u.token.nft.commitment.length > 0,
            );
            if (matchingEntries.length > 1) {
              throw new Error(
                'Multiple entry NFTs found for collection '
                + `'${er.collectionName}' of interface `
                + `'${er.interfaceName}'. Use `
                + '.withExternalEntryKey() to specify '
                + 'which entry to read.',
              );
            }
            entryUtxo = matchingEntries[0];
          }
        } catch {
          // Entry doesn't exist
        }

        if (entryUtxo) {
          const unlocker = createReadOnlyEntryNftUnlocker(
            host.unlockerContract, externalCategoryId, collectionSignature,
          );
          externalReadUtxos.push({ ...entryUtxo, unlocker });
        }
        // Entry may not exist - _externalReadFlags will indicate absence
      }
    }
  }

  return externalReadUtxos;
}
