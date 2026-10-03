/**
 * phase-boundary extract: SC _createBuilder extract — expand looped external calls and auto-resolve callees.
 */

import type {
  AbiFunction,
  ArgSource,
  Artifact,
  ExternalCallAbi,
  ExternalCallExpression,
  StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { ExternalExpressionUnresolvedConditionError } from '../message-bus/result-evaluation-path.js';

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
  evaluateExternalExpression(...args: any[]): FunctionArgument | undefined;
  resolveExternalExpressionReturns?(
    sources: readonly ArgSource[],
    functionArgs: FunctionArgument[],
    state: Record<string, unknown>,
    callerInputs: readonly { type: string }[] | undefined,
    executionSelfAddress: FunctionArgument | undefined,
    producerCalls: readonly ExternalCallAbi[],
  ): Promise<ReadonlyMap<string, FunctionArgument>>;
  hydrateExternalPredicateState?(
    expressions: readonly ExternalCallExpression[],
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    state: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    executionSelfAddress?: FunctionArgument,
  ): Promise<Record<string, unknown>>;
  getExternalRegistryEntry(interfaceName: string): unknown | undefined;
  getExternalDeploymentByAddressValue(value: string | Uint8Array): unknown | undefined;
  getFullState(): Promise<{ state: Record<string, StateValue> }>;
}

export interface ExpandResolveCreateBuilderExternalCallsResult {
  externalCalls: ExternalCallAbi[] | undefined;
  presetResolved: (CreateBuilderResolvedExternalCall | undefined)[] | undefined;
  loopIdxRanges: CreateBuilderLoopIdxRange[];
  resolvedExternalCalls: CreateBuilderResolvedExternalCall[] | undefined;
  callerStateSnapshot: Record<string, StateValue> | undefined;
}

