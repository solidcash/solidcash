/**
 * phase-boundary extract: SC _createBuilder extract — finalize nested-bases unlockers through nested-bases-complete.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction } from '@solidcash/utils';
import type { Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { usesOrdinarySelfIdentity } from './ordinary-self-identity.js';
import { isPoolInfoInput } from '../oracle/pool/reader.js';
import { resolveBlockhashCoSpend } from '../oracle/blockhashCoSpend.js';
import { createDataNftUnlocker, createDynamicChunkUnlocker } from './covenant-helpers.js';
import { directCallBatchUnlocker } from './direct-call-batch.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { defaultInternalFunctionArg } from './kernel-journal-helpers.js';
import { externalReturnParamSlot } from './physical-external-call.js';
import { argumentsForPhysicalAbiFrame } from './route-expression-key.js';
import { resolveLogicalIdentity } from './logical-identity.js';
import type { ExternalGroupMeta } from './stateful-lifecycle-types.js';
import { logicalReturnGroupIndex } from './value-chunk-geometry.js';
import { groupLayoutTrailingBase } from './writer-event-delegate-layout.js';

export function selectorParamSlot(
  paramName: string,
  externalCalls: ReadonlyArray<{
    needsSelectorVerification?: boolean;
    selectorArrayVar?: string;
  }> | undefined,
): number {
  const match = paramName.match(/^__internal__externalCallSelector(\d*)$/);
  if (!match) return 0;
  if (match[1] !== '') return Number(match[1]);
  const explicit = (externalCalls ?? [])
    .map((call, index) => ({ call, index }))
    .filter(({ call }) => call.needsSelectorVerification === true && !call.selectorArrayVar);
  if (explicit.length === 1) return explicit[0].index;
  const implicit = (externalCalls ?? [])
    .map((call, index) => ({ call, index }))
    .filter(({ call }) => call.needsSelectorVerification !== false && !call.selectorArrayVar);
  return implicit.length === 1 ? implicit[0].index : 0;
}


export interface FinalizeCreateBuilderNestedBasesUnlockersHost {
  readonly provider: NetworkProvider;
  readonly physicalRootLockingBytecode: Uint8Array;
  readonly rootLogicalAddress?: string;
  /** The root reader's pool and the input of the coin it co-spends. */
  readonly blockOracle?: { pool: string; inputIndex: number };
  ensureOrdinarySelfIdentityBand(contract: any, abi: AbiFunction): Promise<number | undefined>;
  readonly pendingAnchorFills: Array<{
    group: {
      masterUtxo?: unknown;
      refreshInternalArgs?: (updates: Record<string, any>) => void;
      externalContract: { inner: { unlock: Record<string, ((...args: never[]) => unknown) | undefined> } };
    };
    functionName: string;
    encodedArgs: any[];
    positions: Array<{
      argIndex: number; name: string; band?: number; categoryId?: string;
      proxyRoute: boolean; required?: boolean;
    }>;
  }>;
  selectorParamSlot: typeof selectorParamSlot;
  isComputedBlockhashKey(readKey: string): boolean;
  noteBhLocktime(locktime: number): void;
  extractGraphBlockhashRead(
    contract: any,
    masterUtxo: Utxo,
    masterUnlocker: Unlocker,
    dataNftUtxos: UnlockableUtxo[],
    prior: Array<{ slotOrdinal: number; utxo: Utxo; unlocker: Unlocker; recreate: Output }>,
    absoluteBase: number,
    slotOrdinal: number,
    slotCount: number,
    masterInputIndex: number,
  ): Promise<bigint | null>;
  paramBlockhashN(
    contract: any,
    readKey: string,
    rowArgs: any[],
    handler: AbiFunction,
  ): bigint | null;
}

/**
 * Patch each nested group's data-NFT/master unlockers with absolute input bases and
 * hidden ABI witnesses, then advance bases through `timing('nested-bases-complete')`.
 */
