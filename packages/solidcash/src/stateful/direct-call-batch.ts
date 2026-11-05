/**
 * Direct multi-call (docs/wip/call-records/DESIGN.md, sections 3, 4 and 7). A direct caller's calls in one
 * `callOrdinal` group run in one spend of the callee's master, through its multi-call entry: frame k is the k-th
 * reached call, it reads its entries `rowEntryShift` inputs past its layout slots, and its record sits in the batch
 * block at the k-th record slot. The batch block holds every data record of the callee, which the entry carries
 * through its frames. A group reaching one returning call keeps the standalone spend; a void call always runs as a
 * frame, since a standalone void run pins no record.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type {
  AbiFunction, ArgSource, Artifact, BlockLayoutSlot, ExternalCallAbi, ExternalCallExpression, FunctionBlockLayout,
  StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Contract } from '../Contract.js';
import type {
  ContractUnlocker, GenerateUnlockingBytecodeOptions, Output, UnlockableUtxo,
} from '../interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import { generateLibauthSourceOutputs, solidCashOutputToLibauthOutput } from '../utils.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import { parseCallRecord } from './call-record.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import { defaultInternalFunctionArg } from './kernel-journal-helpers.js';
import { containsReturningExpression } from './sc-expand-resolve-create-builder-external-calls.js';
import { extractExpectedOutputCommitmentFromTrace } from './trace-commitment-helpers.js';

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
  /** The commitments the spend leaves on its data records, record j at index j, once a frame writes state. */
  readonly dataCommitments?: readonly string[];
}

export interface DirectCallBatchFrameBlock {
  readonly inputs: readonly UnlockableUtxo[];
  readonly layout: FunctionBlockLayout;
  readonly returnEventInBlock: boolean;
  readonly dataNftUtxos: readonly UnlockableUtxo[];
  readonly requiredDataNftIndices: readonly number[];
  /** Every data record of the callee, record j at index j: the band a multi-call spend lays after its master. */
  readonly dataRecords: readonly UnlockableUtxo[];
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
  }): Promise<readonly { args: readonly FunctionArgument[]; sourceIteration: number }[]>;
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

/** The callee entry a resolved call runs. */
const calleeEntry = (call: ResolvedCall): AbiFunction | undefined => calleeArtifact(call)?.abi
  .find((candidate) => candidate.name === call.functionName);

/** Whether a serialized expression reads the result of one of `callsites`. */
function readsResultOf(value: unknown, callsites: ReadonlySet<number>, seen = new Set<object>()): boolean {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const { kind, callsiteId } = value as { kind?: string; callsiteId?: number };
  if ((kind === 'producerResult' || kind === 'externalCall') && callsiteId !== undefined
    && callsites.has(callsiteId)) return true;
  return Object.values(value).some((child) => (Array.isArray(child)
    ? child.some((item) => readsResultOf(item, callsites, seen)) : readsResultOf(child, callsites, seen)));
}

/** A callee asked to run several calls in one spend without its multi-call entry. */
export function directCallBatchRefusal(caller: string, callee: string, count: number): Error {
  return new Error(`${caller} makes ${count} call${count === 1 ? '' : 's'} to ${callee} in one transaction. A `
    + 'direct callee runs several calls, or a void one its caller reads the record of, in one spend of its master '
    + `only through its multi-call entry, which ${callee} was compiled without: compile it with \`callBatch: true\`, `
    + 'or compile caller and callee together with compileStringMulti or compileFileMulti.');
}

