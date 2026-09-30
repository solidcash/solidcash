/**
 * phase-boundary extract: SC _createBuilder extract — token-container transfer plan, return
 * placeholder reserve, delegate-index materialization, and library sidecar
 * co-spend (through sidecar set; before nothing-to-derive gate).
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  ExternalLibraryAbi,
  SHARED_LIBRARY_SALT,
  resolveLibraryBlob,
  sidecarLockingBytecode,
  type AbiFunction,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  assignPhysicalReturnIndices,
  lastCollidingMutableWriterIndex,
} from './physical-return-layout.js';
import { visibleHandlerInputs } from './route-expression-key.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { groupOwnsInBlockReturnEvent } from './value-chunk-geometry.js';

export type PrepareCreateBuilderDerivePreludeHost = {
  readonly categoryId: string;
  readonly inner: any;
  hydrateExternalPredicateState: (...args: any[]) => Promise<any>;
  evaluateExternalExpression: (...args: any[]) => any;
};

export type PrepareCreateBuilderDerivePreludeResult = {
  tokenContainerTransferOps: Array<{
    type: 'transfer' | 'transferNft'; categoryId: string; outputSlot?: number;
  }>;
  derivTransferCount: number;
  derivTokenOps: Array<{
    type: 'transfer' | 'transferNft'; categoryId: string; outputSlot?: number;
  }> | undefined;
  delegatecallInputIndex: number | undefined;
  delegatecallAbiFunction: AbiFunction | undefined;
  eventBlockLayoutForDerive: any;
};

/**
 * Plan TC transfers, reserve the return placeholder, resolve the delegated
 * derivation input index, and attach any required library sidecar UTXO.
 */
