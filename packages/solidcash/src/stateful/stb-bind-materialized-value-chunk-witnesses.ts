/**
 * phase-boundary extract: STB public-surface extract — bindMaterializedValueChunkWitnesses continuation witnesses.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import type { AbiFunction } from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript, calculateDust } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { findDisposableValueChunkOutputBase } from './early-value-chunk-helpers.js';
import {
  ownsCapturedValueChunkOutputBase,
  refreshCapturedValueChunkOutputBase,
  rebaseValueChunkWriteDescriptors,
  transportedContinuationLocalBase,
} from './value-chunk-base-writer-select.js';
import {
  coherentAuthenticatedValueChunkRun,
  materializedValueChunkAbsoluteStart,
  settlement,
  valueChunkIndexFromCommitment,
  valueChunkWriteResourceIdentity,
  type AuthenticatedValueChunk,
  type DerivedChunkOutputObservation,
} from './value-chunk-persist.js';
import { isP2sh32LockScript } from './value-chunk-band-helpers.js';
import type { UnlockableUtxo } from '../interfaces.js';

export interface BindMaterializedValueChunkWitnessesHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly categoryId: string;
  readonly derivedChunkOutputs: Map<number, DerivedChunkOutputObservation>;
  readonly allInputs: readonly UnlockableUtxo[];
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  syncRefreshedCarrierMasters(
    builder: TransactionBuilder,
    carriers: ReadonlySet<ExternalCallUtxoGroup>,
  ): void;
}

/**
 * Bind compiler-owned continuation witnesses after every output in an isolated composition block has been
 * materialized. Graph routes can represent several logical calls with one low-level carrier, so discovery is
 * based on ABI/state-layout metadata and the self-describing output run rather than a source function name.
 */
