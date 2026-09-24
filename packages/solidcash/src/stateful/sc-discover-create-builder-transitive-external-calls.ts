/**
 * phase-boundary extract: SC _createBuilder extract — discover transitive B→C external-call groups.
 */

import type { AbiInput, ExternalCallAbi, StateLayout } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { ExternalGroupMeta } from './stateful-lifecycle-types.js';

export type TransitiveExternalContract = {
  categoryId: string;
  getFullState(): Promise<{
    masterUtxo: UnlockableUtxo | undefined;
    dataNftUtxos: UnlockableUtxo[];
  }>;
  inner: {
    artifact: { abi: readonly { externalCalls?: readonly ExternalCallAbi[]; inputs: readonly AbiInput[]; name: string }[] };
    stateLayout?: StateLayout;
    lockingBytecode: string;
  };
  _externalRegistry: Map<string, unknown>;
  _resolveExternalArgs(...args: any[]): FunctionArgument[] | undefined;
};

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
      // Resolve C from B's external registry
      const cRegistered = bContract._externalRegistry.get(bEc.interfaceName);
      if (!cRegistered) {
        throw new Error(
          `Transitive external call: ${bEc.interfaceName}.${bEc.functionName} not found `
          + `in ${directGroup.functionName}'s connect-time externals. `
          + 'Register it via StatefulContract.withCategory(bContract, bCategoryId, '
          + `{ externals: { ${bEc.interfaceName}: scC } }).`,
        );
      }

      const cContract = cRegistered as TransitiveExternalContract;

      // Detect circular calls (B->A): the transitive target is the primary contract
      if (cContract.categoryId === primaryCategoryId) {
        throw new Error(
          `Circular external call detected: ${directGroup.functionName} calls `
          + `${bEc.interfaceName}.${bEc.functionName} which targets the primary contract. `
          + 'Circular A->B->A calls are not supported in auto-resolution.',
        );
      }

      // Resolve C's args from B's argSources
      const cArgs = bContract._resolveExternalArgs(
        bEc.argSources, directGroup.functionArgs, bContract.inner.artifact, undefined, bAbiFunc.inputs,
      );
      if (cArgs === undefined && bEc.argSources?.some((s: any) => s.kind === 'expression')) {
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
        functionName: bEc.functionName,
        functionArgs: cArgs ?? [],
        externalContract: cContract as any,
        callerIdentity: {
          categoryId: bContract.categoryId,
          lockingBytecode: bContract.inner.lockingBytecode,
        },
        logicalFunctionName: bEc.functionName,
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
