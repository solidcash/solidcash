/**
 * phase-boundary extract: SC _createBuilder extract — nothing-to-derive / read-only-getter gate
 * plus the STB derive-pass (value-chunk witness prep, first/second derive,
 * graph absolute base publish, builder __derived* tags + __reDerive).
 */

import { binToHex } from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';
import { isValidComputedValueChunkCommitmentEncoding } from './computed-value-chunk-pin.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { permitsLegacyNamedValueChunkFallback } from './chunkable-value-write-selection.js';
import { resolveKernelValueChunkResourceLanes } from './kernel-value-chunk-lanes.js';
import { valueChunkOutputWitnessCarrier } from './route-value-chunk-helpers.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import type { AssembledWitnessBag } from './sc-rebind-create-builder-assembled-witnesses.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  isValueChunkWriteReady,
  persistedValueChunkWriteState,
  readyPersistedCompatibilityValueChunkWidth,
  selectPersistedValueChunkWrite,
  valueChunkWriteResourceIdentity,
} from './value-chunk-persist.js';
import { orderTransportedContinuationResourceClaims } from './ValueChunkProducerIdentity.js';
import {
  describeValueChunkWrites,
  writesChunkableValue,
} from './writer-group-selection.js';

export type RunCreateBuilderDerivePassHost = {
  deriveFullTransactionState: (...args: any[]) => Promise<any>;
};

/** Only this state owner's materialized writes may activate its continuation witness. Nested callees share the
 * builder's staged/derived output tables, so those tables alone cannot prove that this route wrote a long value. */
export function hasMaterializedValueChunkWitness(
  builder: Pick<StatefulTransactionBuilder, 'getValueChunkRawCommitments'>,
  runs: readonly { id: string }[],
  ownedMaterializedChunkCounts: readonly number[],
): boolean {
  return ownedMaterializedChunkCounts.some((count) => Number.isSafeInteger(count) && count > 0)
    || runs.some((run) => builder.getValueChunkRawCommitments(run.id)
      .some(isValidComputedValueChunkCommitmentEncoding));
}

/** Rebase graph write descriptors without flattening authenticated, separately placed resources. */
export function rebaseGraphValueChunkWrites(
  target: ExternalCallUtxoGroup,
  outputBase: number,
  outputCount: number,
): void {
  const writes = target.valueChunkWrites;
  if (!writes?.length) return;
  const readyBases = writes.map((write) => write.outputBase)
    .filter((base) => Number.isSafeInteger(base) && base >= 0);
  const distinctReadyBases = new Set(readyBases);
  if (distinctReadyBases.size > 1) {
    // Each lane is already placed; move the entire frame without collapsing its geometry.
    const delta = outputBase - Math.min(...readyBases);
    const nextWrites = writes.map((write) => (
      write.outputBase >= 0 ? { ...write, outputBase: write.outputBase + delta } : write
    ));
    let nextClaims = target.continuationResourceClaims;
    if (target.continuationResourceClaims?.length) {
      // Write bases can arrive as transaction-absolute production coordinates, while claims are already
      // participant-local. Moving the scalar to its local slot must not subtract the participant base from
      // those claims; a later local move advances each claim by the scalar's own local displacement.
      const claimDelta = outputBase - target.continuationResourceClaims[0]!.bandOffset;
      const shiftedClaims = target.continuationResourceClaims.map((claim) => ({
        ...claim, bandOffset: claim.bandOffset + claimDelta,
      }));
      const ordered = orderTransportedContinuationResourceClaims(shiftedClaims);
      if (!ordered) throw new Error('Kernel multi-resource continuation claims lost local band geometry.');
      nextClaims = ordered;
    }
    target.valueChunkWrites = nextWrites;
    target.continuationResourceClaims = nextClaims;
    return;
  }
  const identities = writes.map(valueChunkWriteResourceIdentity);
  const distinctIdentities = new Set(identities);
  if (distinctIdentities.size > 1 || (target.transportedValueChunkProductions === true
    && (target.continuationResourceClaims?.length ?? 0) > 1)) {
    const claims = target.transportedValueChunkProductions === true
      ? orderTransportedContinuationResourceClaims(target.continuationResourceClaims ?? [])
      : undefined;
    const byResource = new Map(claims?.map((claim) => [claim.producerClaim.resourceIdentity, claim]));
    if (!claims || claims.length !== writes.length || byResource.size !== writes.length
      || distinctIdentities.size !== writes.length) {
      throw new Error('Kernel multi-resource value-chunk writes lack exact continuation geometry.');
    }
    const firstOffset = claims[0]!.bandOffset;
    const reconstructed = writes.map((write, index) => {
      const claim = byResource.get(identities[index]!);
      const base = claim === undefined ? NaN : outputBase + claim.bandOffset - firstOffset;
      if (!claim || !Number.isSafeInteger(base) || base < 0
        || !Number.isSafeInteger(base + claim.chunkCount)) {
        throw new Error('Kernel multi-resource value-chunk writes lack exact continuation geometry.');
      }
      return { ...write, outputBase: base, outputCount: claim.chunkCount };
    });
    target.valueChunkWrites = reconstructed;
    return;
  }
  target.valueChunkWrites = writes.map((write) => ({
    ...write,
    outputBase,
    outputCount: write.outputCount > 0 ? write.outputCount : outputCount,
  }));
}

