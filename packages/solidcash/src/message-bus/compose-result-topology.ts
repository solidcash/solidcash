import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  decodePushdataValue, getDefaultStateValue, scriptToBytecode,
  type ArgSource, type Artifact, type ExternalCallAbi, type ExternalCallExpression,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import {
  findDeploymentByAddressValue, registeredAddressValueLockingBytecode,
} from '../stateful/deployment-registry.js';
import { externalReturnsForCallsites } from '../stateful/external-returns-for-callsites.js';
import { externalCallIterationIndices } from '../stateful/external-call-iteration-domain.js';
import { hydrateExternalPredicateState } from '../stateful/sc-hydrate-external-predicate-state.js';
import { evaluateExternalExpression } from '../stateful/sc-evaluate-external-expression.js';
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
    const candidateResults = new Map<number, FunctionArgument>();
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
      const returnsFor = (argSources: readonly ArgSource[], condition?: ExternalCallAbi):
      Map<string, FunctionArgument> => externalReturnsForCallsites(argSources, childResults, sources,
        condition?.callsiteId === undefined ? undefined : {
          callsiteId: condition.callsiteId, resultConsumers: fn.resultConsumers, lane: 'condition',
        });
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
        for (const template of templates) {
          const existing = existingSite.filter((child) => (
            child.previous === undefined
              ? child.call.sourceLogicalIndex ?? child.call.batchLogicalIndex
              : ctx?.plan.invocations[child.previous]?.sourceLogicalIndex
                ?? child.call.sourceLogicalIndex ?? child.call.batchLogicalIndex
          ) === template.sourceLogicalIndex);
          if (previous !== undefined && ctx !== undefined && !hasChangedDependency(
            [template.condition, template.iterationDomain, template.addressSource], childResults,
            ctx.descriptors[previous].args, call.args,
          )) {
            // Argument propagation already refreshed existing rows. A result unrelated to this edge's
            // reachability must not reinterpret an independently prepared loop or its occurrence domain.
            next.push(...existing);
            continue;
          }
          let iterations = [0];
          if (template.occurrence === 'loop') {
            const domain = template.iterationDomain;
            if (!domain) throw new Error('messageBus: result-dependent loop has no compiler iteration domain');
            const expressions = [domain.initialValue, domain.stepValue, domain.continueCondition];
            const returns = returnsFor(expressions.map((expression) => ({ kind: 'expression', expression })));
            await hydrate(expressions, [0], returns);
            // Missing producer results are not zero/false. Defer this callsite, then let VM return discovery
            // supply the value on the next graph epoch. Invalid resolved domains still fail closed.
            let unresolved = false;
            try {
              iterations = externalCallIterationIndices(domain, (expression, bindings) => {
                const value = evaluate(expression, 0, returns, bindings);
                if (value === undefined) unresolved = true;
                return value;
              });
            } catch (error) {
              if (!unresolved) throw error;
              next.push(...existing);
              continue;
            }
          }
          const selected: Child[] = [];
          let unresolved = false;
          let occurrence = 0;
          for (const iteration of iterations) {
            if (template.condition) {
              const returns = returnsFor([{ kind: 'expression', expression: template.condition }], template);
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
            const returns = returnsFor([...argSources, ...addressSources]);
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
                snapshot, fn.inputs, externalReturnsForCallsites(argSources, updated, sources),
                iteration, false, self, incoming);
              return rawPayload && resolved
                ? decodeCanonicalRawInvocation(childArtifact, resolved[0]).args : resolved;
            };
            if (prior && prior.call.contract === contract && prior.call.selector === childFn.selector
              && prior.call.executor === executor) {
              const rebuilt = rebuildPreparedInvocation(prior.call, childArgs, undefined);
              rebuilt.resolveArgsFromResults = resolveArgsFromResults;
              selected.push({ call: rebuilt, previous: prior.previous });
              occurrence += 1;
              continue;
            }
            const child: Prepared = {
              contract, functionName: childFn.name, selector: childFn.selector, args: childArgs,
              callsiteId: template.callsiteId, sourceCallsiteId: template.sourceCallsiteId,
              occurrenceIndex: occurrence, sourceLogicalIndex: template.sourceLogicalIndex,
              sourceEffectOrdinal: template.sourceEffectOrdinal,
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
            selected.push({ call: child });
            // A newly discovered producer may feed a mandatory later edge before any aggregate VM pass exists.
            // Seed only this in-memory candidate topology with a typed empty result; never publish it as a
            // prepared return commitment. The composer must replace it with the observed producer result,
            // rebuild the graph, and pass the complete transaction VM before admission.
            if (previous === undefined && template.occurrence !== 'loop' && template.hasReturnValues
              && template.returnTypes?.length === 1 && template.callsiteId !== undefined
              && (template.maximumOccurrences ?? 1) === 1) {
              candidateResults.set(template.callsiteId, getDefaultStateValue(
                template.returnTypes[0], artifact.structs ?? artifact.stateLayout?.structs,
              ) as FunctionArgument);
            }
            occurrence += 1;
          }
          next.push(...(unresolved ? existing : selected));
        }
      }
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
