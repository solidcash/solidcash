/**
 * phase-boundary extract: SC _createBuilder extract — nested direct-callee resource prelude before block build.
 */

import type {
  AbiFunction,
  Artifact,
  ExternalCallAbi,
  StateLayout,
  StateValue,
} from '@solidcash/utils';
import { VALUE_CHUNK_SIZE, VALUE_HEAD_SIZE, parseChunkCommitment } from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import type { Output, UnlockableUtxo, Utxo } from '../interfaces.js';
import { createDataNftUnlocker, createDynamicChunkUnlocker } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  selectGraphBlockhashReads,
} from './sc-batch-raw.js';
import { resolveStatefulAbiFunction } from './stateful-abi-resolve.js';
import type { OnChainState } from './StateReader.js';
import {
  deriveValueChunkProducerChildPath,
  type ValueChunkProducerPathDisposition,
} from './ValueChunkProducerIdentity.js';

export type NestedCalleeOnChainState = OnChainState & { masterUtxo: Utxo };

export type NestedCalleeContract = {
  categoryId: string;
  getFullState(): Promise<OnChainState>;
  inner: {
    artifact: Artifact;
    stateLayout?: StateLayout;
    lockingBytecode: string;
  };
};

export type NestedCalleeCallInfo = {
  externalContract: NestedCalleeContract;
  functionName: string;
  args: FunctionArgument[];
};

export type NestedCalleeCompilerRoute = NonNullable<ExternalCallUtxoGroup['compilerRoute']>;

export interface LoadCreateBuilderNestedCalleePreludeHost {
  buildRepeatedExternalBatch(...args: any[]): NestedCalleeCompilerRoute | undefined;
  resolveExternalKeccakSideCars(
    bAbiFunc: AbiFunction | undefined,
    args: FunctionArgument[],
    externalCategoryId: string,
    bContract: NestedCalleeContract | null,
  ): Promise<{ inputs: UnlockableUtxo[]; recreates: Output[] }>;
  readonly lockingBytecode: string;
}

export interface LoadCreateBuilderNestedCalleePreludeResult {
  externalCategoryId: string;
  compilerRoute: NestedCalleeCompilerRoute | undefined;
  bGraphBlockhashSelections: ReturnType<typeof selectGraphBlockhashReads>;
  bState: NestedCalleeOnChainState;
  bStatelayout: StateLayout;
  concreteAbi: readonly AbiFunction[];
  bRequiredNftIndices: number[];
  bDataNfts: UnlockableUtxo[];
  bSc: NestedCalleeContract;
  bAbiFunc: AbiFunction | undefined;
  bBlockLayout: NonNullable<AbiFunction['blockLayout']> | undefined;
  bHasLoop: boolean;
  bDirectChunkValue: Uint8Array | undefined;
  bValueChunkOutputCount: number;
  bKeccak: { inputs: UnlockableUtxo[]; recreates: Output[] };
  bDynamicChunkInputs: Array<{ name: string; type: string; utxo: UnlockableUtxo }>;
}

/**
 * Resolve one direct nested callee's compiler route, on-chain state, required data NFTs,
 * ABI/layout selection, pre-known chunkable values, and keccak side-cars — everything needed
 * before assembling that callee's full block inputs.
 */
