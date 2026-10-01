/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — rebase proxy
 * identity witnesses for local delegate probes.
 */

import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

export type DeriveFullProbeRebaseResult = {
  probeDelegate: ExternalCallUtxoGroup | undefined;
  rebasedProbeWitnesses: Record<string, FunctionArgument>;
  restoreProbeWitnesses: Record<string, FunctionArgument>;
};

/**
 * For atomic participant probes, temporarily rebase `__internal__proxyMasterIndex` /
 * `__internal__proxyMasterOutputIndex` onto the local coordinate system.
 */
export function rebaseDeriveFullProbeDelegateWitnesses(
  stb: StatefulTransactionBuilder,
  delegatecallInputIndex: number | undefined,
  debugTargetDerivation: boolean,
): DeriveFullProbeRebaseResult {
  const probeDelegate = delegatecallInputIndex === undefined ? undefined
    : stb.getLowLevelCallUtxoGroups().find((group, index) => (
      group.callMode === 'delegatecall'
        && stb.getLowLevelCallMasterInputIndex(index) === delegatecallInputIndex
        && group.compilerRoute?.internalArgs?.__internal__graphFixedSize !== undefined
    ));
  const probeRoute = probeDelegate?.compilerRoute?.abiFunction;
  const probeRouteBlockSize = probeRoute?.blockLayout?.blockSize;
  const localProxyMasterIndex = delegatecallInputIndex !== undefined && probeRouteBlockSize !== undefined
    ? delegatecallInputIndex - probeRouteBlockSize : -1;
  const rebasedProbeWitnesses: Record<string, FunctionArgument> = {};
  const restoreProbeWitnesses: Record<string, FunctionArgument> = {};
  if (probeDelegate?.refreshInternalArgs && probeRoute && localProxyMasterIndex >= 0) {
    const rebaseStartedAt = debugTargetDerivation ? Date.now() : 0;
    if (debugTargetDerivation) console.error('derive-probe-rebase-start', {
      delegatecallInputIndex, probeRouteBlockSize, localProxyMasterIndex,
    });
    // The owner sentinel diagnostic must survive this probe rebase, otherwise the value under investigation
    // is overwritten before the composition that fails. See compose.ts' SOLIDC_DEBUG_OWNER_SENTINEL.
    const ownerSentinel = (globalThis as { process?: { env?: Record<string, string> } }).process
      ?.env?.SOLIDC_DEBUG_OWNER_SENTINEL === '1';
    for (const name of ownerSentinel ? [] : ['__internal__proxyMasterIndex', '__internal__proxyMasterOutputIndex']) {
      const argumentIndex = probeRoute.inputs.findIndex((input) => input.name === name);
      if (argumentIndex < 0) continue;
      const original = probeDelegate.internalArgs?.[name]
        ?? probeDelegate.compilerRoute?.internalArgs?.[name]
        ?? probeDelegate.compilerRoute?.args[argumentIndex];
      if (original === undefined) continue;
      restoreProbeWitnesses[name] = original;
      rebasedProbeWitnesses[name] = BigInt(localProxyMasterIndex);
    }
    if (Object.keys(rebasedProbeWitnesses).length > 0) {
      probeDelegate.refreshInternalArgs(rebasedProbeWitnesses, { shiftPredOut: false });
      if (debugTargetDerivation) console.error('derive-probe-rebase-unlocker-refreshed', {
        ms: Date.now() - rebaseStartedAt,
      });
      stb._refreshInputs();
      if (debugTargetDerivation) console.error('derive-probe-rebase-inputs-refreshed', {
        ms: Date.now() - rebaseStartedAt,
      });
    }
  }

  return { probeDelegate, rebasedProbeWitnesses, restoreProbeWitnesses };
}