/**
 * Gate empty/read-only builders, otherwise run the STB derivation probe(s) and
 * stamp __derived* / __reDerive onto the builder.
 */
export async function runCreateBuilderDerivePass(
  host: RunCreateBuilderDerivePassHost,
  bag: AssembledWitnessBag,
  params: {
    builder: StatefulTransactionBuilder;
    abiFunction: AbiFunction | undefined;
    entryAbiFunction: AbiFunction | undefined;
    requiredNftIndices: readonly number[];
    entryAccesses: readonly any[] | undefined;
    loopEntryVars: readonly any[];
    runtimeLoopEventOutputs: readonly any[];
    runtimeLoopTransferOutputs: readonly any[];
    emitInfos: readonly any[];
    derivTransferCount: number;
    derivTokenOps: readonly any[] | undefined;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    externalOutStateUtxoGroups: ExternalCallUtxoGroup[];
    returnEmitOutputIndex: number;
    stateLayout: any;
    allGroupEcSlots: readonly any[];
    functionName: string;
    timingEnabled: boolean;
    timing?: (label: string) => void;
    computedValueChunkRuns: readonly any[];
    ownedMaterializedValueChunkCounts: readonly number[];
    overrides: any;
    applyMintingMasterFills: () => boolean;
    refreshNestedIdentityAnchorWitnesses: () => boolean;
    refreshTopLevelIdentityAnchorWitnesses: () => boolean;
    eventBlockLayoutForDerive: any;
    delegatecallInputIndex: number | undefined;
    onChainState: any;
    valueChunkWriteStagingSession: any;
    buildStateInputUnlocker: () => any;
    [key: string]: any;
  },
): Promise<void> {
  const {
    builder, abiFunction, entryAbiFunction, requiredNftIndices, entryAccesses,
    loopEntryVars, runtimeLoopEventOutputs, runtimeLoopTransferOutputs, emitInfos,
    derivTransferCount, derivTokenOps, externalCallUtxoGroups, externalOutStateUtxoGroups,
    returnEmitOutputIndex, stateLayout, allGroupEcSlots, functionName, timingEnabled,
    timing, computedValueChunkRuns, ownedMaterializedValueChunkCounts, overrides, applyMintingMasterFills,
    refreshNestedIdentityAnchorWitnesses, refreshTopLevelIdentityAnchorWitnesses,
    eventBlockLayoutForDerive, delegatecallInputIndex, onChainState,
    valueChunkWriteStagingSession, buildStateInputUnlocker,
  } = params;
  const finalArgs = bag.finalArgs;

  // Check if there is nothing to derive for this function (e.g., split/merge/unsafe tiers)
  // X11. Read the ROUTED accesses, not the forwarder's. A delegatecall'd impl's mapping write is verified by
  // the IMPLEMENTATION covenant, so the proxy entry point (`__fallback`) publishes no entryAccesses of its own;
  // keyed on `abiFunction` a proxy with no data NFTs, no emits and no transfers looked like it had nothing to
  // derive, derivation was skipped outright, and the entry output kept its INPUT commitment - the delegated
  // write silently did nothing and the impl covenant rejected it at its own input.
  const hasNothingToDerive = requiredNftIndices.length === 0
  && (entryAccesses?.length ?? 0) === 0
  && (entryAbiFunction?.entryLoopWrites?.length ?? 0) === 0
  && (entryAbiFunction?.sortedUpsertLoopInfo?.length ?? 0) === 0
  // A kernel route owns no mapping metadata itself: selected row metadata materializes directly as physical
  // loop-entry variables above. Those variables are the authoritative derivation plan even when every wrapper
  // metadata list is empty; skipping here would publish link-only placeholder commitments for computed values.
  && loopEntryVars.length === 0
  && runtimeLoopEventOutputs.length === 0
  && runtimeLoopTransferOutputs.length === 0
  && emitInfos.length === 0
  && derivTransferCount === 0
  && (derivTokenOps?.length ?? 0) === 0
  && externalCallUtxoGroups.length === 0
  && externalOutStateUtxoGroups.length === 0
  && returnEmitOutputIndex < 0;

  // A provably read-only getter (compiler writesState=false) produces output state == input state, so the
  // builder reproduces the input commitments (empty stateUpdates) and the multi-pass derivation probe is pure
  // overhead. X176: `=== false` is the ONLY sound reading of this flag - `true` means "not provably
  // read-only", never "mutates a state variable". `StatefulContract.readWritesState` publishes the
  // distinction; nothing here may be rewritten to act on `true`, which would make this skip fail OPEN.
  // Skipping it makes getter calls cheap on-chain here AND in production. Guards: value-returning
  // views (returnEmitOutputIndex>=0) still need the return blob derived, and external call/read groups still
  // need Phase-1 derivation. Misclassification fails closed - the covenant rejects a mismatched output.
  // Kill-switch: SC_DISABLE_GETTER_SKIP=1 forces the full probe (escape hatch for the covenant-path change).
  // Read via globalThis - this is a browser+node library, so `process` is not typed/present in the prod build.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  // A sorted (vmap) mapping read REQUIRES co-spending the bracketing entry (no skippable default-on-absent), so
  // it must not be getter-skipped even though the function writes nothing.
  const readsSortedMapping = (abiFunction?.entryAccesses ?? [])
    .some((ea: any) => stateLayout.collections?.find((c: any) => c.name === ea.collection)?.sorted);
  const isReadOnlyGetter = env?.SC_DISABLE_GETTER_SKIP !== '1'
  && abiFunction?.writesState === false
  && !readsSortedMapping
  && returnEmitOutputIndex < 0
  && externalCallUtxoGroups.length === 0
  && externalOutStateUtxoGroups.length === 0;

  if (hasNothingToDerive || isReadOnlyGetter) {
  // Nothing to derive - set empty state so _applyOverrides doesn't throw
    (builder as any).__derivedState = {};
    (builder as any).__vmErrored = false;
  } else {
  // Try to auto-derive commitments via STB-based probe.
  // Uses _deriveFullTransactionState for all paths - the STB probe includes external read
  // inputs, generates valid signatures (enabling sig-arg auto-derivation), and handles
  // cross-contract calls. Phase 1 derives B's state for each external call group;
  // Phase 2 derives A's state + entries + events + transfers.
    const entryAccessesForDerive = entryAccesses; // routed: a delegatecall'd impl's entries, else abiFunction's
    let deriveResult: any;
    const ecGroupsForDerive = externalCallUtxoGroups.length > 0 ? externalCallUtxoGroups : [];
    const ecCallsForDerive = externalCallUtxoGroups.length > 0 ? allGroupEcSlots : [];
    const osGroupsForDerive = externalOutStateUtxoGroups.length > 0 ? externalOutStateUtxoGroups : undefined;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
      console.error('stateful-derive-call', {
        functionName,
        groups: ecGroupsForDerive.map((group, groupIdx) => ({
          groupIdx,
          functionName: group.functionName,
          hasReturnValues: ecCallsForDerive[groupIdx]?.hasReturnValues,
          sharedGroupIndex: group.sharedGroupIndex,
          fusedReturnGroupIndex: group.fusedReturnGroupIndex,
          returnEventInBlock: group.returnEventInBlock,
          returnOutputIndex: group.returnOutputIndex,
          precomputedReturnCommitment: group.precomputedReturnCommitment
            ? binToHex(group.precomputedReturnCommitment) : undefined,
          blockSize: group.blockInputs?.length,
          returnSlot: group.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent')?.offset,
          entries: group.compilerRoute ? group.blockLayout?.slots.flatMap((slot, index) => {
            if (slot.kind !== 'entry') return [];
            const commitment = group.blockInputs?.[index]?.token?.nft?.commitment;
            return [{
              index,
              slotIndex: slot.slotIndex,
              commitment: commitment
                ? typeof commitment === 'string' ? commitment : binToHex(commitment)
                : undefined,
            }];
          }) : undefined,
          internalArgs: group.compilerRoute?.internalArgs,
        })),
      });
    }
    if (timingEnabled) console.error('builder-derive-identity', {
      functionName, entryFunction: entryAbiFunction?.name,
      dynamicVars: builder.getDynamicChunkVars().map((variable) => ({
        name: variable.name, delegate: variable.delegate, suffix: variable.delegateSuffix,
      })),
    });
    await builder.ensurePersistedValueChunkInputs();
    timing?.('persisted-inputs-ready');
    // The route ABI owns one continuation coordinate. Derivation executes this participant in an isolated
    // transaction, so its witness must remain participant-local until every dynamic resource has converged.
    // Only the finalized graph transaction uses the compiler-published absolute block coordinate.
    const graphOwnsValueChunkWitness = (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)
      ?.messageBusGraphExecution === true;
    const hasExactComputedValueChunkLane = computedValueChunkRuns.length > 0
    && computedValueChunkRuns.every((run) => run.slot?.length === 32);
    const valueChunkWitnessGroups = !graphOwnsValueChunkWitness || !hasExactComputedValueChunkLane ? [] : [
      ...builder.getExternalCallUtxoGroups(), ...builder.getLowLevelCallUtxoGroups(),
    ].filter((group) => {
      const witness = valueChunkOutputWitnessCarrier(builder, group);
      const convention = (witness?.abiFunction as MessageBusRuntimeAbiFunction | undefined)
        ?.messageBusConvention
      ?? witness?.carrier.logicalArtifact?.messageBus?.convention
      ?? witness?.carrier.externalContract?.inner.artifact.messageBus?.convention;
      return witness !== undefined
      && convention === 'kernel-row-loop'
      && writesChunkableValue(witness.carrier, witness.abiFunction);
    });
    if (valueChunkWitnessGroups.length > 0) {
    // Collapse repeated callsites for one resource, but keep distinct collections/keys as ordered lanes.
    // The scalar `__internal__valueChunkOutputBase` authenticates band[0]; later bands ride ordered
    // continuationResourceClaims rather than sharing one projected coordinate.
      resolveKernelValueChunkResourceLanes(computedValueChunkRuns);
    }
    const graphValueChunkArgumentIndex = graphOwnsValueChunkWitness && entryAbiFunction
      ? entryAbiFunction.inputs.findIndex((input) => input.name === '__internal__valueChunkOutputBase')
      : -1;
    const graphValueChunkArgument = graphValueChunkArgumentIndex < 0
      ? undefined : finalArgs[graphValueChunkArgumentIndex];
    const publishedGraphBases = new Set([
      graphValueChunkArgument,
      ...valueChunkWitnessGroups.flatMap((group) => [
        group.compilerRoute?.internalArgs?.__internal__valueChunkOutputBase,
        group.internalArgs?.__internal__valueChunkOutputBase,
      ]),
    ].flatMap((candidate) => typeof candidate === 'bigint'
    && candidate >= 0n && candidate <= BigInt(Number.MAX_SAFE_INTEGER)
      ? [Number(candidate)] : []));
    if (publishedGraphBases.size > 1) {
      throw new Error(
        'Kernel chunkable-value output placement published conflicting continuation coordinates.',
      );
    }
    const graphPublishedValueChunkOutputBase = publishedGraphBases.size === 1
      ? [...publishedGraphBases][0] : undefined;
    const setGraphValueChunkOutputBase = (outputBase: number): boolean => {
      let refreshed = false;
      for (const group of valueChunkWitnessGroups) {
        const witness = valueChunkOutputWitnessCarrier(builder, group);
        if (!witness || !writesChunkableValue(witness.carrier, witness.abiFunction)) continue;
        group.valueChunkOutputBase = outputBase;
        witness.carrier.valueChunkOutputBase = outputBase;
        const outputCount = witness.carrier.valueChunkOutputCount ?? group.valueChunkOutputCount ?? 0;
        if (outputCount > 0 || group.valueChunkWrites?.length || witness.carrier.valueChunkWrites?.length) {
          rebaseGraphValueChunkWrites(group, outputBase, outputCount);
          if (witness.carrier !== group) {
            rebaseGraphValueChunkWrites(witness.carrier, outputBase, outputCount);
          }
        }
        witness.carrier.internalArgs = {
          ...witness.carrier.internalArgs,
          __internal__valueChunkOutputBase: BigInt(outputBase),
        };
        witness.carrier.refreshInternalArgs?.({
          __internal__valueChunkOutputBase: BigInt(outputBase),
        });
        refreshed = true;
      }
      if (refreshed) builder._refreshInputs();
      return refreshed;
    };
    // The builder materializes a composed participant's continuation chunks at the block-LOCAL trailing
    // coordinates (that is what keeps its balanced block inside `blockSize`), while the covenant argument and the
    // composed value-chunk spans must name the ABSOLUTE coordinate in the concatenated transaction. The atomic
    // composer publishes that absolute base when it can; otherwise it is the local band shifted by this
    // participant's block base.
    const composedValueChunkBlockBase = overrides?.omitLocalFeeTail === true
      ? overrides?.blockBase ?? 0 : 0;
    const resolvedGraphValueChunkOutputBase = (): number => (
      graphPublishedValueChunkOutputBase
      ?? builder.getValueChunkOutputBase() + composedValueChunkBlockBase
    );
    setGraphValueChunkOutputBase(resolvedGraphValueChunkOutputBase());
    if (applyMintingMasterFills()) builder._refreshInputs();
    timing?.('pre-derive-layout-ready');
    const describedPersistedWrites = [
      ...builder.getExternalCallUtxoGroups(), ...builder.getLowLevelCallUtxoGroups(),
    ].flatMap((group) => group.valueChunkWrites ?? describeValueChunkWrites(group));
    const describedPersistedWrite = selectPersistedValueChunkWrite(
      describedPersistedWrites, undefined, valueChunkWriteStagingSession,
    );
    const persistBeforeDerive = describedPersistedWrite && isValueChunkWriteReady(describedPersistedWrite)
      ? (persistedValueChunkWriteState(describedPersistedWrite)?.width ?? 0)
      : (describedPersistedWrites.length === 0 && permitsLegacyNamedValueChunkFallback(
        [...builder.getExternalCallUtxoGroups(), ...builder.getLowLevelCallUtxoGroups()],
        (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusConvention,
      ) ? readyPersistedCompatibilityValueChunkWidth(builder.getSelectedPersistedValueChunkCategory()) : 0);
    const layoutRevisionBeforeDerive = builder.getDynamicLayoutRevision();
    const firstDeriveStarted = Date.now();
    deriveResult = await host.deriveFullTransactionState(
      builder, requiredNftIndices, ecGroupsForDerive, ecCallsForDerive,
      entryAccessesForDerive, emitInfos.length > 0 ? emitInfos : undefined,
      eventBlockLayoutForDerive, derivTransferCount, derivTokenOps, delegatecallInputIndex,
      osGroupsForDerive, timingEnabled,
      onChainState.state,
    );
    if (timingEnabled) console.error('builder-derive-pass', {
      functionName, pass: 1, ms: Date.now() - firstDeriveStarted,
      vmErrored: deriveResult.vmErrored,
    });
    const dynamicLayoutChanged = builder.getDynamicLayoutRevision() !== layoutRevisionBeforeDerive;
    if (dynamicLayoutChanged
    || (builder as unknown as { __returnWitnessesReconciled?: boolean }).__returnWitnessesReconciled) {
      (builder as unknown as { __returnWitnessesReconciled?: boolean }).__returnWitnessesReconciled = false;
      // Reconciled witnesses only need a restart while the first probe is incomplete. Structural growth always
      // needs one: caller indices and output witnesses from the narrower geometry are no longer authoritative.
      if (dynamicLayoutChanged || deriveResult.vmErrored || persistBeforeDerive === 0) {
        if (dynamicLayoutChanged) {
          setGraphValueChunkOutputBase(resolvedGraphValueChunkOutputBase());
          refreshNestedIdentityAnchorWitnesses();
          refreshTopLevelIdentityAnchorWitnesses();
          if (applyMintingMasterFills()) builder._refreshInputs();
        }
        const secondDeriveStarted = Date.now();
        deriveResult = await host.deriveFullTransactionState(
          builder, requiredNftIndices, ecGroupsForDerive, ecCallsForDerive,
          entryAccessesForDerive, emitInfos.length > 0 ? emitInfos : undefined,
          eventBlockLayoutForDerive, derivTransferCount, derivTokenOps, delegatecallInputIndex,
          osGroupsForDerive, timingEnabled,
          onChainState.state, true,
        );
        if (timingEnabled) console.error('builder-derive-pass', {
          functionName, pass: 2, ms: Date.now() - secondDeriveStarted,
          vmErrored: deriveResult.vmErrored,
        });
      }
    }
    setGraphValueChunkOutputBase(resolvedGraphValueChunkOutputBase());
    if (graphOwnsValueChunkWitness && abiFunction) {
      const topLevelValueChunkBase = abiFunction.inputs.findIndex(
        (input) => input.name === '__internal__valueChunkOutputBase',
      );
      if (topLevelValueChunkBase >= 0) {
      // During derivation the default/sentinel selects the route-relative continuation band. Once the complete
      // transaction geometry is known, publish the absolute coordinate on the executing input too. This is
      // required for standalone kernel rows as well as atomic graphs: runtime mapping entries precede their
      // computed value chunks, so the layout-relative base is no longer the materialized coordinate.
        // A chunkable-capable route can select an inline write: its reserved continuation band has
        // zero physical chunks. The provisional positive base used during derivation is not a witness
        // until a concrete chunk has materialized; preserve the compiler's absent sentinel otherwise.
        finalArgs[topLevelValueChunkBase] = hasMaterializedValueChunkWitness(
          builder, computedValueChunkRuns, ownedMaterializedValueChunkCounts,
        )
          ? BigInt(resolvedGraphValueChunkOutputBase()) : -1n;
        bag.stateInputUnlocker = buildStateInputUnlocker();
        builder._setMasterUnlocker(bag.stateInputUnlocker);
      }
    }
    timing?.('derivation-complete');
    // Tag the builder with derivation result and a re-derive callback.
    // The callback enables re-derivation after transfers/overrides are applied.
    (builder as any).__derivedState = deriveResult.state;
    (builder as any).__vmErrored = deriveResult.vmErrored;
    (builder as any).__derivationError = deriveResult.derivationError;
    (builder as any).__derivedTransfers = deriveResult.derivedTransfers;
    (builder as any).__derivedTokenContainerTransfers = deriveResult.derivedTokenContainerTransfers;
    (builder as any).__derivedTokenContainerTransferNfts = deriveResult.derivedTokenContainerTransferNfts;
    (builder as any).__expectedTransferCount = derivTransferCount;
    (builder as any).__expectedFtTransferCount = derivTokenOps?.filter((o) => o.type === 'transfer').length ?? 0;
    (builder as any).__expectedNftTransferCount = derivTokenOps?.filter((o) => o.type === 'transferNft').length ?? 0;
    const ecGroups = externalCallUtxoGroups;
    const ecCalls = allGroupEcSlots;
    const osGroups = osGroupsForDerive;
    const ea = entryAccessesForDerive;
    const ei = emitInfos.length > 0 ? emitInfos : undefined;
    const rni = requiredNftIndices;
    const dci = delegatecallInputIndex;
    // Re-derive callback: does NOT pass transfer params - when re-deriving after user
    // provides manual transfers, we work with whatever transfers are already in the builder.
    (builder as any).__reDerive = async (stb: StatefulTransactionBuilder) => (
      host.deriveFullTransactionState(stb, rni, ecGroups, ecCalls, ea, ei,
        eventBlockLayoutForDerive, undefined, undefined, dci, osGroups, false, onChainState.state)
    );
  }
}
