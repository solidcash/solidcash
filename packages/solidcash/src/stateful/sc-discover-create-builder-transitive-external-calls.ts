/**
 * phase-boundary extract: SC _createBuilder extract — discover transitive B→C external-call groups.
 */

import { hexToBin } from '@bitauth/libauth';
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

/** Resolve an unconnected transitive callee from the compiler's exact typed address source. */
export async function resolveTransitiveExternalContract(
  caller: TransitiveExternalContract,
  edge: ExternalCallAbi,
  args: readonly FunctionArgument[],
  abi: AbiFunction,
): Promise<TransitiveExternalContract | undefined> {
  const connected = edge.interfaceName === '__raw__' ? undefined
    : caller._externalRegistry.get(edge.interfaceName);
  if (!edge.addressSource) return connected as TransitiveExternalContract | undefined;
  const state = await caller.getState();
  const selfAddress = hexToBin(caller.inner.lockingBytecode);
  const hydrated = edge.addressSource.kind === 'expression' && edge.addressSource.expression
    ? await caller._hydrateExternalPredicateState(
      [edge.addressSource.expression], [...args], caller.inner.artifact, state, abi.inputs,
      selfAddress,
    ) : state;
  const target = caller._resolveExternalArgs(
    [edge.addressSource], [...args], caller.inner.artifact, hydrated, abi.inputs,
    undefined, 0, false, selfAddress,
  )?.[0];
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
    const bAbiFunc = bAbi.find((f) => f.name === directGroup.functionName);

    if (!bAbiFunc?.externalCalls?.length) continue;

    for (const bEc of bAbiFunc.externalCalls) {
      // Resolve C from the exact compiler-published address when B has no connect-time interface binding.
      const cRegistered = await resolveTransitiveExternalContract(
        bContract, bEc, directGroup.functionArgs, bAbiFunc,
      );
      if (!cRegistered) {
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
          bAbiFunc.inputs, hexToBin(bContract.inner.lockingBytecode),
        );
      }
      // Resolve C's args from B's compiler-published sources.
      const cArgs = bContract._resolveExternalArgs(
        cArgSources, directGroup.functionArgs, bContract.inner.artifact, bState, bAbiFunc.inputs,
        undefined, 0, false, hexToBin(bContract.inner.lockingBytecode),
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
      const cRequiredNftIndices = bEc.requiredDataNftIndices;
      const cAbiFunction = cContract.inner.artifact.abi.find((candidate) =>
        candidate.name === cFunctionName);
      // The ordinary transitive A→B→C discovery path does not pass through nested graph expansion. Seed a
      // read-only C result here so B can decode it while its own return is derived. This is an advancing seed,
      // never a substitute for final transaction validation: state-writing/unknown callees still use VM proof.
      let precomputedReturnCommitment: Uint8Array | undefined;
      if (bEc.hasReturnValues && cAbiFunction?.writesState === false
        && cAbiFunction.outputs?.length === 1) {
        try {
          const value = await cContract._deriveReturnValue(
            cFunctionName, cArgs ?? [], undefined, cAbiFunction, undefined,
            hexToBin(bContract.inner.lockingBytecode), bContract.categoryId,
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

      externalCallUtxoGroups.push({
        categoryId: cCategoryId,
        stateLayout: cStateLayout,
        masterUtxo: cState.masterUtxo,
        dataNftUtxos: cDataNfts,
        requiredDataNftIndices: cRequiredNftIndices,
        functionName: cFunctionName,
        functionArgs: cArgs ?? [],
        externalContract: cContract as any,
        callerIdentity: {
          categoryId: bContract.categoryId,
          lockingBytecode: bContract.inner.lockingBytecode,
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
