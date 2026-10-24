/**
 * Direct multi-call (docs/wip/call-records/DESIGN.md, sections 3, 4 and 7). A direct caller's calls in one
 * `callOrdinal` group run in one spend of the callee's master, through its multi-call entry: frame k is the k-th
 * reached call, it reads its entries `rowEntryShift` inputs past its layout slots, and its record sits in the batch
 * block at the k-th record slot. A group reaching one call keeps the standalone spend.
 */

import type {
  AbiFunction, ArgSource, Artifact, BlockLayoutSlot, ExternalCallAbi, ExternalCallExpression, FunctionBlockLayout,
  StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Contract } from '../Contract.js';
import type { ContractUnlocker, GenerateUnlockingBytecodeOptions, UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { defaultInternalFunctionArg } from './kernel-journal-helpers.js';
import { containsReturningExpression } from './sc-expand-resolve-create-builder-external-calls.js';

const ROW_ENTRY_SHIFT = '__internal__rowEntryShift';
const RETURN_OUTPUT_INDEX = '__internal__returnOutputIdx';
const FRAME_SLOT_KINDS = new Set(['master', 'dataNft', 'entry', 'returnEvent']);

/** One reached call of a caller's `callOrdinal` group. */
export interface DirectCallBatchUnit {
  /** The caller's `callOrdinal` group. */
  readonly group: number;
  /** The frame whose record this call reads. */
  readonly ordinal: number;
  /** Where its return witness points, past the batch's first record: its ordinal, or 0 in a loop (+ counter). */
  readonly witnessOffset: number;
  /** The first call of its ordinal: the call its frame runs. */
  readonly isFrame: boolean;
  /** The group spending the callee master, once the batch is consolidated. */
  physical?: number;
}

export interface DirectCallBatchFrame {
  readonly abiFunction: AbiFunction;
  /** The entry's visible arguments. */
  readonly args: readonly FunctionArgument[];
  readonly ordinal: number;
  /** The raw result its record carries. */
  readonly result: Uint8Array;
  readonly rowEntryShift: bigint;
}

export interface DirectCallBatch {
  readonly frames: readonly DirectCallBatchFrame[];
  /** Block offset of frame 0's record; frame k's sits k past it. */
  readonly recordOffset: number;
}

export interface DirectCallBatchFrameBlock {
  readonly inputs: readonly UnlockableUtxo[];
  readonly layout: FunctionBlockLayout;
  readonly returnEventInBlock: boolean;
  readonly dataNftUtxos: readonly UnlockableUtxo[];
  readonly requiredDataNftIndices: readonly number[];
}

/** The unit marker a planned call carries into group assembly. */
export type DirectCallBatchCall = ExternalCallAbi & { directBatch?: DirectCallBatchUnit };

type ResolvedCall = {
  externalContract: unknown;
  functionName: string;
  args: FunctionArgument[];
  stateOverrides?: Record<string, unknown>;
};

export interface PlanDirectCallBatchesHost {
  planExternalCallOccurrences(call: ExternalCallAbi, frame: {
    functionArgs: FunctionArgument[];
    artifact: Artifact;
    state?: Record<string, unknown>;
    callerInputs?: readonly { type: string }[];
    executionSelfAddress?: FunctionArgument;
    externalReturns?: ReadonlyMap<string, FunctionArgument>;
  }): Promise<readonly { args: readonly FunctionArgument[] }[]>;
  resolveExternalExpressionReturns(
    sources: readonly ArgSource[], functionArgs: FunctionArgument[], state: Record<string, unknown>,
    callerInputs: readonly { type: string }[] | undefined, executionSelfAddress: FunctionArgument | undefined,
    producerCalls: readonly ExternalCallAbi[],
  ): Promise<ReadonlyMap<string, FunctionArgument>>;
  evaluateExternalExpression(...args: any[]): FunctionArgument | undefined;
  hydrateExternalPredicateState(
    expressions: readonly ExternalCallExpression[], functionArgs: FunctionArgument[], artifact: Artifact,
    state: Record<string, unknown>, callerInputs?: readonly { type: string }[],
    executionSelfAddress?: FunctionArgument,
  ): Promise<Record<string, unknown>>;
  getFullState(): Promise<{ state: Record<string, StateValue> }>;
}

/** The callee a resolved call names, when it is a plain stateful contract. */
const calleeArtifact = (call: ResolvedCall): Artifact | undefined => (
  call.externalContract as { inner?: { artifact?: Artifact } } | undefined
)?.inner?.artifact;

/** A callee asked to run several calls in one spend without its multi-call entry. */
export function directCallBatchRefusal(caller: string, callee: string, count: number): Error {
  return new Error(`${caller} makes ${count} calls to ${callee} in one transaction. A direct callee runs several `
    + `calls in one spend of its master only through its multi-call entry, which ${callee} was compiled without: `
    + 'compile it with `callBatch: true`, or compile caller and callee together with compileStringMulti or '
    + 'compileFileMulti.');
}

/**
 * Expand each `callOrdinal` group of a direct caller into its reached calls in execution order: a fixed group keeps
 * its calls, a counted group resolves its loops' reached occurrences (domain, conditions and arguments) and its
 * conditions. A group reaching two or more frames marks its calls as units of one multi-call spend; one reaching a
 * single call keeps the standalone spend, with that call's own arguments.
 */
export async function planDirectCallBatches(
  host: PlanDirectCallBatchesHost,
  params: {
    abiFunction: AbiFunction | undefined;
    args: FunctionArgument[];
    artifact: Artifact;
    externalCalls: ExternalCallAbi[] | undefined;
    resolvedExternalCalls: ResolvedCall[] | undefined;
    callerState: Record<string, StateValue> | undefined;
    publicSelfAddress: FunctionArgument | undefined;
  },
): Promise<{
    externalCalls: ExternalCallAbi[] | undefined;
    resolvedExternalCalls: ResolvedCall[] | undefined;
    callerState: Record<string, StateValue> | undefined;
  }> {
  const { abiFunction, args, artifact, externalCalls, resolvedExternalCalls, publicSelfAddress } = params;
  let callerState = params.callerState;
  const unchanged = { externalCalls, resolvedExternalCalls, callerState };
  if (!abiFunction || !externalCalls || !resolvedExternalCalls || artifact.composition?.convention === 'framed'
    || !externalCalls.some((call) => call.callOrdinal !== undefined)) return unchanged;
  const positionsByGroup = new Map<number, number[]>();
  for (const [position, call] of externalCalls.entries()) {
    if (call.callOrdinal === undefined) continue;
    positionsByGroup.set(call.callOrdinal.group, [...(positionsByGroup.get(call.callOrdinal.group) ?? []), position]);
  }
  const stateOf = async (expressions: readonly ExternalCallExpression[]): Promise<Record<string, unknown>> => {
    callerState ??= (await host.getFullState()).state;
    if (expressions.length === 0) return callerState;
    return host.hydrateExternalPredicateState(
      expressions, args, artifact, { ...callerState }, abiFunction.inputs, publicSelfAddress,
    );
  };
  const returnsOf = async (
    sources: readonly ArgSource[], state: Record<string, unknown>,
  ): Promise<ReadonlyMap<string, FunctionArgument> | undefined> => (
    sources.some((source) => containsReturningExpression(source))
      ? host.resolveExternalExpressionReturns(
        sources, args, state, abiFunction.inputs, publicSelfAddress, abiFunction.externalCalls ?? [],
      ) : undefined
  );
  const caller = `${artifact.contractName}.${abiFunction.name}()`;
  const planned = new Map<number, Array<{ call: DirectCallBatchCall; info: ResolvedCall }>>();
  for (const [group, positions] of positionsByGroup) {
    const units: Array<{ position: number; info: ResolvedCall; ordinal: number; witnessOffset: number }> = [];
    let next = 0;
    for (const position of positions) {
      const call = externalCalls[position]!;
      const info = resolvedExternalCalls[position]!;
      const ordinal = call.callOrdinal!;
      if ('ordinal' in ordinal) {
        units.push({ position, info, ordinal: ordinal.ordinal, witnessOffset: ordinal.ordinal });
        continue;
      }
      if (call.occurrence === 'loop') {
        // A looped call reads its record at its return index plus the group's counter.
        const domain = call.iterationDomain;
        const expressions = [
          ...(domain ? [domain.initialValue, domain.stepValue, domain.continueCondition] : []),
          ...(call.condition ? [call.condition] : []),
        ];
        const state = await stateOf(expressions);
        const externalReturns = await returnsOf([
          ...expressions.map((expression): ArgSource => ({ kind: 'expression', expression })),
          ...(call.argSources ?? []),
        ], state);
        const reached = await host.planExternalCallOccurrences(call, {
          functionArgs: args, artifact, state, callerInputs: abiFunction.inputs,
          executionSelfAddress: publicSelfAddress, externalReturns,
        });
        for (const occurrence of reached) {
          units.push({ position, info: { ...info, args: [...occurrence.args] }, ordinal: next, witnessOffset: 0 });
          next += 1;
        }
        continue;
      }
      if (call.condition !== undefined) {
        const state = await stateOf([call.condition]);
        const externalReturns = await returnsOf([{ kind: 'expression', expression: call.condition }], state);
        const active = host.evaluateExternalExpression(
          call.condition, args, artifact, state, abiFunction.inputs, externalReturns, 0, false, publicSelfAddress,
        );
        if (active === false) continue;
        if (active !== true) {
          throw new Error(`${caller}: the condition of callsite ${call.callsiteId ?? position} is unresolved`);
        }
      }
      units.push({ position, info, ordinal: next, witnessOffset: next });
      next += 1;
    }
    const frameCount = new Set(units.map((unit) => unit.ordinal)).size;
    if (frameCount > 1) {
      for (const unit of units) {
        const callee = calleeArtifact(unit.info);
        if (typeof callee?.callBatch !== 'object') {
          throw directCallBatchRefusal(caller, callee?.contractName ?? unit.info.functionName, frameCount);
        }
        const entry = callee.abi.find((candidate) => candidate.name === unit.info.functionName);
        if (entry?.callBatchRow !== true) {
          throw new Error(`${caller}: ${callee.contractName}.${unit.info.functionName}() cannot run as a frame of `
            + `its multi-call entry, which runs only entries that return values and preserve all state.`);
        }
      }
    }
    for (const position of positions) planned.set(position, []);
    const seen = new Set<number>();
    for (const unit of units) {
      const call = externalCalls[unit.position]!;
      const isFrame = !seen.has(unit.ordinal);
      seen.add(unit.ordinal);
      planned.get(unit.position)!.push({
        call: frameCount > 1 ? {
          ...call,
          directBatch: { group, ordinal: unit.ordinal, witnessOffset: unit.witnessOffset, isFrame },
        } : call,
        info: unit.info,
      });
    }
  }
  const nextCalls: ExternalCallAbi[] = [];
  const nextResolved: ResolvedCall[] = [];
  for (const [position, call] of externalCalls.entries()) {
    const entries = planned.get(position);
    if (entries === undefined) {
      nextCalls.push(call);
      nextResolved.push(resolvedExternalCalls[position]!);
      continue;
    }
    for (const entry of entries) {
      nextCalls.push(entry.call);
      nextResolved.push(entry.info);
    }
  }
  return { externalCalls: nextCalls, resolvedExternalCalls: nextResolved, callerState };
}

const sameOutpoint = (left: UnlockableUtxo, right: UnlockableUtxo): boolean => (
  left.txid.toLowerCase() === right.txid.toLowerCase() && left.vout === right.vout
);

const slotsOf = (layout: FunctionBlockLayout, kind: string): BlockLayoutSlot[] => layout.slots
  .filter((slot) => slot.kind === kind).sort((left, right) => left.offset - right.offset);

/**
 * Turn each multi-call's units into one spend of the callee master: the first unit's group carries the batch block
 * (master, data records, every frame's entries in frame order, one record slot per frame) and the frames, and every
 * other unit reads its frame's record from that block. Each frame's result comes from its own probe.
 */
export async function consolidateDirectCallBatches(
  host: {
    deriveFrameResult(group: ExternalCallUtxoGroup, abiFunction: AbiFunction,
      args: readonly FunctionArgument[]): Promise<Uint8Array>;
  },
  groups: ExternalCallUtxoGroup[],
): Promise<void> {
  const batches = new Map<number, number[]>();
  for (const [index, group] of groups.entries()) {
    if (group.callBatchUnit === undefined) continue;
    batches.set(group.callBatchUnit.group, [...(batches.get(group.callBatchUnit.group) ?? []), index]);
  }
  for (const indices of batches.values()) {
    const physicalIndex = indices[0]!;
    const physical = groups[physicalIndex]!;
    const callee = physical.externalContract.inner.artifact as Artifact;
    const unsupported = (detail: string): Error => new Error(
      `A multi-call spend of ${callee.contractName} cannot be assembled: ${detail}.`,
    );
    if (physical.sharedGroupIndex !== undefined) throw unsupported('its first call does not own the callee master');
    const frameUnits = indices.filter((index) => groups[index]!.callBatchUnit!.isFrame)
      .sort((left, right) => groups[left]!.callBatchUnit!.ordinal - groups[right]!.callBatchUnit!.ordinal);
    if (frameUnits.some((index, ordinal) => groups[index]!.callBatchUnit!.ordinal !== ordinal)) {
      throw unsupported('its frame ordinals are not consecutive');
    }
    const blocks = frameUnits.map((index) => {
      const block = groups[index]!.callBatchFrameBlock;
      if (block === undefined || !block.returnEventInBlock) throw unsupported('a frame has no balanced block');
      if (!block.layout.slots.every((slot) => FRAME_SLOT_KINDS.has(slot.kind))) {
        throw unsupported('a frame co-spends more than its data records and entries');
      }
      return block;
    });
    // Every frame reads its data records at its own slots, so they must agree on the shared ones.
    const reference = blocks.reduce((widest, block) => (
      slotsOf(block.layout, 'dataNft').length > slotsOf(widest.layout, 'dataNft').length ? block : widest
    ));
    const dataSlots = slotsOf(reference.layout, 'dataNft');
    for (const block of blocks) {
      if (!slotsOf(block.layout, 'dataNft').every((slot, index) => slot.offset === 1 + index
        && dataSlots[index]?.nftIndex === slot.nftIndex)) throw unsupported('its frames read different data records');
    }
    const masterSlot = slotsOf(blocks[0]!.layout, 'master')[0];
    const master = masterSlot === undefined ? undefined : blocks[0]!.inputs[masterSlot.offset];
    if (master === undefined) throw unsupported('the first frame has no master input');
    const inputs: UnlockableUtxo[] = [master, ...dataSlots.map((slot) => reference.inputs[slot.offset]!)];
    const slots: BlockLayoutSlot[] = [
      { kind: 'master', offset: 0 },
      ...dataSlots.map((slot, index): BlockLayoutSlot => ({
        kind: 'dataNft', offset: 1 + index, nftIndex: slot.nftIndex,
      })),
    ];
    const shifts: bigint[] = [];
    for (const block of blocks) {
      const entries = slotsOf(block.layout, 'entry');
      if (entries.length === 0) {
        shifts.push(0n);
        continue;
      }
      if (entries.some((slot, index) => slot.offset !== entries[0]!.offset + index)) {
        throw unsupported('a frame\'s entries are not consecutive');
      }
      const entryInputs = entries.map((slot) => block.inputs[slot.offset]);
      if (entryInputs.some((input) => input === undefined)) throw unsupported('a frame has no entry input');
      // A frame reading the entries an earlier frame reads shares their inputs: one shift names them.
      const existing = entryInputs.map((input) => inputs.findIndex((candidate) => sameOutpoint(candidate, input!)));
      let position: number;
      if (existing.every((index, offset) => index >= 0 && index === existing[0]! + offset)) {
        position = existing[0]!;
      } else if (existing.every((index) => index < 0)) {
        position = inputs.length;
        entries.forEach((slot, offset) => slots.push({ ...slot, offset: position + offset }));
        inputs.push(...entryInputs as UnlockableUtxo[]);
      } else {
        throw unsupported('two frames share part of their entries');
      }
      shifts.push(BigInt(position - entries[0]!.offset));
    }
    const recordOffset = inputs.length;
    for (const [frameIndex, block] of blocks.entries()) {
      const recordSlot = slotsOf(block.layout, 'returnEvent')[0];
      const funder = recordSlot === undefined ? undefined : block.inputs[recordSlot.offset];
      if (funder === undefined || funder.token !== undefined) throw unsupported('a frame has no record funder');
      inputs.push(funder);
      slots.push({ kind: 'returnEvent', offset: recordOffset + frameIndex, slotIndex: frameIndex });
    }
    const frames: DirectCallBatchFrame[] = [];
    for (const [frameIndex, index] of frameUnits.entries()) {
      const unit = groups[index]!;
      const abiFunction = callee.abi.find((candidate) => candidate.name === unit.functionName);
      if (abiFunction?.callBatchRow !== true) throw unsupported(`'${unit.functionName}' is no frame entry`);
      frames.push({
        abiFunction,
        args: [...unit.functionArgs],
        ordinal: frameIndex,
        result: unit.precomputedReturnCommitment
          ?? await host.deriveFrameResult(unit, abiFunction, unit.functionArgs),
        rowEntryShift: shifts[frameIndex]!,
      });
    }
    physical.blockInputs = inputs;
    physical.blockLayout = { blockSize: inputs.length, slots };
    physical.dataNftUtxos = [...reference.dataNftUtxos];
    physical.requiredDataNftIndices = [...reference.requiredDataNftIndices];
    physical.returnEventInBlock = true;
    physical.callBatch = { frames, recordOffset };
    physical.precomputedReturnCommitment = frames[0]!.result;
    for (const index of indices) {
      const group = groups[index]!;
      group.callBatchUnit!.physical = physicalIndex;
      // The records of the batch are its frames' own; a rolled loop's parts do not apply.
      delete group.loopReturnCommitments;
      delete group.loopResultArrayOutput;
      delete group.loopMaximumOccurrences;
      delete group.resolveLoopReturnCommitment;
      delete group.resolveLoopReturnValue;
      delete group.resolveLoopFunctionArgs;
      if (index === physicalIndex) continue;
      group.sharedGroupIndex = physicalIndex;
      group.blockInputs = [];
      delete group.precomputedReturnCommitment;
    }
  }
}

/** Whether group `index` reads another unit's multi-call spend and lays no record of its own. */
export function isCallBatchMember(
  group: { readonly callBatchUnit?: { readonly physical?: number } } | undefined, index: number,
): boolean {
  return group?.callBatchUnit?.physical !== undefined && group.callBatchUnit.physical !== index;
}

/**
 * The multi-call entry's unlocker for a consolidated batch. Frame k's record index is its master input's index plus
 * the record slot's offset, so the unlocking bytecode follows the input it is generated for.
 */
export function directCallBatchUnlocker(group: ExternalCallUtxoGroup): ContractUnlocker {
  const contract = group.externalContract.inner as Contract;
  const batch = group.callBatch!;
  const unlockerAt = (masterInputIndex: number): ContractUnlocker => contract.createCallBatchUnlocker(
    batch.frames.map((frame, frameIndex) => {
      let visible = 0;
      return {
        abiFunction: frame.abiFunction,
        args: frame.abiFunction.inputs.map((input): FunctionArgument => {
          if (input.name === RETURN_OUTPUT_INDEX) return BigInt(masterInputIndex + batch.recordOffset + frameIndex);
          if (input.name === ROW_ENTRY_SHIFT) return frame.rowEntryShift;
          if (input.name.startsWith('__internal__')) return defaultInternalFunctionArg(input);
          return frame.args[visible++] as FunctionArgument;
        }),
      };
    }),
  );
  return {
    ...unlockerAt(0),
    generateUnlockingBytecode: (options: GenerateUnlockingBytecodeOptions): Uint8Array => (
      unlockerAt(options?.inputIndex ?? 0).generateUnlockingBytecode(options)
    ),
  };
}