/**
 * Expand each `callOrdinal` group of a direct caller into its reached calls in execution order: a fixed group keeps
 * its calls, a counted group resolves its loops' reached occurrences (domain, conditions and arguments) and its
 * conditions, and numbers them as they run; a call inside nested loops is refused, as is a group whose frames change
 * state where a loop bound, condition or argument reads one of its results. A group reaching two or more frames, or a
 * void call, marks its calls as units of one multi-call spend; one reaching a single returning call keeps the
 * standalone spend, with that call's own arguments.
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
    // A counted group numbers its reached calls as the caller's counter does, in execution order: by where each runs
    // (a looped call where the first of the group's calls in its loop sits), its iteration, then its program point.
    const reached: Array<{ position: number; info: ResolvedCall; anchor: number; iteration?: number }> = [];
    const effectOf = (position: number): number => externalCalls[position]!.sourceEffectOrdinal ?? position;
    const loopOf = (position: number): number | undefined => externalCalls[position]!.iterationDomain?.sourceLoopId;
    const looped = positions.filter((position) => externalCalls[position]!.occurrence === 'loop');
    const nested = looped.find((position) => (externalCalls[position]!.nestedIterationDomains?.length ?? 0) > 0);
    if (nested !== undefined) {
      throw new Error(`${caller}: callsite ${externalCalls[nested]!.callsiteId ?? nested} sits in nested loops, `
        + 'whose calls do not run as frames of one multi-call spend yet.');
    }
    if (looped.length > 1 && looped.some((position) => loopOf(position) === undefined)) {
      throw new Error(`${caller}: the loops of its calls to one callee are not published, so the calls cannot be `
        + 'put in execution order as frames of one multi-call spend.');
    }
    // A frame that writes state changes the results of the frames after it, which their standalone probes do not
    // see: a loop bound, condition or argument that reads one of the group's own results is refused.
    if (positions.some((position) => calleeEntry(resolvedExternalCalls[position]!)?.writesState === true)) {
      const own = new Set(positions.flatMap((position) => {
        const id = externalCalls[position]!.callsiteId;
        return id === undefined ? [] : [id];
      }));
      for (const position of positions) {
        const call = externalCalls[position]!;
        const domain = call.iterationDomain;
        const reads = (value: unknown): boolean => readsResultOf(value, own);
        const part = domain && [domain.initialValue, domain.stepValue, domain.continueCondition].some(reads)
          ? 'the bound of its loop' : call.condition !== undefined && reads(call.condition) ? 'its condition'
            : (call.argSources ?? []).some(reads) ? 'an argument' : undefined;
        if (part !== undefined) {
          throw new Error(`${caller}: ${part} of callsite ${call.callsiteId ?? position} reads a result of a call `
            + 'to the same callee, whose calls change state; the frames of a multi-call spend are planned from their '
            + 'standalone results, so such a spend is refused.');
        }
      }
    }
    for (const position of positions) {
      const call = externalCalls[position]!;
      const info = resolvedExternalCalls[position]!;
      const ordinal = call.callOrdinal!;
      if ('ordinal' in ordinal) {
        units.push({ position, info, ordinal: ordinal.ordinal, witnessOffset: ordinal.ordinal });
        continue;
      }
      if (call.occurrence === 'loop') {
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
        const occurrences = await host.planExternalCallOccurrences(call, {
          functionArgs: args, artifact, state, callerInputs: abiFunction.inputs,
          executionSelfAddress: publicSelfAddress, externalReturns,
        });
        const anchor = Math.min(...looped.filter((other) => loopOf(other) === loopOf(position)).map(effectOf));
        for (const occurrence of occurrences) {
          reached.push({
            position, info: { ...info, args: [...occurrence.args] }, anchor, iteration: occurrence.sourceIteration,
          });
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
      reached.push({ position, info, anchor: effectOf(position) });
    }
    reached.sort((left, right) => left.anchor - right.anchor || (left.iteration ?? 0) - (right.iteration ?? 0)
      || effectOf(left.position) - effectOf(right.position));
    // A looped call reads its record at its return index plus the counter, any other at its ordinal.
    for (const [ordinal, unit] of reached.entries()) {
      units.push({
        position: unit.position, info: unit.info, ordinal, witnessOffset: unit.iteration === undefined ? ordinal : 0,
      });
    }
    const frameCount = new Set(units.map((unit) => unit.ordinal)).size;
    // A void call reads its frame's record, which only a multi-call spend pins.
    const batched = frameCount > 1 || units.some((unit) => {
      const entry = calleeEntry(unit.info);
      return entry !== undefined && (entry.outputs?.length ?? 0) === 0;
    });
    if (batched) {
      for (const unit of units) {
        const callee = calleeArtifact(unit.info);
        if (typeof callee?.callBatch !== 'object') {
          throw directCallBatchRefusal(caller, callee?.contractName ?? unit.info.functionName, frameCount);
        }
        const entry = callee.abi.find((candidate) => candidate.name === unit.info.functionName);
        if (entry?.callBatchRow !== true) {
          throw new Error(`${caller}: ${callee.contractName}.${unit.info.functionName}() cannot run as a frame of `
            + 'its multi-call entry, which runs only entries that write at most fixed state fields and take no '
            + 'value, event, transfer or external call.');
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
        call: batched ? {
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

/**
 * The block a unit of a multi-call spend co-spends: its entry's, and for a void frame a record slot past it. A
 * standalone void run lays no record, so its entry's layout has none; the spend pins `digest || 0x01` there.
 */
export function callBatchFrameLayout(
  layout: FunctionBlockLayout | undefined, call: ExternalCallAbi,
): FunctionBlockLayout | undefined {
  if (layout === undefined || (call as DirectCallBatchCall).directBatch === undefined
    || layout.slots.some((slot) => slot.kind === 'returnEvent')) return layout;
  return {
    ...layout,
    blockSize: layout.blockSize + 1,
    slots: [...layout.slots, { kind: 'returnEvent', offset: layout.blockSize, slotIndex: 0 }],
  };
}

