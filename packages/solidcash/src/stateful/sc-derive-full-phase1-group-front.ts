/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 1 per-group build through probe evaluate.
 */

import { binToHex, hexToBin, type AuthenticationProgramStateCommon } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import { valueChunkOutputWitnessCarrier } from './route-value-chunk-helpers.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { ownsCapturedValueChunkOutputBase } from './value-chunk-base-writer-select.js';
import { selectValueChunkOutputBase } from './value-chunk-geometry.js';
import { writesChunkableValue } from './writer-group-selection.js';

export interface DeriveFullPhase1GroupFrontHost {
  readonly categoryId: string;
  readonly inner: { provider: NetworkProvider };
  rebindExternalResourceMaster(group: ExternalCallUtxoGroup, entryMasterIdx: number): boolean;
}

export type DeriveFullPhase1GroupFrontResult = {
  probeBuilder: TransactionBuilder;
  transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>;
  sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>;
  fullTrace: AuthenticationProgramStateCommon[];
  bMasterIdx: number;
  entryMasterIdx: number;
  builtMasterIdx: number;
  builtStateMasterIdx: number;
  valueChunkWitness: ReturnType<typeof valueChunkOutputWitnessCarrier>;
};

/**
 * Build the Phase-1 probe for one external group, place any private value-chunk continuation
 * band, rebind entry masters, and evaluate the faithful probe trace.
 * Caller skips sharedGroupIndex groups before invoking.
 */
