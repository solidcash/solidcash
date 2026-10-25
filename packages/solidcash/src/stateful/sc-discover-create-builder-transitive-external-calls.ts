/**
 * phase-boundary extract: SC _createBuilder extract — discover transitive B→C external-call groups.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, Artifact, ExternalCallAbi, StateLayout, StateValue } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import { findDeploymentByAddressValue } from './deployment-registry.js';
import { encodeExternalReturnValue } from './external-return-encoding.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import type { ExternalGroupMeta } from './stateful-lifecycle-types.js';
import { resolveStatefulAbiFunction } from './stateful-abi-resolve.js';
import { resolveOrdinarySelfIdentity } from './ordinary-self-identity.js';
import { physicalExternalCallGroupIndexByMasterOutpoint } from './physical-external-call.js';

export type TransitiveExternalContract = {
  categoryId: string;
  getFullState(): Promise<{
    masterUtxo: UnlockableUtxo | undefined;
    dataNftUtxos: UnlockableUtxo[];
  }>;
  getState(): Promise<Record<string, unknown>>;
  inner: {
    artifact: Artifact;
    stateLayout?: StateLayout;
    lockingBytecode: string;
    provider: NetworkProvider;
  };
  _externalRegistry: Map<string, unknown>;
  _hydrateExternalPredicateState(...args: any[]): Promise<Record<string, unknown>>;
  _resolveExternalExpressionReturns?(...args: any[]): Promise<Map<string, FunctionArgument>>;
  _planExternalCallOccurrences?(call: ExternalCallAbi, frame: {
    functionArgs: FunctionArgument[];
    artifact: Artifact;
    state?: Record<string, unknown>;
    callerInputs?: readonly { type: string }[];
    executionSelfAddress?: FunctionArgument;
    externalReturns?: ReadonlyMap<string, FunctionArgument>;
  }): Promise<readonly { args: readonly FunctionArgument[] }[]>;
  _resolveExternalArgs(...args: any[]): FunctionArgument[] | undefined;
  _deriveReturnValue(...args: any[]): Promise<StateValue>;
};

/** A standalone return probe cannot materialize this transitive edge before the aggregate graph exists. */
export class DeferredTransitiveReturnProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeferredTransitiveReturnProbeError';
  }
}

/**
 * Resolve a transitive callee. A connect-time interface binding wins: the caller already named that
 * contract. An unconnected edge falls through to the compiler's exact typed address source.
 */
export async function resolveTransitiveExternalContract(
  caller: TransitiveExternalContract,
  edge: ExternalCallAbi,
  args: readonly FunctionArgument[],
  abi: AbiFunction,
): Promise<TransitiveExternalContract | undefined> {
  const connected = edge.interfaceName === '__raw__' ? undefined
    : caller._externalRegistry.get(edge.interfaceName);
  if (connected) return connected as TransitiveExternalContract;
  if (!edge.addressSource) return undefined;
  const state = await caller.getState();
  const selfAddress = (await resolveOrdinarySelfIdentity(caller, abi))?.unlocker.generateLockingBytecode()
    ?? hexToBin(caller.inner.lockingBytecode);
  const hydrated = edge.addressSource.kind === 'expression' && edge.addressSource.expression
    ? await caller._hydrateExternalPredicateState(
      [edge.addressSource.expression], [...args], caller.inner.artifact, state, abi.inputs,
      selfAddress,
    ) : state;
  // A target taken from another call's return (`(_feeTo, _migrator) = factory.feeToAndMigrator()`) is a
  // producerResult, not an argument or a state read. Resolve the producer's authenticated return value first;
  // without it the edge cannot name a deployment even though the compiled frame reads it at run time.
  const mentionsProducer = (expression: unknown): boolean => {
    if (expression === null || typeof expression !== 'object') return false;
    const value = expression as Record<string, unknown>;
    if (value.kind === 'producerResult' || value.kind === 'externalCall') return true;
    return Object.values(value).some((child) => (Array.isArray(child)
      ? child.some(mentionsProducer) : mentionsProducer(child)));
  };
  const producerReturns = edge.addressSource.kind === 'expression'
    && mentionsProducer(edge.addressSource.expression)
    && typeof caller._resolveExternalExpressionReturns === 'function'
    ? await caller._resolveExternalExpressionReturns(
      [edge.addressSource], [...args], caller, hydrated, abi.inputs, selfAddress, abi.externalCalls,
    )
    : undefined;
  const target = caller._resolveExternalArgs(
    [edge.addressSource], [...args], caller.inner.artifact, hydrated, abi.inputs,
    producerReturns, 0, false, selfAddress,
  )?.[0];
  if ((globalThis as any).process?.env?.SOLIDC_DEBUG_TRANSITIVE === '1') {
    console.error('TRANSITIVE', edge.interfaceName, edge.functionName,
      target === undefined ? 'undefined'
        : typeof target === 'string' ? target : target instanceof Uint8Array ? binToHex(target) : String(target),
      'source', JSON.stringify(edge.addressSource)?.slice(0, 200));
  }
  if (typeof target !== 'string' && !(target instanceof Uint8Array)) return undefined;
  const deployment = findDeploymentByAddressValue(caller.inner.provider, target);
  return deployment?.contract as TransitiveExternalContract | undefined;
}

