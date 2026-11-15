/**
 * phase-boundary extract: SC _createBuilder extract — the regions a transitive callee's own run reads (A calls B,
 * which calls C).
 */

import type { AbiFunction, Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Output, UnlockableUtxo, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  appendCreateBuilderNestedCalleeIterations,
  type NestedCalleeIterationContract,
} from './sc-append-create-builder-nested-callee-iterations.js';
import {
  appendCreateBuilderNestedCalleeKeccakLoop,
  TRAILING_BAND_USERS,
  type NestedCalleeKeccakLoopContract,
} from './sc-append-create-builder-nested-callee-keccak-loop.js';
import {
  assembleCreateBuilderNestedCalleeBlockInputs,
  type AssembleCreateBuilderNestedCalleeBlockHost,
} from './sc-assemble-create-builder-nested-callee-block.js';
import { isDirectConventionArtifact } from './sc-expand-resolve-create-builder-external-calls.js';
import { writtenDynamicChunkInputs } from './sc-load-create-builder-nested-callee-prelude.js';
import { argumentDynamicStateValues } from './sc-push-create-builder-direct-external-call-group.js';
import { resolveStatefulAbiFunction } from './stateful-abi-resolve.js';
import type { ExternalGroupMeta } from './stateful-lifecycle-types.js';

/** The regions after its block this layout places for a transitive callee, each by the ABI field that publishes it. */
const PLACED_REGIONS: ReadonlyArray<readonly [keyof AbiFunction, string]> = [
  ['collectionIterations', 'its collection walk'],
  ['keccakLoopReads', 'its keccak256 loop side-cars'],
  ['dynamicWrites', 'the chunks of dynamic state it writes'],
];

/** The block slots of a transitive callee this layout places: its master, its records and its call record's slot. */
const PLACED_SLOT_KINDS: ReadonlySet<string> = new Set(['master', 'dataNft', 'returnEvent']);

const publishes = (fn: AbiFunction, field: keyof AbiFunction): boolean => {
  const value = fn[field];
  return Array.isArray(value) ? value.length > 0 : value === true;
};

/** The function the group's call runs, as discovery selected it; none when its name selects no one function. */
function selectedFunction(artifact: Artifact, group: ExternalCallUtxoGroup): AbiFunction | undefined {
  try {
    return resolveStatefulAbiFunction(artifact, group.functionName, group.functionArgs);
  } catch {
    return undefined;
  }
}

export interface AppendCreateBuilderTransitiveCalleeRegionsHost {
  /** The host a direct callee's block is assembled with. */
  readonly block: AssembleCreateBuilderNestedCalleeBlockHost;
  /** The view the build lists the shared side-car pool (salt 0) through, when it has one (a creation's). */
  readonly sharedSidecarPool?: NetworkProvider;
}

/**
 * Lay out the block of each transitive callee (C, which a direct callee B calls) whose function reads a region right
 * after its block, the way a direct callee's block is laid out: its master, its records and its call record's slot
 * held open with an input, then the region where C's covenant reads it. The regions are the collection walk an
 * iteration reads, one shared side-car per iteration of a keccak256 loop, and the old chunks of the dynamic state it
 * writes (its new chunks are learned from its run once its record is, as a direct callee's are).
 *
 * C's master follows B's block, where B reads it, so only C's own block and regions grow. Every check stays C's: its
 * covenant reads each region relative to its own master and checks every entry, side-car and chunk. A shape this layout
 * cannot place (C's block shares its master with another call, B calls C in a loop, C's block holds another slot kind,
 * or C's run reads another region after its block) is refused with a reason before anything is built.
 */
