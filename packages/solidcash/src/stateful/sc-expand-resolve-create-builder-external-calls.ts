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
import { connectedContractMatchesExactAddress, exactAddressLockingBytecodeHex } from './deployment-registry.js';
import { externalCallIterationIndices } from './external-call-iteration-domain.js';

/** Structural ExternalCallInfo to avoid importing StatefulContract through lifecycle types. */
export type CreateBuilderResolvedExternalCall = {
  externalContract: unknown;
  functionName: string;
  args: FunctionArgument[];
  stateOverrides?: Record<string, unknown>;
  /**
   * A raw low-level call with no co-spent callee. EVM answers a call to an account (or to a contract without the
   * requested function) without executing a callee covenant: `fails: false` is `(true, "")`, `fails: true` is
   * `(false, "")`. The published ABI slot stays in place, but no participant block is co-spent.
   */
  absentCallee?: { fails: boolean };
};

export type CreateBuilderLoopIdxRange = {
  start: number;
  count: number;
  fnPtrCall: boolean;
};

export interface ExpandResolveCreateBuilderExternalCallsHost {
  getExternalTargetEntriesByInterface(interfaceName: string): ReadonlyArray<{
    address: string;
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
  /** True when the value reaches its deployment only through the child's off-chain CREATE2 projection. */
  isCreate2ProjectedAddressValue?(value: string | Uint8Array): boolean;
  getFullState(): Promise<{ state: Record<string, StateValue> }>;
  /**
   * Ask a pinned raw callee whether this invocation can execute. `executionFailure` is true only for a proven
   * covenant/require failure: an unsupported probe shape is not evidence that the call reverts.
   */
  probeRawCallee?(contract: unknown, functionName: string, args: FunctionArgument[]): Promise<
  { ok: true } | { ok: false; error: unknown; executionFailure: boolean }
  >;
}

export interface ExpandResolveCreateBuilderExternalCallsResult {
  externalCalls: ExternalCallAbi[] | undefined;
  presetResolved: (CreateBuilderResolvedExternalCall | undefined)[] | undefined;
  loopIdxRanges: CreateBuilderLoopIdxRange[];
  resolvedExternalCalls: CreateBuilderResolvedExternalCall[] | undefined;
  callerStateSnapshot: Record<string, StateValue> | undefined;
  /** Published ABI slots whose raw call co-spends no callee, and whether the call answered `success = false`. */
  absentCalleeSlots?: ReadonlyMap<number, boolean>;
}

/**
 * A published callsite one runtime loop can reach more than once with a FIXED callee (not an address-array
 * expansion or a batched invocation list).
 */
export function isRepeatedTypedLoopCallsite(call: ExternalCallAbi): boolean {
  return call.occurrence === 'loop' && !call.loopArrayVar && !call.batchInvocations
    && (call.maximumOccurrences === undefined || call.maximumOccurrences > 1);
}

/** Refusal for a repeated typed loop callsite that the legacy builder cannot compose. */
export function repeatedTypedLoopRefusal(call: ExternalCallAbi): Error {
  return new Error(`messageBus: typed loop callsite ${call.callsiteId ?? '?'} requires atomic composition; `
    + 'connect a signer before sending');
}

/**
 * Whether a bus-compiled root's discovered graph runs as bus rows: it reaches one state owner more than once, or
 * the root loops over a fixed callee and reaches any callee. A direct callee run settles one call (D50).
 */
export function plansRepeatedBusRows(
  entry: Pick<AbiFunction, 'externalCalls'>,
  calls: readonly { contract: { categoryId: string; inner: { lockingBytecode: string } } }[],
): boolean {
  if (calls.length < 2) return false;
  if (entry.externalCalls?.some(isRepeatedTypedLoopCallsite)) return true;
  const owners = new Set<string>();
  return calls.some(({ contract }) => {
    const owner = `${contract.categoryId.toLowerCase()}:${contract.inner.lockingBytecode.toLowerCase()}`;
    if (owners.has(owner)) return true;
    owners.add(owner);
    return false;
  });
}

/** Counter names of compiler `loopIndex` sources nested in a published callsite. */
function collectLoopCounters(value: unknown, seen = new Set<object>(), out = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return out;
  seen.add(value as object);
  const node = value as { kind?: string; source?: { kind?: string; counterName?: string } };
  if (node.kind === 'source' && node.source?.kind === 'loopIndex' && node.source.counterName) {
    out.add(node.source.counterName);
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (Array.isArray(child)) {
      for (const item of child) collectLoopCounters(item, seen, out);
    } else {
      collectLoopCounters(child, seen, out);
    }
  }
  return out;
}

/**
 * A loop-nested call with no published domain still runs only when its loop body runs. When it shares a
 * counter with an array-element callsite and that state array is empty, this invocation reaches no row.
 */
function zeroTripSharedArrayLoop(
  call: ExternalCallAbi,
  calls: readonly ExternalCallAbi[],
  state: Record<string, StateValue> | undefined,
): boolean {
  if (call.occurrence !== 'loop' || call.loopArrayVar || call.iterationDomain || !state) return false;
  const counters = collectLoopCounters(call);
  if (counters.size === 0) return false;
  const arrays = new Set<string>();
  for (const other of calls) {
    if (!other.loopArrayVar) continue;
    const shared = collectLoopCounters(other);
    if ([...counters].some((name) => shared.has(name))) arrays.add(other.loopArrayVar);
  }
  if (arrays.size !== 1) return false;
  const arrayName = [...arrays][0];
  if (arrayName === undefined) return false;
  const value = state[arrayName];
  return Array.isArray(value) && value.length === 0;
}

/**
 * The bus-compile predicate: `selector` names an eligible message-bus route handler of `artifact`. A direct
 * compile publishes none, so its calls never reach the composer, the bus-row planner or the send-time promotion.
 */
export function isBusCompiledEntry(
  artifact: Pick<Artifact, 'messageBus'>, selector: string | undefined,
): boolean {
  return selector !== undefined && artifact.messageBus?.handlers.some((handler) => handler.eligible
    && handler.selector.toLowerCase() === selector.toLowerCase()) === true;
}

/** A direct compile: `messageBus: false` stated, and not framed. Its repeated calls stay in the direct convention. */
export function isDirectConventionArtifact(artifact: Pick<Artifact, 'compiler' | 'composition'>): boolean {
  return artifact.compiler?.options?.messageBus === false && artifact.composition?.convention !== 'framed';
}

export function containsReturningExpression(value: unknown, seen = new Set<object>()): boolean {
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
  returnProbeOnly = false,
): Promise<ExpandResolveCreateBuilderExternalCallsResult> {
  let externalCalls = abiFunction?.externalCalls;
  let presetResolved: (CreateBuilderResolvedExternalCall | undefined)[] | undefined;
  const loopIdxRanges: CreateBuilderLoopIdxRange[] = [];
  let callerStateSnapshot: Record<string, StateValue> | undefined;
  // The covenant addresses a raw call's witnesses by its PUBLISHED ABI slot, which is its position in the
  // artifact's list - not its position after loop expansion.
  const abiSlotByCall = new Map<ExternalCallAbi, number>();
  (abiFunction?.externalCalls ?? []).forEach((call, index) => abiSlotByCall.set(call, index));
  const absentCalleeSlots = new Map<number, boolean>();

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

  // Producer results resolved for the activation predicates, reused to resolve a conditional call's target.
  let producerReturns: ReadonlyMap<string, FunctionArgument> | undefined;
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
    // A condition may depend on an earlier call's result (`totalSupply == 0 && msg.sender == migrator()`).
    // Resolve those producers first: without them the condition stays unknown, its zero-target callee cannot be
    // resolved, and the all-or-nothing resolution below would drop every *other* reached call as well. A
    // producer that cannot be resolved only means the condition stays unknown; it never proves the call away.
    let conditionReturns: ReadonlyMap<string, FunctionArgument> | undefined;
    if (host.resolveExternalExpressionReturns
      && conditions.some((condition) => containsReturningExpression(condition))) {
      try {
        conditionReturns = await host.resolveExternalExpressionReturns(
          conditions.map((expression) => ({ kind: 'expression', expression })),
          args, callerStateSnapshot, abiFunction?.inputs, publicSelfAddress,
          abiFunction?.externalCalls ?? [],
        );
      } catch (error) {
        if (!(error instanceof ExternalExpressionUnresolvedConditionError)) throw error;
      }
    }
    producerReturns = conditionReturns;
    externalCalls = externalCalls.filter((call) => {
      if (call.occurrence !== 'conditional' || !call.condition) return true;
      const verdict = host.evaluateExternalExpression(call.condition, args, artifact, callerStateSnapshot,
        abiFunction?.inputs, conditionReturns, 0, false, publicSelfAddress);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_EXTCALL === '1' && call.functionName === 'desiredLiquidity') {
        console.error('extcall-condition', JSON.stringify({
          f: call.functionName, verdict: typeof verdict === 'bigint' ? String(verdict) : verdict,
          hasReturns: conditionReturns !== undefined,
        }));
      }
      return verdict !== false;
    });
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
    if (externalCalls.length === 0) {
      return {
        externalCalls: [], presetResolved: [], loopIdxRanges: [], resolvedExternalCalls: [],
        callerStateSnapshot,
      };
    }
  }

  // A loop-nested call that shares its counter with an array-element sibling is unreachable when that
  // array is empty. The covenant skips the epilogue in that case; omitting the callsite here matches it.
  if (!overrideExternalCalls && externalCalls?.some((call) => call.occurrence === 'loop'
    && !call.loopArrayVar && !call.iterationDomain)) {
    callerStateSnapshot ??= (await host.getFullState()).state;
    const published = externalCalls;
    externalCalls = externalCalls.filter((call) => !zeroTripSharedArrayLoop(call, published, callerStateSnapshot));
    if (externalCalls.length === 0) {
      return {
        externalCalls: [], presetResolved: [], loopIdxRanges: [], resolvedExternalCalls: [],
        callerStateSnapshot,
      };
    }
  }

  // This legacy builder places one physical callee block per published callsite. A non-array loop can reach
  // that same callsite repeatedly, but expanding it here would duplicate the owner's master input and cannot
  // authenticate one ordered journal across the rows. The atomic composer handles that exact source domain;
  // without a connected signer, refuse rather than broadcasting only the first call as a successful prefix.
  // A published ceiling above one is that variable-width journal even when this invocation takes one row.
  // A domain that resolves to a single occurrence is one callee block, same as a call that is not a loop.
  // A return probe broadcasts nothing: when the loop's results form a published result array, it keeps the one
  // callee block and resolves every occurrence's value separately (pushCreateBuilderDirectExternalCallGroup).
  // A direct compile's grouped loop runs its reached calls as frames of the callee's multi-call spend.
  const repeatedLoop = externalCalls?.find((call) => {
    if (!isRepeatedTypedLoopCallsite(call) || call.callOrdinal !== undefined) return false;
    if (returnProbeOnly && call.resultArrayOutput !== undefined) return false;
    if ((call.maximumOccurrences ?? 0) > 1) return true;
    const domain = call.iterationDomain;
    if (!domain) return true;
    try {
      const count = externalCallIterationIndices(domain, (expression, bindings) =>
        host.evaluateExternalExpression(
          expression, args, artifact, callerStateSnapshot, abiFunction?.inputs,
          undefined, 0, false, publicSelfAddress, bindings,
        )).length;
      return count > 1;
    } catch {
      return true;
    }
  });
  if (repeatedLoop) throw repeatedTypedLoopRefusal(repeatedLoop);

  if (externalCalls?.some((ec) => ec.loopArrayVar)) {
    const expanded: ExternalCallAbi[] = [];
    presetResolved = [];
    for (const ec of externalCalls) {
      if (ec.loopArrayVar) {
        // A varying-method dispatch table co-spends each callee with its OWN registered method (the covenant
        // verifies it against the on-chain selector array); a fixed-method array uses the ABI functionName.
        const entries = host.getExternalTargetEntriesByInterface(ec.interfaceName);
        const start = expanded.length;
        for (const [occurrence, entry] of entries.entries()) {
          const inst = entry.instance;
          const fnName = (ec.selectorArrayVar && entry.method) ? entry.method : ec.functionName;
          expanded.push({ ...ec, loopArrayVar: undefined });
          // Each iteration's callee runs that iteration's call, whose record the caller digests.
          presetResolved.push({
            externalContract: inst,
            functionName: fnName,
            args: host.resolveExternalArgs(
              ec.argSources, args, artifact, undefined, abiFunction?.inputs,
              undefined, occurrence, false, publicSelfAddress,
            ) ?? [],
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
    const autoResolved: Array<CreateBuilderResolvedExternalCall | undefined> = [];
    let canAutoResolve = true;
    for (let eci = 0; eci < externalCalls.length; eci++) {
      const ec = externalCalls[eci];
      // Array-element call: the callee instance was already resolved during expansion.
      if (presetResolved?.[eci]) { autoResolved.push(presetResolved[eci]!); continue; }
      // A published address is authoritative. A connected interface entry may still supply the instance,
      // but only when its known physical or logical address is exactly the published target.
      let pinned: unknown;
      let registeredAtAddress: unknown;
      const hasPublishedTarget = ec.addressSource !== undefined
        || ec.addressStateVar !== undefined || ec.addressLiteral !== undefined;
      let address: unknown;
      if (hasPublishedTarget) {
        callerStateSnapshot ??= (await host.getFullState()).state;
        address = ec.addressSource
          ? host.resolveExternalArgs(
            [ec.addressSource], args, artifact, callerStateSnapshot, abiFunction?.inputs,
            producerReturns, 0, false, publicSelfAddress,
          )?.[0]
          : ec.addressStateVar !== undefined
            ? callerStateSnapshot[ec.addressStateVar]
            : ec.addressLiteral;
        if (typeof address === 'string' || address instanceof Uint8Array) {
          pinned = host.getExternalDeploymentByAddressValue(address);
          const lockHex = exactAddressLockingBytecodeHex(address);
          if (lockHex) {
            const matches = host.getExternalTargetEntriesByInterface(ec.interfaceName).filter((entry) => (
              entry.instance !== undefined
              && (!entry.method || entry.method === ec.functionName)
              && exactAddressLockingBytecodeHex(entry.address) === lockHex
            ));
            if (matches.length === 1) registeredAtAddress = matches[0]!.instance;
            if (!registeredAtAddress) {
              const connected = host.getExternalRegistryEntry(ec.interfaceName);
              if (connectedContractMatchesExactAddress(connected, address)) registeredAtAddress = connected;
            }
          }
        }
      }
      const registered = pinned ?? registeredAtAddress
        ?? (hasPublishedTarget ? undefined : host.getExternalRegistryEntry(ec.interfaceName));
      if (registered && hasPublishedTarget
        && (typeof address === 'string' || address instanceof Uint8Array)
        && host.isCreate2ProjectedAddressValue?.(address) === true) {
        // A CREATE2 address is an EVM init-code hash, not a BCH lock identity. No locking bytecode hashes to
        // it and an SCID anchor cannot carry it (the anchor must be spendable), so the caller's on-chain
        // identity check can never pass. Report the limit here instead of assembling a doomed transaction.
        const projected = typeof address === 'string'
          ? address : [...address].map((byte) => byte.toString(16).padStart(2, '0')).join('');
        throw new Error(
          `External call to ${ec.interfaceName}.${ec.functionName} targets CREATE2 identity '${projected}', `
          + 'which no Bitcoin Cash locking bytecode commits to. The caller covenant authenticates a callee '
          + 'by its lock-derived identity or a co-spent SCID identity anchor, and neither can name a CREATE2 '
          + 'address; address the callee through a lock-derived value instead.',
        );
      }
      if (!registered) {
        // A raw low-level call with an EMPTY payload and no deployment at its target is a plain value transfer
        // to an account. EVM executes no callee and answers `(true, "")`; the covenant already models the
        // recipient and amount as a transfer output, so state the call without a co-spent participant.
        const rawArgs = ec.rawArgSources ?? ec.argSources ?? [];
        const emptyPayload = rawArgs.length === 0
          || (rawArgs.length === 1 && rawArgs[0].kind === 'literal'
            && rawArgs[0].type === 'bytes0' && rawArgs[0].value === '');
        const valueOnlyRawCall = ec.interfaceName === '__raw__'
          && ec.rawSelector === undefined
          && emptyPayload
          && ec.loopArrayVar === undefined;
        if (valueOnlyRawCall) {
          const abiSlot = abiSlotByCall.get(ec);
          if (abiSlot !== undefined) absentCalleeSlots.set(abiSlot, false);
          autoResolved.push({
            externalContract: undefined,
            functionName: ec.functionName,
            args: [],
            absentCallee: { fails: false },
          });
          continue;
        }
        // A conditional call whose published target resolves to the zero identity has no callee. A *returning*
        // call there cannot succeed (empty returndata fails the ABI decode), so a successful execution never
        // takes it: drop the callsite the way a proven-false condition is dropped. Failing the whole fan-out
        // instead would also drop every reached call before it (balanceOf, feeTo) and produce a transaction
        // whose return witnesses cannot be filled.
        const zeroTarget = ec.hasReturnValues === true && ec.occurrence === 'conditional'
          && ((address instanceof Uint8Array && address.every((byte) => byte === 0))
            || (typeof address === 'string' && /^(?:0x)?0*$/i.test(address))
            || (typeof address === 'bigint' && address === 0n)
            || address === 0);
        if (zeroTarget) {
          autoResolved.push(undefined);
          continue;
        }
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_EXTCALL === '1') {
          console.error('extcall-unresolved', JSON.stringify({
            interfaceName: ec.interfaceName, functionName: ec.functionName,
            occurrence: ec.occurrence, hasPublishedTarget,
            addressStateVar: ec.addressStateVar,
            addressSource: ec.addressSource ? JSON.stringify(ec.addressSource).slice(0, 120) : undefined,
            addressLiteral: ec.addressLiteral,
            address: address instanceof Uint8Array ? [...address].map((b) => b.toString(16).padStart(2, '0')).join('') : address,
            producerReturns: producerReturns ? [...producerReturns.keys()] : undefined,
          }, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)));
        }
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
          // EVM answers a call to a contract that has no matching function (and no fallback) with
          // `(false, "")`; the caller's own `require(success)` then decides the outcome. There is no callee
          // entry to co-spend, so state the slot's negative sentinels and let the caller's covenant speak.
          const abiSlot = abiSlotByCall.get(ec);
          if (abiSlot === undefined || ec.loopArrayVar !== undefined) {
            throw new Error(`Raw external call selector '${ec.rawSelector ?? '<unknown>'}' has no unique pinned callee`);
          }
          absentCalleeSlots.set(abiSlot, true);
          autoResolved.push({
            externalContract: registered,
            functionName: ec.functionName,
            args: [],
            absentCallee: { fails: true },
          });
          continue;
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
      // A raw call does not propagate a callee revert: the caller observes `success = false` and its own
      // `require` decides the outcome. Prove the invocation on the callee's own covenant now; when it fails,
      // state the slot as a failed call with no co-spent participant instead of planning a spend that cannot pass.
      if (ec.interfaceName === '__raw__' && registered !== undefined && resolvedArgs !== undefined
        && host.probeRawCallee !== undefined) {
        const probe = await host.probeRawCallee(registered, functionName, resolvedArgs);
        const abiSlot = abiSlotByCall.get(ec);
        if (!probe.ok && probe.executionFailure && abiSlot !== undefined && ec.loopArrayVar === undefined) {
          absentCalleeSlots.set(abiSlot, true);
          autoResolved.push({
            externalContract: registered,
            functionName: ec.functionName,
            args: [],
            absentCallee: { fails: true },
          });
          continue;
        }
      }
      autoResolved.push({
        externalContract: registered,
        functionName,
        args: resolvedArgs ?? [],
      });
    }
    if (canAutoResolve && autoResolved.length === externalCalls.length) {
      // An absent raw callee keeps its published ABI slot (the covenant's witness names it) but co-spends no
      // participant, so it plans like an omitted callsite rather than a group.
      const participates = (
        call: CreateBuilderResolvedExternalCall | undefined,
      ): call is CreateBuilderResolvedExternalCall => call !== undefined && call.absentCallee === undefined;
      const kept = autoResolved.filter(participates);
      if (kept.length !== autoResolved.length) {
        externalCalls = externalCalls.filter((_call, index) => participates(autoResolved[index]));
        if (presetResolved) {
          presetResolved = presetResolved.filter((_call, index) => participates(autoResolved[index]));
        }
      }
      resolvedExternalCalls = kept;
    }
  }

  return {
    externalCalls: externalCalls as ExternalCallAbi[] | undefined,
    presetResolved,
    loopIdxRanges,
    resolvedExternalCalls,
    callerStateSnapshot,
    ...(absentCalleeSlots.size > 0 ? { absentCalleeSlots } : {}),
  };
}
