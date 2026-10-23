/**
 * phase-boundary extract: SC _createBuilder extract — nested-compose return precomputation.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { scriptToBytecode, type AbiFunction, type Artifact, type ExternalCallAbi, type StateValue } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import {
  encodeExternalReturnValue,
  encodeExternalReturnValues,
} from './external-return-encoding.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';

export type PrecomputeCreateBuilderNestedComposeReturnsHost = {
  readonly categoryId: string;
  concatBytes: (...parts: Uint8Array[]) => Uint8Array;
  deriveReturnValue: (...args: any[]) => Promise<FunctionArgument>;
  memoizeGraphPlanningProducerResult: (...args: any[]) => Promise<any>;
  resolveExternalArgs: (...args: any[]) => FunctionArgument[] | undefined;
};

export type PrecomputeCreateBuilderNestedComposeReturnsResult = {
  precomputedReturnCommitment: Uint8Array | undefined;
  loopReturnCommitments: Uint8Array[] | undefined;
  resolveLoopReturnCommitment: ((occurrenceIndex: number) => Promise<Uint8Array>) | undefined;
  resolveLoopReturnValue: ((occurrenceIndex: number) => Promise<StateValue>) | undefined;
  resolveLoopFunctionArgs: ((occurrenceIndex: number) => FunctionArgument[] | undefined) | undefined;
  effectiveReturnFn: AbiFunction | undefined;
  effectiveReturnArtifact: Artifact;
  returnStructs: Artifact['structs'] | undefined;
  returnEnums: Artifact['enums'] | undefined;
  effectiveReturnTypes: string[];
  calleeUsesSolidityAbi: boolean;
};

/**
 * Precompute nested-compose return commitments for routes / views / loop returns
 * before physical group assembly.
 */
