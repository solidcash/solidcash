/**
 * phase-boundary extract: SC _createBuilder extract — nested-compose callee target + argument resolution.
 */

import { binToHex } from '@bitauth/libauth';
import type {
  AbiFunction,
  ArgSource,
  Artifact,
  ExternalCallAbi,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { projectMessageBusHandlerArguments } from '../message-bus/message-bus.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { tryCashAddressToLockScript } from '../utils.js';
import {
  findDeploymentByAddressValue,
  findDeploymentByName,
  registeredAddressValueLockingBytecode,
} from './deployment-registry.js';
import {
  adaptLegacyNestedJobEventArguments,
  usesLegacyJobEventCompatibility,
} from './legacy-job-event-wire.js';
import { legacyPersistedValueChunkWidth } from './early-value-chunk-helpers.js';
import { providerUnixLocktime } from './soft-state-overlays.js';
import { isPersistedJobEventsReady } from './value-chunk-persist.js';

export type ResolveCreateBuilderNestedComposeCalleeHost = {
  resolveExternalArgs: (...args: any[]) => FunctionArgument[] | undefined;
  resolveExternalExpressionReturns: (...args: any[]) => Promise<Map<string, FunctionArgument> | undefined>;
  nestedIdentity: (address: string) => Promise<unknown>;
  callerRegistryValues: () => Iterable<unknown>;
  callerRegistryGet: (interfaceName: string) => unknown;
  calleeRegistryValues: (callInfoContract: any) => Iterable<unknown>;
  calleeRegistryGet: (callInfoContract: any, interfaceName: string) => unknown;
  readonly provider: NetworkProvider;
};

export type ResolveCreateBuilderNestedComposeCalleeResult =
  | { skip: true }
  | {
    skip: false;
    nestedSources: readonly ArgSource[] | undefined;
    addressValue: FunctionArgument | undefined;
    resolvedTargetLockingBytecode: Uint8Array | undefined;
    /** Concrete proxy pair when the registry entry is a ConnectedStatefulContract. */
    proxyCallee: any | undefined;
    /** Resolved StatefulContract target for the nested callsite. */
    callee: any;
    resolvedRawFunctionName: string | undefined;
    nestedFunctionName: string;
    nestedArgs: FunctionArgument[];
    graphNestedArgs: FunctionArgument[];
    needsExpressionReturns: boolean;
    nestedExpressionReturns: Map<string, FunctionArgument> | undefined;
    graphExpressionReturns: Map<string, FunctionArgument> | undefined;
  };

function usesEmptyArrayElement(
  value: unknown,
  delegateVisibleArgs: readonly FunctionArgument[],
  seen = new Set<object>(),
): boolean {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return false;
  seen.add(value as object);
  const source = value as Partial<ArgSource>;
  if (source.kind === 'arrayElement' && source.paramIndex !== undefined
    && Array.isArray(delegateVisibleArgs[source.paramIndex])
    && (delegateVisibleArgs[source.paramIndex] as unknown[]).length === 0) {
    return true;
  }
  return Object.values(value).some((child) => (
    Array.isArray(child)
      ? child.some((item) => usesEmptyArrayElement(item, delegateVisibleArgs, seen))
      : usesEmptyArrayElement(child, delegateVisibleArgs, seen)
  ));
}

function containsReturningExpression(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return false;
  seen.add(value as object);
  if (['externalCall', 'producerResult'].includes((value as { kind?: string }).kind ?? '')) return true;
  return Object.values(value).some((child) => (
    Array.isArray(child)
      ? child.some((item) => containsReturningExpression(item, seen))
      : containsReturningExpression(child, seen)
  ));
}

/**
 * Resolve one nested-compose callsite's inactive-array skip, target contract,
 * and argument vectors (including legacy JobEvent wire adapt).
 */
export async function resolveCreateBuilderNestedComposeCallee(
  host: ResolveCreateBuilderNestedComposeCalleeHost,
  params: {
    nested: ExternalCallAbi;
    delegateVisibleArgs: readonly FunctionArgument[];
    delegateVisibleInputs: readonly { name: string }[];
    delegateFn: AbiFunction | undefined;
    callInfoContract: {
      _externalRegistry: Map<string, unknown>;
      inner: { artifact: Artifact };
    };
    onChainState: { state: Record<string, unknown> };
    delegateSelfAddress: FunctionArgument;
    publishedNestedExternalCalls: readonly ExternalCallAbi[];
    preparedAtomicNodes: unknown[] | undefined;
    graphPlanningResults: unknown;
  },
): Promise<ResolveCreateBuilderNestedComposeCalleeResult> {
  const {
    nested,
    delegateVisibleArgs,
    delegateVisibleInputs,
    delegateFn,
    callInfoContract,
    onChainState,
    delegateSelfAddress,
    publishedNestedExternalCalls,
    preparedAtomicNodes,
    graphPlanningResults,
  } = params;

  const nestedSources = nested.rawArgSources ?? nested.argSources;
  const inactiveArrayIteration = nestedSources?.some((source) =>
    usesEmptyArrayElement(source, delegateVisibleArgs));
  if (inactiveArrayIteration) return { skip: true };

  const resolvedAddress = nested.addressSource
    ? host.resolveExternalArgs(
      [nested.addressSource], delegateVisibleArgs, callInfoContract.inner.artifact,
      onChainState.state, delegateVisibleInputs, undefined, 0, false, delegateSelfAddress,
    )?.[0]
    // Backward compatibility for artifacts which predate addressSource: addressStateVar names the
    // authenticated caller-state field, not a deployment-registry hint. Prefer it over interface-name
    // lookup so two different interfaces cannot accidentally collapse onto the same fallback callee.
    : nested.addressStateVar
      ? onChainState.state[nested.addressStateVar] as FunctionArgument | undefined
      : undefined;
  const addressParamIndex = nested.addressParam
    ? delegateFn!.inputs.findIndex((input) => input.name === nested.addressParam)
    : -1;
  const addressValue = resolvedAddress
    ?? (addressParamIndex >= 0 ? delegateVisibleArgs[addressParamIndex] : undefined);
  const typedAddress = typeof addressValue === 'string' || addressValue instanceof Uint8Array
    ? addressValue : undefined;
  const resolvedTargetLockingBytecode = typedAddress === undefined ? undefined
    : registeredAddressValueLockingBytecode(host.provider, typedAddress)
      ?? tryCashAddressToLockScript(typedAddress);
  const deploymentAtAddress = typedAddress === undefined ? undefined
    : findDeploymentByAddressValue(host.provider, typedAddress)?.contract;
  // Hardhat-style factories connect externals on the public proxy
  // instance. A manually assembled delegate may instead connect them
  // directly on the implementation. When the source supplies an address, that authenticated value
  // identifies the instance; an interface-name registration is only a fallback. Otherwise a stale
  // same-interface binding can silently redirect a state-pinned call to a different deployment.
  const rawCandidates = nested.interfaceName === '__raw__'
    ? [...new Set([
      ...host.calleeRegistryValues(callInfoContract),
      ...host.callerRegistryValues(),
    ])].filter((candidate) => {
      const contract = ('proxy' in (candidate as object)
        ? (candidate as { implementation: any }).implementation
        : candidate) as { inner: { artifact: Artifact } };
      return (contract.inner.artifact.abi as readonly AbiFunction[])
        .some((fn) => (nested.rawFunctionName !== undefined && fn.name === nested.rawFunctionName)
          || (nested.rawSelector !== undefined && fn.selector === nested.rawSelector));
    }) : [];
  if (rawCandidates.length > 1 && deploymentAtAddress === undefined) {
    throw new Error(
      `Delegate raw call '${nested.rawFunctionName}' matches more than one connected contract; `
      + 'pin its target address in the caller state or arguments.',
    );
  }
  const registeredCallee = (
    deploymentAtAddress
    ?? rawCandidates[0]
    ?? host.calleeRegistryGet(callInfoContract, nested.interfaceName)
    ?? host.callerRegistryGet(nested.interfaceName)
    ?? findDeploymentByName(host.provider, nested.interfaceName)?.contract
  ) as any | undefined;
  const proxyCallee = registeredCallee && 'proxy' in registeredCallee
    ? registeredCallee : undefined;
  const callee = (proxyCallee?.proxy ?? registeredCallee) as any | undefined;
  if (!callee) {
    const addressDiagnostic = addressValue instanceof Uint8Array
      ? binToHex(addressValue) : String(addressValue);
    throw new Error(
      `Delegate external call to ${nested.interfaceName}.${nested.functionName} is not connected. `
      + `Connect '${nested.interfaceName}' on the implementation before calling through the proxy. `
      + `Resolved target: ${addressDiagnostic}`,
    );
  }
  const resolvedRawFunctionName = nested.interfaceName === '__raw__'
    ? nested.rawFunctionName
      ?? (callee.inner.artifact.abi as readonly AbiFunction[])
        .find((fn) => fn.selector === nested.rawSelector)?.name
    : undefined;
  if (nested.interfaceName === '__raw__' && !resolvedRawFunctionName) {
    throw new Error(
      `Delegate raw call selector '${nested.rawSelector ?? '<unknown>'}' is not advertised by `
      + `the resolved ${callee.inner.artifact.contractName} deployment.`,
    );
  }
  if (callee._logicalAddress ?? callee.target) {
    void host.nestedIdentity(callee._logicalAddress ?? callee.target!);
  }

  const needsExpressionReturns = nestedSources?.some((source) => containsReturningExpression(source)) === true;
  const nestedExpressionReturns = needsExpressionReturns
    ? await host.resolveExternalExpressionReturns(
      nestedSources, delegateVisibleArgs, callInfoContract, onChainState.state,
      delegateVisibleInputs,
      delegateSelfAddress,
      publishedNestedExternalCalls,
      preparedAtomicNodes !== undefined,
      graphPlanningResults,
    )
    : undefined;
  let nestedArgs = nestedExpressionReturns
    ? host.resolveExternalArgs(
      nestedSources,
      delegateVisibleArgs,
      callInfoContract.inner.artifact,
      onChainState.state,
      delegateVisibleInputs,
      nestedExpressionReturns,
      0,
      false,
      delegateSelfAddress,
    )
    : host.resolveExternalArgs(
      nestedSources, delegateVisibleArgs, callInfoContract.inner.artifact, onChainState.state,
      delegateVisibleInputs, undefined, 0, false, delegateSelfAddress,
    );
  if (nestedArgs === undefined) {
    throw new Error(
      `Delegate external call to ${nested.interfaceName}.${nested.functionName} `
      + `(offset ${nested.computedOffset ?? 0}) has arguments `
      + 'that cannot yet be resolved by the SDK.',
    );
  }
  // Historical legacy-unroll artifacts encoded their JobEvent payload after implicitly filling the
  // timestamp. Keep that wire adapter quarantined to its exact ABI schema. Kernel calls retain their
  // source arguments and derive mutations by executing the authenticated handler behind OP_INVOKE.
  const nestedFunctionName = resolvedRawFunctionName ?? nested.functionName;
  const hasLegacyJobEventInput = (callee.inner.artifact.abi as readonly AbiFunction[])
    .filter((candidate) => candidate.name === nestedFunctionName)
    .some((candidate) => candidate.inputs.some((input) => usesLegacyJobEventCompatibility(
      callee.inner.artifact, input.type, callee.inner.artifact.structs,
    )));
  if (hasLegacyJobEventInput) {
    const tip = Number(
      (host.provider as { getBlockTime?: () => number }).getBlockTime?.() ?? 0,
    );
    const appending = isPersistedJobEventsReady()
      && (legacyPersistedValueChunkWidth(callee.categoryId) > 0
        || legacyPersistedValueChunkWidth() > 0);
    const locktime = appending
      ? providerUnixLocktime(host.provider as { getBlockTime?: () => number })
      : undefined;
    const now = BigInt(
      locktime ?? (tip > 0 ? tip : Math.floor(Date.now() / 1000)),
    );
    nestedArgs = adaptLegacyNestedJobEventArguments(
      callee.inner.artifact, nestedFunctionName, nestedArgs, now,
    );
  }
  const graphExpressionReturns = preparedAtomicNodes && needsExpressionReturns
    ? await host.resolveExternalExpressionReturns(
      nestedSources,
      projectMessageBusHandlerArguments(
        callInfoContract.inner.artifact, delegateFn?.name ?? '', delegateFn?.selector,
        delegateVisibleArgs,
      ),
      callInfoContract, onChainState.state,
      delegateVisibleInputs, delegateSelfAddress,
      publishedNestedExternalCalls,
      true,
      graphPlanningResults,
    )
    : nestedExpressionReturns;
  const graphNestedArgs = preparedAtomicNodes
    ? host.resolveExternalArgs(
      nestedSources, projectMessageBusHandlerArguments(
        callInfoContract.inner.artifact, delegateFn?.name ?? '', delegateFn?.selector,
        delegateVisibleArgs,
      ), callInfoContract.inner.artifact, onChainState.state,
      delegateVisibleInputs, graphExpressionReturns, 0, false, delegateSelfAddress,
    ) ?? nestedArgs
    : nestedArgs;

  return {
    skip: false,
    nestedSources,
    addressValue,
    resolvedTargetLockingBytecode,
    proxyCallee,
    callee,
    resolvedRawFunctionName,
    nestedFunctionName,
    nestedArgs,
    graphNestedArgs,
    needsExpressionReturns,
    nestedExpressionReturns,
    graphExpressionReturns,
  };
}