export async function finalizeCreateBuilderNestedBasesUnlockers(
  host: FinalizeCreateBuilderNestedBasesUnlockersHost,
  externalCallUtxoGroups: ExternalCallUtxoGroup[],
  groupMetas: ExternalGroupMeta[],
  externalCallInputBase: number,
  returnEventIndexMap: Map<number, number>,
  timing: (stage: string) => void,
): Promise<{ currentInputBase: number; groupMasterIndices: number[] }> {
  // Fix data NFT unlockers and create master unlockers with correct hidden params.
  // Uses ABI-driven param resolution: scans each group's ABI inputs for hidden param names
  // and computes values based on the param name and transaction layout.
  // Pool category -> the input of the one coin of that pool the transaction co-spends.
  const sharedOracleInputs = new Map<string, number>();
  if (host.blockOracle !== undefined) {
    sharedOracleInputs.set(host.blockOracle.pool, host.blockOracle.inputIndex);
  }
  // A logical clock-writing call can promote an earlier read-only call's physical block.
  // Inventory actual pool coin inputs before binding any logical alias's hidden frame.
  let oracleBlockBase = externalCallInputBase;
  for (const group of externalCallUtxoGroups) {
    // Logical aliases retain resource metadata but contribute no physical inputs or continuation band.
    if (group.sharedGroupIndex !== undefined) continue;
    const offset = group.blockLayout?.slots.find((slot) => slot.kind === 'blockInfoOracle')?.offset;
    const input = offset === undefined ? undefined : group.blockInputs?.[offset];
    const pool = group.externalContract.inner.oraclePool as string | undefined;
    if (offset !== undefined && input !== undefined && pool !== undefined && isPoolInfoInput(input, pool)) {
      if (!sharedOracleInputs.has(pool)) sharedOracleInputs.set(pool, oracleBlockBase + offset);
    }
    oracleBlockBase += group.blockInputs?.length ?? 1 + group.dataNftUtxos.length;
    oracleBlockBase += group.ordinaryDynamicChunkInputs?.length ?? 0;
  }
  // The inputs a group takes as the builder flattens it: its block (or its master and records), then the old chunks
  // its write consumes.
  const plannedInputWidth = (group: ExternalCallUtxoGroup): number => (group.blockInputs
    ? group.blockInputs.length : 1 + group.dataNftUtxos.length) + (group.ordinaryDynamicChunkInputs?.length ?? 0);
  // Every group's planned master, for a caller planned before the callees its witnesses name.
  const plannedMasterIndices: number[] = [];
  let plannedBase = externalCallInputBase;
  for (const group of externalCallUtxoGroups) {
    plannedMasterIndices.push(plannedBase);
    plannedBase += plannedInputWidth(group);
  }
  let currentInputBase = externalCallInputBase;
  const groupMasterIndices: number[] = []; // per co-spend group: its master's absolute input index
  for (let groupIdx = 0; groupIdx < externalCallUtxoGroups.length; groupIdx++) {
    const group = externalCallUtxoGroups[groupIdx];
    const meta = groupMetas[groupIdx];
    const masterInputIndex = currentInputBase;
    groupMasterIndices[groupIdx] = masterInputIndex;

    // Re-create data NFT unlockers with correct master input index
    group.dataNftUtxos = group.dataNftUtxos.map((nftUtxo) => ({
      ...nftUtxo,
      unlocker: createDataNftUnlocker(
        group.externalContract.inner, masterInputIndex, group.categoryId,
      ),
    }));
    group.ordinaryDynamicChunkInputs = group.ordinaryDynamicChunkInputs?.map((chunk) => ({
      ...chunk,
      utxo: { ...chunk.utxo, unlocker: createDynamicChunkUnlocker(
        group.externalContract.inner, masterInputIndex, group.categoryId, chunk.name, chunk.type,
      ) },
    }));
    // A full block is what gets serialized, so its dataNft slots must carry the re-created unlockers too.
    if (group.blockInputs && group.blockLayout && group.returnEventInBlock === true) {
      let dataIdx = 0;
      for (const slot of group.blockLayout.slots) {
        if (slot.kind !== 'dataNft') continue;
        const recreated = group.dataNftUtxos[dataIdx++];
        if (recreated && group.blockInputs[slot.offset]) group.blockInputs[slot.offset] = recreated;
      }
    }

    // Build hidden args by scanning the function's ABI inputs for hidden param names
    type AbiEntry = AbiFunction;
    const bAbiAll = group.externalContract.inner.artifact.abi as readonly AbiEntry[];
    const bAbiFunc = group.compilerRoute?.abiFunction
      ?? bAbiAll.find((f) => f.name === group.functionName);
    const bAbiInputs = bAbiFunc?.inputs ?? [];
    const selfIdentityBand = !group.compilerRoute && usesOrdinarySelfIdentity(bAbiFunc)
      ? await host.ensureOrdinarySelfIdentityBand(group.externalContract, bAbiFunc!) : undefined;
    const routeArgs = argumentsForPhysicalAbiFrame({
      abiFunction: bAbiFunc,
      physicalFunctionArgs: group.functionArgs,
      logicalFunctionName: group.logicalFunctionName ?? group.functionName,
      logicalFunctionArgs: group.logicalFunctionArgs,
      compilerRoute: group.compilerRoute,
    });
    const userArgCount = routeArgs.length;
    const callerLock = group.callerIdentity?.lockingBytecode.toLowerCase();
    const rootPhysicalLock = binToHex(host.physicalRootLockingBytecode).toLowerCase();
    const needsRootCallerAnchor = meta.parentGroupIndex < 0
      && callerLock !== undefined && callerLock !== rootPhysicalLock
      && bAbiInputs.some((input) => input.name === '__internal__msgSenderAnchorIdx');
    if (needsRootCallerAnchor) {
      if (!host.rootLogicalAddress) throw new Error('A logical nested caller requires its CREATE address.');
      const identity = await resolveLogicalIdentity(host.provider, host.rootLogicalAddress);
      if (identity.categoryId.toLowerCase() !== group.callerIdentity?.categoryId.toLowerCase()
        || binToHex(identity.unlocker.generateLockingBytecode()).toLowerCase() !== callerLock) {
        throw new Error('Nested caller CREATE identity does not match its authenticated call subject.');
      }
    }

    // Compiler routes may interleave hidden inputs with published witnesses (for example
    // __internal__msgSenderCategory immediately after batchBlob). Treating all visible args as an ABI prefix
    // shifts every later witness into the preceding hidden slot. Assemble routed calls in exact ABI order;
    // ordinary function calls retain their existing visible-prefix behavior.
    let bFinalArgs = group.compilerRoute ? [] : [...routeArgs];
    let routeArgIndex = 0;
    let bReturningSlotIdx = 0;

    // Pre-compute child group indices for transitive param resolution
    let childGroupIndices: number[] | undefined;
    const getChildGroupIndices = (): number[] => {
      if (!childGroupIndices) {
        childGroupIndices = [];
        for (let tIdx = groupIdx + 1; tIdx < externalCallUtxoGroups.length; tIdx++) {
          if (groupMetas[tIdx].parentGroupIndex === groupIdx) {
            childGroupIndices.push(tIdx);
          }
        }
      }
      return childGroupIndices;
    };
    // An ordinary frame's absolute input and output coordinates are planned here from band widths, which count no
    // slot of the root's block that a plain send compacts or a published record holds open. The builder re-reads them
    // from the assembled transaction, as it does the root's and a low-level call's nested callers': the masters and
    // records of its callees, the first old chunk its write consumes and its first block-hash slot.
    const rebindsAssembledCoordinates = !group.compilerRoute && group.callBatch === undefined
      && group.callBatchUnit === undefined && group.delegateCallGroupIndex === undefined;
    const bindToCoin = (paramName: string, coin: Pick<Utxo, 'txid' | 'vout'>): void => {
      group.inputWitnessOutpoints = {
        ...group.inputWitnessOutpoints, [paramName]: { txid: coin.txid, vout: coin.vout },
      };
    };
    const calleeGroupForSlot = (slot: number): number | undefined => {
      const callsiteId = bAbiFunc?.externalCalls?.[slot]?.callsiteId;
      const children = getChildGroupIndices();
      return callsiteId === undefined ? children[slot]
        : children.find((index) => groupMetas[index].ecSlot.callsiteId === callsiteId);
    };

    for (let i = group.compilerRoute ? 0 : userArgCount; i < bAbiInputs.length; i++) {
      const paramName = bAbiInputs[i].name;
      const argumentCountBefore = bFinalArgs.length;

      if (group.compilerRoute && !paramName.startsWith('__internal__')) {
        if (routeArgIndex >= routeArgs.length) {
          throw new Error(`Compiler route '${group.functionName}' is missing visible ABI argument '${paramName}'`);
        }
        bFinalArgs.push(routeArgs[routeArgIndex++]);
        continue;
      }

      if (!group.compilerRoute && usesOrdinarySelfIdentity(bAbiFunc)
        && paramName === '__internal__graphSelfIdentityInput') {
        bFinalArgs.push(-1n);
        if (selfIdentityBand !== undefined) host.pendingAnchorFills.push({
          group, functionName: group.functionName, encodedArgs: bFinalArgs,
          positions: [{ argIndex: bFinalArgs.length - 1, name: paramName,
            band: selfIdentityBand, proxyRoute: false, required: true }],
        });
        continue;
      }
      const resolvedInternalArgs = group.compilerRoute?.internalArgs ?? group.internalArgs;
      if (resolvedInternalArgs
        && Object.prototype.hasOwnProperty.call(resolvedInternalArgs, paramName)) {
        const value = resolvedInternalArgs[paramName];
        bFinalArgs.push(group.relativeOutputInternalArgs?.includes(paramName)
          ? BigInt(masterInputIndex) + BigInt(value as bigint)
          : value);
      } else if (paramName === '__internal__externalCallInputBase') {
        // Where this function's external call groups start in the input sequence: immediately after B's own
        // co-spent block, which is blockInputs wide when a full block was assembled (X13).
        const thisGroupEnd = currentInputBase
          + (group.blockInputs ? group.blockInputs.length : 1 + group.dataNftUtxos.length)
          + (group.ordinaryDynamicChunkInputs?.length ?? 0);
        bFinalArgs.push(BigInt(thisGroupEnd));
        // The region begins at the master of the callee of the first call, wherever the transaction places it.
        const firstCallee = rebindsAssembledCoordinates ? calleeGroupForSlot(0) : undefined;
        if (firstCallee !== undefined) {
          const physical = externalCallUtxoGroups[externalCallUtxoGroups[firstCallee].sharedGroupIndex ?? firstCallee];
          group.mintingInputWitnessCategories = {
            ...group.mintingInputWitnessCategories, [paramName]: physical.categoryId,
          };
        }
      } else if (rebindsAssembledCoordinates && /^__internal__extcallMasterIdx\d*$/.test(paramName)) {
        // Each call's own callee master, which a function that makes more than one call reads for every call. A
        // call this run does not make names no input (-1).
        const suffix = paramName.slice('__internal__extcallMasterIdx'.length);
        const callee = calleeGroupForSlot(suffix === '' ? 0 : Number(suffix));
        const physicalIndex = callee === undefined ? undefined
          : externalCallUtxoGroups[callee].sharedGroupIndex ?? callee;
        bFinalArgs.push(physicalIndex === undefined ? -1n : BigInt(plannedMasterIndices[physicalIndex]));
        if (physicalIndex !== undefined) {
          group.mintingInputWitnessCategories = {
            ...group.mintingInputWitnessCategories, [paramName]: externalCallUtxoGroups[physicalIndex].categoryId,
          };
        }
      } else if (paramName.startsWith('__internal__extcallAnchorIdx')) {
        // Batch-route callees address their own callees physically; -1 selects the direct identity proof.
        bFinalArgs.push(-1n);
      } else if (paramName === '__internal__msgSenderCategory') {
        bFinalArgs.push(hexToBin(meta.callerCategoryId).reverse());
      } else if (paramName === '__internal__msgSenderAnchorIdx') {
        // A logical root caller is authenticated by its co-spent CREATE identity. Its absolute
        // coordinate is filled after the builder assembles the input bands. Physical callers
        // continue to use the directly authenticated master input.
        bFinalArgs.push(-1n);
        if (needsRootCallerAnchor) {
          host.pendingAnchorFills.push({
            group,
            functionName: group.functionName,
            encodedArgs: bFinalArgs,
            positions: [{
              argIndex: bFinalArgs.length - 1,
              name: paramName,
              categoryId: group.callerIdentity!.categoryId,
              proxyRoute: false,
              required: true,
            }],
          });
        }
      } else if (paramName === '__internal__blockOracleInputIndex') {
        // Planned here: each sync of the builder's unlockers names the transaction's one info coin of the pool.
        const ownOffset = group.blockLayout?.slots.find((slot) => slot.kind === 'blockInfoOracle')?.offset;
        const pool = group.externalContract.inner.oraclePool as string | undefined;
        const own = ownOffset === undefined ? undefined : group.blockInputs?.[ownOffset];
        if (pool !== undefined && !sharedOracleInputs.has(pool) && own !== undefined && isPoolInfoInput(own, pool)) {
          sharedOracleInputs.set(pool, masterInputIndex + ownOffset!);
        }
        const oracleIndex = pool === undefined ? undefined : sharedOracleInputs.get(pool);
        if (oracleIndex === undefined) throw new Error('nested block oracle reader has no co-spent pool coin');
        bFinalArgs.push(BigInt(oracleIndex));
      } else if (paramName === '__internal__blockhashInputIndex') {
        const firstOracleOffset = group.blockLayout?.slots.find(
          (slot) => slot.kind === 'blockhashOracle',
        )?.offset;
        if (firstOracleOffset === undefined) {
          throw new Error('External message-bus batch graph blockhash plan has no physical oracle band');
        }
        bFinalArgs.push(BigInt(masterInputIndex + firstOracleOffset));
        const firstOracle = group.blockInputs?.[firstOracleOffset];
        if (rebindsAssembledCoordinates && firstOracle !== undefined) bindToCoin(paramName, firstOracle);
      } else if (paramName === '__internal__returnOutputIdx') {
        const retIdx = returnEventIndexMap.get(groupIdx);
        if (retIdx !== undefined) {
          bFinalArgs.push(BigInt(retIdx));
        }
      } else if (paramName === '__internal__valueChunkOutputBase') {
        // Composed computed values are relocated after the complete participant layout is materialized.
        bFinalArgs.push(-1n);
      } else if (paramName === '__internal__dynamicChunkInputBase') {
        // Old chunks follow this callee's fixed block. With none, the negative sentinel makes the covenant
        // reconstruct its output base rather than treating input zero as an output coordinate.
        const firstOldChunk = group.ordinaryDynamicChunkInputs?.[0]?.utxo;
        bFinalArgs.push(firstOldChunk === undefined ? -1n
          : BigInt(masterInputIndex + (group.blockInputs?.length ?? 1 + group.dataNftUtxos.length)));
        // The run reads them from the first one. A run that also reads chunks inside its block takes the first of
        // those instead, once the transaction is assembled (pendingDynamicChunkInputFills).
        if (rebindsAssembledCoordinates && firstOldChunk !== undefined && !group.dynamicChunkResources?.length) {
          bindToCoin(paramName, firstOldChunk);
        }
      } else if (paramName === '__internal__dynamicChunkOutputBase') {
        // A nested route's final output coordinate is resolved by its physical layout authority.
        bFinalArgs.push(-1n);
      } else if (paramName.startsWith('__internal__externalReturnOutputIdx')) {
        // An ordinary frame names the record of the call in the slot the witness stands for (its ordinal among the
        // function's returning calls), matched by callsite: a call this run does not make shifts no later witness
        // and names none itself (-1). Other frames take their returning callees in order.
        let childIdx: number | undefined;
        if (rebindsAssembledCoordinates) {
          const slot = externalReturnParamSlot(paramName, bAbiFunc?.externalCalls);
          childIdx = slot === undefined ? undefined : calleeGroupForSlot(slot);
        } else {
          childIdx = getChildGroupIndices()
            .filter((cIdx) => groupMetas[cIdx].ecSlot.hasReturnValues)[bReturningSlotIdx];
          bReturningSlotIdx++;
        }
        const childRetIdx = childIdx === undefined ? undefined : returnEventIndexMap.get(childIdx);
        if (childIdx !== undefined && childRetIdx !== undefined) {
          bFinalArgs.push(BigInt(childRetIdx));
          // Read where the callee's record lands, as the root's own return witnesses are.
          if (rebindsAssembledCoordinates) {
            group.returnWitnessGroups = {
              ...group.returnWitnessGroups,
              [paramName]: logicalReturnGroupIndex(externalCallUtxoGroups, childIdx),
            };
          }
        }
      } else if (paramName.startsWith('__internal__loopTargetStride')) {
        // A computed-target loop's occurrences are this caller's child groups. One occurrence's physical width is
        // the width of the block the SDK composed for it (master + the state data NFTs the call reads); the next
        // iteration's master starts that far past the previous one. The compiler cannot know a callee's private
        // footprint, so it multiplies the loop index by this witness.
        const witnessName = `__internal__loopTargets${paramName.slice('__internal__loopTargetStride'.length)}`;
        const slot = (bAbiFunc?.externalCalls ?? []).findIndex((call) => call.loopArrayVar === witnessName);
        const published = slot < 0 ? undefined : bAbiFunc?.externalCalls?.[slot];
        const children = getChildGroupIndices().map((idx) => externalCallUtxoGroups[idx]);
        const matching = published?.callsiteId === undefined ? []
          : children.filter((child) => child.sourceCallsiteId === published.callsiteId);
        const candidate = matching.find((child) => (child.blockInputs?.length ?? 0) > 0)
          ?? matching[0] ?? children[0];
        const physical = candidate?.sharedGroupIndex === undefined ? candidate
          : externalCallUtxoGroups[candidate.sharedGroupIndex] ?? candidate;
        bFinalArgs.push(physical === undefined ? 1n
          : BigInt(physical.blockInputs ? physical.blockInputs.length : 1 + physical.dataNftUtxos.length));
      } else if (paramName.startsWith('__internal__externalCallSelector')) {
        // Resolve selector for child group's target function. An ordinary frame takes the callee of the slot's
        // callsite, as two calls can name functions of one name on two contracts; other frames match by name.
        const children = getChildGroupIndices();
        const slotIdx = host.selectorParamSlot(paramName, bAbiFunc?.externalCalls);
        const call = bAbiFunc?.externalCalls?.[slotIdx];
        const slotCallee = rebindsAssembledCoordinates ? calleeGroupForSlot(slotIdx) : undefined;
        const childGroup = rebindsAssembledCoordinates
          ? slotCallee === undefined ? undefined : externalCallUtxoGroups[slotCallee]
          : children
            .map((idx) => externalCallUtxoGroups[idx])
            .find((candidateGroup) => candidateGroup.functionName === call?.functionName
              || candidateGroup.logicalFunctionName === call?.functionName
              || candidateGroup.functionName === call?.rawFunctionName)
            ?? (slotIdx < children.length ? externalCallUtxoGroups[children[slotIdx]] : undefined);
        if (childGroup) {
          const cAbi = childGroup.externalContract.inner.artifact.abi as readonly { name: string; selector?: string }[];
          const cFunc = cAbi.find((f) => f.name === childGroup.functionName);
          if (cFunc?.selector) {
            bFinalArgs.push(hexToBin(cFunc.selector));
          }
        }
      }
      // Preserve ABI order even when this composed call does not exercise a compiler-owned optional path.
      // Any path that actually consumes the sentinel still fails closed in its covenant.
      if (bFinalArgs.length === argumentCountBefore && paramName.startsWith('__internal__')) {
        bFinalArgs.push(defaultInternalFunctionArg(bAbiInputs[i]));
      }
    }

    // Create master unlocker
    const hasResolvedHiddenArgs = !group.compilerRoute && bFinalArgs.length !== routeArgs.length;
    let bMasterUnlocker = group.compilerRoute
      ? group.externalContract.inner.createCompilerRouteUnlocker(
        group.compilerRoute.abiFunction, group.compilerRoute.selector,
      )(...bFinalArgs)
      : hasResolvedHiddenArgs && bAbiFunc
        ? group.externalContract.inner.createAbiUnlocker(bAbiFunc as AbiFunction)(...bFinalArgs)
        : (group.externalContract.inner.unlock as any)[group.functionName](...bFinalArgs);

    // The external participant's absolute group base is known only here. Resolve its selected message-bus
    // rows now, place active oracle co-spends at their exact row-band offsets, and leave every inactive slot as the
    // already-created funder. Computed n values are recovered from B's own covenant trace at B's real index.
    if (group.graphBlockhashSelections?.length) {
      if (!group.blockInputs || !group.blockLayout) {
        throw new Error('External message-bus batch graph blockhash route has no balanced participant block');
      }
      const firstOracleOffset = group.blockLayout.slots.find(
        (slot) => slot.kind === 'blockhashOracle',
      )?.offset;
      const plan = group.compilerRoute?.abiFunction.graphBlockhashOracle;
      if (firstOracleOffset === undefined || !plan) {
        throw new Error('External message-bus batch graph blockhash metadata/layout mismatch');
      }
      const absoluteBase = masterInputIndex + firstOracleOffset;
      const bSc = group.externalContract as any;
      const pool: string | undefined = group.externalContract.inner.oraclePool;
      if (pool === undefined) {
        throw new Error(`${group.externalContract.inner.name} reads blockhash(n), and binds no oracle pool`);
      }
      const prior: Array<{
        slotOrdinal: number; utxo: Utxo; unlocker: Unlocker; recreate: Output;
      }> = [];
      for (const selection of group.graphBlockhashSelections) {
        const n = host.isComputedBlockhashKey(selection.readKey)
          ? await host.extractGraphBlockhashRead(bSc,
            group.masterUtxo as Utxo, bMasterUnlocker, group.dataNftUtxos,
            prior, absoluteBase, selection.slotOrdinal, plan.slotCount, masterInputIndex,
          )
          : host.paramBlockhashN(bSc, selection.readKey, selection.rowArgs, selection.handler);
        if (n === null) throw new Error(`blockhash: could not resolve external message-bus batch read "${selection.readKey}"`);
        const coSpend = await resolveBlockhashCoSpend(host.provider, pool, n, prior.map(({ utxo }) => utxo));
        if (!coSpend) throw new Error(`blockhash(${n}): oracle pool ${pool} has no live slot that answers block ${n}`);
        const physicalOffset = firstOracleOffset + selection.slotOrdinal;
        group.blockInputs[physicalOffset] = { ...coSpend.utxo, unlocker: coSpend.unlocker };
        prior.push({
          slotOrdinal: selection.slotOrdinal, utxo: coSpend.utxo, unlocker: coSpend.unlocker,
          recreate: coSpend.recreateOutput,
        });
        host.noteBhLocktime(coSpend.locktime);
      }
    }
    if (group.compilerRoute && routeArgIndex !== routeArgs.length) {
      throw new Error(
        `Compiler route '${group.functionName}' supplied ${routeArgs.length} visible arguments, `
        + `but its ABI consumed ${routeArgIndex}`,
      );
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_VMAP_PROOF === '1' && group.compilerRoute) {
      console.error('delegate-route-final-args', {
        contract: group.externalContract.inner.artifact.contractName,
        function: group.functionName,
        args: bAbiInputs.map((input, index) => ({
          name: input.name,
          value: bFinalArgs[index] instanceof Uint8Array
            ? binToHex(bFinalArgs[index] as Uint8Array) : String(bFinalArgs[index]),
        })),
      });
    }
    group.masterUtxo = { ...group.masterUtxo, unlocker: bMasterUnlocker } as UnlockableUtxo;
    const applyMasterUnlocker = (unlocker: Unlocker): void => {
      group.masterUtxo = { ...group.masterUtxo, unlocker } as UnlockableUtxo;
      if (group.blockInputs && group.blockLayout) {
        const masterOffset = group.blockLayout.slots.find((slot) => slot.kind === 'master')?.offset;
        if (masterOffset !== undefined && group.blockInputs[masterOffset]) {
          group.blockInputs[masterOffset] = {
            ...group.blockInputs[masterOffset],
            unlocker,
          };
        }
      }
    };
    applyMasterUnlocker(bMasterUnlocker);
    const capturedUnlockerArgs = bFinalArgs;
    const capturedUnlockerInputs = bAbiInputs;
    group.internalArgNames = Object.freeze(capturedUnlockerInputs.map((input) => input.name));
    group.refreshInternalArgs = (updates, options) => {
      group.internalArgs = { ...group.internalArgs, ...updates };
      const returnIdx = capturedUnlockerInputs.findIndex((input) => input.name === '__internal__returnOutputIdx');
      const previousReturn = returnIdx >= 0 && typeof capturedUnlockerArgs[returnIdx] === 'bigint'
        ? Number(capturedUnlockerArgs[returnIdx]) : undefined;
      for (const [name, value] of Object.entries(updates)) {
        const index = capturedUnlockerInputs.findIndex((input) => input.name === name);
        if (index >= 0) capturedUnlockerArgs[index] = value;
      }
      if (options?.shiftPredOut !== false
        && previousReturn !== undefined && typeof updates.__internal__returnOutputIdx === 'bigint') {
        const delta = Number(updates.__internal__returnOutputIdx) - previousReturn;
        if (delta !== 0) {
          for (const [index, input] of capturedUnlockerInputs.entries()) {
            if (!/PredOut/.test(input.name) || typeof capturedUnlockerArgs[index] !== 'bigint') continue;
            if (capturedUnlockerArgs[index] < 0n) continue;
            if (updates[input.name] !== undefined) continue;
            capturedUnlockerArgs[index] = (capturedUnlockerArgs[index] as bigint) + BigInt(delta);
          }
        }
      }
      if (group.relocatedPredOutBase !== undefined) {
        const trailingBase = BigInt(groupLayoutTrailingBase(group));
        const predBase = BigInt(group.relocatedPredOutBase);
        let trailing = 0n;
        for (const [index, input] of capturedUnlockerInputs.entries()) {
          if (!/PredOut/.test(input.name) || typeof capturedUnlockerArgs[index] !== 'bigint') continue;
          if (capturedUnlockerArgs[index] < 0n) continue;
          if ((capturedUnlockerArgs[index] as bigint) < trailingBase) continue;
          if ((capturedUnlockerArgs[index] as bigint) >= predBase) continue;
          if (updates[input.name] !== undefined) continue;
          capturedUnlockerArgs[index] = predBase + trailing;
          trailing += 1n;
        }
      }
      const unlocker = group.compilerRoute
        ? group.externalContract.inner.createCompilerRouteUnlocker(
          group.compilerRoute.abiFunction, group.compilerRoute.selector,
        )(...capturedUnlockerArgs)
        : hasResolvedHiddenArgs && bAbiFunc
          ? group.externalContract.inner.createAbiUnlocker(bAbiFunc as AbiFunction)(...capturedUnlockerArgs)
          : (group.externalContract.inner.unlock as Record<string, ((...args: never[]) => Unlocker) | undefined>)
            [group.functionName]!(...capturedUnlockerArgs as never[]);
      applyMasterUnlocker(unlocker);
    };
    group.refreshFunctionArgs = (nextArgs) => {
      const visibleInputs = capturedUnlockerInputs.filter(
        (input) => !input.name.startsWith('__internal__'),
      );
      if (visibleInputs.length !== nextArgs.length) {
        throw new Error(
          `Cannot refresh ${group.functionName}: expected ${visibleInputs.length} visible arguments, `
          + `received ${nextArgs.length}.`,
        );
      }
      group.functionArgs = [...nextArgs];
      let nextIndex = 0;
      for (const [inputIndex, input] of capturedUnlockerInputs.entries()) {
        if (input.name.startsWith('__internal__')) continue;
        capturedUnlockerArgs[inputIndex] = nextArgs[nextIndex++];
      }
      group.refreshInternalArgs?.({});
    };
    // A multi-call spend runs its frames through the callee's multi-call entry; its frames' witnesses follow
    // the master's input, so the unlocker needs no refresh beyond rebuilding it.
    if (group.callBatch !== undefined) {
      applyMasterUnlocker(directCallBatchUnlocker(group));
      group.refreshInternalArgs = (updates) => {
        group.internalArgs = { ...group.internalArgs, ...updates };
        applyMasterUnlocker(directCallBatchUnlocker(group));
      };
      group.refreshFunctionArgs = () => undefined;
    }

    // Advance to next group. A full block occupies blockInputs.length slots (its output-only slots each
    // carry a paired funder), which is what the builder's input flattening emits.
    currentInputBase += plannedInputWidth(group);
  }
  timing('nested-bases-complete');
  return { currentInputBase, groupMasterIndices };
}