const sameOutpoint = (left: UnlockableUtxo, right: UnlockableUtxo): boolean => (
  left.txid.toLowerCase() === right.txid.toLowerCase() && left.vout === right.vout
);

const slotsOf = (layout: FunctionBlockLayout, kind: string): BlockLayoutSlot[] => layout.slots
  .filter((slot) => slot.kind === kind).sort((left, right) => left.offset - right.offset);

/**
 * Turn each multi-call's units into one spend of the callee master: the first unit's group carries the batch block
 * (master, every data record, every frame's entries in frame order, one record slot per frame) and the frames, and
 * every other unit reads its frame's record from that block. A void frame's record carries an empty result. Where
 * every frame preserves state, each result comes from its own probe; once one writes, frame k runs on the records
 * the frames before it left, so the results and the records the spend leaves come from a probe of the spend.
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
    // The entry reads data record j at master + 1 + j, whichever records the frames touch.
    const dataRecords = blocks[0]!.dataRecords;
    const masterSlot = slotsOf(blocks[0]!.layout, 'master')[0];
    const master = masterSlot === undefined ? undefined : blocks[0]!.inputs[masterSlot.offset];
    if (master === undefined) throw unsupported('the first frame has no master input');
    const inputs: UnlockableUtxo[] = [master, ...dataRecords];
    const slots: BlockLayoutSlot[] = [
      { kind: 'master', offset: 0 },
      ...dataRecords.map((_, nftIndex): BlockLayoutSlot => ({ kind: 'dataNft', offset: 1 + nftIndex, nftIndex })),
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
    const specs = frameUnits.map((index, frameIndex) => {
      const unit = groups[index]!;
      const abiFunction = callee.abi.find((candidate) => candidate.name === unit.functionName);
      if (abiFunction?.callBatchRow !== true) throw unsupported(`'${unit.functionName}' is no frame entry`);
      return { unit, abiFunction, args: [...unit.functionArgs], rowEntryShift: shifts[frameIndex]! };
    });
    // A frame that writes state changes what the frames after it read: every result, and the records the spend
    // leaves, come from a probe of the spend itself.
    const probed = specs.some((spec) => spec.abiFunction.writesState === true)
      ? probeCallBatch(physical.externalContract.inner as Contract, inputs, specs, recordOffset, dataRecords.length,
        unsupported) : undefined;
    const frames: DirectCallBatchFrame[] = [];
    for (const [frameIndex, spec] of specs.entries()) {
      const { unit, abiFunction } = spec;
      frames.push({
        abiFunction,
        args: spec.args,
        ordinal: frameIndex,
        result: probed?.results[frameIndex] ?? ((abiFunction.outputs?.length ?? 0) === 0 ? new Uint8Array()
          : unit.precomputedReturnCommitment ?? await host.deriveFrameResult(unit, abiFunction, unit.functionArgs)),
        rowEntryShift: spec.rowEntryShift,
      });
    }
    physical.blockInputs = inputs;
    physical.blockLayout = { blockSize: inputs.length, slots };
    physical.dataNftUtxos = [...dataRecords];
    physical.requiredDataNftIndices = dataRecords.map((_, nftIndex) => nftIndex);
    physical.returnEventInBlock = true;
    physical.callBatch = { frames, recordOffset, ...(probed && { dataCommitments: probed.dataCommitments }) };
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

type FrameCall = Pick<DirectCallBatchFrame, 'abiFunction' | 'args' | 'rowEntryShift'>;

/** A frame's ABI arguments: its visible ones, the output its record sits at and its entries' shift. */
function frameAbiArgs(frame: FrameCall, recordIndex: number): FunctionArgument[] {
  let visible = 0;
  return frame.abiFunction.inputs.map((input): FunctionArgument => {
    if (input.name === RETURN_OUTPUT_INDEX) return BigInt(recordIndex);
    if (input.name === ROW_ENTRY_SHIFT) return frame.rowEntryShift;
    if (input.name.startsWith('__internal__')) return defaultInternalFunctionArg(input);
    return frame.args[visible++] as FunctionArgument;
  });
}

/**
 * Run a multi-call spend of `contract` alone, its master at input 0, and read what it settles: each frame's
 * result from the record it pins, and the data records the entry leaves from its final pins. A failed pin names
 * the value it expected, so the probe learns them one at a time until the spend passes.
 */
