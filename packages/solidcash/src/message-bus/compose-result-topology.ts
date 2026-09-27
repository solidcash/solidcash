import { binToHex, hexToBin } from '@bitauth/libauth';
import type { ArgSource, ExternalCallAbi, ExternalCallExpression } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
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
  const resultsByParent = decodeResultsByParent(ctx, results);
  const childrenByParent = new Map<number, Child[]>();
  for (const invocation of ctx.plan.invocations) {
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
    const childResults = previous === undefined ? new Map<number, FunctionArgument>()
      : resultsByParent.get(previous) ?? new Map<number, FunctionArgument>();
    const self = artifact.messageBus?.route.inputs.some(
      (input) => input.name === '__internal__graphSelfIdentityInput',
    ) ? addressToLockScript(call.contract.target) : hexToBin(call.contract.inner.lockingBytecode);
    const argsChanged = previous !== undefined
      && semanticJson(call.args) !== semanticJson(ctx.descriptors[previous].args);
    if (fn?.externalCalls?.length && (childResults.size > 0 || argsChanged || previous === undefined)) {
      const sources = fn.externalCalls;
      const args = projectMessageBusHandlerArguments(artifact, fn.name, fn.selector, call.args);
      let state = { ...await ctx.stateOf(call.contract) };
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
        const existingSite = children.filter((child) => child.call.callsiteId === source.callsiteId);
        const templates = source.batchInvocations?.map((row) => ({
          ...source, ...row, argSources: row.argSources, rawArgSources: undefined,
          sourceCallsiteId: row.sourceCallsiteId, sourceLogicalIndex: row.logicalIndex,
          selectedSelector: row.selector,
        })) ?? [{ ...source, sourceCallsiteId: source.callsiteId,
          sourceLogicalIndex: undefined, selectedSelector: source.rawSelector }];
        for (const template of templates) {
          const existing = existingSite.filter((child) =>
            (child.call.sourceLogicalIndex ?? child.call.batchLogicalIndex) === template.sourceLogicalIndex);
          if (previous !== undefined && !hasChangedDependency(
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
            const prior = existing.find((child) =>
              (child.call.occurrenceIndex ?? child.call.batchOccurrenceIndex ?? 0) === reachedOccurrence);
            const argSources = template.rawArgSources ?? template.argSources ?? [];
            const addressSources = template.addressSource ? [template.addressSource] : [];
            const returns = returnsFor([...argSources, ...addressSources]);
            await hydrate([...argSources, ...addressSources].map((argSource) =>
              ({ kind: 'source', source: argSource })), [iteration], returns);
            const childArgs = logical._resolveExternalArgs(argSources, [...args], artifact, state, fn.inputs,
              returns, iteration, false, self, incoming);
            if (!childArgs) { unresolved = true; break; }
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
            const childFn = template.selectedSelector
              ? childArtifact.abi.find((candidate) => candidate.selector === template.selectedSelector)
              : resolveMessageBusAbiFunction(childArtifact, template.rawFunctionName ?? template.functionName);
            if (!childFn?.selector) throw new Error('messageBus: newly reached call has no exact ABI selector');
            const targetLock = address === undefined ? undefined
              : registeredAddressValueLockingBytecode(provider, address) ?? tryCashAddressToLockScript(address);
            const snapshot = state;
            const resolveArgsFromResults: Prepared['resolveArgsFromResults'] = (updated, frame) =>
              logical._resolveExternalArgs(argSources, [...(frame ?? args)], artifact, snapshot, fn.inputs,
                externalReturnsForCallsites(argSources, updated, sources), iteration, false, self, incoming);
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
  await visit({ call: prepared[0], previous: 0 }, ctx.rootCaller, 0);
  // Results are already carried by `prepared` at their original invocation identity; never remap the old
  // numeric result table over the new DFS indices (insertion/removal would cross-wire unrelated producers).
  return { propagated, calls };
}
