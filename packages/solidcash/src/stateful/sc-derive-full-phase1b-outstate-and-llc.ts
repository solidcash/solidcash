/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 1b outState + Phase 1c low-level call state.
 */

import type NetworkProvider from '../network/NetworkProvider.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { extractCommitmentsFromTrace } from './trace-commitment-helpers.js';
import { commitmentsToState } from './trace-verified-value-helpers.js';

export interface DeriveFullPhase1bOutStateAndLlcHost {
  readonly inner: { provider: NetworkProvider };
}

/**
 * After Phase-1 external groups: derive outState participant state, then low-level
 * (non-staticcall/non-delegatecall) callee state from probe traces.
 */
export function deriveFullPhase1bOutStateAndLowLevel(
  host: DeriveFullPhase1bOutStateAndLlcHost,
  stb: StatefulTransactionBuilder,
  externalOutStateUtxoGroups: ExternalCallUtxoGroup[] | undefined,
  debugTargetDerivation: boolean,
): void {
  // Phase 1b: Derive each outState group's state (same pattern as external call groups)
  if (externalOutStateUtxoGroups && externalOutStateUtxoGroups.length > 0) {
    for (let groupIdx = 0; groupIdx < externalOutStateUtxoGroups.length; groupIdx++) {
      const group = externalOutStateUtxoGroups[groupIdx];

      const probeBuilder = stb.build();
      const transaction = probeBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(probeBuilder.inputs);

      const bMasterIdx = stb.getExternalOutStateMasterInputIndex(groupIdx);
      const fullTrace = evaluateProbeTrace(host.inner.provider, {
        inputIndex: bMasterIdx,
        sourceOutputs,
        transaction,
      });

      const bRequiredNftCount = group.requiredDataNftIndices.length;
      const bOutputBase = stb.getExternalOutStateOutputBase(groupIdx);
      const bDataOutputRange = { min: bOutputBase + 1, max: bOutputBase + 1 + bRequiredNftCount };
      const commitments = extractCommitmentsFromTrace(fullTrace, bRequiredNftCount, bDataOutputRange);
      if (commitments) {
        const bState = commitmentsToState(commitments, group.stateLayout, group.requiredDataNftIndices);
        for (const [name, value] of Object.entries(bState)) {
          stb.setExternalCallState(group.categoryId, name, value);
        }
      }
    }
  }

  // Phase 1c: Derive low-level call target state
  // Same pattern as external call groups: run the VM on the target's master,
  // extract expected commitments from the trace, and apply as state updates.
  const llcGroups = stb.getLowLevelCallUtxoGroups();
  if (debugTargetDerivation) console.error('derive-low-level-groups-start', { count: llcGroups.length });
  if (llcGroups.length > 0) {
    for (let groupIdx = 0; groupIdx < llcGroups.length; groupIdx++) {
      const group = llcGroups[groupIdx];
      if (group.callMode === 'staticcall' || group.callMode === 'delegatecall') continue;

      const debugLowLevelStartedAt = debugTargetDerivation ? Date.now() : 0;
      if (debugTargetDerivation) console.error('derive-phase1-low-level-start', {
        groupIdx,
        functionName: group.functionName,
        callMode: group.callMode,
        categoryId: group.categoryId,
        requiredDataNftIndices: group.requiredDataNftIndices,
      });

      const probeBuilder = stb.build();
      const transaction = probeBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(probeBuilder.inputs);

      const bMasterIdx = stb.getLowLevelCallMasterInputIndex(groupIdx);
      const fullTrace = evaluateProbeTrace(host.inner.provider, {
        inputIndex: bMasterIdx,
        sourceOutputs,
        transaction,
      });
      if (debugTargetDerivation) console.error('derive-phase1-low-level-evaluated', {
        groupIdx,
        functionName: group.functionName,
        ms: Date.now() - debugLowLevelStartedAt,
        states: fullTrace.length,
        error: fullTrace.at(-1)?.error,
      });

      const bRequiredNftCount = group.requiredDataNftIndices.length;
      // Compute output base: find the target's master output index by scanning
      // the built outputs for matching category + minting capability
      let bOutputBase = -1;
      for (let oi = 0; oi < probeBuilder.outputs.length; oi++) {
        const out = probeBuilder.outputs[oi];
        if (out.token?.category === group.categoryId
        && out.token?.nft?.capability === 'minting') {
          bOutputBase = oi;
          break;
        }
      }
      if (bOutputBase < 0) continue;

      const bDataOutputRange = { min: bOutputBase + 1, max: bOutputBase + 1 + bRequiredNftCount };
      const commitments = extractCommitmentsFromTrace(fullTrace, bRequiredNftCount, bDataOutputRange);
      if (commitments) {
        const bState = commitmentsToState(commitments, group.stateLayout, group.requiredDataNftIndices);
        for (const [name, value] of Object.entries(bState)) {
          stb.setExternalCallState(group.categoryId, name, value);
        }
      }
    }
  }
  if (debugTargetDerivation) console.error('derive-low-level-groups-complete');

}
