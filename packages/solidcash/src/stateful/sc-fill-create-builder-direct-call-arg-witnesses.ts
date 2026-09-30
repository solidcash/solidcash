/**
 * phase-boundary extract: SC _createBuilder extract — fill direct-call selector / master-idx / anchor / return-idx witnesses
 * after nested-bases unlockers finalize.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import type { AbiFunction, Artifact, ExternalCallAbi, StateValue } from '@solidcash/utils';
import { encodePushdataValue } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { addressToLockScript } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { logicalIdentityBandKey, resolveLogicalIdentity } from './logical-identity.js';
import { externalCallTargetSourceLockingBytecodeHex } from './mapping-key-lookup.js';
import { defaultInternalFunctionArg, materializeInternalFunctionArgument } from './kernel-journal-helpers.js';
import { selectorParamSlot } from './physical-external-call.js';
import type { CreateBuilderLoopIdxRange } from './sc-expand-resolve-create-builder-external-calls.js';
import type { ExternalGroupMeta } from './stateful-lifecycle-types.js';

export interface FillCreateBuilderDirectCallArgWitnessesHost {
  readonly inner: { provider: NetworkProvider; artifact: Artifact };
  resolveExternalArgs(
    argSources: readonly unknown[] | undefined,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    state?: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
    occurrenceIndex?: number,
    stateIncludesPriorWrites?: boolean,
    executionSelfAddress?: FunctionArgument,
  ): FunctionArgument[] | undefined;
}

export type CreateBuilderAnchorFillPosition = {
  argIndex: number;
  band?: number;
  categoryId?: string;
  proxyRoute: boolean;
};

export type CreateBuilderCalleeContract = {
  _logicalAddress?: string;
  target?: string;
  address?: string;
  inner: { lockingBytecode: string };
};

/**
 * Append direct-group selector, master-index, logical-identity anchor, and return-event
 * witness args onto `finalArgs`. Mutates identity-anchor / return-witness side tables in place.
 */
