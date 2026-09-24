/**
 * phase-boundary extract: SC _createBuilder extract — effective block layout + logical identity.
 */

import type { AbiFunction, FunctionBlockLayout } from '@solidcash/utils';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  resolveLogicalIdentity,
  type ResolvedLogicalIdentity,
} from './logical-identity.js';
import { selectDelegateExecutionLayout } from './writer-event-delegate-layout.js';

export type ResolveCreateBuilderEffectiveLayoutHost = {
  readonly inner: {
    provider: any;
  };
  getLogicalAddress: () => string | undefined;
  setLogicalAddress: (address: string) => void;
};

export type ResolveCreateBuilderEffectiveLayoutResult = {
  compilerRouteDelegateLayout: FunctionBlockLayout | undefined;
  effectiveBlockLayout: FunctionBlockLayout | undefined;
  logicalIdentity: ResolvedLogicalIdentity | undefined;
  usesComposedDelegateDynamicTail: boolean;
};

/**
 * After dynamic chunks: select the compiler-route delegate layout (or legacy
 * execution layout), fold projected delegate event slots into the effective
 * block layout (X56 return-event relocate), and resolve logical identity for
 * nested msg.sender observers.
 */
export async function resolveCreateBuilderEffectiveLayout(
  host: ResolveCreateBuilderEffectiveLayoutHost,
  params: {
    delegateRouteGroup: ExternalCallUtxoGroup | undefined;
    physicalAbiFunction: AbiFunction | undefined;
    abiFunction: AbiFunction | undefined;
    lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
    nestedDelegateProxyGroupByLowLevel: ReadonlyMap<number, number>;
    activeDelegateGroupIndex: number | undefined;
    externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
    dynamicChunkVars: Array<{ delegate?: boolean; delegateSuffix?: boolean }>;
    delegateReturnEventOffset: number | undefined;
    delegateEventSlots: Array<{ kind: string; offset: number; slotIndex?: number }>;
    overrides: { logicalIdentity?: ResolvedLogicalIdentity } | undefined;
    functionName: string;
    timingEnabled: boolean;
    timing?: (label: string) => void;
  },
): Promise<ResolveCreateBuilderEffectiveLayoutResult> {
  const {
    delegateRouteGroup, physicalAbiFunction, abiFunction, lowLevelCallUtxoGroups,
    nestedDelegateProxyGroupByLowLevel, activeDelegateGroupIndex, externalCallUtxoGroups,
    dynamicChunkVars, delegateReturnEventOffset, delegateEventSlots, overrides,
    functionName, timingEnabled, timing,
  } = params;

  const compilerRouteDelegateLayout = delegateRouteGroup?.compilerRoute?.abiFunction.blockLayout
    ?? (physicalAbiFunction?.delegateForwarding || (physicalAbiFunction?.lowLevelCalls
      ?.some((call) => call.callMode === 'delegatecall') === true
      && physicalAbiFunction.blockLayout?.slots.some((slot: any) => slot.kind === 'lowLevelCall') === true)
      ? undefined
      : selectDelegateExecutionLayout(lowLevelCallUtxoGroups, nestedDelegateProxyGroupByLowLevel));
  const dynamicDelegateGroup = activeDelegateGroupIndex === undefined
    ? lowLevelCallUtxoGroups.find((group) => {
      if (group.callMode !== 'delegatecall') return false;
      const fn = group.compilerRoute?.abiFunction
        ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
          .find((candidate) => candidate.name === group.functionName);
      return (fn?.dynamicWrites?.length ?? 0) > 0;
    })
    : lowLevelCallUtxoGroups[activeDelegateGroupIndex];
  const dynamicDelegateFunction = dynamicDelegateGroup?.compilerRoute?.abiFunction
    ?? (dynamicDelegateGroup?.externalContract.inner.artifact.abi as readonly AbiFunction[] | undefined)
      ?.find((candidate) => candidate.name === dynamicDelegateGroup?.functionName);
  const delegateDynamicLayout = dynamicDelegateFunction?.blockLayout;
  const usesComposedDelegateDynamicTail = delegateDynamicLayout !== undefined
    && externalCallUtxoGroups.some((group) => group.sharedGroupIndex === undefined);
  if (usesComposedDelegateDynamicTail) {
    for (const variable of dynamicChunkVars) {
      if (variable.delegate === true) variable.delegateSuffix = true;
    }
  }
  // The proxy is the physical route owner. Its implementation's compiler-owned route layout therefore replaces
  // the forwarder's tiny master/data/call layout, exactly like a nested proxy's preassembled `blockInputs`.
  let effectiveBlockLayout = compilerRouteDelegateLayout ?? abiFunction?.blockLayout;
  // X56. Relocate - never duplicate - the forwarder's returnEvent slot when the impl resolves its own return
  // event at a DIFFERENT index in this block. Unconditional on the send mode: two slots at one offset would
  // have the funder loop position the same index twice, and a plain send has to keep the event where it is.
  // A returning implementation with no event resolves to the offset the forwarder already published, so this
  // is a no-op there and the layout object is left exactly as it was.
  const returnSlotMoved = delegateReturnEventOffset !== undefined
    && effectiveBlockLayout?.slots.some((s: any) => s.kind === 'returnEvent' && s.offset !== delegateReturnEventOffset);
  if (effectiveBlockLayout && returnSlotMoved) {
    effectiveBlockLayout = {
      ...effectiveBlockLayout,
      slots: effectiveBlockLayout.slots.map((s: any) => (s.kind === 'returnEvent'
        ? { ...s, offset: delegateReturnEventOffset! } : s)),
    };
  }
  if (effectiveBlockLayout && (delegateEventSlots.length > 0 || returnSlotMoved)) {
    const maxOff = Math.max(
      effectiveBlockLayout.blockSize - 1,
      ...delegateEventSlots.map((s: any) => s.offset),
      ...(returnSlotMoved ? [delegateReturnEventOffset!] : []),
    );
    effectiveBlockLayout = {
      blockSize: maxOff + 1,
      slots: [...effectiveBlockLayout.slots, ...delegateEventSlots as any],
    };
  }

  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
    console.error('stateful-builder-create', {
      functionName, externalGroups: externalCallUtxoGroups.length,
      lowLevelGroups: lowLevelCallUtxoGroups.length,
    });
  }
  if (timingEnabled) console.error('logical-identity-input', {
    override: overrides?.logicalIdentity !== undefined,
    logicalAddress: host.getLogicalAddress(),
    externalGroups: externalCallUtxoGroups.length,
  });
  // address(this) is always the active input's exact bytecode. A nested call which observes msg.sender also
  // needs this contract's stable public identity anchor when this is a CREATE/proxy facade; native contracts
  // have no logical address and the callee falls back to the authenticated minting-master input bytecode.
  const nestedUsesMsgSender = [...externalCallUtxoGroups, ...lowLevelCallUtxoGroups].some((group) => {
    const called = group.compilerRoute?.abiFunction
      ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
        .find((candidate) => candidate.name === group.functionName);
    return called?.usesMsgSender === true;
  });
  const logicalIdentity = overrides?.logicalIdentity
    ?? (nestedUsesMsgSender && host.getLogicalAddress()
      ? await resolveLogicalIdentity(host.inner.provider, host.getLogicalAddress()!)
      : undefined);
  if (logicalIdentity && !host.getLogicalAddress()) {
    host.setLogicalAddress(logicalIdentity.logicalAddress);
  }
  timing?.('logical-identity-complete');

  return {
    compilerRouteDelegateLayout,
    effectiveBlockLayout,
    logicalIdentity,
    usesComposedDelegateDynamicTail,
  };
}
