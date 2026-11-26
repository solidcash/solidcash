/**
 * phase-boundary extract: SC _createBuilder extract — nothing-to-derive / read-only-getter gate
 * plus the STB derive-pass (first/second derive, builder __derived* tags + __reDerive).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction } from '@solidcash/utils';
import { isValidComputedValueChunkCommitmentEncoding } from './computed-value-chunk-pin.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { AssembledWitnessBag } from './sc-rebind-create-builder-assembled-witnesses.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { dropSkippedConditionalInserts } from './conditional-sorted-activity.js';
import {
  isValueChunkWriteReady,
  persistedValueChunkWriteState,
  readyPersistedCompatibilityValueChunkWidth,
  selectPersistedValueChunkWrite,
} from './value-chunk-persist.js';
import { describeValueChunkWrites } from './writer-group-selection.js';

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
    timing, applyMintingMasterFills,
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
  // A compiler-generated route owns no mapping metadata itself: selected row metadata materializes directly as physical
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
      ?.SOLIDC_DEBUG_TRACE_CONCISE === '1') {
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
      : (describedPersistedWrites.length === 0
        ? readyPersistedCompatibilityValueChunkWidth(builder.getSelectedPersistedValueChunkCategory()) : 0);
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
    // DS-6: a conditional insert whose arm did not run keeps its node, so its planned relink leaves the plan.
    if (entryAbiFunction === abiFunction && dropSkippedConditionalInserts(builder, abiFunction, finalArgs)) {
      bag.stateInputUnlocker = buildStateInputUnlocker();
      builder._setMasterUnlocker(bag.stateInputUnlocker);
      deriveResult = await host.deriveFullTransactionState(
        builder, requiredNftIndices, ecGroupsForDerive, ecCallsForDerive,
        entryAccessesForDerive, emitInfos.length > 0 ? emitInfos : undefined,
        eventBlockLayoutForDerive, derivTransferCount, derivTokenOps, delegatecallInputIndex,
        osGroupsForDerive, timingEnabled,
        onChainState.state, true,
      );
    }
    const dynamicLayoutChanged = builder.getDynamicLayoutRevision() !== layoutRevisionBeforeDerive;
    if (dynamicLayoutChanged
    || (builder as unknown as { __returnWitnessesReconciled?: boolean }).__returnWitnessesReconciled) {
      (builder as unknown as { __returnWitnessesReconciled?: boolean }).__returnWitnessesReconciled = false;
      // Reconciled witnesses only need a restart while the first probe is incomplete. Structural growth always
      // needs one: caller indices and output witnesses from the narrower geometry are no longer authoritative.
      if (dynamicLayoutChanged || deriveResult.vmErrored || persistBeforeDerive === 0) {
        if (dynamicLayoutChanged) {
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
    const reTransferCount = derivTransferCount;
    const reTokenOps = derivTokenOps;
    // Re-derive callback. By default it does NOT pass transfer params: when re-deriving after the user
    // provides manual transfers, we work with whatever transfers are already in the builder. A caller
    // whose call has no manual transfers asks for them to be derived again, because the first pass may
    // have stopped before reaching them (for example a `tx.time` check before `.setLocktime()` applied).
    (builder as any).__reDerive = async (
      stb: StatefulTransactionBuilder,
      options: { deriveTransfers?: boolean; deriveTokenTransfers?: boolean } = {},
    ) => (
      host.deriveFullTransactionState(stb, rni, ecGroups, ecCalls, ea, ei,
        eventBlockLayoutForDerive,
        options.deriveTransfers ? reTransferCount : undefined,
        options.deriveTokenTransfers ? reTokenOps : undefined,
        dci, osGroups, false, onChainState.state)
    );
  }
}