export async function loadCreateBuilderNestedCalleePrelude(
  host: LoadCreateBuilderNestedCalleePreludeHost,
  slotIndex: number,
  ec: ExternalCallAbi,
  callInfo: NestedCalleeCallInfo | undefined,
  args: FunctionArgument[],
  artifact: Artifact,
  abiFunction: AbiFunction | undefined,
  callerStateSnapshot: Record<string, StateValue> | undefined,
  publicSelfAddress: FunctionArgument | undefined,
  publicSelfIdentity: { categoryId: string; lockingBytecode: string },
  rootProducerPath: ValueChunkProducerPathDisposition,
): Promise<LoadCreateBuilderNestedCalleePreludeResult> {
  if (!callInfo) {
    throw new Error(
      `External call at slot ${slotIndex} (${ec.interfaceName}.${ec.functionName}) `
      + 'not provided via withExternalCall() or connect-time externals.',
    );
  }

  // Resolve external category ID from the resolved external contract (address model: A's args
  // bake the callee address, so its category comes from the registered external instance).
  const externalCategoryId = callInfo.externalContract.categoryId;
  const compilerRoute = host.buildRepeatedExternalBatch(
    ec, args, callInfo.externalContract,
    artifact, callerStateSnapshot, undefined, abiFunction?.inputs,
    false, publicSelfAddress, undefined, publicSelfIdentity,
    (row: NonNullable<NestedCalleeCompilerRoute['rowArguments']>[number]) => deriveValueChunkProducerChildPath({
      parent: rootProducerPath,
      parentExecutionLockingBytecode: host.lockingBytecode,
      parentSelector: abiFunction?.selector,
      sourceCallsiteId: row.sourceCallsiteId,
      sourceLogicalIndex: row.sourceLogicalIndex,
      occurrenceIndex: row.occurrenceIndex,
      sourceEffectOrdinal: row.sourceEffectOrdinal,
    }),
  );
  const bGraphBlockhashSelections = compilerRoute
    ? selectGraphBlockhashReads(callInfo.externalContract.inner.artifact, compilerRoute.blob)
    : [];

  // Get B's on-chain state
  const loadedState = await callInfo.externalContract.getFullState();
  if (!loadedState.masterUtxo) {
    throw new Error(
      `External contract master UTXO not found for ${ec.interfaceName} (category ${externalCategoryId})`,
    );
  }
  const bState: NestedCalleeOnChainState = { ...loadedState, masterUtxo: loadedState.masterUtxo };

  const bStatelayout = callInfo.externalContract.inner.stateLayout!;

  // This list is emitted for every callsite. An explicit empty list is authoritative: mapping-only calls
  // do not co-spend fixed-state NFTs, and expanding empty to "all" shifts every later block slot.
  const concreteAbi = callInfo.externalContract.inner.artifact.abi as readonly AbiFunction[];
  const selectedConcreteAbi = compilerRoute ? undefined : resolveStatefulAbiFunction(
    callInfo.externalContract.inner.artifact, callInfo.functionName, callInfo.args,
  );
  const bRequiredNftIndices = compilerRoute
    ? [...new Set((compilerRoute.rowArguments ?? []).flatMap((row) => (
      concreteAbi.find((candidate) => candidate.selector === row.selector)?.requiredNftIndices
        ?? row.handler.requiredNftIndices ?? []
    )))]
    // A low-level callsite cannot publish the callee function's state footprint: only the runtime
    // `.withExternalCall()` binding identifies that function. Once bound, use the selected concrete ABI's
    // exact footprint. The callsite list remains the fallback for typed calls and older artifacts.
    : [...(selectedConcreteAbi?.requiredNftIndices ?? ec.requiredDataNftIndices)];
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_RETURN_SNAPSHOT === '1' && callInfo.functionName === 'approve') {
    console.error('approve-required-nfts', {
      callsite: ec.requiredDataNftIndices,
      rows: (compilerRoute?.rowArguments ?? []).map((row) => ({
        selector: row.selector,
        handler: row.handler.name,
        matched: concreteAbi.find((candidate) => candidate.selector === row.selector)?.name,
        required: concreteAbi.find((candidate) => candidate.selector === row.selector)?.requiredNftIndices,
      })),
      selected: bRequiredNftIndices,
    });
  }
  const bDataNfts: UnlockableUtxo[] = [];
  for (const nftIndex of bRequiredNftIndices) {
    const dataNftUtxo = bState.dataNftUtxos[nftIndex];
    if (!dataNftUtxo) {
      throw new Error(
        `External data NFT at index ${nftIndex} not found for ${ec.interfaceName}`,
      );
    }
    bDataNfts.push({
      ...dataNftUtxo,
      // Placeholder unlocker - will be replaced after we know the master input index
      unlocker: createDataNftUnlocker(callInfo.externalContract.inner as any, 0, externalCategoryId),
    });
  }

  // Build B's full block inputs when B's function has entries/events/transfers
  const bSc = callInfo.externalContract;
  const bAbiFunc = compilerRoute?.abiFunction ?? selectedConcreteAbi;
  const bBlockLayout = bAbiFunc?.blockLayout;
  const directDynamicWrites = new Set(compilerRoute ? [] : bAbiFunc?.dynamicWrites ?? []);
  const bDynamicChunkInputs = bStatelayout.variables
    .filter((variable) => variable.dynamic && directDynamicWrites.has(variable.name))
    .flatMap((variable) => (bState.dynamicChunkUtxos?.[variable.name] ?? [])
      .filter((utxo) => utxo.token?.category === externalCategoryId
        && utxo.token.nft?.capability === 'mutable' && utxo.token.nft.commitment.length > 0)
      .map((utxo) => ({ utxo, index: parseChunkCommitment(utxo.token!.nft!.commitment).chunkIndex }))
      .sort((a, b) => a.index - b.index)
      .map(({ utxo }) => ({
        name: variable.name, type: variable.type,
        utxo: { ...utxo, unlocker: createDynamicChunkUnlocker(
          callInfo.externalContract.inner as any, 0, externalCategoryId, variable.name, variable.type,
        ) },
      })));
  const bHasLoop = (bAbiFunc?.sortedUpsertLoopInfo?.length ?? 0) > 0;
  // A whole chunkable value assigned from one published ABI parameter is known before VM derivation. Keep
  // this tied to the compiler's entry effect and valueParam metadata: selecting a merely type-compatible
  // argument would be ambiguous for functions with multiple dynamic values or collection writes.
  const bDirectChunkValues = (bAbiFunc?.entryAccesses ?? []).flatMap((access) => {
    if (!access.operations.includes('write') || access.valueParam === undefined
      || access.arrayMutation !== undefined) return [];
    const collection = bStatelayout.collections?.find((candidate) => (
      candidate.name === access.collection || candidate.signature === access.collection
    ));
    if (!collection?.chunkableValue) return [];
    const parameterIndex = bAbiFunc!.inputs.findIndex((input) => input.name === access.valueParam);
    if (parameterIndex < 0) return [];
    const encoded = encodeFunctionArgument(
      callInfo.args[parameterIndex], bAbiFunc!.inputs[parameterIndex].type, bStatelayout.structs,
    );
    return encoded instanceof Uint8Array ? [{ access, encoded }] : [];
  });
  const bDirectChunkValue = bDirectChunkValues.length === 1
    ? bDirectChunkValues[0].encoded : undefined;
  const bValueChunkOutputCount = bDirectChunkValue && bDirectChunkValue.length > VALUE_HEAD_SIZE
    ? Math.ceil((bDirectChunkValue.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE) : 0;
  // B's keccak256 side-cars (transitive): co-spent inside B's block so B's covenant reads them.
  const bKeccak = await host.resolveExternalKeccakSideCars(
    bAbiFunc, callInfo.args, externalCategoryId, callInfo.externalContract,
  );

  return {
    externalCategoryId,
    compilerRoute,
    bGraphBlockhashSelections,
    bState,
    bStatelayout,
    concreteAbi,
    bRequiredNftIndices,
    bDataNfts,
    bSc,
    bAbiFunc,
    bBlockLayout,
    bHasLoop,
    bDirectChunkValue,
    bValueChunkOutputCount,
    bKeccak,
    bDynamicChunkInputs,
  };
}