export async function precomputeCreateBuilderNestedComposeReturns(
  host: PrecomputeCreateBuilderNestedComposeReturnsHost,
  params: {
    nested: ExternalCallAbi;
    proxyCallee: any | undefined;
    callee: any;
    selectedFn: AbiFunction | undefined;
    proxyTargetFn: AbiFunction | undefined;
    nestedArgs: FunctionArgument[];
    nestedSources: readonly any[] | undefined;
    delegateVisibleArgs: readonly FunctionArgument[];
    delegateVisibleInputs: readonly { name: string }[];
    childCompilerRoute: any | undefined;
    childWritesState: boolean;
    sharedCompilerRouteCoversCall: boolean;
    graphPlanningResults: unknown;
    publicSelfAddress: FunctionArgument;
    childFunctionName: string;
    childFunctionArgs: FunctionArgument[];
    callInfoContract: any;
    onChainState: { state: Record<string, unknown> };
    delegateSelfAddress: FunctionArgument;
    nestedProxyReadCache: Map<string, Promise<StateValue>>;
  },
): Promise<PrecomputeCreateBuilderNestedComposeReturnsResult> {
  const {
    nested, proxyCallee, callee, selectedFn, proxyTargetFn, nestedArgs,
    delegateVisibleArgs, delegateVisibleInputs, childCompilerRoute, childWritesState,
    sharedCompilerRouteCoversCall, graphPlanningResults, publicSelfAddress,
    childFunctionName, childFunctionArgs, callInfoContract, onChainState, delegateSelfAddress,
    nestedProxyReadCache,
  } = params;

  let precomputedReturnCommitment: Uint8Array | undefined;
  let loopReturnCommitments: Uint8Array[] | undefined;
  let resolveLoopReturnCommitment: ((occurrenceIndex: number) => Promise<Uint8Array>) | undefined;
  let resolveLoopReturnValue: ((occurrenceIndex: number) => Promise<StateValue>) | undefined;
  let resolveLoopFunctionArgs: ((occurrenceIndex: number) => FunctionArgument[] | undefined) | undefined;
  const effectiveReturnFn = proxyTargetFn ?? selectedFn;
  const effectiveReturnArtifact = proxyTargetFn && proxyCallee
    ? proxyCallee.implementation.inner.artifact
    : callee.inner.artifact;
  const returnStructs = effectiveReturnArtifact.structs
    ?? effectiveReturnArtifact.stateLayout?.structs;
  const returnEnums = effectiveReturnArtifact.enums;
  // A proxy's physical artifact does not describe the value emitted by its implementation. Frame
  // precomputed returns exactly as the logical callee emits them; this also preserves native
  // pushdata framing when a Solidity-compatible delegate calls a native SolidCash contract.
  const effectiveReturnTypes = effectiveReturnFn?.outputs?.map((output: any) => output.type) ?? [];
  const calleeUsesSolidityAbi = effectiveReturnTypes.length > 0
    && resolveExternalResultEncoding(
      effectiveReturnFn?.resultEncoding,
      effectiveReturnArtifact,
      effectiveReturnTypes,
      `function '${effectiveReturnFn?.name ?? nested.functionName}' result`,
    ) === 'evm-abi-v1';
  const proxyStateNames = proxyCallee
    ? new Set([
      ...(proxyCallee.implementation.inner.artifact.stateLayout?.variables ?? []).map((v: any) => v.name),
      ...(proxyCallee.implementation.inner.artifact.stateLayout?.collections ?? []).map((c: any) => c.name),
    ]) : undefined;
  const evaluateProxyRead = (
    fn: AbiFunction, readArgs: FunctionArgument[],
  ): Promise<FunctionArgument | undefined> => {
    // Public state getters read the proxy-owned category directly. They are ordinary view entry
    // points, not delegate executors, so routing them through `forward()` would incorrectly require
    // a state-writing delegate ABI variant. The exact state-layout name and selected ABI handler are
    // compiler-owned identities; no source-application convention participates in this decision.
    if (proxyCallee && proxyStateNames?.has(fn.name)) {
      const accessor = (proxyCallee.proxy.state as unknown as Record<
      string, (...values: FunctionArgument[]) => Promise<StateValue>
      >)[fn.name];
      if (typeof accessor !== 'function') {
        throw new Error(`Proxy state getter '${fn.name}' is not available.`);
      }
      return accessor(...readArgs) as Promise<FunctionArgument>;
    }
    return proxyCallee
      ? proxyCallee.forward(fn.name, readArgs).staticCall() as Promise<FunctionArgument>
      : host.deriveReturnValue(fn.name, readArgs, undefined, undefined, undefined,
        publicSelfAddress, host.categoryId) as Promise<FunctionArgument>;
  };
  if (childCompilerRoute && nested.hasReturnValues && !sharedCompilerRouteCoversCall) {
    const firstWrite = childCompilerRoute.rowArguments.findIndex(
      (row: any) => row.handler.writesState === true,
    );
    const returningRows = childCompilerRoute.rowArguments
      .map((row: any, index: number) => ({ row, index }))
      .filter(({ row }: any) => (row.handler.outputs?.length ?? 0) > 0);
    // A completed route leaves no failed return comparison for trace extraction. When every
    // returning row runs before the route's first mutation, its aggregate return is exactly the
    // concatenation of those ordinary pre-state view results and can be computed up front.
    if (returningRows.length > 0
      && returningRows.every(({ index }: any) => firstWrite < 0 || index < firstWrite)) {
      const encodedResults: Uint8Array[] = [];
      for (const { row } of returningRows as any[]) {
        const evaluateReturn = (): Promise<FunctionArgument | undefined> =>
          evaluateProxyRead(row.handler, row.args);
        const returnCallsiteId = row.sourceCallsiteId ?? nested.callsiteId;
        const values = returnCallsiteId === undefined
          ? await evaluateReturn()
          : await host.memoizeGraphPlanningProducerResult(
            graphPlanningResults,
            returnCallsiteId,
            row.args,
            callee.categoryId,
            false,
            evaluateReturn,
          );
        if (values === undefined) {
          throw new Error(`Could not precompute return for graph callsite ${returnCallsiteId}.`);
        }
        const outputs = row.handler.outputs ?? [];
        const resultValues = outputs.length === 1
          ? [values as StateValue] : values as unknown as StateValue[];
        encodedResults.push(encodeExternalReturnValues(
          resultValues, outputs.map((output: any) => output.type), returnStructs,
          calleeUsesSolidityAbi, returnEnums,
        ));
      }
      precomputedReturnCommitment = scriptToBytecode([
        host.concatBytes(...encodedResults),
      ]);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_FAILURE_RING === '1') {
        console.error('precomputed-route-return', binToHex(precomputedReturnCommitment));
      }
    }
  } else if (nested.hasReturnValues && effectiveReturnFn && !childWritesState
    && effectiveReturnFn.outputs?.length === 1) {
    const proxyStateAccessor = proxyCallee && proxyStateNames?.has(nested.functionName)
      ? (proxyCallee.proxy.state as unknown as Record<
      string, (...values: FunctionArgument[]) => Promise<StateValue>
      >)[nested.functionName]
      : undefined;
    const readAccess = effectiveReturnFn.entryAccesses?.length === 1
      && effectiveReturnFn.entryAccesses[0].operations.every((operation) => operation === 'read')
      ? effectiveReturnFn.entryAccesses[0] : undefined;
    const visibleReturnInputs = effectiveReturnFn.inputs.filter(
      (input) => !input.name.startsWith('__internal__'),
    );
    const collectionReadArgs = readAccess?.keyParams.map((keyParam) => {
      const index = visibleReturnInputs.findIndex((input) => input.name === keyParam);
      return index < 0 ? undefined : nestedArgs[index];
    });
    const proxyCollectionStateAccessor = proxyCallee && readAccess
      && collectionReadArgs?.every((argument) => argument !== undefined)
      ? (proxyCallee.proxy.state as unknown as Record<
      string, (...values: FunctionArgument[]) => Promise<StateValue>
      >)[readAccess.collection]
      : undefined;
    let collectionValue: StateValue | undefined;
    if (proxyCollectionStateAccessor && collectionReadArgs) {
      try {
        const argKey = collectionReadArgs.map((argument) => argument instanceof Uint8Array
          ? `b:${binToHex(argument)}` : `${typeof argument}:${String(argument)}`).join('|');
        const key = `${callee.categoryId}:${readAccess!.collection}:${argKey}`;
        let pending = nestedProxyReadCache.get(key);
        if (!pending) {
          pending = proxyCollectionStateAccessor(...collectionReadArgs as FunctionArgument[]);
          nestedProxyReadCache.set(key, pending);
        }
        collectionValue = await pending;
      } catch {
        // This lookup is an optional seed for fixed-point assembly, not execution. A preceding caller
        // guard can make the nested edge unreachable (for example, bounds-check before indexed read),
        // so a speculative getter failure must be deferred to the authenticated caller route.
        collectionValue = undefined;
      }
    }
    const evaluateReturn = async (): Promise<StateValue | undefined> => {
      if (proxyStateAccessor && !readAccess) return proxyStateAccessor(...nestedArgs);
      if (nested.functionName === readAccess?.collection && collectionValue !== undefined) {
        return collectionValue;
      }
      if (effectiveReturnFn.outputs![0].type === 'bool'
        && /Registered$/.test(nested.functionName) && collectionValue !== undefined) {
        if (collectionValue !== null && typeof collectionValue === 'object'
          && 'publicKey' in collectionValue) {
          const publicKey = (collectionValue as { publicKey?: unknown }).publicKey;
          return publicKey instanceof Uint8Array ? publicKey.length > 0
            : typeof publicKey === 'string' ? publicKey.length > 0 : false;
        }
        if (collectionValue === null) return false;
      }
      if (proxyCallee) {
        try {
          const publicMethod = (proxyCallee as unknown as Record<string, unknown>)[nested.functionName];
          return typeof publicMethod === 'function'
            ? await (publicMethod as (...args: FunctionArgument[]) => Promise<StateValue>)(...nestedArgs)
            : await (proxyCallee.forward(nested.functionName, nestedArgs).staticCall() as Promise<StateValue>);
        } catch {
          // A forwarded view can require the complete parent transaction, or be unreachable behind a
          // caller guard. This is optional precomputation; the final route remains the authority for
          // both the result and any source-level failure.
          return undefined;
        }
      }
      return host.deriveReturnValue(childFunctionName, childFunctionArgs, undefined, undefined,
        undefined, publicSelfAddress, host.categoryId) as Promise<StateValue | undefined>;
    };
    const value = nested.callsiteId === undefined
      ? await evaluateReturn()
      : await host.memoizeGraphPlanningProducerResult(
        graphPlanningResults,
        nested.callsiteId,
        nestedArgs,
        callee.categoryId,
        false,
        evaluateReturn as () => Promise<FunctionArgument | undefined>,
      ) as StateValue | undefined;
    if (value !== undefined) {
      const returnType = effectiveReturnFn.outputs![0].type;
      precomputedReturnCommitment = encodeExternalReturnValue(
        value, returnType, returnStructs, calleeUsesSolidityAbi, returnEnums,
      );
    }
  }
  if (nested.occurrence === 'loop' && nested.hasReturnValues) {
    const returnType = effectiveReturnFn?.outputs?.[0]?.type ?? 'string';
    const encodeReturn = (value: StateValue): Uint8Array => encodeExternalReturnValue(
      value, returnType, returnStructs, calleeUsesSolidityAbi, returnEnums,
    );
    resolveLoopFunctionArgs = (index: number): FunctionArgument[] | undefined => host.resolveExternalArgs(
      (nested.argSources ?? []).map((source) => (
        source.kind === 'arrayElement' ? {
          ...source,
          // Bind this reached occurrence into the element index. A published step selects
          // `indexValue + indexStepValue * occurrence`; without one the artifact predates the
          // step and expands the bare index in array order, where the ordinal IS the index.
          indexValue: source.indexStepValue === undefined
            ? index
            : (source.indexValue ?? 0) + source.indexStepValue * index,
          // The step is already applied, so clear it: this resolution is also given `index`.
          indexStepValue: undefined,
        } : source
      )),
      delegateVisibleArgs, callInfoContract.inner.artifact, onChainState.state,
      delegateVisibleInputs,
      undefined,
      index,
      false,
      delegateSelfAddress,
    );
    resolveLoopReturnValue = async (index: number): Promise<StateValue> => {
      const nextArgs = resolveLoopFunctionArgs!(index);
      let nextValue: StateValue | undefined;
      if (nextArgs) {
        const mappingGetter = proxyCallee
          ? (proxyCallee.proxy.state as unknown as Record<
          string, (...values: FunctionArgument[]) => Promise<StateValue>
          >)[nested.functionName]
          : undefined;
        try {
          if (typeof mappingGetter === 'function') {
            nextValue = await mappingGetter(...nextArgs);
          } else if (proxyCallee) {
            const publicMethod = (proxyCallee as unknown as Record<string, unknown>)[nested.functionName];
            nextValue = typeof publicMethod === 'function'
              ? await (publicMethod as (...args: FunctionArgument[]) => Promise<StateValue>)(...nextArgs)
              : await proxyCallee.forward(nested.functionName, nextArgs).staticCall();
          } else {
            nextValue = await host.deriveReturnValue(nested.functionName, nextArgs, undefined,
              undefined, undefined, publicSelfAddress, host.categoryId) as StateValue;
          }
        } catch {
          nextValue = returnType === 'bool' ? false : '';
        }
      }
      if (nextValue === undefined || nextValue === null) {
        nextValue = returnType === 'bool' ? false : '';
      }
      return nextValue;
    };
    resolveLoopReturnCommitment = async (index: number): Promise<Uint8Array> => (
      index === 0 && precomputedReturnCommitment
        ? precomputedReturnCommitment
        : encodeReturn(await resolveLoopReturnValue!(index))
    );
    const arraySource = (nested.argSources ?? []).find((source: any) => source.kind === 'arrayElement');
    const array = arraySource?.paramIndex !== undefined
      ? delegateVisibleArgs[arraySource.paramIndex] : undefined;
    if (Array.isArray(array) && array.length > 1) {
      loopReturnCommitments = precomputedReturnCommitment
        ? [precomputedReturnCommitment]
        : [];
      for (let index = loopReturnCommitments.length; index < array.length; index++) {
        loopReturnCommitments.push(await resolveLoopReturnCommitment(index));
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RETURN === '1') {
        console.error('mece-loop-returns', {
          functionName: nested.functionName,
          array: array.map((item: any) => (typeof item === 'string' ? item
            : item instanceof Uint8Array ? binToHex(item) : String(item))),
          precomputedHex: precomputedReturnCommitment
            ? binToHex(precomputedReturnCommitment) : undefined,
          commitments: loopReturnCommitments.map((part: any) => binToHex(part)),
        });
      }
    } else if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RETURN === '1' && nested.functionName === 'meceTags') {
      console.error('mece-loop-returns-skipped', {
        arrayIsArray: Array.isArray(array),
        arrayLength: Array.isArray(array) ? array.length : undefined,
        paramIndex: arraySource?.paramIndex,
        visibleLen: delegateVisibleArgs.length,
        precomputedHex: precomputedReturnCommitment
          ? binToHex(precomputedReturnCommitment) : undefined,
      });
    }
  }

  return {
    precomputedReturnCommitment,
    loopReturnCommitments,
    resolveLoopReturnCommitment,
    resolveLoopReturnValue,
    resolveLoopFunctionArgs,
    effectiveReturnFn,
    effectiveReturnArtifact,
    returnStructs,
    returnEnums,
    effectiveReturnTypes,
    calleeUsesSolidityAbi,
  };
}