export async function prepareCreateBuilderDerivePrelude(
  host: PrepareCreateBuilderDerivePreludeHost,
  params: {
    builder: StatefulTransactionBuilder;
    abiFunction: AbiFunction | undefined;
    entryAbiFunction: AbiFunction | undefined;
    args: readonly any[];
    tokenContainerAbiFunction: AbiFunction | undefined;
    tokenContainerArgs: readonly any[];
    tokenContainerAccesses: readonly any[] | undefined;
    onChainState: any;
    executionSelfAddress: any;
    overrides: any;
    functionName: string;
    returnAbiFunction: AbiFunction | undefined;
    returnEmitOutputIndex: number;
    returnMaterializationOutputIndex: number;
    returnEmitBlockOffset: any;
    delegateReturnEventOffset: any;
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    externalOutStateUtxoGroups: ExternalCallUtxoGroup[];
    activeDelegateGroupIndex: number | undefined;
    effectiveBlockLayout: any;
    timing?: (label: string) => void;
    [key: string]: any;
  },
): Promise<PrepareCreateBuilderDerivePreludeResult> {
  const {
    builder, abiFunction, entryAbiFunction, args, tokenContainerAbiFunction, tokenContainerArgs,
    tokenContainerAccesses,
    onChainState, executionSelfAddress, overrides, functionName,
    returnAbiFunction, returnEmitOutputIndex, returnMaterializationOutputIndex,
    returnEmitBlockOffset, delegateReturnEventOffset, lowLevelCallUtxoGroups,
    externalCallUtxoGroups, externalOutStateUtxoGroups, activeDelegateGroupIndex,
    effectiveBlockLayout, timing,
  } = params;

// Build token container transfer ops from ABI for auto-derivation.
// Uses transferCount/transferNftCount when available (fan-out support),
// falling back to the operations array for backward compatibility.
const tokenContainerTransferOps: Array<{
  type: 'transfer' | 'transferNft'; categoryId: string; outputSlot?: number;
}> = [];
const runtimeTokenPlan = (abiFunction as MessageBusRuntimeAbiFunction | undefined)
  ?.messageBusTokenContainerTransferPlan;
const directTokenPlan = runtimeTokenPlan === undefined
  ? tokenContainerAbiFunction?.tokenContainerTransferSites?.map((site) => ({
    args: tokenContainerArgs as readonly FunctionArgument[], handler: tokenContainerAbiFunction, site,
    outputSlot: site.transferIndex,
  })) : undefined;
const fixedTokenPlan = runtimeTokenPlan ?? directTokenPlan;
if (fixedTokenPlan !== undefined) {
  const occupiedSlots = new Set<number>();
  for (const planned of fixedTokenPlan) {
    let active = true;
    if (planned.site.condition) {
      const visible = visibleHandlerInputs(planned.handler.inputs);
      const predicateState = await host.hydrateExternalPredicateState(
        [planned.site.condition], [...planned.args], host.inner.artifact,
        onChainState.state, visible, executionSelfAddress,
      );
      const result = host.evaluateExternalExpression(
        planned.site.condition, [...planned.args], host.inner.artifact,
        predicateState, visible, undefined, 0, false, executionSelfAddress,
      );
      if (typeof result !== 'boolean') throw new Error(
        `Could not resolve fixed token-transfer predicate in '${planned.handler.name}'.`,
      );
      active = result;
    }
    // A null condition records a conditional source expression which this artifact version could not
    // serialize. Retain the historical active-site probe for that case; serializable false paths are exact.
    if (!active) continue;
    if (occupiedSlots.has(planned.outputSlot)) throw new Error(
      `Multiple fixed token transfers selected physical slot ${planned.outputSlot}`,
    );
    occupiedSlots.add(planned.outputSlot);
    const access = planned.handler.tokenContainerAccesses?.[planned.site.tokenContainerSlot];
    if (!access) throw new Error(
      `Fixed token-transfer site in '${planned.handler.name}' has no container slot `
      + `${planned.site.tokenContainerSlot}`,
    );
    const visible = visibleHandlerInputs(planned.handler.inputs);
    const categoryIndex = visible.findIndex((input) => input.name === access.keyParam);
    const category = access.keySource === 'own'
      ? host.categoryId : categoryIndex >= 0 ? planned.args[categoryIndex] : undefined;
    if (category === undefined) throw new Error(
      `Fixed token-transfer category '${access.keyParam}' is not available in '${planned.handler.name}'.`,
    );
    const categoryId = category instanceof Uint8Array ? binToHex(category) : String(category);
    tokenContainerTransferOps.push({
      type: planned.site.kind === 'nft' ? 'transferNft' : 'transfer',
      categoryId,
      outputSlot: planned.outputSlot,
    });
  }
  tokenContainerTransferOps.sort((left, right) => (left.outputSlot ?? 0) - (right.outputSlot ?? 0));
} else if (tokenContainerAccesses) {
  for (const access of tokenContainerAccesses) {
    const catParamIdx = tokenContainerAbiFunction!.inputs.findIndex((inp) => inp.name === access.keyParam);
    const catValue = access.keySource === 'own'
      ? host.categoryId : catParamIdx >= 0 ? tokenContainerArgs[catParamIdx] : undefined;
    const catId = catValue instanceof Uint8Array
      ? binToHex(catValue) : (catValue !== undefined ? String(catValue) : '');
    const ftCount = access.transferCount ?? (access.operations.includes('transfer') ? 1 : 0);
    const nftCount = access.transferNftCount ?? (access.operations.includes('transferNft') ? 1 : 0);
    for (let i = 0; i < ftCount; i++) {
      tokenContainerTransferOps.push({ type: 'transfer', categoryId: catId });
    }
    for (let i = 0; i < nftCount; i++) {
      tokenContainerTransferOps.push({ type: 'transferNft', categoryId: catId });
    }
  }
}
// A proxy forwarder carries no Solidity-visible effects of its own. Transfer slots belong to the routed
// implementation ABI, just like its entries/dynamic writes above; counting from the forwarder leaves those
// balanced output slots as funders and prevents the VM from deriving their address and value.
const derivTransferCount = entryAbiFunction?.transferCount ?? abiFunction?.transferCount ?? 0;
const derivTokenOps = tokenContainerTransferOps.length > 0 ? tokenContainerTransferOps : undefined;

// Reserve the return placeholder before computing any input indices: an active returnEvent contributes a
// funder inside the root block and therefore shifts the delegated facet by one input.
if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
  ?.SOLIDC_DEBUG_RETURN_LAYOUT === '1' && overrides?.omitLocalFeeTail) {
  console.error('atomic-return-plan', JSON.stringify({
    functionName,
    abiFunction: abiFunction?.name,
    returnAbiFunction: returnAbiFunction?.name,
    returnOutputs: returnAbiFunction?.outputs,
    returnEmitOutputIndex,
    returnMaterializationOutputIndex,
    returnEmitBlockOffset,
    delegateReturnEventOffset,
    suppliedReturnBlob: overrides.returnBlob && binToHex(overrides.returnBlob),
  }));
}
if (returnEmitOutputIndex >= 0) {
  builder.setPlannedReturnOutputIndex(returnMaterializationOutputIndex);
  builder.setReturnEventOutput(host.categoryId, new Uint8Array([0]));
}

