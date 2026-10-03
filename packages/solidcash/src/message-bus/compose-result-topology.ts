import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  ATOMIC_MESSAGE_BUS_MAX_ROWS, decodePushdataValue, getDefaultStateValue, scriptToBytecode,
  type ArgSource, type Artifact, type ExternalCallAbi, type ExternalCallExpression, type StateValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import {
  findDeploymentByAddressValue, registeredAddressValueLockingBytecode,
} from '../stateful/deployment-registry.js';
import { externalReturnsForCallsites } from '../stateful/external-returns-for-callsites.js';
import { AuthenticatedProducerResults } from './authenticated-producer-results.js';
import { externalCallIterationIndices } from '../stateful/external-call-iteration-domain.js';
import { hydrateExternalPredicateState } from '../stateful/sc-hydrate-external-predicate-state.js';
import { evaluateExternalExpression } from '../stateful/sc-evaluate-external-expression.js';
import { discoveredReturnFollowsParticipantWrite } from '../stateful/sc-materialize-create-builder-return-emit.js';
import { encodeExternalReturnValue } from '../stateful/external-return-encoding.js';
import { artifactUsesSolidityAbi } from '../stateful/solidityAbi.js';
import { deriveValueChunkProducerChildPath } from '../stateful/ValueChunkProducerIdentity.js';
import { addressToLockScript, tryCashAddressToLockScript } from '../utils.js';
import {
  projectMessageBusHandlerArguments, resolveMessageBusAbiFunction,
} from './message-bus.js';
import {
  rebuildPreparedInvocation, semanticJson, type PreparedAtomicMessageBusCall,
} from './compose-prepared-invocation.js';
import { decodeResultsByParent, type ResultPropagationContext } from './compose-result-propagation.js';

type Prepared = PreparedAtomicMessageBusCall;
type Child = { call: Prepared; previous?: number };

/** Initial graph discovery has the owner's pre-transaction state, not the caller's ordered writes. A
 * state-dependent require may turn true before this edge, so only frame-stable predicates can omit it. */
function stateIndependentPredicate(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.every((item) => stateIndependentPredicate(item, seen));
  const record = value as Record<string, unknown>;
  if (record.kind === 'state' || record.kind === 'stateAccess') return false;
  return Object.values(record).every((item) => stateIndependentPredicate(item, seen));
}

/** Resolve a forwarded low-level payload against the selected runtime callee, then require its exact
 * canonical BCH call encoding. The worklist and the participant VM independently authenticate this row. */
function decodeCanonicalRawInvocation(
  artifact: Artifact,
  payload: FunctionArgument | undefined,
): { fn: Artifact['abi'][number]; args: FunctionArgument[] } {
  if (!(payload instanceof Uint8Array) || payload.length < 4) {
    throw new Error('messageBus: raw call has no four-byte calldata selector');
  }
  const selector = binToHex(payload.subarray(0, 4));
  const matches = artifact.abi.filter((candidate) => candidate.selector?.toLowerCase() === selector);
  if (matches.length !== 1) {
    throw new Error(`messageBus: raw selector ${selector} has no unique runtime callee`);
  }
  const fn = matches[0]!;
  const inputs = fn.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const args: FunctionArgument[] = [];
  let cursor = 4;
  for (const input of inputs) {
    const aggregate = input.type.endsWith(']')
      || artifact.structs?.some((candidate) => candidate.name === input.type) === true;
    const outer = decodePushdataValue(payload, cursor, aggregate ? 'bytes' : input.type, artifact.structs);
    let value = outer.value as FunctionArgument;
    if (aggregate) {
      if (!(outer.value instanceof Uint8Array)) {
        throw new Error('messageBus: raw aggregate argument is not a pushed byte sequence');
      }
      if (input.type.endsWith('[]') && outer.value.length === 2
        && outer.value[0] === 0x01 && outer.value[1] === 0x00) {
        value = [];
      } else {
        const inner = decodePushdataValue(outer.value, 0, input.type, artifact.structs);
        if (inner.bytesConsumed !== outer.value.length) {
          throw new Error('messageBus: raw aggregate argument has trailing bytes');
        }
        value = inner.value as FunctionArgument;
      }
    }
    args.push(value);
    cursor += outer.bytesConsumed;
  }
  if (cursor !== payload.length) throw new Error('messageBus: raw calldata has trailing bytes');
  const encoded = args.map((argument, index) =>
    encodeFunctionArgument(argument, inputs[index]!.type, artifact.structs));
  if (encoded.some((argument) => !(argument instanceof Uint8Array))) {
    throw new Error('messageBus: raw calldata cannot contain a transaction signature');
  }
  const canonical = Uint8Array.from([
    ...hexToBin(fn.selector!), ...scriptToBytecode(encoded as Uint8Array[]),
  ]);
  if (binToHex(canonical) !== binToHex(payload)) {
    throw new Error('messageBus: raw calldata is not the canonical runtime ABI encoding');
  }
  return { fn, args };
}

function registeredExternal(contract: StatefulContract, name: string): unknown {
  return (contract as unknown as { _externalRegistry: ReadonlyMap<string, unknown> })._externalRegistry.get(name);
}