function probeCallBatch(
  contract: Contract, inputs: readonly UnlockableUtxo[], frames: readonly FrameCall[], recordOffset: number,
  dataRecordCount: number, unsupported: (detail: string) => Error,
): { results: Uint8Array[]; dataCommitments: string[] } {
  const master = inputs[0]!;
  const category = master.token?.category;
  if (category === undefined) throw unsupported('its master carries no token');
  const unlocker = contract.createCallBatchUnlocker(frames.map((frame, frameIndex) => ({
    abiFunction: frame.abiFunction, args: frameAbiArgs(frame, recordOffset + frameIndex),
  })));
  // The entry's pushes do not depend on the transaction.
  const unlocking = unlocker.generateUnlockingBytecode({} as GenerateUnlockingBytecodeOptions);
  // Only the master runs: every other input contributes its lock and token.
  const probeInputs: UnlockableUtxo[] = inputs.map((input, index) => {
    const lock = input.unlocker.generateLockingBytecode();
    return { ...input, unlocker: index === 0 ? unlocker : {
      generateLockingBytecode: (): Uint8Array => lock, generateUnlockingBytecode: (): Uint8Array => new Uint8Array(),
    } };
  });
  const records = frames.map(() => '');
  const data = inputs.slice(1, 1 + dataRecordCount).map((input) => input.token?.nft?.commitment ?? '');
  const program = (): Parameters<typeof evaluateProbeTrace>[1] => {
    const outputs: Output[] = probeInputs.map((input, index): Output => {
      const lock = input.unlocker.generateLockingBytecode();
      if (index >= recordOffset) {
        return { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS, token: {
          amount: 0n, category, nft: { capability: 'none', commitment: records[index - recordOffset]! },
        } };
      }
      if (index >= 1 && index <= dataRecordCount && input.token?.nft !== undefined) {
        return { to: lock, amount: input.satoshis, token: {
          ...input.token, nft: { ...input.token.nft, commitment: data[index - 1]! },
        } };
      }
      return { to: lock, amount: input.satoshis, ...(input.token && { token: input.token }) };
    });
    const transaction = {
      version: 2,
      locktime: 0,
      inputs: probeInputs.map((input, index) => ({
        outpointTransactionHash: hexToBin(input.txid), outpointIndex: input.vout, sequenceNumber: 0xffffffff,
        unlockingBytecode: index === 0 ? unlocking : new Uint8Array(),
      })),
      outputs: outputs.map(solidCashOutputToLibauthOutput),
    };
    return { inputIndex: 0, sourceOutputs: generateLibauthSourceOutputs(probeInputs), transaction };
  };
  for (let round = 0; round <= frames.length + dataRecordCount; round += 1) {
    const trace = evaluateProbeTrace(contract.provider, program());
    let learned = false;
    const learn = (values: string[], index: number, outputIndex: number): void => {
      const expected = extractExpectedOutputCommitmentFromTrace(trace, outputIndex, values[index]!);
      if (expected === undefined || expected === values[index]) return;
      values[index] = expected;
      learned = true;
    };
    records.forEach((_, frameIndex) => learn(records, frameIndex, recordOffset + frameIndex));
    data.forEach((_, nftIndex) => learn(data, nftIndex, 1 + nftIndex));
    if (!learned) break;
  }
  const vm = createVirtualMachineBch2026ForProvider(contract.provider);
  const outcome = vm.stateSuccess(vm.evaluate(program()));
  if (outcome !== true) throw unsupported(`a probe of the spend fails (${String(outcome)})`);
  const results = records.map((record, frameIndex) => {
    const raw = parseCallRecord(hexToBin(record))?.raw;
    if (raw === undefined) throw unsupported(`frame ${frameIndex} pins no inline result`);
    return raw;
  });
  return { results, dataCommitments: data };
}

/**
 * The multi-call entry's unlocker for a consolidated batch. Frame k's record index is its master input's index plus
 * the record slot's offset, so the unlocking bytecode follows the input it is generated for.
 */
export function directCallBatchUnlocker(group: ExternalCallUtxoGroup): ContractUnlocker {
  const contract = group.externalContract.inner as Contract;
  const batch = group.callBatch!;
  const unlockerAt = (masterInputIndex: number): ContractUnlocker => contract.createCallBatchUnlocker(
    batch.frames.map((frame, frameIndex) => ({
      abiFunction: frame.abiFunction, args: frameAbiArgs(frame, masterInputIndex + batch.recordOffset + frameIndex),
    })),
  );
  return {
    ...unlockerAt(0),
    generateUnlockingBytecode: (options: GenerateUnlockingBytecodeOptions): Uint8Array => (
      unlockerAt(options?.inputIndex ?? 0).generateUnlockingBytecode(options)
    ),
  };
}