export function deriveFullPhase1GroupFront(
  host: DeriveFullPhase1GroupFrontHost,
  stb: StatefulTransactionBuilder,
  externalCallUtxoGroups: ExternalCallUtxoGroup[],
  groupIdx: number,
  debugTargetDerivation: boolean,
): DeriveFullPhase1GroupFrontResult {
  const group = externalCallUtxoGroups[groupIdx];
  if (debugTargetDerivation) console.error('derive-phase1-group-start', {
    groupIdx, functionName: group.functionName, groups: externalCallUtxoGroups.length,
  });
  const debugGroupStartedAt = debugTargetDerivation ? Date.now() : 0;

  // Build the current participant layout once, then give this computed-value writer a private append-only
  // continuation region. The compiler witness makes that absolute coordinate authoritative, so later
  // participant masters and return tails cannot collide with the recovered chunks.
  const valueChunkWitness = valueChunkOutputWitnessCarrier(stb, group);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
    console.error('route-probe-build-start', { groupIdx, functionName: group.functionName });
  }
  let probeBuilder = stb.build();
  if (valueChunkWitness && group.valueChunkOutputBase === undefined) {
    const plannedBand = stb.getPublishJobEventsBand();
    const usesPlannedBand = plannedBand !== undefined
      && writesChunkableValue(valueChunkWitness.carrier, valueChunkWitness.abiFunction);
    // Reuse an already-planned continuation band for the same chunkable writer. Only an unowned run is
    // append-only relative to the participant frame; it must then precede a reverse-indexed suffix and
    // its terminal anchor. Duplicating a planned run at the append coordinate makes later cardinality
    // cleanup erase the very outputs named by the absolute witness.
    const outputBase = selectValueChunkOutputBase({
      plannedBandStart: plannedBand?.start,
      usesPlannedBand,
      fallbackBase: stb.getContinuationOutputBase(probeBuilder),
    });
    group.valueChunkOutputBase = outputBase;
    valueChunkWitness.carrier.valueChunkOutputBase = outputBase;
    valueChunkWitness.carrier.internalArgs = {
      ...valueChunkWitness.carrier.internalArgs,
      __internal__valueChunkOutputBase: BigInt(outputBase),
    };
    valueChunkWitness.carrier.refreshInternalArgs?.({
      __internal__valueChunkOutputBase: BigInt(outputBase),
    });
    const nestedImpl = valueChunkWitness.carrier.delegateCallGroupIndex;
    if (nestedImpl !== undefined) {
      const nestedOwner = stb.getLowLevelCallUtxoGroups()[nestedImpl];
      if (nestedOwner && ownsCapturedValueChunkOutputBase(nestedOwner)) {
        nestedOwner.refreshInternalArgs?.({
          __internal__valueChunkOutputBase: BigInt(outputBase),
        });
      }
    }
    stb._refreshInputs();
    probeBuilder = stb.build();
  }
  if (debugTargetDerivation) console.error('derive-phase1-group-built', {
    groupIdx, functionName: group.functionName,
    inputs: probeBuilder.inputs.length, outputs: probeBuilder.outputs.length,
    ms: Date.now() - debugGroupStartedAt,
  });
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
    console.error('route-probe-build-finish', { groupIdx, inputs: probeBuilder.inputs.length });
    console.error('route-probe-output-window', probeBuilder.outputs.slice(38, 50).map((output, offset) => ({
      index: 38 + offset,
      bytecode: typeof output.to === 'string' ? output.to : binToHex(output.to),
      category: output.token?.category,
      commitment: output.token?.nft?.commitment,
    })));
  }
  const transaction = probeBuilder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(probeBuilder.inputs);
  const debugTransactionBuiltAt = debugTargetDerivation ? Date.now() : 0;
  if (debugTargetDerivation) console.error('derive-phase1-transaction-built', {
    groupIdx, functionName: group.functionName,
    ms: debugTransactionBuiltAt - debugGroupStartedAt,
    unlockingBytes: transaction.inputs.reduce((sum, input) => sum + input.unlockingBytecode.length, 0),
  });

  // Get B's master input index
  // A proxied nested callee's state transition and return blob are authenticated by its co-spent
  // implementation, not by the forwarding proxy master. Probe that implementation input; probing the
  // proxy can complete successfully without ever exposing the route's return commitment.
  const expectedMaster = group.delegateCallGroupIndex === undefined
    ? group.masterUtxo
    : stb.getLowLevelCallUtxoGroups()[group.delegateCallGroupIndex]?.masterUtxo ?? group.masterUtxo;
  // Composed delegate bands can be interleaved when TransactionBuilder materializes the final input
  // list. The STB's pre-build `allInputs` ordering is therefore not authoritative for a derivation VM
  // run. Resolve the exact outpoint in the probe we are about to execute; retain the layout getter only
  // as a defensive fallback for synthetic groups without a materialized master outpoint.
  const builtMasterIdx = probeBuilder.inputs.findIndex((input) => input.txid === expectedMaster.txid
    && input.vout === expectedMaster.vout);
  const builtStateMasterIdx = probeBuilder.inputs.findIndex((input) => input.txid === group.masterUtxo.txid
    && input.vout === group.masterUtxo.vout);
  const bMasterIdx = group.compilerRoute && group.delegateCallGroupIndex !== undefined
    // Routed proxy state follows its implementation in the input band. The group's provisional master
    // outpoint can still alias the implementation during probe convergence, so derive this coordinate
    // from the already-final low-level implementation position.
    ? stb.getLowLevelCallMasterInputIndex(group.delegateCallGroupIndex) + 1
    : builtMasterIdx >= 0 ? builtMasterIdx
      : group.delegateCallGroupIndex === undefined
        ? stb.getExternalCallMasterInputIndex(groupIdx)
        : stb.getLowLevelCallMasterInputIndex(group.delegateCallGroupIndex);
  if (debugTargetDerivation) console.error('derive-phase1-master-index', {
    groupIdx, functionName: group.functionName, bMasterIdx, builtMasterIdx, builtStateMasterIdx,
    computedExternalMaster: stb.getExternalCallMasterInputIndex(groupIdx),
    computedOutputBase: stb.getExternalCallOutputBase(groupIdx),
  });
  // A delegate implementation authenticates the transition, but its
  // grafted entries retain the proxy's category. Their entry covenant
  // must therefore authorize against the proxy minting master, not the
  // implementation master selected above for the VM probe.
  const entryMasterIdx = group.delegateCallGroupIndex !== undefined && builtStateMasterIdx >= 0
    ? builtStateMasterIdx : bMasterIdx;

  // Patch B's vmap entry co-spend unlockers with B's REAL master input index (docs/deferrals.md #1). The entry
  // covenant's write path (flag=1) verifies a minting NFT at masterInputIndex = B's master, but block-build
  // time used a block-relative placeholder (B's master index isn't known until the tx layout is). A funder
  // placeholder (absent key, no token) has no covenant to fix. The probe above runs B's master covenant only,
  // so the placeholder does not affect the entry-commitment extraction below; the final build uses this patch.
  host.rebindExternalResourceMaster(group, entryMasterIdx);

  // Run VM on B's master input
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
    const tail = sourceOutputs.at(-1);
    console.error('route-derive-start', {
      groupIdx, functionName: group.functionName, bMasterIdx,
      groupMasterOutpoint: `${group.masterUtxo.txid}:${group.masterUtxo.vout}`,
      nearbyInputs: probeBuilder.inputs.slice(Math.max(0, bMasterIdx - 4), bMasterIdx + 5)
        .map((input, offset) => ({
          index: Math.max(0, bMasterIdx - 4) + offset,
          outpoint: `${input.txid}:${input.vout}`,
          category: input.token?.category,
          bytecode: binToHex(input.unlocker.generateLockingBytecode()).slice(0, 48),
        })),
      inputCount: sourceOutputs.length,
      tailCategory: tail?.token?.category ? binToHex(tail.token.category) : undefined,
      tailCommitment: tail?.token?.nft?.commitment
        ? binToHex(tail.token.nft.commitment).slice(0, 32) : undefined,
      tailBytecode: tail?.lockingBytecode ? binToHex(tail.lockingBytecode) : undefined,
      senderCategoryArg: binToHex(hexToBin(host.categoryId).reverse()),
    });
  }
  let fullTrace = evaluateProbeTrace(host.inner.provider, {
    inputIndex: bMasterIdx,
    sourceOutputs,
    transaction,
  });
  if (debugTargetDerivation) console.error('derive-phase1-group-evaluated', {
    groupIdx, functionName: group.functionName, states: fullTrace.length,
    error: fullTrace.find((state) => state.error)?.error,
    buildAndSerializeMs: debugTransactionBuiltAt - debugGroupStartedAt,
    evaluateMs: Date.now() - debugTransactionBuiltAt,
  });

  return {
    probeBuilder, transaction, sourceOutputs, fullTrace,
    bMasterIdx, entryMasterIdx, builtMasterIdx, builtStateMasterIdx,
    valueChunkWitness,
  };
}