// Detect delegatecall group for auto-derivation: Phase 2 runs on the delegate's input
// instead of input 0 (proxy's master), because the delegate function is what verifies
// the proxy's state commitments.
let delegatecallInputIndex: number | undefined;
let delegatecallAbiFunction: AbiFunction | undefined;
if (lowLevelCallUtxoGroups.length > 0) {
  const derivationDelegateIndexes = activeDelegateGroupIndex === undefined
    ? lowLevelCallUtxoGroups.map((_, index) => index)
    : [activeDelegateGroupIndex];
  for (const i of derivationDelegateIndexes) {
    if (lowLevelCallUtxoGroups[i].callMode === 'delegatecall') {
      const delegateGroup = lowLevelCallUtxoGroups[i];
      delegatecallAbiFunction = delegateGroup.compilerRoute?.abiFunction
        ?? (delegateGroup.externalContract.inner.artifact.abi as readonly AbiFunction[])
          .find((candidate) => candidate.name === delegateGroup.functionName);
      // `allInputs` is a pre-build ordering and can become stale when an active return slot adds a funder
      // inside the root block. Resolve the implementation by outpoint in the materialized probe, just as
      // nested participant derivation does; the implementation covenant (not the proxy) authenticates the
      // delegated return value.
      const delegateMaster = lowLevelCallUtxoGroups[i].masterUtxo;
      timing?.('delegate-index-build-start');
      const materialized = builder.build();
      const materializedInputs = materialized.inputs;
      {
        for (const group of externalCallUtxoGroups) {
          if (group.plannedReturnOutputIndex === undefined
            && group.returnOutputIndex !== undefined) {
            group.plannedReturnOutputIndex = group.returnOutputIndex;
          }
        }
        const planned = externalCallUtxoGroups
          .map((group, index) => (
            group.returnOutputIndex !== undefined
              && !groupOwnsInBlockReturnEvent(externalCallUtxoGroups, index)
              ? (group.plannedReturnOutputIndex ?? group.returnOutputIndex) : -1
          ))
          .filter((index) => index >= 0);
        const writerEnd = lastCollidingMutableWriterIndex(materialized.outputs, planned);
        if (writerEnd >= 0) {
          const reassigned = assignPhysicalReturnIndices(
            externalCallUtxoGroups,
            (categoryId) => builder.findMintingInputIndex(categoryId),
            writerEnd,
            builder.viewTailPackOptions(),
          );
          let changed = false;
          for (const [groupIdx, returnIndex] of reassigned) {
            const group = externalCallUtxoGroups[groupIdx];
            if (!group || group.returnOutputIndex === returnIndex) continue;
            group.returnOutputIndex = returnIndex;
            changed = true;
          }
          if (changed) {
            for (const carrier of [...externalCallUtxoGroups, ...lowLevelCallUtxoGroups]) {
              if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
              const updates: Record<string, FunctionArgument> = {};
              for (const [name, groupIdx] of Object.entries(carrier.returnWitnessGroups)) {
                const returnIndex = reassigned.get(groupIdx);
                if (returnIndex === undefined) continue;
                if (carrier.internalArgs?.[name] === BigInt(returnIndex)) continue;
                updates[name] = BigInt(returnIndex);
              }
              if (Object.keys(updates).length === 0) continue;
              carrier.refreshInternalArgs(updates);
            }
            builder._refreshInputs();
          }
        }
      }
      timing?.('delegate-index-build-complete');
      const exactIndex = delegateMaster === undefined ? -1 : materializedInputs.findIndex((input) => (
        input.txid.toLowerCase() === delegateMaster.txid.toLowerCase()
          && input.vout === delegateMaster.vout
      ));
      delegatecallInputIndex = exactIndex >= 0
        ? exactIndex : builder.getLowLevelCallMasterInputIndex(i);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1') {
        console.error('delegate-return-probe-index', {
          functionName, exactIndex, delegatecallInputIndex,
          delegateMaster: delegateMaster && {
            txid: delegateMaster.txid, vout: delegateMaster.vout,
            category: delegateMaster.token?.category,
          },
          inputs: materializedInputs.map((input, index) => ({
            index, txid: input.txid, vout: input.vout, category: input.token?.category,
          })),
        });
      }
      break;
    }
  }
}
// Event placeholders are materialized by the STB's effective physical
// layout. For compiler-routed delegates that layout can be substantially
// wider than the public implementation ABI; using the latter maps event
// ordinals onto unrelated participant outputs and learns false commits.
const eventBlockLayoutForDerive = effectiveBlockLayout
  ?? entryAbiFunction?.blockLayout ?? abiFunction?.blockLayout;