function containsReturningExpression(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return false;
  seen.add(value as object);
  if (['producerResult', 'externalCall'].includes((value as { kind?: string }).kind ?? '')) return true;
  return Object.values(value).some((child) => Array.isArray(child)
    ? child.some((item) => containsReturningExpression(item, seen))
    : containsReturningExpression(child, seen));
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

  // A zero-trip affine loop reaches none of its nested callees. Check each published pre-test before registry
  // lookup or argument evaluation: two loops in one handler may have different argument-array lengths.
  // Unknown pre-tests remain candidates; the completed covenant is authoritative if earlier writes change one.
  if (!overrideExternalCalls && externalCalls?.some((call) =>
    call.occurrence === 'loop' && call.iterationDomain)) {
    callerStateSnapshot = (await host.getFullState()).state;
    const evaluate = (expression: ExternalCallExpression,
      bindings?: ReadonlyMap<string, FunctionArgument>): FunctionArgument | undefined =>
      host.evaluateExternalExpression(expression, args, artifact, callerStateSnapshot,
        abiFunction?.inputs, undefined, 0, false, publicSelfAddress, bindings);
    externalCalls = externalCalls.filter((call) => {
      if (call.occurrence !== 'loop' || !call.iterationDomain) return true;
      const domain = call.iterationDomain;
      const initial = evaluate(domain.initialValue);
      if (typeof initial !== 'bigint') return true;
      const pretest = evaluate(domain.continueCondition, new Map([[domain.counterName, initial]]));
      return pretest !== false;
    });
    if (externalCalls.length === 0) {
      return {
        externalCalls: [], presetResolved: [], loopIdxRanges: [], resolvedExternalCalls: [],
        callerStateSnapshot,
      };
    }
  }

  // A published false activation has no call operand or participant block to resolve. The final covenant
  // remains authoritative if an earlier write changes the condition: an omitted required callee cannot
  // satisfy its on-chain identity check. Keep unresolved conditions as candidates rather than guessing.
  if (!overrideExternalCalls && externalCalls?.some((call) => call.occurrence === 'conditional' && call.condition)) {
    callerStateSnapshot ??= (await host.getFullState()).state;
    const conditions = externalCalls.flatMap((call) => call.occurrence === 'conditional' && call.condition
      ? [call.condition] : []);
    if (host.hydrateExternalPredicateState) {
      callerStateSnapshot = await host.hydrateExternalPredicateState(
        conditions, args, artifact, callerStateSnapshot, abiFunction?.inputs, publicSelfAddress,
      ) as Record<string, StateValue>;
    }
    externalCalls = externalCalls.filter((call) => call.occurrence !== 'conditional' || !call.condition
      || host.evaluateExternalExpression(call.condition, args, artifact, callerStateSnapshot,
        abiFunction?.inputs, undefined, 0, false, publicSelfAddress) !== false);
    if (externalCalls.length === 0) {
      return {
        externalCalls: [], presetResolved: [], loopIdxRanges: [], resolvedExternalCalls: [],
        callerStateSnapshot,
      };
    }
  }

  // A source `require` that dominates a call can prove the call unreachable even if its later operands depend
  // on an external return: `false && unresolved` is false. Keep any unknown guard and let the VM decide. This
  // proof runs before all-or-nothing registry resolution, so an unreachable zero-address call cannot erase the
  // earlier, reached callees needed to execute the require itself.
  if (!overrideExternalCalls && externalCalls?.some((call) => call.preCallRequires?.length)) {
    callerStateSnapshot ??= (await host.getFullState()).state;
    const guards = externalCalls.flatMap((call) => call.preCallRequires ?? []);
    if (host.hydrateExternalPredicateState) {
      callerStateSnapshot = await host.hydrateExternalPredicateState(
        guards, args, artifact, callerStateSnapshot, abiFunction?.inputs, publicSelfAddress,
      ) as Record<string, StateValue>;
    }
    const guardVerdict = (call: ExternalCallAbi, returns?: ReadonlyMap<string, FunctionArgument>): boolean =>
      call.preCallRequires?.some((guard) => host.evaluateExternalExpression(
        guard, args, artifact, callerStateSnapshot, abiFunction?.inputs,
        returns, 0, false, publicSelfAddress,
      ) === false) ?? false;
    externalCalls = externalCalls.filter((call) => !guardVerdict(call));
    const returningGuards = externalCalls.flatMap((call) => call.preCallRequires ?? [])
      .filter((guard) => containsReturningExpression(guard));
    if (returningGuards.length > 0 && host.resolveExternalExpressionReturns) {
      // A source require can stop before a later external call after an earlier producer returned false.
      // Resolve only the referenced producer results through the callee VM; if a predicate remains unknown,
      // retain its call so the final covenant remains the authority for a successful transaction.
      try {
        const returns = await host.resolveExternalExpressionReturns(
          returningGuards.map((expression) => ({ kind: 'expression', expression })),
          args, callerStateSnapshot, abiFunction?.inputs, publicSelfAddress,
          abiFunction?.externalCalls ?? [],
        );
        externalCalls = externalCalls.filter((call) => !guardVerdict(call, returns));
      } catch (error) {
        // This is only a negative reachability proof. An unresolved branch cannot prove a require false,
        // so keep every call and let the authenticated transaction execute the original require.
        if (!(error instanceof ExternalExpressionUnresolvedConditionError)) throw error;
      }
    }
  }

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
      // A state-pinned target need not have been registered under its source interface name (e.g. an
      // IERC20 value stored in a pool record). Resolve that authenticated address against deployments
      // first; an interface-name registration is only a fallback when no pinned deployment is available.
      let pinned: unknown;
      if (ec.addressSource || ec.addressStateVar) {
        callerStateSnapshot ??= (await host.getFullState()).state;
        const address = ec.addressSource
          ? host.resolveExternalArgs(
            [ec.addressSource], args, artifact, callerStateSnapshot, abiFunction?.inputs,
            undefined, 0, false, publicSelfAddress,
          )?.[0]
          : callerStateSnapshot[ec.addressStateVar!];
        if (typeof address === 'string' || address instanceof Uint8Array) {
          pinned = host.getExternalDeploymentByAddressValue(address);
        }
      }
      const registered = pinned ?? host.getExternalRegistryEntry(ec.interfaceName);
      if (!registered) {
        canAutoResolve = false;
        break;
      }
      let functionName = ec.functionName;
      if (ec.interfaceName === '__raw__') {
        const selected = (registered as { implementation?: unknown }).implementation ?? registered;
        const concreteAbi = (selected as { inner?: { artifact?: Artifact } }).inner?.artifact?.abi ?? [];
        const matches = concreteAbi.filter((candidate) => (
          (ec.rawFunctionName !== undefined && candidate.name === ec.rawFunctionName)
          || (ec.rawSelector !== undefined && candidate.selector?.toLowerCase() === ec.rawSelector.toLowerCase())
        ));
        if (matches.length !== 1) {
          throw new Error(`Raw external call selector '${ec.rawSelector ?? '<unknown>'}' has no unique pinned callee`);
        }
        functionName = matches[0].name;
      }
      // Expression arg sources are evaluated against the caller's own state (for example, array length minus one).
      // `_evaluateExternalExpression` already covers every shape these reach - state/array length/arithmetic,
      // struct constructors, the Encoding helpers - but silently yields undefined without a state snapshot,
      // which then surfaces as "cannot be auto-resolved". Read it once and thread it through.
      callerStateSnapshot ??= (await host.getFullState()).state;
      const argSources = ec.interfaceName === '__raw__' ? ec.rawArgSources ?? ec.argSources : ec.argSources;
      let resolvedArgs = host.resolveExternalArgs(
        argSources, args, artifact, callerStateSnapshot, abiFunction?.inputs,
        undefined, 0, false, publicSelfAddress,
      );
      const expressionArgs = argSources?.flatMap((source) => source.kind === 'expression'
        && source.expression ? [source.expression] : []) ?? [];
      if (resolvedArgs === undefined && expressionArgs.length > 0 && host.hydrateExternalPredicateState) {
        callerStateSnapshot = await host.hydrateExternalPredicateState(
          expressionArgs, args, artifact, callerStateSnapshot, abiFunction?.inputs, publicSelfAddress,
        ) as Record<string, StateValue>;
        resolvedArgs = host.resolveExternalArgs(
          argSources, args, artifact, callerStateSnapshot, abiFunction?.inputs,
          undefined, 0, false, publicSelfAddress,
        );
      }
      if (resolvedArgs === undefined && argSources && host.resolveExternalExpressionReturns
        && argSources.some((source) => containsReturningExpression(source))) {
        // A later call can consume an earlier call's result after local edits. Resolve that exact published
        // producer first; never substitute a provisional aggregate for a transaction argument.
        const returns = await host.resolveExternalExpressionReturns(
          argSources, args, callerStateSnapshot, abiFunction?.inputs, publicSelfAddress,
          abiFunction?.externalCalls ?? [],
        );
        resolvedArgs = host.resolveExternalArgs(
          argSources, args, artifact, callerStateSnapshot, abiFunction?.inputs,
          returns, 0, false, publicSelfAddress,
        );
      }
      if (resolvedArgs === undefined && argSources?.some((s) => s.kind === 'expression')) {
        throw new Error(
          `External call to ${ec.interfaceName}.${ec.functionName} has expression-based argSources `
          + 'that cannot be auto-resolved. Use withExternalCall() to provide args explicitly.',
        );
      }
      autoResolved.push({
        externalContract: registered,
        functionName,
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