function hasChangedDependency(
  value: unknown,
  results: ReadonlyMap<number, FunctionArgument>,
  before: readonly FunctionArgument[],
  after: readonly FunctionArgument[],
): boolean {
  if (!value || typeof value !== 'object') return false;
  const node = value as { kind?: string; callsiteId?: number; paramIndex?: number };
  if ((node.kind === 'producerResult' || node.kind === 'externalCall')
    && node.callsiteId !== undefined && results.has(node.callsiteId)) return true;
  if (node.paramIndex !== undefined && semanticJson(before[node.paramIndex]) !== semanticJson(after[node.paramIndex])) {
    return true;
  }
  return Object.values(value).some((child) => hasChangedDependency(child, results, before, after));
}

/** A flat reached index is sound for a nested call only when every directly serialized loop source belongs
 * to its innermost counter. Outer values must arrive through the enclosing single producer occurrence. */
function usesAnotherLoopCounter(value: unknown, innerCounter: string, seen = new Set<object>()): boolean {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const source = value as { kind?: string; counterName?: string; indexStepValue?: number;
    stepValue?: string; stepExpression?: ExternalCallExpression };
  if (((source.kind === 'loopIndex' && (source.stepValue !== '0' || source.stepExpression !== undefined))
    || (source.kind === 'arrayElement' && source.indexStepValue !== 0))
    && source.counterName !== innerCounter) return true;
  return Object.values(value).some((child) => usesAnotherLoopCounter(child, innerCounter, seen));
}

/** Identify the exact producer callsites whose results a nested edge consumes. */
function producerResultCallsites(
  value: unknown, ids = new Set<number>(), seen = new Set<object>(),
): ReadonlySet<number> {
  if (!value || typeof value !== 'object' || seen.has(value)) return ids;
  seen.add(value);
  const node = value as { kind?: string; callsiteId?: number };
  if ((node.kind === 'producerResult' || node.kind === 'externalCall')
    && node.callsiteId !== undefined) ids.add(node.callsiteId);
  for (const child of Object.values(value)) producerResultCallsites(child, ids, seen);
  return ids;
}

/** Select the sole reached outer coordinate before evaluating the inner loop. This rewrites metadata only;
 * the executable call and its compiler-authored guards remain authoritative in final VM preflight. */
function bindOuterLoopCounter<T>(value: T, counterName: string, coordinate: bigint): T {
  if (Array.isArray(value)) return value.map((item) => bindOuterLoopCounter(item, counterName, coordinate)) as T;
  if (!value || typeof value !== 'object' || value instanceof Uint8Array) return value;
  const record = value as Record<string, unknown>;
  if (record.counterName === counterName && record.kind === 'loopIndex') {
    return { ...record, initialValue: coordinate.toString(), stepValue: '0', stepExpression: undefined } as T;
  }
  if (record.counterName === counterName && record.kind === 'arrayElement'
    && record.indexStepValue !== 0) {
    if (!Number.isSafeInteger(Number(coordinate))) {
      throw new Error('messageBus: nested array coordinate is not a safe integer');
    }
    return { ...record, indexValue: Number(coordinate), indexStepValue: 0 } as T;
  }
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [
    key, bindOuterLoopCounter(child, counterName, coordinate),
  ])) as T;
}

/**
 * Return discovery can change reachability as well as argument bytes. Rebuild compiler-described child
 * occurrences before planning the next transaction, retaining result seeds only on the same source edge.
 * Unknown guards keep their previous speculative rows until their producer executes. Neither those rows
 * nor newly selected rows bypass the compiled graph checks or final whole-transaction VM admission.
 */
export async function propagateResultDependentCallTopology(
  ctx: ResultPropagationContext & {
    rootCaller: Uint8Array;
    stateOf: (contract: StatefulContract) => Promise<Record<string, unknown>>;
  },
  prepared: readonly Prepared[],
  results: Readonly<Record<number, string>>,
): Promise<{ propagated: boolean; calls: Prepared[] }> {
  return rebuildCallTopology(ctx.rootCaller, ctx.stateOf, prepared, ctx, results);
}

/** Discover a finite typed graph before the first VM pass; later passes reuse the same source-edge walker. */
export async function discoverInitialCallTopology(
  root: Prepared,
  rootCaller: Uint8Array,
  stateOf: (contract: StatefulContract) => Promise<Record<string, unknown>>,
): Promise<Prepared[]> {
  return (await rebuildCallTopology(rootCaller, stateOf, [root])).calls;
}