if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
  ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
  console.error('stateful-builder-delegate-index', { functionName, delegatecallInputIndex });
}

// Co-spend the external-library side-car if this function uses a library, or calls an external
// contract whose function does. One side-car serves every loader in the tx (the loader reads the last
// input and verifies the blob by hash). Set before derivation so the probes include it.
// First non-inline library used (inline libraries are baked into the contract; no side-car).
// resultNft libraries (keccak256 compute) are co-spent as block-layout keccakSideCar slots, NOT via the
// inline side-car loader, so they must not be treated as a sidecar-library dependency here.
const firstSidecarLib = (art: any, names: readonly string[]): ExternalLibraryAbi | undefined => {
  for (const name of names) {
    const d: ExternalLibraryAbi | undefined = art?.externalLibraries?.find((l: any) => l.name === name);
    if (d && !d.inline && !d.resultNft) return d;
  }
  return undefined;
};
let sidecarLib: ExternalLibraryAbi | undefined;
let sidecarSalt: Uint8Array | undefined;
sidecarLib = firstSidecarLib(host.inner.artifact, abiFunction?.externalLibraries ?? []);
if (sidecarLib) {
  sidecarSalt = sidecarLib.branded ? hexToBin(host.categoryId) : SHARED_LIBRARY_SALT;
} else {
  // External calls and external out-state reads both run the callee's function (co-spent), so a
  // library-using callee needs the side-car too. Check both group lists.
  for (const group of [...externalCallUtxoGroups, ...externalOutStateUtxoGroups]) {
    const bArt = group.externalContract?.inner?.artifact ?? group.externalContract?.artifact;
    const bFn = bArt?.abi?.find((f: any) => f.name === group.functionName);
    sidecarLib = firstSidecarLib(bArt, bFn?.externalLibraries ?? []);
    if (sidecarLib) {
      sidecarSalt = sidecarLib.branded ? hexToBin(group.categoryId) : SHARED_LIBRARY_SALT;
      break; // one side-car suffices for all loaders in the tx
    }
  }
}
if (sidecarLib && sidecarSalt) {
  const blob = resolveLibraryBlob(sidecarLib);
  const lock = sidecarLockingBytecode(blob, sidecarSalt);
  const sidecarUtxos = await host.inner.provider.getUtxosForLockingBytecode(lock);
  if (sidecarUtxos.length === 0) {
    throw new Error(
      `${sidecarLib.name} side-car library UTXO not found; deploy it before spending `
      + '(TransactionBuilder.addSidecarDeployIfNeeded with the contract category salt).',
    );
  }
  builder.setSidecar(sidecarUtxos[0], blob, sidecarSalt);
}

  return {
    tokenContainerTransferOps,
    derivTransferCount,
    derivTokenOps,
    delegatecallInputIndex,
    delegatecallAbiFunction,
    eventBlockLayoutForDerive,
  };
}