export async function fillCreateBuilderDirectCallArgWitnesses(
  host: FillCreateBuilderDirectCallArgWitnessesHost,
  params: {
    abiFunction: AbiFunction;
    args: FunctionArgument[];
    finalArgs: FunctionArgument[];
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    groupMetas: ExternalGroupMeta[];
    directGroupCount: number;
    loopIdxRanges: readonly CreateBuilderLoopIdxRange[];
    groupMasterIndices: readonly number[];
    externalCalls: readonly ExternalCallAbi[];
    returnEventOutputBase: number;
    returnEventIndexMap: ReadonlyMap<number, number>;
    callerStateSnapshot: Record<string, StateValue> | undefined;
    onChainState: { state: Record<string, StateValue> };
    publicSelfAddress: FunctionArgument;
    identityAnchors: UnlockableUtxo[];
    identityAnchorBandByAddress: Map<string, number>;
    externalCallAnchorIndices: ReadonlyMap<number, bigint>;
    topLevelAnchorFillPositions: CreateBuilderAnchorFillPosition[];
    topLevelReturnWitnessPlan: bigint[];
    topLevelReturnWitnessGroups: number[];
  },
): Promise<FunctionArgument[]> {
  let finalArgs = params.finalArgs;
  const {
    abiFunction, args, externalCallUtxoGroups, groupMetas, directGroupCount, loopIdxRanges,
    groupMasterIndices, externalCalls, returnEventOutputBase, returnEventIndexMap,
    callerStateSnapshot, onChainState, publicSelfAddress, identityAnchors,
    identityAnchorBandByAddress, externalCallAnchorIndices, topLevelAnchorFillPositions,
    topLevelReturnWitnessPlan, topLevelReturnWitnessGroups,
  } = params;

  // Conditional callsites retain their ABI slot numbers when inactive, while the physical groups compact.
  // Fill this topology by ABI name; appending one witness per physical group would put the later group's
  // master index into an earlier omitted bytes4 selector slot.
  const publishedCalls = abiFunction.externalCalls ?? [];
  const slotByCallsite = new Map(publishedCalls.flatMap((call, slot) => call.callsiteId === undefined
    ? [] : [[call.callsiteId, slot] as const]));
  const physicalSlot = (groupIndex: number): number => {
    const id = groupMetas[groupIndex]?.ecSlot.callsiteId;
    return id === undefined ? groupIndex : slotByCallsite.get(id) ?? groupIndex;
  };
  const sparse = Array.from({ length: directGroupCount }, (_, index) => physicalSlot(index))
    .some((slot, index) => slot !== index);
  if (sparse) {
    if (loopIdxRanges.length > 0) {
      throw new Error('Sparse direct-call witnesses cannot include an expanded loop slot');
    }
    const groupBySlot = new Map(Array.from({ length: directGroupCount }, (_, index) => (
      [physicalSlot(index), index] as const
    )));
    const returningSlots = publishedCalls.flatMap((call, slot) => call.hasReturnValues ? [slot] : []);
    for (const input of abiFunction.inputs) {
      const selector = /^__internal__externalCallSelector(\d*)$/.exec(input.name);
      const master = /^__internal__extcallMasterIdx(\d*)$/.exec(input.name);
      const anchor = /^__internal__extcallAnchorIdx(\d*)$/.exec(input.name);
      const returned = /^__internal__externalReturnOutputIdx(\d*)$/.exec(input.name);
      if (!selector && !master && !anchor && !returned) continue;
      const slot = returned ? returningSlots[Number(returned[1])]
        : selector ? selectorParamSlot(input.name, publishedCalls)
          : Number((master ?? anchor)![1]);
      const groupIndex = slot === undefined ? undefined : groupBySlot.get(slot);
      const group = groupIndex === undefined ? undefined : externalCallUtxoGroups[groupIndex];
      let value: FunctionArgument = defaultInternalFunctionArg(input);
      if (groupIndex !== undefined && group) {
        if (selector) {
          const selected = group.compilerRoute?.selector
            ?? (group.externalContract.inner.artifact.abi as readonly { name: string; selector?: string }[])
              .find((candidate) => candidate.name === group.functionName)?.selector;
          if (selected === undefined) throw new Error(`No selector for direct callee '${group.functionName}'`);
          value = typeof selected === 'string' ? hexToBin(selected) : selected;
        } else if (master) value = BigInt(groupMasterIndices[groupIndex]);
        else if (anchor) value = externalCallAnchorIndices.get(groupIndex) ?? -1n;
        else if (returned) {
          const outputIndex = returnEventIndexMap.get(groupIndex);
          if (outputIndex !== undefined) value = BigInt(outputIndex);
        }
      } else if (master || anchor || returned) value = -1n;
      finalArgs = materializeInternalFunctionArgument(finalArgs, abiFunction.inputs, input.name, value);
      if (returned) {
        topLevelReturnWitnessPlan.push(typeof value === 'bigint' ? value : -1n);
        topLevelReturnWitnessGroups.push(groupIndex ?? -1);
      }
    }
    return finalArgs;
  }

  // Resolve 4-byte hash selector from B's ABI - only for A's DIRECT external calls.
  // Transitive call selectors are handled above as part of B's hidden params.
  const selectorParamCount = abiFunction!.inputs.filter(
    (inp: { name: string }) => inp.name.startsWith('__internal__externalCallSelector'),
  ).length;
  if (selectorParamCount > 0) {
    for (let i = 0; i < directGroupCount; i++) {
      const group = externalCallUtxoGroups[i];
      // A loop-expanded slot (computed-target / array-element loop) owns ONE shared selector param (the covenant
      // checks each co-spent element against it), not one per element - fill it once at the range start, skip
      // the rest, mirroring the per-group master-index fill above.
      const selRange = loopIdxRanges.find((r) => i >= r.start && i < r.start + r.count);
      if (selRange && i !== selRange.start) continue;
      // call/staticcall/delegatecall modes don't inject selector params - skip them
      if (group.callMode === 'call' || group.callMode === 'staticcall' || group.callMode === 'delegatecall') continue;
      // A single-method callee has no witness selector param (its unlocking carries no selector); only groups
      // the compiler marked needsSelectorVerification get a filled selector. Absent (older artifacts) = fill.
      if ((groupMetas[i].ecSlot as { needsSelectorVerification?: boolean })
        .needsSelectorVerification === false) continue;
      const targetSelector = group.compilerRoute
        ? binToHex(group.compilerRoute.selector)
        : (group.externalContract.inner.artifact.abi as readonly { name: string; selector?: string }[])
          .find((f) => f.name === group.functionName)?.selector;
      if (!targetSelector) {
        throw new Error(
          `Function '${group.functionName}' not found in external contract ABI`,
        );
      }
      finalArgs = [...finalArgs, hexToBin(targetSelector)];
    }
  }

  // Per-slot callee master input index (so the covenant reads the RIGHT co-spent callee without a fixed
  // block offset). Matches the compiler: fn-ptr calls always get one; a loop-free MULTI-call function fills
  // every slot's index too (robust when a prior callee's data-NFT count - from an under-declared interface -
  // shifts the fixed offset). A function with any array-element (loop) call keeps the fixed offset (the loop
  // expands into N groups, so a 1:1 runtime fill cannot be aligned).
  const hasLoopSlotAbi = (abiFunction?.externalCalls ?? []).some((ec) => ec.loopArrayVar);
  // A received-value pointer array (fnPtrCall loop slot) gets ONE witness arg: the framed list of its
  // expanded groups' master input indices (`__internal__extcallIdxList<slot>`), in group order - the
  // covenant decodes one per iteration and identity-binds it to arr[i].
  const appendIdxList = (r: { start: number; count: number }): void => {
    const parts: Uint8Array[] = [];
    for (let j = r.start; j < r.start + r.count; j++) {
      parts.push(encodePushdataValue(BigInt(groupMasterIndices[j]), 'bigint'));
    }
    const total = parts.reduce((s, p) => s + p.length, 0);
    const list = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { list.set(p, off); off += p.length; }
    finalArgs = [...finalArgs, list];
  };
  for (let i = 0; i <= directGroupCount; i++) {
    // A zero-instance fnPtrCall loop slot still owns its (empty) witness list arg at its slot position.
    for (const r of loopIdxRanges) {
      if (r.start === i && r.count === 0 && r.fnPtrCall) appendIdxList(r);
    }
    if (i === directGroupCount) break;
    const range = loopIdxRanges.find((r) => i >= r.start && i < r.start + r.count);
    if (range) {
      if (range.fnPtrCall && i === range.start) appendIdxList(range);
      continue; // loop-expanded groups never get per-group index args
    }
    const ecSlot = groupMetas[i].ecSlot as { fnPtrCall?: boolean };
    if (ecSlot.fnPtrCall || (!hasLoopSlotAbi && directGroupCount > 1)) {
      finalArgs = [...finalArgs, BigInt(groupMasterIndices[i])];
    }
  }

  // Per-slot logical-identity anchor input index. -1 selects the direct identity proof (the visible address
  // IS the co-spent master's locking bytecode); a real index selects the proxy anchor proof. Mirrors the
  // compiler's synthesis condition: fixed-slot calls whose target is a value rather than a baked literal or
  // tx-derived msg.sender. Loop-expanded groups own no anchor param, exactly as for the master index above.
  for (let i = 0; i < directGroupCount; i++) {
    if (loopIdxRanges.some((r) => i >= r.start && i < r.start + r.count)) continue;
    if (!abiFunction?.inputs.some((input) => input.name === `__internal__extcallAnchorIdx${i}`)) continue;
    const anchorSlot = groupMetas[i].ecSlot as {
      addressParam?: string; addressLiteral?: string; addressIsMsgSender?: boolean;
    };
    if (!anchorSlot.addressParam || anchorSlot.addressLiteral !== undefined
      || anchorSlot.addressIsMsgSender) continue;
    const group = externalCallUtxoGroups[i];
    const callee = group?.externalContract as CreateBuilderCalleeContract | undefined;
    const logicalAddress = callee?._logicalAddress ?? callee?.target ?? callee?.address;
    let band: number | undefined;
    if (logicalAddress) {
      const logicalLbc = binToHex(addressToLockScript(logicalAddress));
      const spentUnlocker = group?.masterUtxo && 'unlocker' in group.masterUtxo
        ? group.masterUtxo.unlocker : undefined;
      const spentLock = spentUnlocker
        ? binToHex(spentUnlocker.generateLockingBytecode())
        : callee!.inner.lockingBytecode;
      const call = abiFunction.externalCalls?.[i];
      const resolvedAddressSource = call?.addressSource
        ? host.resolveExternalArgs(
          [call.addressSource], args, host.inner.artifact,
          callerStateSnapshot ?? onChainState.state, abiFunction.inputs,
          undefined, 0, false, publicSelfAddress,
        )?.[0]
        : call?.addressStateVar
          ? (callerStateSnapshot ?? onChainState.state)[call.addressStateVar] as FunctionArgument | undefined
          : undefined;
      const directArgument = externalCallTargetSourceLockingBytecodeHex(
        abiFunction, i, args, resolvedAddressSource,
      ) === spentLock;
      if (!directArgument && logicalLbc !== spentLock) {
        const bandKey = logicalIdentityBandKey(logicalAddress);
        band = identityAnchorBandByAddress.get(bandKey);
        if (band === undefined) {
          try {
            const resolved = await resolveLogicalIdentity(host.inner.provider, logicalAddress);
            band = identityAnchors.length;
            identityAnchors.push({ ...resolved.anchor, unlocker: resolved.unlocker } as UnlockableUtxo);
            identityAnchorBandByAddress.set(bandKey, band);
          } catch (error) {
            if (!/missing or invalid/.test(error instanceof Error ? error.message : String(error))) throw error;
          }
        }
      }
    }
    if (band === undefined) {
      // -2 selects the authenticated compiler-route selector witness while
      // retaining ordinary direct locking-bytecode identity. -1 is the
      // ordinary source-selector/direct-identity path.
      const physicalGroup = group === undefined ? undefined
        : externalCallUtxoGroups[group.sharedGroupIndex ?? i];
      finalArgs = [...finalArgs, externalCallAnchorIndices.get(i)
        ?? (physicalGroup?.compilerRoute ? -2n : -1n)];
    } else {
      topLevelAnchorFillPositions.push({
        argIndex: finalArgs.length,
        band,
        proxyRoute: group?.functionName === '__forward' || group?.delegateCallGroupIndex !== undefined,
      });
      finalArgs = [...finalArgs, -1n];
    }
  }


  // Append per-slot _externalReturnOutputIdx params for A's args (direct returning calls only)
  const directReturningSlots = externalCalls.filter((ec) => ec.hasReturnValues);
  if (directReturningSlots.length > 0 && returnEventOutputBase >= 0) {
    for (let i = 0; i < directGroupCount; i++) {
      // A loop-expanded returning slot owns ONE shared externalReturnOutputIdx param (the covenant reads the
      // per-iteration event at base + i); fill it once at the range start, skip the rest - same as the selector
      // and master-index fills above (else N return-idx args vs 1 param -> arg-count mismatch).
      const retRange = loopIdxRanges.find((r) => i >= r.start && i < r.start + r.count);
      if (retRange && i !== retRange.start) continue;
      if (groupMetas[i].ecSlot.hasReturnValues) {
        const retOutputIdx = returnEventIndexMap.get(i);
        if (retOutputIdx !== undefined) {
          topLevelReturnWitnessPlan.push(BigInt(retOutputIdx));
          topLevelReturnWitnessGroups.push(i);
          finalArgs = [...finalArgs, BigInt(retOutputIdx)];
        }
      }
    }
  }

  return finalArgs;
}
