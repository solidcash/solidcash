/**
 * phase-boundary extract: SC _createBuilder extract — non-shared external outState read UTXO groups + unlockers.
 */

import { hexToBin } from '@bitauth/libauth';
import type { AbiFunction, Artifact, StateLayout } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Output, UnlockableUtxo, Utxo } from '../interfaces.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

export type CreateBuilderOutStateCallInfo = {
  externalContract: {
    categoryId: string;
    getFullState(): Promise<{
      masterUtxo?: Utxo;
      dataNftUtxos: Array<Utxo | undefined>;
    }>;
    inner: {
      stateLayout?: StateLayout;
      artifact: Artifact;
      unlock: Record<string, ((...args: never[]) => unknown) | undefined>;
    };
  };
  functionName: string;
  args: FunctionArgument[];
};

export interface LoadCreateBuilderOutStateReadsHost {
  readonly categoryId: string;
  resolveExternalKeccakSideCars(
    bAbiFunc: AbiFunction | undefined,
    args: FunctionArgument[],
    externalCategoryId: string,
    bContract: unknown,
  ): Promise<{ inputs: UnlockableUtxo[]; recreates: Output[] }>;
}

/**
 * Build non-shared outState UTXO groups from `.withExternalCall()` overrides, inject the
 * outState input-base witness when required, and fix master/data-NFT unlockers.
 */
