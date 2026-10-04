/**
 * phase-boundary extract: SC class-body extract — resolve returning calls nested in external-call argument expressions.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  getDefaultStateValue,
  parseArrayTypeString,
  type AbiFunction,
  type ArgSource,
  type Artifact,
  type ExternalCallAbi,
  type ExternalCallExpression,
  type ExternalResultConsumerAbi,
  type StateValue,
} from '@solidcash/utils';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import { visitExternalExpressionEvaluationPath } from '../message-bus/result-evaluation-path.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { lockingBytecodeToSolidityAddressPayload, tryCashAddressToLockScript } from '../utils.js';
import {
  findDeploymentByAddressValue,
  findDeploymentByName,
  matchingDeploymentsBySolidityAddressPayload,
} from './deployment-registry.js';
import { DeferredTransitiveReturnProbeError } from './sc-discover-create-builder-transitive-external-calls.js';
import { encodeExternalReturnValues } from './external-return-encoding.js';
import {
  createGraphPlanningProducerResultContext,
  memoizeGraphPlanningProducerResult,
  type GraphPlanningProducerResultContext,
} from './graph-planning-producer-result.js';
import { artifactUsesSolidityAbi } from './solidityAbi.js';
import type { ExternalCallInfo } from './stateful-lifecycle-types.js';
import type {
  StatefulContract,
  StatefulFunctionCall,
} from './StatefulContract.js';

function isStatefulContract(value: unknown): value is StatefulContract {
  return typeof value === 'object'
    && value !== null
    && 'inner' in value
    && 'categoryId' in value
    && typeof (value as { _deriveReturnValue?: unknown })._deriveReturnValue === 'function'
    && typeof (value as { _resolveExternalArgs?: unknown })._resolveExternalArgs === 'function';
}

function addressBytes(value: string | Uint8Array): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value;
  try {
    const cashaddr = tryCashAddressToLockScript(value);
    if (cashaddr) return cashaddr;
  } catch { return undefined; }
  return /^(?:0x)?(?:[0-9a-f]{2})+$/iu.test(value)
    ? hexToBin(value.replace(/^0x/iu, '')) : undefined;
}

function solidityPayload(bytes: Uint8Array): Uint8Array | undefined {
  if (bytes.length === 20) return bytes;
  if (bytes.length === 32 && bytes.subarray(0, 12).every((byte) => byte === 0)) {
    return bytes.subarray(12);
  }
  return undefined;
}

function connectedContractMatchesAddress(contract: unknown, target: string | Uint8Array): boolean {
  if (typeof contract !== 'object' || contract === null) return false;
  const wanted = addressBytes(target);
  if (!wanted) return false;
  const connected = contract as {
    inner?: { lockingBytecode?: string };
    implementation?: { inner?: { lockingBytecode?: string } };
    proxy?: { inner?: { lockingBytecode?: string }; _logicalAddress?: string };
    _logicalAddress?: string;
    address?: string;
  };
  const identities = [
    connected.inner?.lockingBytecode,
    connected.implementation?.inner?.lockingBytecode,
    connected.proxy?.inner?.lockingBytecode,
    connected._logicalAddress,
    connected.proxy?._logicalAddress,
    connected.address,
  ];
  const payload = solidityPayload(wanted);
  const wantedHex = binToHex(wanted);
  const payloadHex = payload && binToHex(payload);
  return identities.some((identity) => {
    const bytes = identity && addressBytes(identity);
    if (!bytes) return false;
    if (binToHex(bytes) === wantedHex) return true;
    const projected = payload && lockingBytecodeToSolidityAddressPayload(bytes);
    return projected !== undefined && binToHex(projected) === payloadHex;
  });
}

export interface ResolveExternalExpressionReturnsHost {
  readonly inner: {
    artifact: Artifact;
    provider: NetworkProvider;
    lockingBytecode: string;
  };
  readonly categoryId: string;
  readonly externalRegistry: ReadonlyMap<string, StatefulContract>;
  asCallerContract(): StatefulContract;
  resolveExternalArgs(
    argSources: readonly ArgSource[] | undefined,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    state?: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
    occurrenceIndex?: number,
    stateIncludesPriorWrites?: boolean,
    executionSelfAddress?: FunctionArgument,
    executionCallerAddress?: FunctionArgument,
  ): FunctionArgument[] | undefined;
  evaluateExternalExpression(
    expression: ExternalCallExpression,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    state?: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
    occurrenceIndex?: number,
    stateIncludesPriorWrites?: boolean,
    executionSelfAddress?: FunctionArgument,
    localBindings?: ReadonlyMap<string, FunctionArgument>,
    stateLengthDeltas?: Readonly<Record<string, bigint>>,
    strictFieldAccess?: boolean,
    executionCallerAddress?: FunctionArgument,
  ): FunctionArgument | undefined;
}

export async function resolveExternalExpressionReturns(
  host: ResolveExternalExpressionReturnsHost,
  argSources: readonly ArgSource[] | undefined,
  functionArgs: FunctionArgument[],
  registryOwner: StatefulContract,
  state?: Record<string, unknown>,
  callerInputs?: readonly { type: string }[],
  executionSelfAddress?: FunctionArgument,
  producerCalls?: readonly ExternalCallAbi[],
  allowProvisional = false,
  planningContext: GraphPlanningProducerResultContext = createGraphPlanningProducerResultContext(),
  consumer?: {
    callsiteId?: number;
    resultConsumers?: readonly ExternalResultConsumerAbi[];
    lane: 'condition';
  },
  occurrenceIndex = 0,
  executionCallerAddress?: FunctionArgument,
): Promise<Map<string, FunctionArgument>> {
  const resolved = new Map<string, FunctionArgument>();
  const producerByCallsite = new Map<number, ExternalCallAbi>();
  for (const producer of producerCalls ?? []) {
    // Calls from artifacts predating stable graph identities remain usable for ordinary expression discovery.
    // A producerResult can never select one of them: that branch requires an exact published callsite below.
    if (producer.callsiteId === undefined) continue;
    if (!Number.isInteger(producer.callsiteId) || producer.callsiteId < 0) {
      throw new Error('Graph external-call metadata requires a nonnegative callsiteId for every producer.');
    }
    if (producerByCallsite.has(producer.callsiteId)) {
      throw new Error(`Graph external-call metadata has duplicate callsiteId ${producer.callsiteId}.`);
    }
    producerByCallsite.set(producer.callsiteId, producer);
  }
  const resolvingProducers = new Set<number>();
  const provisionalValues = (types: readonly string[]): FunctionArgument[] => {
    const artifact = registryOwner.inner.artifact;
    const structs = artifact.structs ?? artifact.stateLayout?.structs;
    let remainingElements = 10_000;
    const value = (type: string, ancestors = new Set<string>()): ConstructorArgument => {
      if (remainingElements <= 0) throw new Error('Provisional producer result exceeds the aggregate element limit.');
      remainingElements -= 1;
      const array = parseArrayTypeString(type);
      if (array) {
        if (array.bound === undefined) return [];
        if (!Number.isSafeInteger(array.bound) || array.bound > remainingElements) {
          throw new Error('Provisional producer result exceeds the aggregate element limit.');
        }
        return Array.from({ length: array.bound }, () => value(array.elementType, ancestors));
      }
      const struct = structs?.find((candidate) => candidate.name === type);
      if (struct) {
        if (ancestors.has(type)) throw new Error(`Circular provisional producer result type '${type}'.`);
        const next = new Set(ancestors).add(type);
        return Object.fromEntries(struct.fields.map((field) => [field.name, value(field.type, next)]));
      }
      if (type === 'string') return '';
      if (artifact.enums?.some((candidate) => candidate.name === type)) return 0n;
      return getDefaultStateValue(type) as ConstructorArgument;
    };
    return types.map((type) => value(type));
  };
  const registeredTarget = (
    interfaceName: string, target: FunctionArgument | undefined,
  ): StatefulContract | {
      forward(name: string, args: FunctionArgument[]): StatefulFunctionCall;
    } | undefined => {
    const connected = [
      (registryOwner as unknown as { _externalRegistry: Map<string, StatefulContract> })
        ._externalRegistry.get(interfaceName),
      host.externalRegistry.get(interfaceName),
    ];
    // A published target address is authoritative. An interface-name binding may supply the instance only
    // when it identifies that same address; otherwise a return probe would execute an unrelated callee.
    if (target !== undefined) {
      if (typeof target !== 'string' && !(target instanceof Uint8Array)) return undefined;
      const deployed = findDeploymentByAddressValue(host.inner.provider, target);
      if (deployed) return deployed.contract as StatefulContract;
      const targetBytes = addressBytes(target);
      const payload = targetBytes && solidityPayload(targetBytes);
      if (payload && matchingDeploymentsBySolidityAddressPayload(host.inner.provider, payload).length > 1) {
        return undefined;
      }
      return connected.find((candidate) => connectedContractMatchesAddress(candidate, target)) as StatefulContract | {
        forward(name: string, args: FunctionArgument[]): StatefulFunctionCall;
      } | undefined;
    }
    return (connected[0]
      ?? connected[1]
      ?? findDeploymentByName(host.inner.provider, interfaceName)?.contract) as StatefulContract | {
      forward(name: string, args: FunctionArgument[]): StatefulFunctionCall;
    } | undefined;
  };
  /**
   * Resolve a callee's own published external calls against the exact argument frame the probe invokes it with.
   *
   * A return probe builds its own balanced transaction on the callee, so it materializes the callee's co-spent
   * participants itself. Resolving them here is what lets that builder see the real callee instances: name-based
   * registry lookup cannot bind a call whose target is a computed address (`IERC20(input.currency)`), and an
   * unbound slot leaves every `__internal__extcall*` coordinate at its sentinel, so the callee's own identity
   * check compares the named address against an unrelated input and the probe aborts before its return band.
   *
   * Fail closed: a slot this cannot resolve stays `undefined`, which keeps the caller's established
   * placeholder/withExternalCall() behavior instead of silently binding a same-named deployment.
   */
  const calleeExternalCalls = async (
    callee: StatefulContract,
    fn: string,
    fnArgs: FunctionArgument[],
    fnInputs: readonly { name: string; type: string }[] | undefined,
    callerState: Record<string, unknown> | undefined,
  ): Promise<ExternalCallInfo[] | undefined> => {
    const abi = callee._resolveCallAbi(fn, fnArgs);
    const published = abi?.externalCalls;
    if (!published?.length) return undefined;
    const selfAddress = hexToBin(callee.inner.lockingBytecode);
    const resolvedCalls: ExternalCallInfo[] = [];
    // The call frame's own argument sources read the CALLEE's state (`input.currency`, an immutable address the
    // constructor pinned). `callerState` describes the invoking owner and is only a fallback for the shapes that
    // legitimately read through it; the callee's authenticated snapshot is the authority.
    let calleeState: Record<string, unknown> | undefined;
    if (published.some((ec) => ec.addressStateVar !== undefined
      || ec.addressSource?.kind === 'expression')) {
      try {
        calleeState = await callee.getState() as Record<string, unknown>;
      } catch {
        calleeState = undefined;
      }
    }
    const fnState = { ...(callerState ?? {}), ...(calleeState ?? {}) };
    for (const ec of published) {
      // A target the compiler pinned by state or literal never appears in `addressSource`; read it from the
      // callee's own authenticated state so both provenance forms resolve to the same deployment.
      const resolvedTarget = ec.addressSource
        ? callee._resolveExternalArgs(
          [ec.addressSource], fnArgs, callee.inner.artifact, fnState, fnInputs, resolved,
          0, false, selfAddress,
        )?.[0]
        : ec.addressStateVar !== undefined
          ? fnState?.[ec.addressStateVar] as FunctionArgument | undefined
          : ec.addressLiteral;
      if ((ec.addressSource || ec.addressStateVar !== undefined || ec.addressLiteral !== undefined)
        && resolvedTarget === undefined) return undefined;
      const child = registeredTarget(ec.interfaceName, resolvedTarget);
      // One unresolvable participant makes the whole frame unrepresentable: a partial list would leave that
      // slot's coordinates at the sentinel AND shift every later participant's physical block.
      if (!child || !isStatefulContract(child)) return undefined;
      // A low-level callsite publishes the decoded callee under a runtime selector instead of a source
      // interface name, so its argument frame is the raw one and its function name has to be recovered from
      // the callee's own ABI. Binding the wrong callee here would silently redirect the probe's co-spend.
      const rawFunctionName = ec.interfaceName === '__raw__'
        ? ec.rawFunctionName ?? (child.inner.artifact.abi as readonly AbiFunction[])
          .find((candidate) => ec.rawSelector !== undefined
            && candidate.selector?.toLowerCase() === ec.rawSelector.toLowerCase())?.name
        : undefined;
      if (ec.interfaceName === '__raw__' && rawFunctionName === undefined) return undefined;
      const sources = ec.rawArgSources ?? ec.argSources;
      const childArgs = callee._resolveExternalArgs(
        sources, fnArgs, callee.inner.artifact, fnState, fnInputs, resolved,
        0, false, selfAddress,
      );
      if (!childArgs) return undefined;
      resolvedCalls.push({
        externalContract: child,
        functionName: rawFunctionName ?? ec.functionName,
        args: childArgs,
      });
    }
    return resolvedCalls;
  };
  const derive = async (
    interfaceName: string,
    functionName: string,
    values: FunctionArgument[],
    target: FunctionArgument | undefined,
    returnTypes: readonly string[] | undefined,
  ): Promise<FunctionArgument | undefined> => {
    const registered = registeredTarget(interfaceName, target);
    if (!registered) return undefined;
    try {
      // The frame that MAKES this call is the callee's caller: its locking bytecode and category are exactly the
      // identity the compiler resolves `msg.sender` from, and the probe built below is reused by the composition.
      const callerLock = hexToBin(host.inner.lockingBytecode);
      const debugIdentity = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1';
      const annotate = <T>(call: T): T => {
        const withIdentity = (call as unknown as {
          withCallerIdentity?: (lockingBytecode: Uint8Array, categoryId?: string) => unknown;
        }).withCallerIdentity;
        if (debugIdentity) {
          // An annotation that silently misses the call object is indistinguishable from no annotation at all:
          // record whether the returned value actually exposes `withCallerIdentity` (and what it is).
          console.error('derive-annotate', JSON.stringify({
            functionName,
            ctor: (call as unknown as { constructor?: { name?: string } } | undefined)?.constructor?.name,
            hasMethod: typeof withIdentity === 'function',
            lock: binToHex(callerLock).slice(0, 24),
          }));
        }
        if (typeof withIdentity === 'function') withIdentity.call(call, callerLock, host.categoryId);
        return call;
      };
      if (debugIdentity) {
        console.error('derive-branch', JSON.stringify({
          interfaceName,
          functionName,
          isObject: typeof registered === 'object' && registered !== null,
          hasProxy: typeof registered === 'object' && 'proxy' in (registered as object),
          hasForward: typeof registered === 'object' && 'forward' in (registered as object),
          ctor: (registered as unknown as { constructor?: { name?: string } } | undefined)?.constructor?.name,
        }));
      }
      if (typeof registered === 'object' && 'proxy' in registered) {
        const publicMethod = (registered as Record<string, unknown>)[functionName];
        if (typeof publicMethod === 'function') {
          return await annotate((publicMethod as (...args: FunctionArgument[]) => Promise<FunctionArgument>)(...values));
        }
      }
      if (typeof registered === 'object' && 'forward' in registered
        && typeof (registered as { forward?: unknown }).forward === 'function') {
        return await annotate((registered as {
          forward(name: string, args: FunctionArgument[]): StatefulFunctionCall;
        }).forward(functionName, values)).staticCall() as FunctionArgument;
      }
      const callee = registered as StatefulContract;
      const calleeAbi = callee._resolveCallAbi(functionName, values);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
        // Pair with the callee's own `derive-return-value-entry` record: if this fires with a lock while the
        // callee logs `hasCallerLock: false`, the two are in different code copies (stale bundle), not the same
        // call.
        const lock = executionSelfAddress instanceof Uint8Array
          ? executionSelfAddress : hexToBin(host.inner.lockingBytecode);
        console.error('derive-call-identity', JSON.stringify({
          callee: callee.inner.artifact.contractName, functionName,
          caller: host.inner.artifact.contractName,
          lock: binToHex(lock).slice(0, 24), category: host.categoryId.slice(0, 24),
        }));
      }
      return await callee._deriveReturnValue(
        functionName, values, undefined, calleeAbi,
        await calleeExternalCalls(callee, functionName, values, calleeAbi?.inputs, state),
        // `executionSelfAddress` is THIS frame's identity, i.e. the contract that calls `callee`. The probe it
        // launches materializes the callee frame the composition reuses, so the callee's `msg.sender`-keyed
        // mapping slots must be pinned against that identity - not against the transaction origin.
        // The frame that MAKES the call is the callee's caller, whether or not the caller passed its own
        // identity in: this method runs on that frame, so its locking bytecode is exactly the value the
        // compiler resolves `msg.sender` from. Leaving it undefined keyed a nested probe by the
        // transaction origin (measured: the `transferFrom` probe pinned `4038d902…` - signer-keyed -
        // while the transaction addresses `00fe98d8…`).
        executionSelfAddress instanceof Uint8Array
          ? executionSelfAddress : hexToBin(host.inner.lockingBytecode),
        host.categoryId,
        host.asCallerContract(),
      ) as FunctionArgument;
    } catch (error) {
      if (!allowProvisional || !(error instanceof Error)
        || (!(error instanceof DeferredTransitiveReturnProbeError)
          && !error.message.includes('Could not derive the return value'))) throw error;
      if (!returnTypes?.length) return 0n;
      // Planning may need an aggregate's elements before its state-dependent producer can execute.
      // Preserve the published type shape; these seeds still cannot satisfy an exact result request.
      const placeholders = provisionalValues(returnTypes);
      return placeholders.length === 1 ? placeholders[0] : placeholders as unknown as FunctionArgument;
    }
  };
  const resolveProducer = async (producer: ExternalCallAbi): Promise<FunctionArgument | undefined> => {
    const callsiteId = producer.callsiteId!;
    if (resolvingProducers.has(callsiteId)) {
      throw new Error(`Graph producer callsite ${callsiteId} has a cyclic result dependency.`);
    }
    resolvingProducers.add(callsiteId);
    try {
      const sources = producer.rawArgSources ?? producer.argSources ?? [];
      for (const source of sources) {
        if (source.kind === 'expression') await visit(source.expression);
      }
      if (producer.addressSource?.kind === 'expression') await visit(producer.addressSource.expression);
      const values = host.resolveExternalArgs(
        sources, functionArgs, registryOwner.inner.artifact, state, callerInputs, resolved,
        occurrenceIndex, false, executionSelfAddress,
        executionCallerAddress,
      );
      if (!values) return undefined;
      const target = producer.addressSource
        ? host.resolveExternalArgs(
          [producer.addressSource], functionArgs, registryOwner.inner.artifact, state, callerInputs, resolved,
          occurrenceIndex, false, executionSelfAddress,
          executionCallerAddress,
        )?.[0]
        : producer.addressStateVar !== undefined
          ? state?.[producer.addressStateVar] as FunctionArgument | undefined
          : producer.addressLiteral;
      if ((producer.addressSource || producer.addressStateVar !== undefined
        || producer.addressLiteral !== undefined) && target === undefined) return undefined;
      const rawTarget = producer.interfaceName === '__raw__'
        ? registeredTarget(producer.interfaceName, target) : undefined;
      const rawExecutionTarget = rawTarget && typeof rawTarget === 'object' && 'proxy' in rawTarget
        ? (rawTarget as unknown as { implementation: StatefulContract }).implementation
        : isStatefulContract(rawTarget) ? rawTarget : undefined;
      const rawFunction = rawExecutionTarget
        ? (rawExecutionTarget.inner.artifact.abi as readonly AbiFunction[]).find((candidate) =>
          producer.rawFunctionName !== undefined
            ? candidate.name === producer.rawFunctionName
            : producer.rawSelector !== undefined && candidate.selector === producer.rawSelector)
        : undefined;
      if (producer.interfaceName === '__raw__' && !rawFunction) return undefined;
      return await memoizeGraphPlanningProducerResult(
        planningContext,
        callsiteId,
        values,
        // This cache is scoped to one compiler function and immutable state snapshot. The published callsite
        // authenticates its target expression; arguments and provisional quality distinguish runtime seeds.
        undefined,
        allowProvisional,
        async () => {
          if (!rawFunction || !rawExecutionTarget) {
            return derive(
              producer.interfaceName, producer.functionName, values, target, producer.returnTypes,
            );
          }
          const returnTypes = (rawFunction.outputs ?? []).map((output) => output.type);
          if (returnTypes.length === 0) return new Uint8Array();
          const value = await derive(
            producer.interfaceName, rawFunction.name, values, target, returnTypes,
          );
          if (value === undefined) return undefined;
          const components = returnTypes.length === 1 ? [value]
            : Array.isArray(value) ? value : undefined;
          if (!components || components.length !== returnTypes.length) return undefined;
          return encodeExternalReturnValues(
            components as StateValue[],
            returnTypes,
            rawExecutionTarget.inner.artifact.structs ?? rawExecutionTarget.inner.artifact.stateLayout?.structs,
            artifactUsesSolidityAbi(rawExecutionTarget.inner.artifact),
            rawExecutionTarget.inner.artifact.enums,
          );
        },
      );
    } finally {
      resolvingProducers.delete(callsiteId);
    }
  };
  const visitNode = async (expression: ExternalCallExpression): Promise<void> => {
    if (expression.kind === 'producerResult' && expression.callsiteId !== undefined) {
      const producer = producerByCallsite.get(expression.callsiteId);
      const resultIndex = expression.resultIndex;
      if (!producer || resultIndex === undefined
        || !Number.isInteger(resultIndex) || resultIndex < 0
        || resultIndex >= (producer.returnTypes?.length ?? 0)) {
        throw new Error(
          `Graph producerResult ${expression.callsiteId}:${String(resultIndex)} does not identify one published result.`,
        );
      }
      if (consumer?.resultConsumers && consumer.callsiteId !== undefined) {
        const lanes = consumer.resultConsumers.filter((candidate) =>
          candidate.consumerCallsiteId === consumer.callsiteId
          && candidate.condition === true
          && candidate.producerCallsiteId === expression.callsiteId
          && (candidate.resultIndex === undefined || candidate.resultIndex === resultIndex));
        if (lanes.length !== 1) {
          throw new Error(
            `Graph producerResult ${expression.callsiteId}:${resultIndex} does not identify exactly one `
            + `published consumer condition lane ${consumer.callsiteId}.`,
          );
        }
      }
      const result = await resolveProducer(producer);
      const selected = (producer.returnTypes?.length ?? 0) === 1
        ? result : Array.isArray(result) ? result[resultIndex] as FunctionArgument : undefined;
      if (selected !== undefined) resolved.set(JSON.stringify(expression), selected);
      return;
    }
    if (expression.kind !== 'externalCall' || !expression.name) return;
    const publishedProducer = expression.callsiteId === undefined
      ? undefined : producerByCallsite.get(expression.callsiteId);
    if (publishedProducer) {
      const value = await resolveProducer(publishedProducer);
      if (value !== undefined) resolved.set(JSON.stringify(expression), value);
      return;
    }
    const separator = expression.name.indexOf('.');
    if (separator < 1 || separator === expression.name.length - 1) return;
    const interfaceName = expression.name.slice(0, separator);
    const functionName = expression.name.slice(separator + 1);
    const values = (expression.args ?? []).map((argument) => host.evaluateExternalExpression(
      argument, functionArgs, registryOwner.inner.artifact, state, callerInputs, resolved,
      occurrenceIndex, false, executionSelfAddress,
      undefined, undefined, false, executionCallerAddress,
    ));
    if (values.some((value) => value === undefined)) return;
    const target = expression.target && host.evaluateExternalExpression(
      expression.target, functionArgs, registryOwner.inner.artifact, state, callerInputs, resolved,
      occurrenceIndex, false, executionSelfAddress,
      undefined, undefined, false, executionCallerAddress,
    );
    if (expression.target && target === undefined) return;
    const value = await derive(
      interfaceName, functionName, values as FunctionArgument[], target,
      expression.type ? [expression.type] : undefined,
    );
    if (value !== undefined) resolved.set(JSON.stringify(expression), value);
  };
  const visit = async (expression: ExternalCallExpression | undefined): Promise<void> => {
    if (!expression) return;
    await visitExternalExpressionEvaluationPath(expression, visitNode, (candidate) => host.evaluateExternalExpression(
      candidate, functionArgs, registryOwner.inner.artifact, state, callerInputs, resolved,
      occurrenceIndex, false, executionSelfAddress,
      undefined, undefined, false, executionCallerAddress,
    ));
  };
  for (const source of argSources ?? []) await visit(source.expression);
  return resolved;
}