async function rebuildCallTopology(
  rootCaller: Uint8Array,
  stateOf: (contract: StatefulContract) => Promise<Record<string, unknown>>,
  prepared: readonly Prepared[],
  ctx?: ResultPropagationContext,
  results: Readonly<Record<number, string>> = {},
): Promise<{ propagated: boolean; calls: Prepared[] }> {
  const resultsByParent: ReturnType<typeof decodeResultsByParent> = ctx
    ? decodeResultsByParent(ctx, results) : new Map();
  const childrenByParent = new Map<number, Child[]>();
  for (const invocation of ctx?.plan.invocations ?? []) {
    if (invocation.parent === null) continue;
    const siblings = childrenByParent.get(invocation.parent) ?? [];
    siblings.push({ call: prepared[invocation.index], previous: invocation.index });
    childrenByParent.set(invocation.parent, siblings);
  }
  const calls: Prepared[] = [];
  let propagated = false;
  const visit = async (entry: Child, incoming: Uint8Array, depth: number): Promise<void> => {
    if (depth > 7) throw new Error('messageBus: result-dependent call topology exceeds the graph depth limit');
    const { call, previous } = entry;
    calls.push(call);
    const artifact = call.executionArtifact ?? call.contract.inner.artifact;
    const logical = call.executor ?? call.contract;
    const expressionHost = { resolveExternalArgs: logical._resolveExternalArgs.bind(logical) };
    const fn = resolveMessageBusAbiFunction(artifact, call.functionName, call.selector);
    let children = previous === undefined ? [] : childrenByParent.get(previous) ?? [];
    const candidateResults = new AuthenticatedProducerResults(previous ?? 0);
    const childResults = previous === undefined ? candidateResults
      : resultsByParent.get(previous) ?? new Map<number, FunctionArgument>();
    const self = artifact.messageBus?.route.inputs.some(
      (input) => input.name === '__internal__graphSelfIdentityInput',
    ) ? addressToLockScript(call.contract.target) : hexToBin(call.contract.inner.lockingBytecode);
    const argsChanged = previous !== undefined && ctx !== undefined
      && semanticJson(call.args) !== semanticJson(ctx.descriptors[previous].args);
    if (argsChanged) {
      // Filtering a loop can reuse a reached occurrence for a different source iteration. Its arguments
      // change here, after the ordinary argument-propagation pass, so refresh the retained children before
      // visiting them. Their own guards may be unchanged even though their forwarded arguments are not.
      // Recursion repeats this step for every affected descendant without reinterpreting unrelated domains.
      children = children.map((child) => {
        const resolved = child.call.resolveArgsFromResults?.(childResults, call.args);
        if (!resolved || semanticJson(resolved) === semanticJson(child.call.args)) return child;
        propagated = true;
        return { ...child, call: rebuildPreparedInvocation(child.call, resolved, undefined) };
      });
    }
    if (fn?.externalCalls?.length && (childResults.size > 0 || argsChanged || previous === undefined)) {
      const sources = fn.externalCalls;
      const args = projectMessageBusHandlerArguments(artifact, fn.name, fn.selector, call.args);
      let state = { ...await stateOf(call.contract) };
      const returnsFor = (argSources: readonly ArgSource[], condition?: ExternalCallAbi,
        producerOccurrenceIndex?: number):
      Map<string, FunctionArgument> => externalReturnsForCallsites(argSources, childResults, sources,
        condition?.callsiteId === undefined ? undefined : {
          callsiteId: condition.callsiteId, resultConsumers: fn.resultConsumers, lane: 'condition',
        }, producerOccurrenceIndex);
      const evaluate = (expression: ExternalCallExpression, iteration: number,
        returns: ReadonlyMap<string, FunctionArgument>, bindings?: ReadonlyMap<string, bigint>):
      FunctionArgument | undefined => evaluateExternalExpression(expressionHost,
        expression, [...args], artifact, state, fn.inputs, returns, iteration, false, self,
        bindings, undefined, true, incoming,
      );
      const hydrate = async (expressions: readonly (ExternalCallExpression | undefined)[],
        iterations: readonly number[], returns: ReadonlyMap<string, FunctionArgument>): Promise<void> => {
        state = await hydrateExternalPredicateState({
          evaluateExternalExpression: (expression, frame, owner, snapshot, inputs, _returns, iteration) =>
            evaluateExternalExpression(expressionHost, expression, frame, owner, snapshot, inputs, returns,
              iteration, false, self, undefined, undefined, true, incoming),
          getEntries: (collection: string) => call.contract.getEntries(collection),
        }, expressions, [...args], artifact, state, fn.inputs, self, iterations);
      };
      const next: Child[] = [];
      const reachedProducerOccurrences = new Map<number, {
        domainKey: string; bySourceIteration: Map<number, number>;
      }>();
      for (const source of sources) {
        // A prepared call may omit its callsiteId when the compiled graph can infer the exact edge from source
        // order. Once planned, that graph identity is authoritative: filtering by the optional descriptor field
        // would silently discard every existing sibling during a result-dependent topology refresh.
        const existingSite = children.filter((child) => (
          child.previous === undefined ? child.call.callsiteId
            : ctx?.plan.invocations[child.previous]?.consumerCallsiteId
        ) === source.callsiteId);
        const templates = source.batchInvocations?.map((row) => ({
          ...source, ...row, argSources: row.argSources, rawArgSources: undefined,
          sourceCallsiteId: row.sourceCallsiteId, sourceLogicalIndex: row.logicalIndex,
          selectedSelector: row.selector,
        })) ?? [{ ...source, sourceCallsiteId: source.callsiteId,
          sourceLogicalIndex: undefined, selectedSelector: source.rawSelector }];
        for (const sourceTemplate of templates) {
          const conditionalProducerOccurrences = new Map<number, Map<number, number>>();
          const outerDomain = sourceTemplate.iterationDomain ?? sourceTemplate.nestedIterationDomains?.[0];
          const outerDomainKey = outerDomain?.sourceLoopId === undefined
            ? undefined : semanticJson(outerDomain);
          const returnsForOuter = (
            argSources: readonly ArgSource[], condition: ExternalCallAbi | undefined,
            outerIndex: number | undefined,
            available: ReadonlyMap<number, FunctionArgument> = childResults,
          ): Map<string, FunctionArgument> => {
            if (outerIndex === undefined) {
              return externalReturnsForCallsites(argSources, available, sources,
                condition?.callsiteId === undefined ? undefined : {
                  callsiteId: condition.callsiteId, resultConsumers: fn.resultConsumers, lane: 'condition',
                }, outerIndex);
            }
            const selected = new Map<number, FunctionArgument>();
            for (const producer of sources) {
              if (producer.callsiteId === undefined) continue;
              const producerDomain = producer.iterationDomain ?? producer.nestedIterationDomains?.[0];
              const sharesOuterDomain = outerDomainKey !== undefined && producerDomain !== undefined
                && semanticJson(producerDomain) === outerDomainKey;
              const reached = reachedProducerOccurrences.get(producer.callsiteId);
              const mapped = conditionalProducerOccurrences.get(producer.callsiteId)
                ?? (reached !== undefined && reached.domainKey === outerDomainKey
                  ? reached.bySourceIteration : undefined);
              // An outer loop coordinate selects an occurrence only for a producer in that SAME source loop.
              // A scalar result produced before the loop has one authenticated lane for every consumer iteration;
              // looking up occurrence 1, 2, ... on that one-shot producer makes the later guards unresolved and
              // discards even the already-reached first child from this all-or-nothing topology rebuild.
              const occurrenceIndex = sharesOuterDomain
                ? mapped ? mapped.get(outerIndex) : outerIndex : undefined;
              if (sharesOuterDomain && occurrenceIndex === undefined) continue;
              const result = sharesOuterDomain && available instanceof AuthenticatedProducerResults
                ? available.getOccurrence({ callsiteId: producer.callsiteId, occurrenceIndex })
                : available.get(producer.callsiteId);
              if (result !== undefined) selected.set(producer.callsiteId, result);
            }
            return externalReturnsForCallsites(argSources, selected, sources,
              condition?.callsiteId === undefined ? undefined : {
                callsiteId: condition.callsiteId, resultConsumers: fn.resultConsumers, lane: 'condition',
              });
          };
          const existing = existingSite.filter((child) => (
            child.previous === undefined
              ? child.call.sourceLogicalIndex ?? child.call.batchLogicalIndex
              : ctx?.plan.invocations[child.previous]?.sourceLogicalIndex
                ?? child.call.sourceLogicalIndex ?? child.call.batchLogicalIndex
          ) === sourceTemplate.sourceLogicalIndex);
          if (previous !== undefined && ctx !== undefined && !hasChangedDependency(
            [sourceTemplate.condition, sourceTemplate.iterationDomain, sourceTemplate.nestedIterationDomains,
              sourceTemplate.preCallRequires, sourceTemplate.argSources, sourceTemplate.rawArgSources,
              sourceTemplate.addressSource], childResults,
            ctx.descriptors[previous].args, call.args,
          )) {
            // Argument propagation already refreshed existing rows. A result unrelated to this edge's
            // reachability must not reinterpret an independently prepared loop or its occurrence domain.
            // Later sibling guards may still consume this unchanged producer by source iteration. Preserve its
            // compiler-qualified source-to-reached map even though the producer rows need no refresh.
            if (sourceTemplate.hasReturnValues && sourceTemplate.callsiteId !== undefined
              && sourceTemplate.sourceLogicalIndex === undefined && outerDomainKey !== undefined
              && existing.every((child) => child.call.topologyOuterDomainKey === outerDomainKey
                && Number.isSafeInteger(child.call.topologyOuterIteration)
                && Number.isSafeInteger(child.call.occurrenceIndex))) {
              const bySourceIteration = new Map<number, number>();
              for (const child of existing) {
                const sourceIndex = child.call.topologyOuterIteration!;
                if (bySourceIteration.has(sourceIndex)) {
                  throw new Error('messageBus: producer source iteration has ambiguous reached occurrence');
                }
                bySourceIteration.set(sourceIndex, child.call.occurrenceIndex!);
              }
              reachedProducerOccurrences.set(sourceTemplate.callsiteId, {
                domainKey: outerDomainKey, bySourceIteration,
              });
            }
            next.push(...existing);
            continue;
          }
          let occurrences: Array<{ iteration: number; edge: typeof sourceTemplate; outerIndex?: number }> = [
            { iteration: 0, edge: sourceTemplate },
          ];
          if (sourceTemplate.occurrence === 'loop') {
            const domain = sourceTemplate.iterationDomain;
            const nested = sourceTemplate.nestedIterationDomains;
            if (!domain && nested?.length !== 2) {
              throw new Error('messageBus: result-dependent loop has no compiler iteration domain');
            }
            if (nested && (nested.length !== 2 || nested[0]?.counterName === nested[1]?.counterName)) {
              throw new Error('messageBus: nested call has unsupported or ambiguous loop counters');
            }
            // Missing producer results are not zero/false. Defer this callsite, then let VM return discovery
            // supply the value on the next graph epoch. Invalid resolved domains still fail closed.
            let unresolved = false;
            try {
              const domainIndices = async (selected: NonNullable<typeof domain>,
                producerOccurrenceIndex?: number, remapConditionalProducers = false): Promise<number[]> => {
                const expressions = [selected.initialValue, selected.stepValue, selected.continueCondition];
                const sourcesForExpressions = expressions.map((expression) => ({
                  kind: 'expression' as const, expression,
                }));
                const returns = remapConditionalProducers
                  ? returnsForOuter(sourcesForExpressions, undefined, producerOccurrenceIndex)
                  : returnsFor(sourcesForExpressions, undefined, producerOccurrenceIndex);
                await hydrate(expressions, [0], returns);
                return externalCallIterationIndices(selected, (expression, bindings) => {
                  const value = evaluate(expression, 0, returns, bindings);
                  if (value === undefined) unresolved = true;
                  return value;
                });
              };
              if (domain) occurrences = (await domainIndices(domain)).map((iteration) => ({
                iteration, edge: sourceTemplate, outerIndex: iteration,
              }));
              else {
                const outer = await domainIndices(nested![0]!);
                // A nested consumer can select its outer producer occurrence only if one unconditional,
                // non-batched producer precedes it in the same exact compiler-published outer domain.
                const producerCallsites = [...producerResultCallsites(sourceTemplate)];
                if (outer.length > 1 && producerCallsites.some((callsiteId) => {
                  const producer = sources.find((candidate) => candidate.callsiteId === callsiteId);
                  return !producer || producer.batchInvocations
                    || producer.occurrence !== 'loop' || !producer.iterationDomain
                    || producer.sourceEffectOrdinal === undefined
                    || sourceTemplate.sourceEffectOrdinal === undefined
                    || producer.sourceEffectOrdinal >= sourceTemplate.sourceEffectOrdinal
                    || semanticJson(producer.iterationDomain) !== semanticJson(nested![0]);
                })) {
                  throw new Error('messageBus: nested call repeats an outer producer occurrence');
                }
                for (const callsiteId of producerCallsites) {
                  const producer = sources.find((candidate) => candidate.callsiteId === callsiteId);
                  if (!producer?.condition || !producer.iterationDomain
                    || semanticJson(producer.iterationDomain) !== semanticJson(nested![0])) continue;
                  // A conditional producer's authenticated rows use compact reached ordinals, not outer
                  // source indices. Re-evaluate its published guard in the same outer domain before binding
                  // any nested consumer result; a skipped source index has no result lane.
                  const reached = new Map<number, number>();
                  for (const outerIndex of outer) {
                    const guardReturns = returnsFor([{
                      kind: 'expression', expression: producer.condition,
                    }], producer, outerIndex);
                    await hydrate([producer.condition], [outerIndex], guardReturns);
                    const active = evaluate(producer.condition, outerIndex, guardReturns);
                    if (active === undefined) { unresolved = true; break; }
                    if (typeof active !== 'boolean') throw new Error(
                      'messageBus: conditional outer producer guard is not boolean',
                    );
                    if (active) reached.set(outerIndex, reached.size);
                  }
                  if (unresolved) break;
                  conditionalProducerOccurrences.set(callsiteId, reached);
                }
                if (unresolved) { next.push(...existing); continue; }
                if (outer.length === 0) occurrences = [];
                else {
                  const outerInitial = evaluate(nested![0]!.initialValue, 0, returnsFor([{
                    kind: 'expression', expression: nested![0]!.initialValue,
                  }]));
                  const outerStep = evaluate(nested![0]!.stepValue, 0, returnsFor([{
                    kind: 'expression', expression: nested![0]!.stepValue,
                  }]));
                  if (typeof outerInitial !== 'bigint' || typeof outerStep !== 'bigint') {
                    throw new Error('messageBus: nested outer loop has no exact affine coordinate');
                  }
                  occurrences = [];
                  for (const outerIndex of outer) {
                    const coordinate = outerInitial + BigInt(outerIndex) * outerStep;
                    const edge = bindOuterLoopCounter(sourceTemplate, nested![0]!.counterName, coordinate);
                    if (usesAnotherLoopCounter(
                      [edge.condition, edge.argSources, edge.rawArgSources, edge.addressSource],
                      nested![1]!.counterName,
                    )) throw new Error('messageBus: nested call has an unresolved loop coordinate');
                    const inner = bindOuterLoopCounter(nested![1]!, nested![0]!.counterName, coordinate);
                    if (usesAnotherLoopCounter(
                      [inner.initialValue, inner.stepValue, inner.continueCondition], inner.counterName,
                    )) throw new Error('messageBus: nested domain has an unresolved outer loop coordinate');
                    for (const iteration of await domainIndices(inner, outerIndex, true)) {
                      occurrences.push({ iteration, edge, outerIndex });
                      if (occurrences.length > ATOMIC_MESSAGE_BUS_MAX_ROWS) {
                        throw new Error('messageBus: nested call exceeds the graph row limit');
                      }
                    }
                  }
                }
              }
            } catch (error) {
              if (!unresolved) throw error;
              next.push(...existing);
              continue;
            }
          }
          const selected: Child[] = [];
          const reachedCurrent = new Map<number, number>();
          const candidateSeeds: Array<{ occurrenceIndex: number; value: FunctionArgument }> = [];
          let unresolved = false;
          let occurrence = 0;
          for (const { iteration, edge: template, outerIndex } of occurrences) {
            if (template.preCallRequires?.length) {
              const predicates = template.preCallRequires.filter((predicate) => stateIndependentPredicate(predicate));
              if (predicates.length > 0) {
                const returns = returnsForOuter(predicates.map((expression) => ({
                  kind: 'expression', expression,
                })), undefined, outerIndex);
                await hydrate(predicates, [iteration], returns);
                // A compiler-published necessary predicate that is exactly false proves the source require
                // reverted before this edge. True or unknown does not prove the require passed; the VM does.
                if (predicates.some((predicate) => evaluate(predicate, iteration, returns) === false)) continue;
              }
            }
            if (template.condition) {
              const returns = returnsForOuter([{ kind: 'expression', expression: template.condition }],
                template, outerIndex);
              await hydrate([template.condition], [iteration], returns);
              const active = evaluate(template.condition, iteration, returns);
              if (active === undefined) { unresolved = true; break; }
              if (typeof active !== 'boolean') throw new Error('messageBus: call guard did not resolve to a boolean');
              if (!active) continue;
            }
            const reachedOccurrence = occurrence;
            const prior = existing.find((child) => (
              child.previous === undefined
                ? child.call.occurrenceIndex ?? child.call.batchOccurrenceIndex
                : ctx?.plan.invocations[child.previous]?.occurrenceIndex
                  ?? child.call.occurrenceIndex ?? child.call.batchOccurrenceIndex
            ) === reachedOccurrence);
            const argSources = template.rawArgSources ?? template.argSources ?? [];
            const addressSources = template.addressSource ? [template.addressSource] : [];
            const returns = returnsForOuter([...argSources, ...addressSources], undefined, outerIndex);
            await hydrate([...argSources, ...addressSources].map((argSource) =>
              ({ kind: 'source', source: argSource })), [iteration], returns);
            const sourceArgs = logical._resolveExternalArgs(argSources, [...args], artifact, state, fn.inputs,
              returns, iteration, false, self, incoming);
            if (!sourceArgs) { unresolved = true; break; }
            const target = template.addressSource
              ? logical._resolveExternalArgs([template.addressSource], [...args], artifact, state, fn.inputs,
                returns, iteration, false, self, incoming)?.[0]
              : template.addressParam ? args[fn.inputs.findIndex((input) => input.name === template.addressParam)]
                : template.addressStateVar ? state[template.addressStateVar]
                  : template.addressLiteral ?? (template.addressIsMsgSender ? incoming : undefined);
            const address = typeof target === 'string' || target instanceof Uint8Array ? target : undefined;
            const provider = call.contract.inner.provider;
            const registered = address === undefined
              ? registeredExternal(logical, template.interfaceName)
                ?? registeredExternal(call.contract, template.interfaceName) ?? prior?.call.contract
              : findDeploymentByAddressValue(provider, address)?.contract
                ?? registeredExternal(logical, template.interfaceName)
                ?? registeredExternal(call.contract, template.interfaceName) ?? prior?.call.contract;
            if (!registered || typeof registered !== 'object') throw new Error(
              `messageBus: cannot resolve newly reached callsite ${String(template.callsiteId)}`,
            );
            const proxy = 'implementation' in registered
              ? registered as { proxy: StatefulContract; implementation: StatefulContract } : undefined;
            const contract = proxy?.proxy ?? registered as StatefulContract;
            const executor = proxy?.implementation;
            const childArtifact = (executor ?? contract).inner.artifact;
            const rawPayload = template.interfaceName === '__raw__'
              && template.functionName === '__raw__' && template.rawArgSources === undefined;
            const decodedRaw = rawPayload
              ? decodeCanonicalRawInvocation(childArtifact, sourceArgs[0]) : undefined;
            const childFn = decodedRaw?.fn ?? (template.selectedSelector
              ? childArtifact.abi.find((candidate) => candidate.selector === template.selectedSelector)
              : resolveMessageBusAbiFunction(childArtifact, template.rawFunctionName ?? template.functionName));
            if (!childFn?.selector) throw new Error('messageBus: newly reached call has no exact ABI selector');
            if (decodedRaw && ((template.selectedSelector !== undefined
              && childFn.selector.toLowerCase() !== template.selectedSelector.toLowerCase())
              || (template.rawFunctionName !== undefined && childFn.name !== template.rawFunctionName))) {
              throw new Error('messageBus: raw calldata selector disagrees with compiler callsite');
            }
            const childArgs = decodedRaw?.args ?? sourceArgs;
            const targetLock = address === undefined ? undefined
              : registeredAddressValueLockingBytecode(provider, address) ?? tryCashAddressToLockScript(address);
            const snapshot = state;
            const resolveArgsFromResults: Prepared['resolveArgsFromResults'] = (updated, frame) => {
              const resolved = logical._resolveExternalArgs(argSources, [...(frame ?? args)], artifact,
                snapshot, fn.inputs, returnsForOuter(argSources, undefined, outerIndex, updated),
                iteration, false, self, incoming);
              return rawPayload && resolved
                ? decodeCanonicalRawInvocation(childArtifact, resolved[0]).args : resolved;
            };
            if (template.hasReturnValues && template.callsiteId !== undefined
              && template.sourceLogicalIndex === undefined
              && outerDomainKey !== undefined && outerIndex !== undefined) {
              if (reachedCurrent.has(outerIndex)) {
                throw new Error('messageBus: producer source iteration has ambiguous reached occurrence');
              }
              reachedCurrent.set(outerIndex, occurrence);
            }
            if (prior && prior.call.contract === contract && prior.call.selector === childFn.selector
              && prior.call.executor === executor) {
              const rebuilt = rebuildPreparedInvocation(prior.call, childArgs, undefined);
              rebuilt.resolveArgsFromResults = resolveArgsFromResults;
              if (outerDomainKey !== undefined && outerIndex !== undefined) {
                rebuilt.topologyOuterDomainKey = outerDomainKey;
                rebuilt.topologyOuterIteration = outerIndex;
                rebuilt.topologyInnerIteration = template.nestedIterationDomains ? iteration : undefined;
              }
              selected.push({ call: rebuilt, previous: prior.previous });
              occurrence += 1;
              continue;
            }
            const child: Prepared = {
              contract, functionName: childFn.name, selector: childFn.selector, args: childArgs,
              callsiteId: template.callsiteId, sourceCallsiteId: template.sourceCallsiteId,
              occurrenceIndex: occurrence, sourceLogicalIndex: template.sourceLogicalIndex,
              sourceEffectOrdinal: template.sourceEffectOrdinal,
              ...(outerDomainKey !== undefined && outerIndex !== undefined && {
                topologyOuterDomainKey: outerDomainKey, topologyOuterIteration: outerIndex,
                ...(template.nestedIterationDomains && { topologyInnerIteration: iteration }),
              }),
              ...(template.sourceLogicalIndex !== undefined && {
                batchLogicalIndex: template.sourceLogicalIndex, batchOccurrenceIndex: occurrence,
              }),
              ...(targetLock && { targetLockingBytecode: binToHex(targetLock) }),
              ...(executor && { executor, executionArtifact: childArtifact }),
              producerPath: deriveValueChunkProducerChildPath({
                parent: call.producerPath ?? { status: 'unavailable' },
                parentExecutionLockingBytecode: logical.inner.lockingBytecode,
                parentSelector: fn.selector, sourceCallsiteId: template.sourceCallsiteId,
                sourceLogicalIndex: template.sourceLogicalIndex, occurrenceIndex: occurrence,
                sourceEffectOrdinal: template.sourceEffectOrdinal,
              }),
              resolveArgsFromResults,
            };
            // A later row in the same participant can revert before its complete return vector is exposed.
            // Probe an independent scalar leaf view against the current owner state as an optimistic seed,
            // never as a prepared commitment. The final graph VM still authenticates the value in context.
            let viewSeed: StateValue | undefined;
            const onlyOutput = childFn.outputs?.length === 1 ? childFn.outputs[0] : undefined;
            const precedingCalls = [
              ...calls, ...next.map((scheduledChild) => scheduledChild.call),
              ...selected.map((scheduledChild) => scheduledChild.call),
            ];
            const priorWrite = discoveredReturnFollowsParticipantWrite(
              [...precedingCalls, child], precedingCalls.length,
            );
            const priorNestedEffect = [...next, ...selected].some(({ call: priorCall }) => {
              const priorArtifact = priorCall.executionArtifact ?? priorCall.contract.inner.artifact;
              const priorFn = resolveMessageBusAbiFunction(
                priorArtifact, priorCall.functionName, priorCall.selector,
              );
              // A prior nested call can write this participant even if its direct owner is different. An
              // unrecognised predecessor provides no proof that the isolated pre-transaction view is current.
              return !priorFn || Boolean(priorFn.externalCalls?.length);
            });
            if (previous === undefined && template.hasReturnValues && onlyOutput !== undefined
              && template.occurrence !== 'loop' && !template.iterationDomain
              && !template.nestedIterationDomains?.length
              && !priorWrite && !priorNestedEffect
              && childFn.modifiers?.some((modifier) => modifier === 'view' || modifier === 'pure')
              && childFn.writesState === false && !childFn.externalCalls?.length && !executor) {
              try {
                viewSeed = await contract._deriveReturnValue(
                  childFn.name, childArgs, undefined, childFn, undefined, self, logical.categoryId, logical,
                );
              } catch {
                // An isolated probe may lack the full caller/resource frame. It supplies no fact on failure.
              }
            }
            const seededChild = viewSeed === undefined || onlyOutput === undefined ? child : rebuildPreparedInvocation(
              child, childArgs, binToHex(encodeExternalReturnValue(
                viewSeed, onlyOutput.type, childArtifact.structs,
                artifactUsesSolidityAbi(childArtifact), childArtifact.enums,
              )),
            );
            selected.push({ call: seededChild });
            // A newly discovered producer may feed a mandatory later edge before any aggregate VM pass exists.
            // Seed each compiler-qualified reached occurrence with the isolated observation when available,
            // otherwise a typed empty value. Neither is a prepared return commitment.
            if (previous === undefined && template.hasReturnValues
              && template.returnTypes?.length === 1 && template.callsiteId !== undefined
              && (template.occurrence === 'loop'
                ? outerDomainKey !== undefined && outerIndex !== undefined
                  && template.sourceLogicalIndex === undefined
                : (template.maximumOccurrences ?? 1) === 1)) {
              candidateSeeds.push({ occurrenceIndex: occurrence, value: (viewSeed as FunctionArgument | undefined)
                ?? getDefaultStateValue(
                  template.returnTypes[0], artifact.structs ?? artifact.stateLayout?.structs,
                ) as FunctionArgument });
            }
            occurrence += 1;
          }
          if (!unresolved && reachedCurrent.size > 0 && outerDomainKey !== undefined
            && sourceTemplate.callsiteId !== undefined) {
            const reached = reachedProducerOccurrences.get(sourceTemplate.callsiteId)
              ?? { domainKey: outerDomainKey, bySourceIteration: new Map<number, number>() };
            if (reached.domainKey !== outerDomainKey || [...reachedCurrent.keys()].some((index) =>
              reached.bySourceIteration.has(index))) {
              throw new Error('messageBus: producer source iteration has ambiguous reached occurrence');
            }
            for (const [index, reachedOccurrence] of reachedCurrent) {
              reached.bySourceIteration.set(index, reachedOccurrence);
            }
            reachedProducerOccurrences.set(sourceTemplate.callsiteId, reached);
          }
          if (!unresolved && sourceTemplate.callsiteId !== undefined) {
            for (const seed of candidateSeeds) candidateResults.add({
              callsiteId: sourceTemplate.callsiteId, sourceCallsiteId: sourceTemplate.sourceCallsiteId,
              sourceLogicalIndex: sourceTemplate.sourceLogicalIndex,
              occurrenceIndex: seed.occurrenceIndex,
            }, seed.value);
          }
          next.push(...(unresolved ? existing : selected));
        }
      }
      // Each lexical loop is one source block between scalar effects. Within it, execution order is outer
      // reach, inner-block position, inner reach, then effect position. Only complete compiler-published loop
      // coordinates may schedule all children; unsupported shapes retain the VM's fail-closed check.
      const sourceByCallsite = new Map(sources.map((source) => [source.callsiteId, source]));
      const outerStarts = new Map<number, number>();
      const innerStarts = new Map<number, number>();
      for (const source of sources) {
        const outerId = (source.iterationDomain ?? source.nestedIterationDomains?.[0])?.sourceLoopId;
        if (outerId !== undefined && source.sourceEffectOrdinal !== undefined) {
          outerStarts.set(outerId, Math.min(outerStarts.get(outerId) ?? Infinity,
            source.sourceEffectOrdinal));
        }
        const innerId = source.nestedIterationDomains?.[1]?.sourceLoopId;
        if (innerId === undefined || source.sourceEffectOrdinal === undefined) continue;
        innerStarts.set(innerId, Math.min(innerStarts.get(innerId) ?? Infinity,
          source.sourceEffectOrdinal));
      }
      const loopCounts = new Map<number, number>();
      for (const { call: child } of next) {
        if (child.topologyOuterDomainKey !== undefined && child.callsiteId !== undefined) {
          loopCounts.set(child.callsiteId, (loopCounts.get(child.callsiteId) ?? 0) + 1);
        }
      }
      const complete = next.length > 1 && loopCounts.size >= 2
        && [...loopCounts.values()].some((count) => count > 1)
        && next.every(({ call: child }) => {
          const source = sourceByCallsite.get(child.callsiteId);
          if (!source || !Number.isSafeInteger(child.sourceEffectOrdinal)
            || child.sourceEffectOrdinal !== source.sourceEffectOrdinal
            || child.callsiteId === undefined || !Number.isSafeInteger(child.occurrenceIndex)
            || child.occurrenceIndex! < 0
            || source.batchInvocations || source.opaqueReturn || source.interfaceName === '__raw__'
            || source.selectorArrayVar || source.fnPtrCall) return false;
          const outer = source.iterationDomain ?? source.nestedIterationDomains?.[0];
          if (!outer) return source.occurrence !== 'loop'
            && child.topologyOuterDomainKey === undefined;
          if (outer.sourceLoopId === undefined
            || child.topologyOuterDomainKey !== semanticJson(outer)
            || !Number.isSafeInteger(child.topologyOuterIteration)
            || child.topologyOuterIteration! < 0) return false;
          if (!source.nestedIterationDomains) return true;
          return source.nestedIterationDomains.length === 2
            && source.nestedIterationDomains[1]?.sourceLoopId !== undefined
            && Number.isSafeInteger(child.topologyInnerIteration)
            && child.topologyInnerIteration! >= 0;
        });
      if (complete) {
        const orderOf = (child: Child): [number, number, number, number, number] => {
          const source = sourceByCallsite.get(child.call.callsiteId)!;
          const outerId = (source.iterationDomain ?? source.nestedIterationDomains?.[0])?.sourceLoopId;
          const innerId = source.nestedIterationDomains?.[1]?.sourceLoopId;
          return [outerId === undefined ? child.call.sourceEffectOrdinal! : outerStarts.get(outerId)!,
            child.call.topologyOuterIteration ?? 0,
            innerId === undefined ? child.call.sourceEffectOrdinal! : innerStarts.get(innerId)!,
            child.call.topologyInnerIteration ?? 0, child.call.sourceEffectOrdinal!];
        };
        next.sort((left, right) => {
          const leftOrder = orderOf(left);
          const rightOrder = orderOf(right);
          for (let index = 0; index < leftOrder.length; index += 1) {
            if (leftOrder[index] !== rightOrder[index]) return leftOrder[index]! - rightOrder[index]!;
          }
          return (left.call.occurrenceIndex ?? 0) - (right.call.occurrenceIndex ?? 0);
        });
      }
      next.forEach(({ call: child }) => { child.topologySourceScheduleComplete = complete; });
      if (next.length !== children.length || next.some((child, index) =>
        child.previous === undefined || child.previous !== children[index].previous
        || semanticJson(child.call.args) !== semanticJson(children[index].call.args))) {
        propagated = true;
      }
      children = next;
    }
    for (const child of children) await visit(child, self, depth + 1);
  };
  await visit({ call: prepared[0], ...(ctx && { previous: 0 }) }, rootCaller, 0);
  // Results are already carried by `prepared` at their original invocation identity; never remap the old
  // numeric result table over the new DFS indices (insertion/removal would cross-wire unrelated producers).
  return { propagated, calls };
}
