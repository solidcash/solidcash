/**
 * phase-boundary extract: SC _createBuilder extract — expand looped external calls and auto-resolve callees.
 */

import type {
  AbiFunction,
  Artifact,
  ExternalCallAbi,
  StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';

/** Structural ExternalCallInfo to avoid importing StatefulContract through lifecycle types. */
export type CreateBuilderResolvedExternalCall = {
  externalContract: unknown;
  functionName: string;
  args: FunctionArgument[];
  stateOverrides?: Record<string, unknown>;
};

export type CreateBuilderLoopIdxRange = {
  start: number;
  count: number;
  fnPtrCall: boolean;
};

export interface ExpandResolveCreateBuilderExternalCallsHost {
  getExternalTargetEntriesByInterface(interfaceName: string): ReadonlyArray<{
    instance?: unknown;
    method?: string;
  }>;
  resolveExternalArgs(...args: any[]): FunctionArgument[] | undefined;
  getExternalRegistryEntry(interfaceName: string): unknown | undefined;
  getFullState(): Promise<{ state: Record<string, StateValue> }>;
}

export interface ExpandResolveCreateBuilderExternalCallsResult {
  externalCalls: ExternalCallAbi[] | undefined;
  presetResolved: (CreateBuilderResolvedExternalCall | undefined)[] | undefined;
  loopIdxRanges: CreateBuilderLoopIdxRange[];
  resolvedExternalCalls: CreateBuilderResolvedExternalCall[] | undefined;
  callerStateSnapshot: Record<string, StateValue> | undefined;
}
/**
 * Expand `IFoo(arr[i]).m()` slots into one concrete call per registered target, then
 * auto-resolve registry callees + expression args when overrides omit `externalCalls`.
 */
export async function expandResolveCreateBuilderExternalCalls(
  host: ExpandResolveCreateBuilderExternalCallsHost,
  abiFunction: AbiFunction | undefined,
  args: FunctionArgument[],
  artifact: Artifact,
  publicSelfAddress: FunctionArgument | undefined,
  overrideExternalCalls: CreateBuilderResolvedExternalCall[] | undefined,
): Promise<ExpandResolveCreateBuilderExternalCallsResult> {
  let externalCalls = abiFunction?.externalCalls;
  let presetResolved: (CreateBuilderResolvedExternalCall | undefined)[] | undefined;
  const loopIdxRanges: CreateBuilderLoopIdxRange[] = [];
  let callerStateSnapshot: Record<string, StateValue> | undefined;

  if (externalCalls?.some((ec) => ec.loopArrayVar)) {
    const expanded: ExternalCallAbi[] = [];
    presetResolved = [];
    for (const ec of externalCalls) {
      if (ec.loopArrayVar) {
        // A varying-method dispatch table co-spends each callee with its OWN registered method (the covenant
        // verifies it against the on-chain selector array); a fixed-method array uses the ABI functionName.
        const entries = host.getExternalTargetEntriesByInterface(ec.interfaceName);
        const resolvedArgs = host.resolveExternalArgs(
          ec.argSources, args, artifact, undefined, abiFunction?.inputs,
          undefined, 0, false, publicSelfAddress,
        ) ?? [];
        const start = expanded.length;
        for (const entry of entries) {
          const inst = entry.instance;
          const fnName = (ec.selectorArrayVar && entry.method) ? entry.method : ec.functionName;
          expanded.push({ ...ec, loopArrayVar: undefined });
          presetResolved.push({
            externalContract: inst,
            functionName: fnName,
            args: resolvedArgs,
          });
        }
        loopIdxRanges.push({ start, count: entries.length, fnPtrCall: !!ec.fnPtrCall });
      } else {
        expanded.push(ec);
        presetResolved.push(undefined);
      }
    }
    externalCalls = expanded;
  }

  // Auto-resolve external calls from the registry when not explicitly provided.
  // The registry provides the contract object for UTXO/state lookup.
  // Function args are resolved from argSources metadata when available,
  // falling back to [] for no-arg functions.
  let resolvedExternalCalls = overrideExternalCalls;
  if (externalCalls && externalCalls.length > 0 && !resolvedExternalCalls) {
    const autoResolved: CreateBuilderResolvedExternalCall[] = [];
    let canAutoResolve = true;
    for (let eci = 0; eci < externalCalls.length; eci++) {
      const ec = externalCalls[eci];
      // Array-element call: the callee instance was already resolved during expansion.
      if (presetResolved?.[eci]) { autoResolved.push(presetResolved[eci]!); continue; }
      const registered = host.getExternalRegistryEntry(ec.interfaceName);
      if (!registered) {
        canAutoResolve = false;
        break;
      }
      // Expression arg sources are evaluated against the caller's OWN state (`jobs.length - 1` and friends).
      // `_evaluateExternalExpression` already covers every shape these reach - state/array length/arithmetic,
      // struct constructors, the Encoding helpers - but silently yields undefined without a state snapshot,
      // which then surfaces as "cannot be auto-resolved". Read it once and thread it through.
      callerStateSnapshot ??= (await host.getFullState()).state;
      const resolvedArgs = host.resolveExternalArgs(
        ec.argSources, args, artifact, callerStateSnapshot, abiFunction?.inputs,
        undefined, 0, false, publicSelfAddress,
      );
      if (resolvedArgs === undefined && ec.argSources?.some((s) => s.kind === 'expression')) {
        throw new Error(
          `External call to ${ec.interfaceName}.${ec.functionName} has expression-based argSources `
          + 'that cannot be auto-resolved. Use withExternalCall() to provide args explicitly.',
        );
      }
      autoResolved.push({
        externalContract: registered,
        functionName: ec.functionName,
        args: resolvedArgs ?? [],
      });
    }
    if (canAutoResolve && autoResolved.length === externalCalls.length) {
      resolvedExternalCalls = autoResolved;
    }
  }

  return {
    externalCalls: externalCalls as ExternalCallAbi[] | undefined,
    presetResolved,
    loopIdxRanges,
    resolvedExternalCalls,
    callerStateSnapshot,
  };
}