export async function appendCreateBuilderTransitiveCalleeRegions(
  host: AppendCreateBuilderTransitiveCalleeRegionsHost,
  groups: ExternalCallUtxoGroup[],
  metas: readonly ExternalGroupMeta[],
  directGroupCount: number,
): Promise<void> {
  for (let index = directGroupCount; index < groups.length; index++) {
    const group = groups[index]!;
    const meta = metas[index];
    const parent = meta === undefined || meta.parentGroupIndex < 0 ? undefined : groups[meta.parentGroupIndex];
    const contract = group.externalContract;
    const artifact = contract?.inner?.artifact as Artifact | undefined;
    const parentArtifact = parent?.externalContract?.inner?.artifact as Artifact | undefined;
    // The ordinary convention only: a message-bus route carries its own callee layout.
    if (meta === undefined || parent === undefined || artifact === undefined || parentArtifact === undefined
      || !isDirectConventionArtifact(artifact) || !isDirectConventionArtifact(parentArtifact)
      || group.compilerRoute !== undefined || parent.compilerRoute !== undefined) continue;
    const fn = selectedFunction(artifact, group);
    const region = fn === undefined ? undefined : PLACED_REGIONS.find(([field]) => publishes(fn, field))?.[1];
    if (fn === undefined || region === undefined) continue;
    const label = `${artifact.contractName}.${fn.name}`;
    const caller = `${parentArtifact.contractName}.${parent.functionName}`;
    const refuse = (what: string): never => {
      throw new Error(`The call of ${label} cannot be laid out: ${what}`);
    };

    if (group.sharedGroupIndex !== undefined
      || groups.some((other, at) => at !== index && other.sharedGroupIndex === index)) {
      refuse(`another call of ${artifact.contractName} in this transaction shares its block, so ${region} has no `
        + 'block of its own to follow');
    }
    if (meta.ecSlot.occurrence === 'loop' || meta.ecSlot.loopArrayVar !== undefined) {
      refuse(`${caller} calls it in a loop, and one block of its own cannot hold ${region} for each call`);
    }
    if (parent.callBatchUnit !== undefined) {
      refuse(`its caller ${caller} runs as a frame of a multi-call spend, whose block it does not follow`);
    }
    const layout = fn.blockLayout ?? refuse('its function publishes no block layout');
    const slot = layout.slots.find(({ kind }) => !PLACED_SLOT_KINDS.has(kind));
    if (slot !== undefined) {
      refuse(`its block has a slot of kind ${slot.kind}, which the SDK lays out only in the block of a direct callee`);
    }
    // Each run a covenant reads after its block other than the walk, the loop's side-cars and the written chunks.
    const other = TRAILING_BAND_USERS.find(([field]) => field !== 'collectionIterations' && field !== 'dynamicWrites'
      && field !== 'dynamicReads' && publishes(fn, field));
    if (other !== undefined) {
      refuse(`its run also reads ${other[1]} after its block, which the SDK lays out only for a direct callee`);
    }
    const written = new Set(fn.dynamicWrites ?? []);
    const unwritten = (fn.dynamicReads ?? []).find((name) => !written.has(name));
    if (unwritten !== undefined) {
      refuse(`its run reads the chunks of '${unwritten}', which it does not write, and the SDK co-spends a read `
        + 'run only for a direct callee');
    }

    const state = await contract.getFullState();
    const master = group.masterUtxo as Utxo;
    const internalArgs: Record<string, FunctionArgument> = {};
    // The record is published for a caller that reads it, and always for a function that returns.
    const publishesRecord = meta.ecSlot.hasReturnValues === true || (fn.outputs?.length ?? 0) > 0;
    const ctx = {
      callerReadsRecord: meta.ecSlot.hasReturnValues === true,
      bBlockInputs: undefined as UnlockableUtxo[] | undefined,
      bReturnEventInBlock: false,
      bCompilerInternalArgs: internalArgs,
      bPlannedEntryInserts: [],
      bRelativeOutputInternalArgs: new Set<string>(),
      bBatchEntryLockingBytecodes: new Map<number, Uint8Array>(),
      bBlockLayout: layout,
      bHasLoop: false,
      bSc: contract,
      bAbiFunc: fn,
      bState: { masterUtxo: master, state: state.state },
      bDataNfts: group.dataNftUtxos,
      bStatelayout: group.stateLayout,
      bRequiredNftIndices: group.requiredDataNftIndices,
      bValueChunkOutputCount: 0,
      bKeccak: { inputs: [] },
      compilerRoute: undefined,
      callInfo: { args: group.functionArgs, functionName: group.functionName, externalContract: contract },
      externalCategoryId: group.categoryId,
      slotIndex: 0,
      loopIdxRanges: [],
      // C's caller is B: an entry C keys by msg.sender is B's.
      publicSelfIdentity: group.callerIdentity
        ?? { categoryId: parent.categoryId, lockingBytecode: parent.externalContract.inner.lockingBytecode },
    };
    // A funder's coin is seeded by its group's position, so two callees' block funders stay distinct.
    await assembleCreateBuilderNestedCalleeBlockInputs({ ...host.block, currentGroupCount: () => index }, ctx);
    if (ctx.bBlockInputs === undefined || !ctx.bReturnEventInBlock) {
      refuse(publishesRecord
        ? `its block does not come out with its call record at its slot, where ${region} follows it`
        : 'its call publishes no record, and the SDK lays out a transitive callee\'s block only with its record');
    }
    let block = ctx.bBlockInputs!;

    // The walk follows the block, before any dynamic state the run reads.
    if (publishes(fn, 'collectionIterations')) {
      block = await appendCreateBuilderNestedCalleeIterations({
        bBlockInputs: block,
        bAbiFunc: fn,
        bStatelayout: group.stateLayout,
        bSc: contract as NestedCalleeIterationContract,
        externalCategoryId: group.categoryId,
        publishesRecord,
        bCompilerInternalArgs: internalArgs,
        functionLabel: label,
      });
    }
    // One side-car of the shared pool per iteration, none a coin the build already spends.
    let keccakLoop: { start: number; recreates: Output[] } | undefined;
    if (fn.keccakLoopReads === true) {
      const spent = [
        ...groups.flatMap((owner) => [...(owner.blockInputs ?? []), ...(owner.keccakInputs ?? [])]),
        ...block,
      ];
      const loop = await appendCreateBuilderNestedCalleeKeccakLoop({
        bBlockInputs: block,
        bAbiFunc: fn,
        bSc: contract as NestedCalleeKeccakLoopContract,
        masterUtxo: master,
        bDataNfts: group.dataNftUtxos,
        args: group.functionArgs,
        spent,
        ...(host.sharedSidecarPool !== undefined && { sharedPool: host.sharedSidecarPool }),
        functionLabel: label,
      });
      block = loop.bBlockInputs;
      keccakLoop = { start: loop.start, recreates: loop.recreates };
    }
    // The old chunks the run consumes follow the block (and the walk); the new ones are learned from its run.
    const oldChunks = writtenDynamicChunkInputs(
      contract.inner, group.categoryId, group.stateLayout, written, state.dynamicChunkUtxos,
    );
    const argumentValues = argumentDynamicStateValues(fn, group.stateLayout, group.functionArgs);

    group.blockInputs = block;
    group.blockLayout = layout;
    group.returnEventInBlock = true;
    if (Object.keys(internalArgs).length > 0) group.internalArgs = { ...group.internalArgs, ...internalArgs };
    if (keccakLoop !== undefined) {
      group.keccakLoopStart = keccakLoop.start;
      group.keccakLoopRecreates = keccakLoop.recreates;
    }
    if (oldChunks.length > 0) group.ordinaryDynamicChunkInputs = oldChunks;
    if (argumentValues !== undefined) group.dynamicStateValues = argumentValues;
  }
}