/**
 * For each direct nested callee with its own externalCalls, resolve C from B's
 * connect-time registry, load C's master/data NFTs, and append transitive groups.
 * Circular A→B→A auto-resolution fails closed.
 */
export async function discoverCreateBuilderTransitiveExternalCalls(
  primaryCategoryId: string,
  externalCallUtxoGroups: ExternalCallUtxoGroup[],
  groupMetas: ExternalGroupMeta[],
  directGroupCount: number,
): Promise<void> {
  for (let directIdx = 0; directIdx < directGroupCount; directIdx++) {
    const directGroup = externalCallUtxoGroups[directIdx];
    const bContract = directGroup.externalContract as TransitiveExternalContract;
    const bAbi = bContract.inner.artifact.abi;
    const bAbiFunc = directGroup.compilerRoute
      ? bAbi.find((f) => f.name === directGroup.functionName)
      : resolveStatefulAbiFunction(bContract.inner.artifact, directGroup.functionName, directGroup.functionArgs);

    if (!bAbiFunc?.externalCalls?.length) continue;
    const bSelfIdentity = directGroup.compilerRoute ? undefined : await resolveOrdinarySelfIdentity(bContract, bAbiFunc);
    const bSelfAddress = bSelfIdentity?.unlocker.generateLockingBytecode() ?? hexToBin(bContract.inner.lockingBytecode);

    for (const bEc of bAbiFunc.externalCalls) {
      // A conditional edge the authenticated frame can already prove unreachable does not need a callee group.
      // Without this an `action == 0` callback still plans (and must resolve) every other branch's target.
      if (typeof bContract._planExternalCallOccurrences === 'function') {
        try {
          const occurrences = await bContract._planExternalCallOccurrences(bEc, {
            functionArgs: directGroup.functionArgs,
            artifact: bContract.inner.artifact,
            state: await bContract.getState(),
            callerInputs: bAbiFunc.inputs,
            executionSelfAddress: bSelfAddress,
          });
          if (occurrences.length === 0) continue;
        } catch {
          // An unresolvable guard retains the call; the callee still needs a group.
        }
      }
      // Resolve C from the exact compiler-published address when B has no connect-time interface binding.
      const cRegistered = await resolveTransitiveExternalContract(
        bContract, bEc, directGroup.functionArgs, bAbiFunc,
      );
      if (!cRegistered) {
        // A conditional edge the planner could not prove reachable is stated as not taken: the caller's own
        // covenant keeps its guard, so a spend that does reach the call fails closed at the call site, while an
        // unreached branch (the `if (migrator != 0)` shape) needs no callee UTXO to exist.
        if (bEc.occurrence === 'conditional') continue;
        throw new DeferredTransitiveReturnProbeError(
          `Transitive external call: ${bEc.interfaceName}.${bEc.functionName} not found `
          + `in ${directGroup.functionName}'s connect-time externals. `
          + 'Register it via StatefulContract.withCategory(bContract, bCategoryId, '
          + `{ externals: { ${bEc.interfaceName}: scC } }).`,
        );
      }

      const cContract = cRegistered as TransitiveExternalContract;

      // Detect circular calls (B->A): the transitive target is the primary contract
      if (cContract.categoryId === primaryCategoryId) {
        throw new DeferredTransitiveReturnProbeError(
          `Circular external call detected: ${directGroup.functionName} calls `
          + `${bEc.interfaceName}.${bEc.functionName} which targets the primary contract. `
          + 'Circular A->B->A calls are not supported in auto-resolution.',
        );
      }

      // A lowered Address/SafeERC20 call has no source interface. Its authenticated target
      // determines the concrete ABI; a selector must identify exactly one function there.
      const cAbi = cContract.inner.artifact.abi as readonly AbiFunction[];
      const rawMatches = bEc.interfaceName === '__raw__'
        ? cAbi.filter((candidate) => bEc.rawSelector !== undefined
          && candidate.selector?.toLowerCase() === bEc.rawSelector.toLowerCase()) : [];
      if (bEc.interfaceName === '__raw__' && rawMatches.length !== 1) {
        throw new Error(`Raw transitive call selector '${bEc.rawSelector ?? '<unknown>'}' has no unique pinned callee`);
      }
      const cFunctionName = rawMatches[0]?.name ?? bEc.functionName;
      const cArgSources = bEc.interfaceName === '__raw__'
        ? bEc.rawArgSources ?? bEc.argSources : bEc.argSources;
      let bState = await bContract.getState();
      const argumentExpressions = cArgSources?.flatMap((source) => source.kind === 'expression'
        && source.expression ? [source.expression] : []) ?? [];
      if (argumentExpressions.length > 0) {
        bState = await bContract._hydrateExternalPredicateState(
          argumentExpressions, directGroup.functionArgs, bContract.inner.artifact, bState,
          bAbiFunc.inputs, bSelfAddress,
        );
      }
      // Resolve C's args from B's compiler-published sources.
      const cArgs = bContract._resolveExternalArgs(
        cArgSources, directGroup.functionArgs, bContract.inner.artifact, bState, bAbiFunc.inputs,
        undefined, 0, false, bSelfAddress,
      );
      if (cArgs === undefined && cArgSources?.some((s) => s.kind === 'expression')) {
        throw new Error(
          `Transitive external call to ${bEc.interfaceName}.${bEc.functionName} has expression-based `
          + 'argSources that cannot be auto-resolved. Use withExternalCall() to provide args explicitly.',
        );
      }

      // Resolve C's category ID from the resolved transitive external contract (address model)
      const cCategoryId = cContract.categoryId;

      // Get C's on-chain state
      const cState = await cContract.getFullState();
      if (!cState.masterUtxo) {
        throw new Error(
          'Transitive external contract master UTXO not found for '
          + `${bEc.interfaceName} (category ${cCategoryId})`,
        );
      }

      const cStateLayout = cContract.inner.stateLayout!;
      const cAbiFunction = rawMatches[0]
        ?? resolveStatefulAbiFunction(cContract.inner.artifact, cFunctionName, cArgs ?? []);
      // The connected concrete handler declares its complete fixed-state footprint; an interface may publish
      // no data slots even when that handler reads and updates a fixed-state NFT.
      const cRequiredNftIndices = [...(cAbiFunction?.requiredNftIndices ?? bEc.requiredDataNftIndices)];
      // The ordinary transitive A→B→C discovery path does not pass through nested graph expansion. Seed a
      // read-only C result here so B can decode it while its own return is derived. This is an advancing seed,
      // never a substitute for final transaction validation: state-writing/unknown callees still use VM proof.
      let precomputedReturnCommitment: Uint8Array | undefined;
      if (bEc.hasReturnValues && cAbiFunction?.writesState === false
        && cAbiFunction.outputs?.length === 1) {
        try {
          const value = await cContract._deriveReturnValue(
            cFunctionName, cArgs ?? [], undefined, cAbiFunction, undefined,
            bSelfAddress, bContract.categoryId,
          );
          const returnEncoding = resolveExternalResultEncoding(
            cAbiFunction.resultEncoding, cContract.inner.artifact,
            cAbiFunction.outputs.map((output) => output.type),
            `function '${cAbiFunction.name}' result`,
          );
          precomputedReturnCommitment = encodeExternalReturnValue(
            value, cAbiFunction.outputs[0].type,
            cContract.inner.artifact.structs ?? cContract.inner.artifact.stateLayout?.structs,
            returnEncoding === 'evm-abi-v1', cContract.inner.artifact.enums,
          );
        } catch {
          // A speculative read can depend on a later graph effect or an unavailable context. Its real
          // transaction still has the ordinary VM-derived return path; no unproven value is published.
        }
      }

      const cDataNfts: UnlockableUtxo[] = [];
      for (const nftIndex of cRequiredNftIndices) {
        const dataNftUtxo = cState.dataNftUtxos[nftIndex];
        if (!dataNftUtxo) {
          throw new Error(
            `Transitive external data NFT at index ${nftIndex} not found `
            + `for ${bEc.interfaceName}`,
          );
        }
        cDataNfts.push({
          ...dataNftUtxo,
          unlocker: createDataNftUnlocker(cContract.inner as any, 0, cCategoryId),
        });
      }

      // A callsite may target a participant another direct call already co-spends (the Router's token
      // `transferFrom` and the pair's `balanceOf` on the same token). Keep this logical group for its own
      // selector, arguments and return witness, but let the first group own the physical input block.
      const existingPhysicalIndex = physicalExternalCallGroupIndexByMasterOutpoint(
        externalCallUtxoGroups, cState.masterUtxo,
      );
      const sharedPhysical = existingPhysicalIndex < 0
        ? undefined : externalCallUtxoGroups[existingPhysicalIndex];
      // The same rule a direct callsite applies: two distinct methods that both return cannot execute from one
      // master input unless the compiler published an authenticated batch route; a second carrier would be a
      // placeholder. At most one side of a shared pair may return.
      if (sharedPhysical !== undefined && (cAbiFunction.outputs?.length ?? 0) > 0
        && sharedPhysical.functionName !== cFunctionName) {
        const priorAbi = (sharedPhysical.externalContract?.inner?.artifact?.abi as readonly AbiFunction[] | undefined)
          ?.find((candidate) => candidate.name === sharedPhysical.functionName);
        if ((priorAbi?.outputs?.length ?? 0) > 0) {
          throw new Error(
            `Transitive external calls to ${sharedPhysical.functionName} and ${cFunctionName} share one state `
            + `owner but both return values. Use messageBus.compose() to authenticate both logical invocations.`,
          );
        }
      }
      externalCallUtxoGroups.push({
        categoryId: cCategoryId,
        stateLayout: cStateLayout,
        masterUtxo: cState.masterUtxo,
        ...(existingPhysicalIndex >= 0 && { sharedGroupIndex: existingPhysicalIndex }),
        dataNftUtxos: cDataNfts,
        requiredDataNftIndices: cRequiredNftIndices,
        functionName: cFunctionName,
        functionArgs: cArgs ?? [],
        externalContract: cContract as any,
        callerIdentity: {
          categoryId: bContract.categoryId,
          lockingBytecode: binToHex(bSelfAddress),
        },
        logicalFunctionName: cFunctionName,
        ...(precomputedReturnCommitment && { precomputedReturnCommitment }),
        ...(bEc.callMode && { callMode: bEc.callMode }),
      });

      groupMetas.push({
        ecSlot: bEc,
        callerCategoryId: externalCallUtxoGroups.at(-1)?.callerIdentity?.categoryId
          ?? directGroup.categoryId,
        parentGroupIndex: directIdx,
      });
    }
  }
}