export function bindMaterializedValueChunkWitnesses(
  host: BindMaterializedValueChunkWitnessesHost,
  builder: TransactionBuilder,
  coordinateBase = 0,
): boolean {
  const carriers = [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups];
  const changedCarriers = new Set<ExternalCallUtxoGroup>();
  const occupiedBases = new Map<number, string>();

  for (const [carrierIndex, carrier] of carriers.entries()) {
    const abiFunction = carrier.compilerRoute?.abiFunction
      ?? (carrier.externalContract?.inner.artifact.abi as readonly AbiFunction[] | undefined)
        ?.find((candidate) => candidate.name === carrier.functionName);
    if (!abiFunction?.inputs.some((input) => input.name === '__internal__valueChunkOutputBase')) continue;
    const activeFunctions = carrier.compilerRoute?.abiFunction === abiFunction
      && (carrier.compilerRoute.rowArguments?.length ?? 0) > 0
      ? carrier.compilerRoute.rowArguments!.map((row) => row.handler)
      : [abiFunction];
    const activeWriteCollections = (abiFunction as AbiFunction & {
      messageBusActiveWriteCollections?: readonly string[];
    }).messageBusActiveWriteCollections;
    const chunkableCollections = [...new Set(activeFunctions.flatMap((activeFunction) => (
      activeFunction.entryAccesses ?? []
    ).flatMap((access) => {
      if (!access.operations.includes('write')
        || (activeWriteCollections !== undefined
          && !activeWriteCollections.includes(access.collection))) return [];
      const collection = carrier.stateLayout.collections?.find((candidate) => (
        candidate.name === access.collection || candidate.signature === access.collection
      ));
      return collection?.chunkableValue === true && collection.valueType.endsWith('[]')
        ? [access.collection] : [];
    })))];
    if (chunkableCollections.length === 0) continue;

    const lowLevelIndex = carrierIndex - host.externalCallUtxoGroups.length;
    const delegatedProxy = lowLevelIndex < 0 ? undefined : host.externalCallUtxoGroups.find(
      (group) => group.delegateCallGroupIndex === lowLevelIndex,
    );
    const outputCategoryId = carrier.callMode === 'delegatecall'
      ? delegatedProxy?.categoryId ?? host.categoryId
      : carrier.categoryId;
    const externalIndex = carrierIndex < host.externalCallUtxoGroups.length ? carrierIndex : -1;
    const aliasGroups = externalIndex >= 0
      ? [carrier, ...(carrier.delegateCallGroupIndex === undefined
        ? [] : [host.lowLevelCallUtxoGroups[carrier.delegateCallGroupIndex]])]
      : [carrier, ...host.externalCallUtxoGroups.filter(
        (group) => group.delegateCallGroupIndex === lowLevelIndex,
      )];
    const physicalOwnerId = externalIndex >= 0
      ? carrier.delegateCallGroupIndex === undefined
        ? `external:${externalIndex}` : `delegate:${carrier.delegateCallGroupIndex}`
      : aliasGroups.length > 1 ? `delegate:${lowLevelIndex}` : `low-level:${lowLevelIndex}`;
    const resourceIdentities = new Set(aliasGroups.flatMap((group) => (
      group?.valueChunkWrites ?? []
    )).map(valueChunkWriteResourceIdentity));
    let selectedStart = -1;
    let selectedWidth = 0;
    let selectedResourceIdentity: string | undefined;
    const provisionalBase = carrier.valueChunkOutputBase;
    let preferredLocalBase = provisionalBase === undefined || provisionalBase < 0
      ? undefined
      : provisionalBase >= coordinateBase ? provisionalBase - coordinateBase : provisionalBase;
    const transportedClaims = aliasGroups.flatMap((group) => group?.continuationResourceClaims ?? []);
    const canonicalLocalBases = [...resourceIdentities].flatMap((resourceIdentity) => {
      const writeCount = aliasGroups.flatMap((group) => group?.valueChunkWrites ?? [])
        .find((write) => valueChunkWriteResourceIdentity(write) === resourceIdentity)?.outputCount;
      if (writeCount === undefined) return [];
      const base = transportedContinuationLocalBase(transportedClaims, resourceIdentity, writeCount);
      return base === undefined ? [] : [base];
    });
    if (canonicalLocalBases.length === 1) preferredLocalBase = canonicalLocalBases[0];
    // One scalar witness cannot describe several independently placed resources. Their authenticated
    // claims supply each physical base; bind each write to its own exact run and refresh only the scalar
    // for the first (lowest) band. A single observed run must never shift the other resources as a group.
    const claimsByResource = new Map<string, (typeof transportedClaims)[number]>();
    for (const claim of transportedClaims) {
      const identity = claim.producerClaim.resourceIdentity;
      const prior = claimsByResource.get(identity);
      if (prior && (prior.bandOffset !== claim.bandOffset || prior.chunkCount !== claim.chunkCount)) {
        throw new Error(`Transported value-chunk resource '${identity}' has conflicting carrier bands.`);
      }
      claimsByResource.set(identity, claim);
    }
    if (claimsByResource.size > 1) {
      const claimedWrites = aliasGroups.flatMap((group) => group?.valueChunkWrites ?? []);
      const complete = [...claimsByResource].every(([identity, claim]) => {
        if (!resourceIdentities.has(identity)
          || !Number.isSafeInteger(claim.bandOffset) || claim.bandOffset < 0
          || !Number.isSafeInteger(claim.chunkCount) || claim.chunkCount < 1
          || !Number.isSafeInteger(claim.bandOffset + claim.chunkCount)
          || claim.bandOffset + claim.chunkCount > builder.outputs.length
          || !claimedWrites.some((write) => valueChunkWriteResourceIdentity(write) === identity)) return false;
        for (let index = 0; index < claim.chunkCount; index += 1) {
          const offset = claim.bandOffset + index;
          const observed = host.derivedChunkOutputs.get(offset);
          const output = builder.outputs[offset];
          const lock = output?.to instanceof Uint8Array
            ? output.to : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
          if (observed?.resourceIdentity !== identity
            || observed.resourcePart !== `chunk:${index}`
            || valueChunkIndexFromCommitment(observed.commitment) !== index
            || lock === undefined || !isP2sh32LockScript(lock)
            || binToHex(lock) !== binToHex(observed.lockingBytecode)
            || output.token?.category !== outputCategoryId
            || output.token.nft?.capability !== 'mutable'
            || output.token.nft.commitment !== observed.commitment) return false;
        }
        return true;
      });
      // A progressive probe may not have materialized every claimed run yet. Leave all claims untouched;
      // the final composer validates every resource/output pair before publishing the transaction.
      if (!complete) continue;
      const firstClaim = [...claimsByResource.values()].reduce((first, claim) => (
        claim.bandOffset < first.bandOffset ? claim : first
      ));
      const scalarStart = coordinateBase + firstClaim.bandOffset;
      const priorOwner = occupiedBases.get(scalarStart);
      if (priorOwner !== undefined && priorOwner !== physicalOwnerId) {
        throw new Error('Transported value-chunk carrier bands have conflicting physical owners.');
      }
      occupiedBases.set(scalarStart, physicalOwnerId);
      for (const alias of aliasGroups.filter(
        (candidate): candidate is ExternalCallUtxoGroup => candidate !== undefined
          && ownsCapturedValueChunkOutputBase(candidate),
      )) {
        const nextWrites = alias.valueChunkWrites?.map((write) => {
          const claim = claimsByResource.get(valueChunkWriteResourceIdentity(write));
          return claim === undefined ? write : {
            ...write, outputBase: coordinateBase + claim.bandOffset, outputCount: claim.chunkCount,
          };
        });
        const writesChanged = nextWrites?.some((write, index) => (
          write.outputBase !== alias.valueChunkWrites?.[index]?.outputBase
            || write.outputCount !== alias.valueChunkWrites?.[index]?.outputCount
        )) === true;
        if (writesChanged) alias.valueChunkWrites = nextWrites;
        if (alias.valueChunkOutputBase !== scalarStart
          || alias.internalArgs?.__internal__valueChunkOutputBase !== BigInt(scalarStart)) {
          const trailingBase = alias.blockLayout?.trailingBase ?? carrier.blockLayout?.trailingBase;
          const blockSize = alias.blockLayout?.blockSize ?? carrier.blockLayout?.blockSize;
          if (trailingBase !== undefined && blockSize !== undefined
            && host.messageBusConvention === 'kernel-row-loop') {
            refreshCapturedValueChunkOutputBase(alias, scalarStart, {
              shiftPredOut: false,
              resolveAuthority: {
                publishedBase: coordinateBase,
                blockSize,
                trailingBase,
                trailingCapacity: alias.blockLayout?.trailingCapacity
                  ?? carrier.blockLayout?.trailingCapacity,
                valueChunkBandOffset: firstClaim.bandOffset - trailingBase,
                valueChunkCount: firstClaim.chunkCount,
              },
            });
          } else {
            refreshCapturedValueChunkOutputBase(alias, scalarStart, { shiftPredOut: false });
          }
          changedCarriers.add(alias);
        } else if (writesChanged) changedCarriers.add(alias);
      }
      continue;
    }
    const exactResourceStarts = [...host.derivedChunkOutputs.entries()]
      .filter(([, chunk]) => resourceIdentities.has(chunk.resourceIdentity ?? '')
        && chunk.resourcePart === 'chunk:0')
      .map(([start]) => start);
    let candidateStarts = [...host.derivedChunkOutputs.entries()]
      .filter(([start, chunk]) => (chunk.categoryId ?? host.categoryId) === outputCategoryId
        && valueChunkIndexFromCommitment(chunk.commitment) === 0
        && (exactResourceStarts.length === 0 || exactResourceStarts.includes(start)))
      .map(([start]) => start)
      .sort((left, right) => left - right);
    if (candidateStarts.length === 0) {
      const observedRuns = chunkableCollections.flatMap((collection) => {
        const run = coherentAuthenticatedValueChunkRun(settlement().observedValueChunksByCollection.get(
          `${outputCategoryId.toLowerCase()}:${collection}`,
        ) ?? []);
        return run.length > 0 ? [run] : [];
      });
      const uniqueRuns = new Map(observedRuns.map((run) => [
        run.map((chunk) => `${binToHex(chunk.lockingBytecode)}:${chunk.commitment}`).join('|'), run,
      ]));
      const matchesAt = (run: readonly AuthenticatedValueChunk[], start: number): boolean => (
        run.every((chunk, offset) => {
          const output = builder.outputs[start + offset];
          const lock = output?.to instanceof Uint8Array
            ? output.to : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
          return lock !== undefined
            && binToHex(lock) === binToHex(chunk.lockingBytecode)
            && output.token?.category === outputCategoryId
            && output.token?.nft?.capability === 'mutable'
            && output.token.nft.commitment === chunk.commitment;
        })
      );
      const materializedRuns = [...uniqueRuns.values()].flatMap((run) => builder.outputs.flatMap(
        (_, start) => matchesAt(run, start) ? [{ run, start }] : [],
      ));
      const preferredRun = preferredLocalBase === undefined ? undefined : materializedRuns.find(
        ({ start }) => start === preferredLocalBase,
      );
      const selectedRun = preferredRun
        ?? (materializedRuns.length === 1 ? materializedRuns[0] : undefined);
      const soleObservedRun = uniqueRuns.size === 1 ? [...uniqueRuns.values()][0] : undefined;
      const run = selectedRun?.run ?? soleObservedRun;
      if (run) {
        const reserved = new Set(host.derivedChunkOutputs.keys());
        let base: number | undefined;
        if (selectedRun) {
          base = selectedRun.start;
        } else {
          base = findDisposableValueChunkOutputBase(builder.outputs, host.allInputs, run.length, reserved);
        }
        if (base !== undefined) {
          for (const [offset, chunk] of run.entries()) {
            const index = base + offset;
            const next = {
              to: chunk.lockingBytecode,
              amount: 1200n,
              token: {
                amount: 0n,
                category: outputCategoryId,
                nft: { capability: 'mutable' as const, commitment: chunk.commitment },
              },
            };
            next.amount = BigInt(Math.max(1200, calculateDust(next)));
            builder.outputs[index] = next;
            host.derivedChunkOutputs.set(index, {
              ...chunk, categoryId: outputCategoryId, fixedIndex: true,
            });
          }
          preferredLocalBase = base;
          candidateStarts = [base];
        }
      }
    }
    const eligibleStarts = exactResourceStarts.length > 0
      ? (candidateStarts.length === 1 ? candidateStarts : [])
      : preferredLocalBase !== undefined
        ? candidateStarts.filter((start) => start === preferredLocalBase)
        : candidateStarts.length === 1 ? candidateStarts : [];
    for (const start of eligibleStarts) {
      const firstExpected = host.derivedChunkOutputs.get(start)!;
      const runResourceIdentity = firstExpected.resourceIdentity;
      const runLock = binToHex(firstExpected.lockingBytecode);
      let expectedWidth = 0;
      while (start + expectedWidth < builder.outputs.length) {
        const expected = host.derivedChunkOutputs.get(start + expectedWidth);
        if (!expected || (expected.categoryId ?? host.categoryId) !== outputCategoryId
          || binToHex(expected.lockingBytecode) !== runLock
          || (runResourceIdentity !== undefined
            && (expected.resourceIdentity !== runResourceIdentity
              || expected.resourcePart !== `chunk:${expectedWidth}`))
          || valueChunkIndexFromCommitment(expected.commitment) !== expectedWidth) break;
        expectedWidth += 1;
      }
      let width = 0;
      while (width < expectedWidth) {
        const expected = host.derivedChunkOutputs.get(start + width);
        if (!expected) break;
        const output = builder.outputs[start + width];
        const lock = output?.to instanceof Uint8Array
          ? output.to : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
        if (!isP2sh32LockScript(lock)
          || binToHex(lock) !== runLock
          || output.token?.category !== outputCategoryId
          || output.token.nft?.capability !== 'mutable'
          || output.token.nft.commitment !== expected.commitment) break;
        width += 1;
      }
      if (expectedWidth === 0 || width !== expectedWidth) continue;
      // Map keys and output indices are in this builder's frame, including compiler-owned resources.
      // A resource identity authenticates ownership; it does not make a local output index absolute.
      const absoluteStart = materializedValueChunkAbsoluteStart(start, coordinateBase);
      const owner = occupiedBases.get(absoluteStart);
      if (owner === undefined || owner === physicalOwnerId) {
        selectedStart = start;
        selectedWidth = width;
        selectedResourceIdentity = runResourceIdentity;
      }
    }
    if (selectedStart < 0) continue;
    if (selectedResourceIdentity === undefined && resourceIdentities.size > 1) continue;
    const absoluteStart = materializedValueChunkAbsoluteStart(selectedStart, coordinateBase);
    occupiedBases.set(absoluteStart, physicalOwnerId);
    // `delegateCallGroupIndex` is the planner's stable physical-callsite identity. Every proxy record attached
    // to that implementation input encodes the same continuation witness, even when one logical record omits
    // the implementation's collection descriptor. Update the complete alias set atomically.
    const physicalAliases = aliasGroups.filter(
      (alias): alias is ExternalCallUtxoGroup => alias !== undefined
        && ownsCapturedValueChunkOutputBase(alias),
    );
    for (const alias of physicalAliases) {
      const encoded = alias.internalArgs?.__internal__valueChunkOutputBase;
      const selectedWrite = selectedResourceIdentity === undefined ? undefined
        : alias.valueChunkWrites?.find((write) => (
          valueChunkWriteResourceIdentity(write) === selectedResourceIdentity
        ));
      const resolvedWriteBases = selectedWrite === undefined
        ? selectedResourceIdentity === undefined
          ? (alias.valueChunkWrites ?? []).map((write) => write.outputBase)
            .filter((base) => Number.isSafeInteger(base) && base >= 0)
          : []
        : [selectedWrite.outputBase];
      const previousWriteBase = resolvedWriteBases.length > 0
        ? Math.min(...resolvedWriteBases) : alias.valueChunkOutputBase;
      const writesNeedRebase = previousWriteBase !== undefined && previousWriteBase !== absoluteStart;
      if (alias.valueChunkOutputBase === absoluteStart && encoded === BigInt(absoluteStart)
        && !writesNeedRebase) continue;
      alias.valueChunkWrites = selectedWrite === undefined
        ? selectedResourceIdentity === undefined
          ? rebaseValueChunkWriteDescriptors(alias.valueChunkWrites, previousWriteBase, absoluteStart)
          : alias.valueChunkWrites
        : alias.valueChunkWrites?.map((write) => valueChunkWriteResourceIdentity(write) === selectedResourceIdentity
          ? { ...write, outputBase: absoluteStart } : write);
      // Kernel sole authority: when trailing geometry is published, assign via resolve (not invent).
      const trailingBase = alias.blockLayout?.trailingBase
        ?? carrier.blockLayout?.trailingBase;
      const blockSize = alias.blockLayout?.blockSize
        ?? carrier.blockLayout?.blockSize;
      const writes = alias.valueChunkWrites ?? carrier.valueChunkWrites ?? [];
      const write = selectedResourceIdentity === undefined
        ? writes.length === 1 ? writes[0] : undefined
        : writes.find((candidate) => valueChunkWriteResourceIdentity(candidate) === selectedResourceIdentity);
      if (trailingBase !== undefined && blockSize !== undefined
        && host.messageBusConvention === 'kernel-row-loop') {
        // Descriptors may already carry aggregate coordinates. Resolve the observed builder-local run,
        // not the old descriptor's absolute/provisional base, against the published local trailing band.
        const bandOffset = selectedStart - trailingBase;
        const resolveAuthority = {
          publishedBase: coordinateBase,
          blockSize: Math.max(blockSize, trailingBase + selectedWidth),
          trailingBase,
          trailingCapacity: alias.blockLayout?.trailingCapacity
            ?? carrier.blockLayout?.trailingCapacity,
          valueChunkBandOffset: bandOffset,
          valueChunkCollection: write?.collection,
          // The complete coherent run is known here. A descriptor can still carry a conservative
          // planning estimate or the aggregate width of multiple resources in this carrier.
          valueChunkCount: selectedWidth,
        };
        refreshCapturedValueChunkOutputBase(alias, absoluteStart, {
          shiftPredOut: false,
          resolveAuthority,
        });
      } else {
        refreshCapturedValueChunkOutputBase(alias, absoluteStart, { shiftPredOut: false });
      }
      changedCarriers.add(alias);
    }
  }
  if (changedCarriers.size === 0) return false;
  host.syncRefreshedCarrierMasters(builder, changedCarriers);
  return true;
}
