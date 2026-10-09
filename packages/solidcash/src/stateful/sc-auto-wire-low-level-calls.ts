/**
 * Auto-wire the callee of a Solidity-compat low-level `call` / `staticcall` from the compiler's published target and
 * payload: the target names the registered callee deployment, the payload's selector its function and its
 * arguments the call's. Mapping-backed expressions read the caller's entries (hydrateExternalPredicateState).
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, ArgSource, Artifact, ExternalCallExpression } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { findDeploymentByAddressValue } from './deployment-registry.js';
import { hydrateExternalPredicateState } from './sc-hydrate-external-predicate-state.js';

type LowLevelCallRow = NonNullable<AbiFunction['lowLevelCalls']>[number];

type CallerContract = {
  inner: { artifact: Artifact; lockingBytecode: string; provider: any };
  getFullState(): Promise<{ state: Record<string, unknown> }>;
  getEntries(collectionNameOrSignature: string): Promise<unknown>;
  _resolveExternalArgs(...args: any[]): FunctionArgument[] | undefined;
  _evaluateExternalExpression(...args: any[]): unknown;
};

type CalleeContract = { inner: { artifact: { abi: readonly AbiFunction[] } } };

export interface AutoWireLowLevelCallsHost {
  readonly functionName?: string;
  readonly functionArgs?: unknown[];
  readonly parentContract?: unknown;
  readonly callInfos: unknown[];
  selectedAbiFunction(): AbiFunction | undefined;
}

/** The selector literal and per-argument sources of a published `abiEncodeWithSelector` payload. */
function payloadParts(dataSource: ArgSource | undefined): { selector: string; args: ArgSource[] } | undefined {
  const expression = dataSource?.kind === 'expression' ? dataSource.expression : undefined;
  if (expression?.kind !== 'abiEncodeWithSelector' || !expression.args || expression.args.length === 0) return undefined;
  const [selector, ...args] = expression.args;
  if (selector.kind !== 'literal' || typeof selector.value !== 'string' || selector.value.length !== 8) return undefined;
  return {
    selector: selector.value.toLowerCase(),
    args: args.map((arg: ExternalCallExpression): ArgSource => (
      arg.kind === 'source' && arg.source ? arg.source : { kind: 'expression', expression: arg })),
  };
}

/**
 * Fill `callInfos[i]` for each published low-level call row after the ones the caller already supplied. `callInfos[i]`
 * answers `lowLevelCalls[i]`, so rows are filled strictly in order, stopping at the first row this cannot decide:
 * a delegatecall, a conditional or looped site (its reach is a runtime fact), an unpublished source, an unresolved
 * target, an unregistered callee, or a selector the callee does not dispatch. An explicit `.withCall()` always wins.
 */
export async function autoWireLowLevelCalls(host: AutoWireLowLevelCallsHost): Promise<void> {
  if (!host.functionName || !host.functionArgs) return;
  const abiFunction = host.selectedAbiFunction();
  const rows: readonly LowLevelCallRow[] = abiFunction?.lowLevelCalls ?? [];
  if (host.callInfos.length >= rows.length) return;
  const caller = host.parentContract as CallerContract | undefined;
  if (!caller?.inner || typeof caller._resolveExternalArgs !== 'function') return;
  const functionArgs = host.functionArgs as FunctionArgument[];
  const selfAddress = hexToBin(caller.inner.lockingBytecode);
  const resolve = (
    sources: ArgSource[], state: Record<string, unknown>,
  ): FunctionArgument[] | undefined => caller._resolveExternalArgs(
    sources, functionArgs, caller.inner.artifact, state, abiFunction!.inputs,
    undefined, 0, false, selfAddress,
  );
  const hydrationHost = {
    evaluateExternalExpression: (...args: unknown[]): unknown => caller._evaluateExternalExpression(...args),
    getEntries: (signature: string): Promise<unknown> => caller.getEntries(signature),
  };
  let onChainState: Record<string, unknown> | undefined;
  for (let index = host.callInfos.length; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.callMode === 'delegatecall' || row.occurrence !== 'once' || !row.targetSource) return;
    const payload = payloadParts(row.dataSource);
    if (!payload) return;
    onChainState ??= (await caller.getFullState()).state;
    const sources = [row.targetSource, ...payload.args];
    const callerState = await hydrateExternalPredicateState(
      hydrationHost,
      sources.map((source) => (source.kind === 'expression' ? source.expression : undefined)),
      functionArgs, caller.inner.artifact, onChainState, abiFunction!.inputs, selfAddress,
    );
    const target = resolve([row.targetSource], callerState)?.[0];
    if (!(target instanceof Uint8Array) && typeof target !== 'string') return;
    const callee = findDeploymentByAddressValue(caller.inner.provider, target)?.contract as CalleeContract | undefined;
    const calleeFunction = callee?.inner?.artifact?.abi
      .find((candidate) => candidate.selector?.toLowerCase() === payload.selector);
    if (!callee || !calleeFunction) return;
    const visibleInputs = calleeFunction.inputs.filter((input) => !input.name.startsWith('__internal__'));
    const args = resolve(payload.args, callerState);
    if (!args || args.length !== visibleInputs.length) return;
    host.callInfos.push({ type: 'stateful', contract: callee, functionName: calleeFunction.name, args });
  }
}