export async function loadCreateBuilderOutStateReads(
  host: LoadCreateBuilderOutStateReadsHost,
  params: {
    abiFunction: AbiFunction | undefined;
    externalCalls: readonly { interfaceName?: string; addressParam?: string }[] | undefined;
    outStateOverrideCalls: readonly CreateBuilderOutStateCallInfo[] | undefined;
    externalOutStateUtxoGroups: ExternalCallUtxoGroup[];
    requiredNftIndices: readonly number[];
    externalReadUtxos: readonly unknown[];
    finalArgs: FunctionArgument[];
  },
): Promise<{ finalArgs: FunctionArgument[]; outStateInputCount: number }> {
  let finalArgs = params.finalArgs;
  let outStateInputCount = 0;
  const {
    abiFunction, externalCalls, outStateOverrideCalls, externalOutStateUtxoGroups,
    requiredNftIndices, externalReadUtxos,
  } = params;

  // Handle external outState reads (reading output state from another contract)
  const externalOutStateReads = abiFunction?.externalOutStateReads;

  if (abiFunction && externalOutStateReads && externalOutStateReads.length > 0) {

    // Determine which outState reads are shared with existing external calls
    const nonSharedReads: { read: typeof externalOutStateReads[0]; overrideIdx: number }[] = [];
    let overrideIdx = externalCalls?.length ?? 0; // outState overrides start after externalCalls

    for (const osRead of externalOutStateReads) {
      const isShared = externalCalls?.some(
        (ec) => ec.interfaceName === osRead.interfaceName && ec.addressParam === osRead.addressParam,
      ) ?? false;

      if (!isShared) {
        nonSharedReads.push({ read: osRead, overrideIdx });
        overrideIdx++;
      }
    }

    // Build UTXOs for non-shared outState reads from .withExternalCall() overrides
    for (const { read: osRead, overrideIdx: oidx } of nonSharedReads) {
      const callInfo = outStateOverrideCalls?.[oidx];
      if (!callInfo) {
        // Not yet resolved - will be rebuilt when .withExternalCall() is used
        continue;
      }

      // Resolve external category ID from the resolved external contract (address model)
      const externalCategoryId = callInfo.externalContract.categoryId;

      // Get B's on-chain state
      const bState = await callInfo.externalContract.getFullState();
      if (!bState.masterUtxo) {
        throw new Error(
          `External contract master UTXO not found for ${osRead.interfaceName} (category ${externalCategoryId})`,
        );
      }

      const bStateLayout = callInfo.externalContract.inner.stateLayout!;
      const bRequiredNftIndices = osRead.requiredDataNftIndices;
      const bDataNfts: UnlockableUtxo[] = [];
      for (const nftIndex of bRequiredNftIndices) {
        const dataNftUtxo = bState.dataNftUtxos[nftIndex];
        if (!dataNftUtxo) {
          throw new Error(
            `External data NFT at index ${nftIndex} not found for ${osRead.interfaceName}`,
          );
        }
        bDataNfts.push({
          ...dataNftUtxo,
          unlocker: createDataNftUnlocker(callInfo.externalContract.inner as any, 0, externalCategoryId),
        });
      }

      // B's keccak256 side-cars (transitive): the outState read runs B's function, which reads a keccakSideCar
      // slot in B's block, so co-spend + recreate B's branded side-cars (appended after B's data NFTs).
      const bOsAbiFunc = (callInfo.externalContract.inner.artifact.abi as readonly AbiFunction[])
        .find((f) => f.name === callInfo.functionName);
      const bOsKeccak = await host.resolveExternalKeccakSideCars(
        bOsAbiFunc, callInfo.args, externalCategoryId, callInfo.externalContract as unknown,
      );

      externalOutStateUtxoGroups.push({
        categoryId: externalCategoryId,
        stateLayout: bStateLayout,
        masterUtxo: bState.masterUtxo,
        dataNftUtxos: bDataNfts,
        requiredDataNftIndices: bRequiredNftIndices,
        functionName: callInfo.functionName,
        functionArgs: callInfo.args,
        externalContract: callInfo.externalContract as any,
        ...(bOsKeccak.inputs.length > 0 && { keccakInputs: bOsKeccak.inputs, keccakRecreates: bOsKeccak.recreates }),
      });
    }

    // Compute outState input count for base offset adjustments
    outStateInputCount = externalOutStateUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
    );

    // Inject _externalOutStateInputBase if ABI expects it (i.e. not all shared)
    const hasOutStateBaseParam = abiFunction.inputs.some(
      (inp: { name: string }) => inp.name === '__internal__externalOutStateInputBase',
    );
    if (hasOutStateBaseParam) {
      const outStateInputBase = 1 + requiredNftIndices.length + externalReadUtxos.length;
      finalArgs = [...finalArgs, BigInt(outStateInputBase)];
    }

    // Fix data NFT unlockers with correct master input index and create B's master unlockers
    const outStateBase = 1 + requiredNftIndices.length + externalReadUtxos.length;
    let currentOutStateBase = outStateBase;
    for (let groupIdx = 0; groupIdx < externalOutStateUtxoGroups.length; groupIdx++) {
      const group = externalOutStateUtxoGroups[groupIdx];
      const masterInputIndex = currentOutStateBase;

      group.dataNftUtxos = group.dataNftUtxos.map((nftUtxo) => ({
        ...nftUtxo,
        unlocker: createDataNftUnlocker(
          group.externalContract.inner as any, masterInputIndex, group.categoryId,
        ),
      }));

      // If callee uses msg.sender, append our category
      const bAbiFuncs = group.externalContract.inner.artifact.abi as readonly { name: string; usesMsgSender?: boolean }[];
      const bAbiFunc = bAbiFuncs.find((f) => f.name === group.functionName);
      let bFinalArgs = [...group.functionArgs];
      if (bAbiFunc?.usesMsgSender) {
        // EVM delegatecall preserves the original caller. A zero category selects tx.origin in emitMsgSender;
        // passing the proxy category would incorrectly make onlyOwner compare against the proxy itself.
        bFinalArgs = [...bFinalArgs, group.callMode === 'delegatecall'
          ? new Uint8Array(32) : hexToBin(host.categoryId).reverse()];
      }

      // Create B's master unlocker
      const bMasterUnlocker = (group.externalContract.inner.unlock as any)[group.functionName](
        ...bFinalArgs,
      );
      group.masterUtxo = { ...group.masterUtxo, unlocker: bMasterUnlocker } as UnlockableUtxo;

      currentOutStateBase += 1 + group.dataNftUtxos.length;
    }
  }

  return { finalArgs, outStateInputCount };
}
