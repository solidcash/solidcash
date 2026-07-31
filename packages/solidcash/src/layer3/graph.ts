import { MAX_HIDDEN_BATCH_BLOB_BYTES, occurrenceBoundOf, occurrenceCountViolation } from '@solidcash/utils';
import type {
  AbiFunction, Artifact, ExternalCallAbi, InvocationAnalysisFunction,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import {
  encodeHiddenBatch, type EncodedHiddenBatch, type HiddenBatchInvocation,
} from './hidden-batch.js';

export interface CompiledGraphParticipant {
  artifact: Artifact;
  lockingBytecode: string;
  /**
   * Values for route key witnesses no invocation binds. An ordered mix of handlers produces these by
   * construction: a handler with a single mapping access binds only the shared entry, so another row's
   * row-local slot stays unbound while the route still declares it. The caller names that entry - the SDK
   * cannot derive it, because no row touches it - and the covenant still authenticates it like any other.
   */
  unboundRouteWitnesses?: Readonly<Record<string, FunctionArgument>>;
}

export interface CompiledGraphInvocation {
  /**
   * Parent invocation index. `null` identifies the single transaction-origin root.
   * The logical caller owner is derived as `invocations[parent].callee`; it is never witness-authored.
   */
  parent: number | null;
  callee: number;
  function: string;
  args?: readonly FunctionArgument[];
  /** Compiler-authored mode of the parent edge. Omitted only for the root or legacy direct planners. */
  callMode?: 'call' | 'staticcall';
}

export interface PlannedGraphInvocation {
  index: number;
  parent: number | null;
  caller: number | null;
  callee: number;
  /** Inclusive end of this invocation's canonical depth-first subtree. */
  subtreeEnd: number;
  localRow: number;
  depth: number;
  function: string;
  selectorHex: string;
  callMode: 'call' | 'staticcall';
  /**
   * X5: the committed call-options byte of this row's parent edge - one field, one encoder, one covenant bound.
   *
   * Bit 0 is the read-only (`staticcall`) mode. Bits 1-7 are the call options a source-level callsite can carry
   * (`{value: ..}` and token-container operations); none is an admitted graph edge, so the only values the
   * covenants accept are 0 and 1, and a transaction-origin row - which answers no callsite and therefore has no
   * edge - must be exactly 0. The bits are DERIVED from the same measurement `assertNoUnboundCallOptions`
   * refuses on, not hardcoded: if that refusal is ever relaxed, an option-bearing row carries its option into
   * the transcript and the projection verifier rejects it, rather than the option silently disappearing.
   */
  callOptions: number;
  argsHex: string;
  resultTypes: readonly string[];
  /**
   * Compiler callsite identifier of the parent occurrence this invocation answers. Absent for the root and
   * for parents whose artifact publishes no matching callsite.
   */
  consumerCallsiteId?: number;
  /** Child invocation results which must exist before this invocation can resume. */
  resultDependencies: readonly number[];
}

export interface CompiledParticipantExecution {
  participant: number;
  lockingBytecode: string;
  batch: EncodedHiddenBatch;
  /** Global invocation indices, in the exact order executed by this owner's SCB1 route. */
  invocations: readonly number[];
  /** Exact compiler-emitted balanced physical block for this owner's SCB1 route. */
  blockLayout: NonNullable<Artifact['hiddenBatch']>['route']['blockLayout'];
}

export interface CompiledGraphPlan {
  participants: readonly CompiledParticipantExecution[];
  invocations: readonly PlannedGraphInvocation[];
}

/**
 * Reject a result-dependency graph which requires an invocation to consume an unavailable future value.
 * Structural execution/owner edges are intentionally absent: A -> B -> A is valid when its invocation-level
 * result dependencies still have a topological order.
 */
export function assertResolvableResultDependencies(
  invocationCount: number,
  dependencies: readonly (readonly number[])[],
): void {
  if (!Number.isInteger(invocationCount) || invocationCount < 0
    || dependencies.length !== invocationCount) {
    throw new Error('layer3: result dependency table has the wrong invocation count');
  }
  dependencies.forEach((outgoing, consumer) => {
    const unique = new Set<number>();
    for (const producer of outgoing) {
      if (!Number.isInteger(producer) || producer < 0 || producer >= invocationCount) {
        throw new Error(`layer3: invocation ${consumer} names an out-of-range result producer`);
      }
      if (producer === consumer || unique.has(producer)) {
        throw new Error(`layer3: invocation ${consumer} has an invalid duplicate/self result dependency`);
      }
      unique.add(producer);
    }
  });
  const state = new Uint8Array(invocationCount);
  const visit = (consumer: number): void => {
    if (state[consumer] === 2) return;
    if (state[consumer] === 1) {
      throw new Error('layer3: result dependency cycle requires an unavailable future result');
    }
    state[consumer] = 1;
    for (const producer of dependencies[consumer]) visit(producer);
    state[consumer] = 2;
  };
  for (let invocation = 0; invocation < invocationCount; invocation += 1) visit(invocation);
}

export interface FinalizedCompiledGraph {
  plan: CompiledGraphPlan;
  /** Canonical framed transcript bytes authenticated by every participant projection. */
  bytes: Uint8Array;
  /** SHA-256 of `bytes`; suitable for the controller NFT commitment. */
  root: string;
  /** Canonical per-invocation result bytes, empty for void invocations. */
  resultsHex: readonly string[];
  /** Byte offset of each participant's `lbc-frame || batch-frame` within `bytes`. */
  participantOffsets: readonly number[];
  participantInputs: readonly number[];
  projectionInputs: readonly number[];
  returnOutputs: readonly (number | null)[];
  /** Inner SCB1 packed result vector (before the outer `bytes` return-event framing), by participant. */
  participantResultVectorsHex: readonly string[];
  /** Exact source-emitted child-call rows, grouped by caller owner. */
  participantEmissionsHex: readonly string[];
  /** Logical caller locking bytecode per local invocation, framed in local-row order. */
  participantCallersHex: readonly string[];
}

/**
 * One participant's bounded runtime-resource region, in ABSOLUTE transaction slots.
 *
 * The compiler reserves this region inside the participant's balanced block for resources whose count is
 * only known at run time: dynamic-storage chunks, loop entries and loop sidecars. Its size is fixed at
 * compile time and is part of `blockSize`, so every later participant is already placed past it - the region
 * is not an extension of the block, it is part of it.
 *
 * Published because the composer cannot derive it: `blockLayout.trailingBase` is LOCAL to the block, and only
 * this layout knows where the block starts. Without it, S3's transaction is assembled by adding the two by
 * hand at every call site, which is exactly the global-index dependency L1 exists to remove.
 */
export interface GraphTrailingRegion {
  /** Index into `CompiledGraphPlan.participants`. */
  participant: number;
  /** First absolute input/output slot of the region. */
  base: number;
  /** Slots reserved. A longer run cannot be described by the balanced model at all. */
  capacity: number;
}

export interface CompiledGraphPhysicalLayout {
  /** Physical master input of each participant, by participant index. */
  participantInputs: readonly number[];
  /** One-shot controller NFT input carrying `FinalizedCompiledGraph.root`. */
  controllerInput: number;
  /** One paired proof slot per participant. */
  projectionInputs: readonly number[];
  /** Final fee-funding input paired with final change. */
  feeInput: number;
  /** Exact balanced transaction input/output count. */
  totalSlots: number;
  /**
   * Optional return-event output per participant. Required when that participant's SCB1 plan returns values.
   * The corresponding expected full NFT commitment is supplied in `resultCommitmentsHex`.
   */
  returnOutputs?: readonly (number | null)[];
  /**
   * Absolute runtime-resource regions, in participant order. A participant whose block declares none - every
   * participant with no dynamic state, no loop entry write and no loop sidecar - contributes no entry.
   */
  trailingRegions: readonly GraphTrailingRegion[];
}

/**
 * Compose compiler-emitted participant blocks without diverging input/output bases.
 *
 * Each participant begins after the complete preceding SCB1 route block. Projection
 * proofs, the one-shot controller, and the fee/change tail are each paired one-slot
 * blocks, so the complete transaction has one shared input/output index space.
 */
export function compiledGraphPhysicalLayout(plan: CompiledGraphPlan): CompiledGraphPhysicalLayout {
  const participantInputs: number[] = [];
  const returnOutputs: (number | null)[] = [];
  const trailingRegions: GraphTrailingRegion[] = [];
  let cursor = 0;
  for (const participant of plan.participants) {
    const layout = participant.blockLayout;
    if (!layout || layout.blockSize < 1 || layout.slots[0]?.kind !== 'master') {
      throw new Error(`layer3: participant ${participant.participant} lacks a balanced master block`);
    }
    const offsets = new Set<number>();
    for (const slot of layout.slots) {
      if (!Number.isInteger(slot.offset) || slot.offset < 0 || slot.offset >= layout.blockSize
        || offsets.has(slot.offset)) {
        throw new Error(
          `layer3: participant ${participant.participant} has a malformed local block descriptor`,
        );
      }
      offsets.add(slot.offset);
    }
    if (layout.slots.filter((slot) => slot.kind === 'master').length !== 1
      || layout.slots.find((slot) => slot.kind === 'master')?.offset !== 0
      || offsets.size !== layout.blockSize) {
      throw new Error(
        `layer3: participant ${participant.participant} local block is not a complete balanced span`,
      );
    }
    if (layout.trailingBase !== undefined) {
      const capacity = layout.trailingCapacity ?? -1;
      const trailing = layout.slots.filter((slot) => slot.kind === 'trailing');
      if (!Number.isInteger(capacity) || capacity < 1 || trailing.length !== capacity
        || trailing.some((slot, index) => slot.offset !== layout.trailingBase! + index)) {
        throw new Error(
          `layer3: participant ${participant.participant} has a malformed trailing region`,
        );
      }
    }
    participantInputs.push(cursor);
    if (layout.trailingBase !== undefined) {
      trailingRegions.push(Object.freeze({
        participant: participant.participant,
        base: cursor + layout.trailingBase,
        capacity: layout.trailingCapacity!,
      }));
    }
    const returnSlots = layout.slots.filter((slot) => slot.kind === 'returnEvent');
    if (returnSlots.length > 1) {
      throw new Error(`layer3: participant ${participant.participant} has multiple return-event slots`);
    }
    returnOutputs.push(returnSlots.length === 0 ? null : cursor + returnSlots[0].offset);
    cursor += layout.blockSize;
  }
  const projectionInputs = plan.participants.map((_participant, index) => cursor + index);
  cursor += plan.participants.length;
  const controllerInput = cursor;
  cursor += 1;
  const feeInput = cursor;
  cursor += 1;
  return Object.freeze({
    participantInputs: Object.freeze(participantInputs),
    projectionInputs: Object.freeze(projectionInputs),
    controllerInput,
    feeInput,
    totalSlots: cursor,
    returnOutputs: Object.freeze(returnOutputs),
    trailingRegions: Object.freeze(trailingRegions),
  });
}

/**
 * The part of a physical layout the capacity rule reads: how many participants exist, and which of them
 * declare a runtime-resource region.
 *
 * `CompiledGraphPhysicalLayout` satisfies this structurally, so a caller holding one passes it unchanged. The
 * narrower type is what lets the preflight run the same rule against an assembly DERIVED from a builder's own
 * inputs, where no caller-supplied plan object exists at all - see `preflightLayer3BlockAssembly`.
 */
export interface GraphTrailingCapacityView {
  participantInputs: readonly number[];
  trailingRegions: readonly GraphTrailingRegion[];
}

/**
 * Refuse a runtime-resource run the balanced model cannot describe, BEFORE anything is signed.
 *
 * `runs` names, per participant, how many trailing slots that owner's handlers actually claim: one per
 * dynamic-storage chunk output, loop entry or loop sidecar. The direct route already refuses this shape
 * (`StatefulTransactionBuilder`, "Runtime resource outputs exceed balanced trailing capacity"); the graph
 * route had no analogue, and the difference is measurable. A 65-chunk write against a 64-slot region was
 * built, funded and signed, and then refused by the VM at the FIRST PROJECTION INPUT - a slot that names
 * nothing about the cause, because the overflowing block simply runs into the proof region. This states the
 * refusal where the composer can act on it, at zero signature requests.
 *
 * It is a describability rule, not a covenant: the covenant is what actually authenticates the chunk run, and
 * nothing here relaxes it. A run WITHIN capacity is accepted by this check and still has to satisfy the
 * count, order, category, capability and commitment checks in the participant's own route.
 */
export function assertGraphTrailingCapacity(
  layout: GraphTrailingCapacityView,
  runs: Readonly<Record<number, number>>,
): void {
  for (const [key, run] of Object.entries(runs)) {
    const participant = Number(key);
    if (!Number.isInteger(participant) || participant < 0
      || participant >= layout.participantInputs.length) {
      throw new Error(`layer3: trailing run names participant ${key}, which this graph does not have`);
    }
    if (!Number.isInteger(run) || run < 0) {
      throw new Error(`layer3: participant ${participant} has a non-integer runtime-resource run`);
    }
    if (run === 0) continue;
    const region = layout.trailingRegions.find((entry) => entry.participant === participant);
    if (region === undefined) {
      throw new Error(
        `layer3: participant ${participant} claims ${run} runtime-resource slots but its block declares no `
        + 'trailing region',
      );
    }
    if (run > region.capacity) {
      throw new Error(
        `layer3: participant ${participant} runtime-resource run exceeds its balanced trailing capacity `
        + `(${run} > ${region.capacity})`,
      );
    }
  }
}

const GRAPH_DOMAIN = utf8ToBin('L3GRAPH1\0');
const MAX_GRAPH_PARTICIPANTS = 8;
const MAX_GRAPH_INVOCATIONS = 24;
const MAX_GRAPH_DEPTH = 7;

/**
 * Largest SCB1 batch blob the GENERATED root controller admits, in bytes (X106).
 *
 * NOT A SECOND COPY ANY MORE. This is the shared `MAX_HIDDEN_BATCH_BLOB_BYTES` from `@solidcash/utils` under
 * the name the SDK's layer3 callers already use, so the controller's per-participant frame check and the
 * compiler's route check (republished as `artifact.hiddenBatch.maximumBlobBytes`) cannot drift apart. Both were
 * a bare `223`; `@solidcash/utils` is the only package the compiler and the SDK both depend on, so it is the
 * only place they can share one literal.
 *
 * A re-export rather than a rename, because the value is load-bearing: for a chunk-backed value crossing a
 * handler boundary the blob and not the trailing region is the binding constraint - an argument-carried value
 * caps at 202 bytes (2 chunks) while a computed one reaches all 64 trailing slots, so the envelope binds 32x
 * earlier than the region.
 *
 * `assertGraphBatchBlobEnvelope` closes the loop the other way, from the artifact back to this bound.
 */
export const GRAPH_MAX_BATCH_BLOB_BYTES = MAX_HIDDEN_BATCH_BLOB_BYTES;

/**
 * Refuse a participant whose published blob envelope is wider than the generated controller admits.
 *
 * The direction is not symmetric, and only one side is a defect. A participant publishing a SMALLER maximum is
 * merely tighter: `encodeHiddenBatch` refuses the oversized blob first, by name. A participant publishing a
 * LARGER one is the drift that costs: the SDK encodes a blob its own encoder accepts, and the co-spent
 * controller then refuses the whole transaction at the controller input, naming nothing about blob width.
 */
export function assertGraphBatchBlobEnvelope(artifact: Artifact, participant: number): void {
  const published = artifact.hiddenBatch?.maximumBlobBytes;
  if (published === undefined || published <= GRAPH_MAX_BATCH_BLOB_BYTES) return;
  throw new Error(
    `layer3: participant ${participant} publishes an SCB1 blob envelope of ${published} bytes, wider than the `
    + `${GRAPH_MAX_BATCH_BLOB_BYTES} the generated graph root controller admits`,
  );
}
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};
const uint = (value: number, width: 1 | 2): Uint8Array => {
  const maximum = width === 1 ? 0xff : 0xffff;
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`layer3: graph field does not fit uint${width * 8}`);
  }
  return width === 1
    ? Uint8Array.of(value)
    : Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
};
const framed = (bytes: Uint8Array): Uint8Array => concat(uint(bytes.length, 2), bytes);

/** Bit 0 of the call-options byte: the compiler-proven read-only (`staticcall`) mode. */
const CALL_OPTION_READ_ONLY = 1;
/** Bit 1: the admitted singular raw-call value option. Higher source-level option bits remain refused. */
const CALL_OPTION_VALUE = 2;
const CALL_OPTION_TOKEN_CONTAINER = 4;
const CALL_OPTION_BLOCK_SLOT = 8;

/**
 * The single encoder of a row's committed call-options byte, used by BOTH framings that carry it: the caller's
 * emission row and the global invocation row. They are compared against each other by the projection verifier,
 * so a second copy of this ternary is a place for the two to drift - the shape X31 removed for `abi.find`.
 *
 * `callMode` stays the field the rest of the planner reasons about; this asserts the byte agrees with it, so a
 * hand-constructed `CompiledGraphPlan` handed straight to `finalizeCompiledGraph` cannot desynchronize the two.
 */
const callOptionsByte = (invocation: PlannedGraphInvocation): number => {
  const options = invocation.callOptions;
  if (!Number.isInteger(options) || options < 0 || options > 0xff) {
    throw new Error(`layer3: invocation ${invocation.index} has no canonical call-options byte`);
  }
  const readOnly = invocation.callMode === 'staticcall' ? CALL_OPTION_READ_ONLY : 0;
  if ((options & CALL_OPTION_READ_ONLY) !== readOnly) {
    throw new Error(
      `layer3: invocation ${invocation.index} call-options byte disagrees with its '${invocation.callMode}' mode`,
    );
  }
  return options;
};

/**
 * Freeze a planned graph into one unambiguous execution transcript.
 *
 * Results are supplied only after producer VM probes. Every returning invocation must have exactly one
 * canonical result byte vector, while void invocations must not be assigned one. The transcript commits both
 * the global depth-first tree and each owner's exact SCB1 execution blob, preventing a graph/local-projection
 * desynchronization.
 */
export function finalizeCompiledGraph(
  plan: CompiledGraphPlan,
  results: Readonly<Record<number, string>> = {},
  participantInputs: readonly number[] = plan.participants.map((_participant, index) => index),
  returnOutputs: readonly (number | null)[] = plan.participants.map(() => null),
  participantResultVectorsHex: readonly string[] = plan.participants.map(() => ''),
  projectionInputs: readonly number[] = plan.participants.map(
    (_participant, index) => plan.participants.length + index,
  ),
  rootCallerLockingBytecode = '',
): FinalizedCompiledGraph {
  if (participantInputs.length !== plan.participants.length
    || participantInputs.some((input) => !Number.isInteger(input) || input < 0 || input > 0xffff)
    || participantInputs.some((input, index) => index > 0 && input <= participantInputs[index - 1])) {
    throw new Error('layer3: participant physical inputs must be strictly increasing uint16 values');
  }
  if (returnOutputs.length !== plan.participants.length
    || participantResultVectorsHex.length !== plan.participants.length
    || projectionInputs.length !== plan.participants.length) {
    throw new Error('layer3: return outputs/result vectors must align with participants');
  }
  if (projectionInputs.some((input) => !Number.isInteger(input) || input < 0 || input > 0xffff)
    || projectionInputs.some((input, index) => index > 0 && input <= projectionInputs[index - 1])
    || projectionInputs.some((input) => participantInputs.includes(input))) {
    throw new Error('layer3: projection inputs must be strictly increasing uint16 proof slots');
  }
  if (plan.participants.length > MAX_GRAPH_PARTICIPANTS
    || plan.invocations.length > MAX_GRAPH_INVOCATIONS
    || plan.invocations.some((invocation) => invocation.depth > MAX_GRAPH_DEPTH)) {
    throw new Error('layer3: graph exceeds the deployed participant, invocation, or depth bound');
  }
  plan.participants.forEach((participant, index) => {
    const returning = participant.batch.results.length > 0;
    const output = returnOutputs[index];
    const vector = participantResultVectorsHex[index];
    if (returning) {
      if (!Number.isInteger(output) || output! < 0 || output! > 0xffff
        || !/^([0-9a-fA-F]{2})+$/.test(vector)) {
        throw new Error(`layer3: returning participant ${index} lacks a return output/result vector`);
      }
      if (vector.length / 2 > 126) {
        throw new Error(`layer3: participant ${index} result vector exceeds the NFT commitment envelope`);
      }
    } else if (output !== null || vector !== '') {
      throw new Error(`layer3: non-returning participant ${index} cannot carry a result vector`);
    }
  });
  const resultHex = plan.invocations.map((invocation) => {
    const supplied = results[invocation.index];
    if (invocation.resultTypes.length === 0) {
      if (supplied !== undefined && supplied !== '') {
        throw new Error(`layer3: void invocation ${invocation.index} cannot carry a result`);
      }
      return '';
    }
    if (supplied === undefined || !/^([0-9a-fA-F]{2})*$/.test(supplied)) {
      throw new Error(`layer3: returning invocation ${invocation.index} lacks canonical result bytes`);
    }
    return supplied.toLowerCase();
  });
  const emissionParts = plan.participants.map(() => [] as Uint8Array[]);
  for (const invocation of plan.invocations) {
    if (invocation.parent === null || invocation.caller === null) continue;
    const target = hexToBin(plan.participants[invocation.callee].lockingBytecode);
    const args = hexToBin(invocation.argsHex);
    const result = hexToBin(resultHex[invocation.index]);
    emissionParts[invocation.caller].push(
      framed(target), uint(callOptionsByte(invocation), 1),
      hexToBin(invocation.selectorHex), framed(args), framed(result),
    );
  }
  const participantEmissions = emissionParts.map((parts) => concat(...parts));
  const callerParts = plan.participants.map(() => [] as Uint8Array[]);
  for (const invocation of plan.invocations) {
    const caller = invocation.parent === null
      ? hexToBin(rootCallerLockingBytecode)
      : hexToBin(plan.participants[invocation.caller!].lockingBytecode);
    callerParts[invocation.callee].push(framed(caller));
  }
  const participantCallers = callerParts.map((parts) => concat(...parts));
  for (const key of Object.keys(results)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= plan.invocations.length) {
      throw new Error(`layer3: result names unknown invocation '${key}'`);
    }
  }
  plan.participants.forEach((participant, owner) => {
    if (participant.batch.results.length === 0) return;
    const reachedPrefix = participant.invocations.map((invocation) => resultHex[invocation]).join('');
    if (!participantResultVectorsHex[owner].toLowerCase().startsWith(reachedPrefix)) {
      throw new Error(`layer3: participant ${owner} result vector disagrees with its invocation results`);
    }
  });

  const parts: Uint8Array[] = [GRAPH_DOMAIN, uint(plan.participants.length, 1)];
  const participantOffsets: number[] = [];
  let encodedLength = GRAPH_DOMAIN.length + 1;
  for (const participant of plan.participants) {
    const participantIndex = participant.participant;
    const lbc = hexToBin(participant.lockingBytecode);
    participantOffsets.push(encodedLength);
    const inputFrame = uint(participantInputs[participantIndex], 2);
    const blockSizeFrame = uint(participant.blockLayout!.blockSize, 2);
    const lbcFrame = framed(lbc);
    const batchFrame = framed(participant.batch.blob);
    const emissionFrame = framed(participantEmissions[participantIndex]);
    const callerFrame = framed(participantCallers[participantIndex]);
    const returnFrame = uint(returnOutputs[participantIndex] ?? 0xffff, 2);
    const resultFrame = framed(hexToBin(participantResultVectorsHex[participantIndex]));
    const projectionFrame = uint(projectionInputs[participantIndex], 2);
    parts.push(inputFrame, blockSizeFrame, lbcFrame, batchFrame, emissionFrame, callerFrame,
      returnFrame, resultFrame, projectionFrame);
    encodedLength += inputFrame.length + blockSizeFrame.length + lbcFrame.length + batchFrame.length
      + emissionFrame.length + callerFrame.length
      + returnFrame.length + resultFrame.length + projectionFrame.length;
  }
  parts.push(uint(plan.invocations.length, 2));
  plan.invocations.forEach((invocation, index) => {
    const args = hexToBin(invocation.argsHex);
    const result = hexToBin(resultHex[index]);
    parts.push(
      uint(invocation.parent === null ? 0xffff : invocation.parent, 2),
      uint(invocation.callee, 1),
      uint(invocation.localRow, 1),
      uint(invocation.depth, 1),
      uint(invocation.subtreeEnd, 2),
      hexToBin(invocation.selectorHex),
      uint(callOptionsByte(invocation), 1),
      framed(args),
      framed(result),
    );
  });
  const bytes = concat(...parts);
  return Object.freeze({
    plan,
    bytes,
    root: binToHex(sha256.hash(bytes)),
    resultsHex: Object.freeze(resultHex),
    participantOffsets: Object.freeze(participantOffsets),
    participantInputs: Object.freeze([...participantInputs]),
    projectionInputs: Object.freeze([...projectionInputs]),
    returnOutputs: Object.freeze([...returnOutputs]),
    participantResultVectorsHex: Object.freeze(
      participantResultVectorsHex.map((vector) => vector.toLowerCase()),
    ),
    participantEmissionsHex: Object.freeze(
      participantEmissions.map((emissions) => binToHex(emissions)),
    ),
    participantCallersHex: Object.freeze(
      participantCallers.map((callers) => binToHex(callers)),
    ),
  });
}

/**
 * Exact compiler-route arguments for one graph participant. Collection witnesses follow the compiler-owned
 * graph context in route ABI order.
 */
export function compiledGraphRouteArgs(
  transcript: FinalizedCompiledGraph,
  participant: number,
  controllerInput: number,
): readonly (Uint8Array | bigint | FunctionArgument)[] {
  const execution = transcript.plan.participants[participant];
  const offset = transcript.participantOffsets[participant];
  if (!execution || offset === undefined) throw new Error('layer3: graph participant is out of range');
  return Object.freeze([
    execution.batch.blob,
    transcript.bytes,
    BigInt(controllerInput),
    BigInt(offset),
    BigInt(execution.blockLayout!.blockSize),
    hexToBin(transcript.participantEmissionsHex[participant]),
    hexToBin(transcript.participantCallersHex[participant]),
    ...execution.batch.routeWitnesses,
  ]);
}

/**
 * Fixed-code one-shot graph-root controller. Its locking bytecode is independent of any transcript, so
 * application artifacts can pin it at compile time. A mint-once mutable NFT supplies the root commitment;
 * `attest` authenticates the complete transcript bytes and burns the unique category.
 */
export function generateGraphRootController(projectionVerifierLbc: string): string {
  const verifier = projectionVerifierLbc.toLowerCase();
  if (!/^([0-9a-f]{2})+$/.test(verifier)) {
    throw new Error('layer3: projection verifier locking bytecode must be hex bytes');
  }
  // One byte per depth frame: `frames[d]` is the open invocation at depth `d`, `frames[8 + d]` its
  // inclusive subtree end. 0xff marks an unopened frame and cannot be forged, because every real index
  // is below `invocationCount <= 24` and the parent equality below is gated on that bound.
  const frameBytes = 2 * (MAX_GRAPH_DEPTH + 1);
  const emptyFrames = `hex"${'ff'.repeat(frameBytes)}"`;
  return `pragma solidcash >=0.8.0;
contract GraphRootController(bytes20 initializer) {
  function initialize(bytes32 root, pubkey pk, sig s) {
    require(hash160(pk) == initializer);
    require(checkSig(s, pk));
    require(root != bytes32(0));
    require(tx.inputs[this.activeInputIndex].nftCommitment.length == 0);
    require(tx.inputs[this.activeInputIndex].tokenCategory.slice(32, 33) == hex"01");
    require(this.activeInputIndex < tx.outputs.length);
    require(tx.outputs[this.activeInputIndex].lockingBytecode
      == tx.inputs[this.activeInputIndex].lockingBytecode);
    require(tx.outputs[this.activeInputIndex].tokenCategory
      == tx.inputs[this.activeInputIndex].tokenCategory);
    require(tx.outputs[this.activeInputIndex].nftCommitment == root);
    require(tx.outputs[this.activeInputIndex].value == tx.inputs[this.activeInputIndex].value);
    require(true);
  }
  function attest(bytes transcript) {
    require(tx.inputs[this.activeInputIndex].nftCommitment.length == 32);
    require(tx.inputs[this.activeInputIndex].nftCommitment == sha256(transcript));
    bigint transcriptLength = transcript.length;
    require(transcriptLength >= 10 && transcript.slice(0, 9) == hex"4c3347524150483100");
    bigint participantCount = int(bytes.concat(transcript.slice(9, 10), hex"00"));
    require(participantCount >= 1 && participantCount <= 8);
    bigint previousReturnOutput = -1;
    bigint previousProjectionInput = -1;
    bigint expectedInput = 0;
    bigint cursor = 10;
    for (bigint participant = 0; participant < participantCount; participant = participant + 1) {
      // X27: split ONE suffix per participant and read every field off it, so a read costs the REMAINING
      // transcript instead of the whole blob. \`local\` carries the same offset \`cursor\` used to, measured
      // from the frame start, and every bound is the old \`cursor + n <= transcript.length\` rewritten as
      // \`local + n <= frame.length\`; frame.length == transcriptLength - cursor makes the two identical.
      // The suffix split itself is in range because cursor <= transcriptLength holds on entry to every
      // iteration - 10 <= transcriptLength for the first, and the last bound of the body for the rest.
      bytes frame = transcript.slice(cursor, transcriptLength);
      require(frame.length >= 6);
      bigint participantInput = int(bytes.concat(frame.slice(0, 2), hex"00"));
      bigint blockSize = int(bytes.concat(frame.slice(2, 4), hex"00"));
      bigint lbcLength = int(bytes.concat(frame.slice(4, 6), hex"00"));
      require(participantInput == expectedInput && participantInput < tx.inputs.length);
      require(blockSize >= 1 && participantInput + blockSize <= tx.inputs.length);
      expectedInput = participantInput + blockSize;
      require(lbcLength > 0 && 8 + lbcLength <= frame.length);
      require(tx.inputs[participantInput].lockingBytecode == frame.slice(6, 6 + lbcLength));
      bigint batchLength = int(bytes.concat(frame.slice(6 + lbcLength, 8 + lbcLength), hex"00"));
      bigint local = 8 + lbcLength;
      require(batchLength >= 7 && batchLength <= ${GRAPH_MAX_BATCH_BLOB_BYTES} && local + batchLength + 2 <= frame.length);
      bytes unlocking = tx.inputs[participantInput].unlockingBytecode;
      require(unlocking.slice(0, 5) == hex"0453434231");
      if (batchLength <= 75) {
        require(int(bytes.concat(unlocking.slice(5, 6), hex"00")) == batchLength);
        require(unlocking.slice(6, 6 + batchLength) == frame.slice(local, local + batchLength));
      } else {
        require(unlocking.slice(5, 6) == hex"4c");
        require(int(bytes.concat(unlocking.slice(6, 7), hex"00")) == batchLength);
        require(unlocking.slice(7, 7 + batchLength) == frame.slice(local, local + batchLength));
      }
      bigint emissionsLength = int(bytes.concat(
        frame.slice(local + batchLength, local + batchLength + 2), hex"00"));
      local = local + batchLength + 2;
      require(local + emissionsLength + 2 <= frame.length);
      bigint callersLength = int(bytes.concat(
        frame.slice(local + emissionsLength, local + emissionsLength + 2), hex"00"));
      local = local + emissionsLength + 2;
      require(local + callersLength + 4 <= frame.length);
      bigint returnOutput = int(bytes.concat(
        frame.slice(local + callersLength, local + callersLength + 2), hex"00"));
      bigint resultVectorLength = int(bytes.concat(
        frame.slice(local + callersLength + 2, local + callersLength + 4), hex"00"));
      local = local + callersLength + 4;
      require(resultVectorLength <= 126 && local + resultVectorLength + 2 <= frame.length);
      if (resultVectorLength == 0) {
        require(returnOutput == 65535);
      } else {
        require(returnOutput >= participantInput && returnOutput < participantInput + blockSize);
        require(returnOutput > previousReturnOutput && returnOutput < tx.outputs.length);
        previousReturnOutput = returnOutput;
        bytes expectedCommitment;
        if (resultVectorLength <= 75) {
          expectedCommitment = bytes.concat(bytes1(resultVectorLength),
            frame.slice(local, local + resultVectorLength));
        } else {
          expectedCommitment = bytes.concat(hex"4c", bytes1(resultVectorLength),
            frame.slice(local, local + resultVectorLength));
        }
        require(tx.outputs[returnOutput].nftCommitment == expectedCommitment);
      }
      bigint projectionInput = int(bytes.concat(
        frame.slice(local + resultVectorLength, local + resultVectorLength + 2), hex"00"));
      local = local + resultVectorLength + 2;
      require(projectionInput > previousProjectionInput && projectionInput < tx.inputs.length);
      require(participant == 0 || projectionInput == previousProjectionInput + 1);
      previousProjectionInput = projectionInput;
      require(tx.inputs[projectionInput].lockingBytecode == hex"${verifier}");
      cursor = cursor + local;
    }
    // The proof slots are consecutive, so the last one names the first: the participant REGION ends
    // exactly where the projection region begins.
    require(previousProjectionInput + 1 - participantCount == expectedInput);
    require(this.activeInputIndex == expectedInput + participantCount);
    require(tx.inputs.length == this.activeInputIndex + 2);
    require(tx.outputs.length == tx.inputs.length);
    require(cursor + 2 <= transcriptLength);
    bigint invocationCount = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
    require(invocationCount >= 1 && invocationCount <= ${MAX_GRAPH_INVOCATIONS});
    bytes frames = ${emptyFrames};
    bigint previousDepth = -1;
    bigint tail = cursor + 2;
    for (bigint invocation = 0; invocation < invocationCount; invocation = invocation + 1) {
      // X27, same rewrite as the participant loop: one suffix split per row, all six reads off the suffix.
      bytes row = transcript.slice(tail, transcriptLength);
      require(row.length >= 14);
      bigint parent = int(bytes.concat(row.slice(0, 2), hex"00"));
      bigint depth = int(bytes.concat(row.slice(4, 5), hex"00"));
      bigint subtreeEnd = int(bytes.concat(row.slice(5, 7), hex"00"));
      require(int(bytes.concat(row.slice(2, 3), hex"00")) < participantCount);
      if (invocation == 0) {
        require(parent == 65535 && depth == 0 && subtreeEnd == invocationCount - 1);
      } else {
        require(parent < invocation && depth >= 1 && depth <= ${MAX_GRAPH_DEPTH}
          && depth <= previousDepth + 1);
        require(subtreeEnd >= invocation && subtreeEnd < invocationCount);
        bigint openIndex = int(bytes.concat(frames.slice(depth - 1, depth), hex"00"));
        bigint openEnd = int(bytes.concat(
          frames.slice(depth + ${MAX_GRAPH_DEPTH}, depth + ${MAX_GRAPH_DEPTH + 1}), hex"00"));
        require(openIndex < invocationCount && parent == openIndex);
        require(invocation <= openEnd && subtreeEnd <= openEnd);
      }
      previousDepth = depth;
      frames = bytes.concat(frames.slice(0, depth), bytes1(invocation),
        frames.slice(depth + 1, depth + ${MAX_GRAPH_DEPTH + 1}), bytes1(subtreeEnd),
        frames.slice(depth + ${MAX_GRAPH_DEPTH + 2}, ${frameBytes}));
      bigint argsLength = int(bytes.concat(row.slice(12, 14), hex"00"));
      require(16 + argsLength <= row.length);
      bigint resultLength = int(bytes.concat(
        row.slice(14 + argsLength, 16 + argsLength), hex"00"));
      tail = tail + 16 + argsLength + resultLength;
      require(tail <= transcriptLength);
    }
    require(tail == transcriptLength);
    require(tx.inputs[this.activeInputIndex].tokenCategory.length >= 32);
    bytes controllerCategory = tx.inputs[this.activeInputIndex].tokenCategory.slice(0, 32);
    for (bigint output = 0; output < tx.outputs.length; output = output + 1) {
      bytes outputCategory = tx.outputs[output].tokenCategory;
      if (outputCategory.length >= 32) {
        require(outputCategory.slice(0, 32) != controllerCategory);
      }
    }
    require(this.activeInputIndex < tx.outputs.length);
    require(tx.outputs[this.activeInputIndex].value == 1000);
    require(tx.outputs[this.activeInputIndex].tokenCategory.length == 0);
    require(tx.outputs[this.activeInputIndex].nftCommitment.length == 0);
    require(tx.outputs[this.activeInputIndex].tokenAmount == 0);
    require(true);
  }
}`;
}

/**
 * Fixed proof-slot covenant: exhaustively compares one owner's global rows to its SCB1/result projection.
 *
 * The four cursor-exhaustion requires at the end are the whole point of the walk: batch, emissions, callers
 * and results must each be consumed to their exact length, so no row can under-claim its share. The result
 * cursor matters most for a row with no consumer - a returning ROOT invocation has no parent, therefore no
 * emission row and no compiled route decoding it, so the projection slice is its only binding and the slice
 * alone is prefix-only. A non-root row is additionally bound by its consumer's route.
 */
export function generateGraphProjectionVerifier(): string {
  // X65: one fixed-stride PARTICIPANT-FRAME table replaces eight live `participantLbcN` locals and the three
  // 8-way if/else chains that wrote and read them. The table is the participant loop's own 6-byte frame header
  // appended in participant order, so `lbcHeaders[6i .. 6i+2)` is participant `i`'s input index,
  // `lbcHeaders[6i+4 .. 6i+6)` is its 2-byte locking-bytecode length field, and the two together reconstruct
  // the framed entry that `participantLbc{i}` used to hold.
  //
  // NOT A BYTE-OFFSET TABLE, and that is the point. An offset table needs a computed 2-byte offset whose
  // soundness rests on the stack-item bound; this stores RAW TRANSCRIPT BYTES at a constant stride and needs
  // no offset arithmetic at all. Measured against the shipped chains, the offset forms were also simply
  // worse: framed-entry table 4,522 / terminal-offset 4,385 / one-slice offset span 4,374 / bounded walk
  // 4,418, against 4,542 for the chains and 4,098 for the 2-byte index-only table X65 first landed.
  //
  // X81: THE `bytes2(...)` BOUND IS GONE, AND THE TABLE CARRIES THE LENGTH FIELD INSTEAD. X65 stored the index
  // alone (stride 2) and re-derived the framed entry's 2-byte length prefix as `bytes2(targetLbc.length)`. That
  // reproduces `frame.slice(4, 6)` exactly only while `lbcLength < 32,768`, which held on an appeal to a VM
  // constant - `8 + lbcLength <= frame.length <= transcript.length <= 10,000`, `transcript` being one stack item
  // under BCH-2025's `maximumStackItemLength`. The bound was fail-closed (OP_NUM2BIN aborts on
  // `insufficientLength` rather than truncating) and VM-verified, so it was never an authenticity risk.
  //
  // WHAT ACTUALLY CHANGES IS THE DIRECTION OF THE MAP, and that is the whole argument. The old form went
  // VALUE -> BYTES through OP_NUM2BIN, a PARTIAL function whose domain is a VM constant away from the field's
  // own domain. The new form goes BYTES -> VALUE through OP_BIN2NUM, which is total, and leans on that decode
  // being INJECTIVE on two bytes (`b0 + 256*b1` for `b0, b1` in `[0, 256)`) - which is unconditional, not a
  // bound. So `frame.slice(4, 6)` is pinned to the unique encoding of `lbcLength`, `lbcLength` is pinned to the
  // introspected script's length by the participant loop's
  // `tx.inputs[participantInput].lockingBytecode == frame.slice(6, 6 + lbcLength)`, and nothing appeals to
  // `maximumStackItemLength` any more. That matters beyond tidiness: BCH has raised its stack and commitment
  // limits twice in two years, and a covenant whose admitted set narrows when a limit RISES is a forward-
  // compatibility hazard rather than a fail-closed convenience.
  //
  // Measured at `6183cf12`: 4,098 -> 4,126 for the swap alone, and 4,121 with the independent `expectedTarget`
  // fold below, so the retired bound was priced at 28 bytes per projection script and the landed net is 23.
  // (The 19 recorded before this measurement belonged to an encoding that could not be reproduced here; the
  // four encodings tried were 6-byte stride 4,126, 4-byte stride index-then-length 4,135, 4-byte stride
  // length-then-index 4,130, two parallel 2-byte tables 4,180. Requiring the prefix's decode instead of
  // comparing its bytes - also bound-free - measures 4,278 and is much worse.)
  //
  // AND IT IS NOT ONLY BYTES, which the board should have when it prices the next one. Every projection input's
  // operation-cost DENSITY ratio rises, because the walk gains 126 instructions against only 23 bytes of
  // density-control length: measured per shape at `6183cf12`, C2's four projections 0.33485 -> 0.33654, C3's
  // eight 0.50829 -> 0.51062, A13's three 0.25122 -> 0.25226, C1's five 0.37421 -> 0.37606. No shape's binding
  // limit moves and no shape's WORST-density input is a projection, so every `worstDensityRatio` reproduces to
  // ten decimals; but the projections themselves got denser, not merely bigger.
  //
  // WHY THE ADMITTED SET IS UNCHANGED, BOTH TIMES. `callee < participantCount` is required before either
  // lookup, and every byte of `activeCallees` is either a `bytes1(callee)` written under that same bound or the
  // 0xff no-caller sentinel - so a lookup index is in `[0, participantCount)` or is 255. In range the table
  // returns the bytes the chain assigned: entry `i` is appended on participant `i`'s iteration, in order, so
  // both fields come from ONE frame and cannot be crossed between participants. At 255 the chain hit
  // `revert("caller out of range")` and `lbcHeaders.slice(1530, 1532)` runs off a <= 48-byte item: both abort
  // the script. No index reaches the chain's dead `participantCount <= i < 8` arms, which compared against an
  // unassigned EMPTY local, so removing them removes no admitted case - and would have been a tightening, not a
  // loosening, had one been reachable.
  const lbcLookup = (selector: string, name: string): string =>
    `bytes ${name}Lbc = tx.inputs[int(bytes.concat(
            lbcHeaders.slice(${selector} * 6, ${selector} * 6 + 2), hex"00"))].lockingBytecode;`;
  /** The framed entry's 2-byte length prefix, read out of the table rather than re-derived by a NUM2BIN. */
  const lbcFramedPrefix = (selector: string): string =>
    `lbcHeaders.slice(${selector} * 6 + 4, ${selector} * 6 + 6)`;
  // One byte per reachable depth frame plus a leading no-caller sentinel, so frame `d` lives at index
  // `d + 1` and the root's caller read at index 0 needs no branch.
  const frameSlots = MAX_GRAPH_DEPTH + 2;
  const emptyFrames = `hex"${'ff'.repeat(frameSlots)}"`;
  const emptyUsed = `hex"${'00'.repeat(MAX_GRAPH_PARTICIPANTS)}"`;
  const allUsed = `hex"${'01'.repeat(MAX_GRAPH_PARTICIPANTS)}"`;
  return `pragma solidcash >=0.8.0;
contract GraphProjectionVerifier() {
  function verify(bytes transcript, bigint controllerInput, bigint participantIndex) {
    require(controllerInput >= 0 && controllerInput < tx.inputs.length);
    require(tx.inputs[controllerInput].nftCommitment == sha256(transcript));
    require(transcript.length >= 10 && transcript.slice(0, 9) == hex"4c3347524150483100");
    bigint participantCount = int(bytes.concat(transcript.slice(9, 10), hex"00"));
    require(participantCount >= 1 && participantCount <= ${MAX_GRAPH_PARTICIPANTS});
    require(participantIndex >= 0 && participantIndex < participantCount);
    bytes ownerBatch;
    bytes ownerEmissions;
    bytes ownerCallers;
    bytes resultVector;
    bytes lbcHeaders = hex"";
    bigint previousProjectionInput = -1;
    bigint expectedParticipantInput = 0;
    bigint cursor = 10;
    for (bigint participant = 0; participant < participantCount; participant = participant + 1) {
      // F4-3: X27's suffix split, the rewrite the controller's participant loop already carries. ONE split per
      // participant, then every field is read at \`local + n\` off the suffix rather than at \`cursor + n\` off
      // the whole blob. \`frame.length == transcript.length - cursor\`, so each old \`cursor + n <=
      // transcript.length\` bound is the same predicate as \`local + n <= frame.length\`. The split is in range
      // because cursor <= transcript.length holds on entry to every iteration - 10 <= transcript.length for
      // the first, and the last bound of the body for the rest.
      bytes frame = transcript.slice(cursor, transcript.length);
      require(frame.length >= 6);
      bigint participantInput = int(bytes.concat(frame.slice(0, 2), hex"00"));
      bigint blockSize = int(bytes.concat(frame.slice(2, 4), hex"00"));
      bigint lbcLength = int(bytes.concat(frame.slice(4, 6), hex"00"));
      require(blockSize >= 1 && participantInput == expectedParticipantInput);
      expectedParticipantInput = expectedParticipantInput + blockSize;
      require(participantInput < controllerInput && expectedParticipantInput <= controllerInput);
      require(lbcLength > 0 && 8 + lbcLength <= frame.length);
      // X65: the framed-entry local F4-1 introduced existed only to feed the eight \`participantLbcN\` slots.
      // With the index table it has no reader left, so this reverts to the direct transcript slice the
      // CONTROLLER's participant loop has always used - identical bytes, one local fewer, -39.
      require(tx.inputs[participantInput].lockingBytecode == frame.slice(6, 6 + lbcLength));
      // X65: append, never overwrite. The loop runs participants in order, so the six bytes appended here are
      // participant \`participant\`'s own frame header - \`participantInput\`, \`blockSize\`, \`lbcLength\` - at a
      // constant 6-byte stride. X81 widened it from the 2-byte index field: one slice either way, and carrying
      // the length field is what retires the NUM2BIN width bound at the two lookups.
      lbcHeaders = bytes.concat(lbcHeaders, frame.slice(0, 6));
      bigint batchLength = int(bytes.concat(frame.slice(6 + lbcLength, 8 + lbcLength), hex"00"));
      bigint local = 8 + lbcLength;
      require(batchLength >= 7 && local + batchLength + 2 <= frame.length);
      bigint emissionsLength = int(bytes.concat(
        frame.slice(local + batchLength, local + batchLength + 2), hex"00"));
      if (participant == participantIndex) {
        ownerBatch = frame.slice(local, local + batchLength);
      }
      local = local + batchLength + 2;
      require(local + emissionsLength + 2 <= frame.length);
      bigint callersLength = int(bytes.concat(
        frame.slice(local + emissionsLength, local + emissionsLength + 2), hex"00"));
      if (participant == participantIndex) {
        ownerEmissions = frame.slice(local, local + emissionsLength);
      }
      local = local + emissionsLength + 2;
      require(local + callersLength + 4 <= frame.length);
      bigint resultLength = int(bytes.concat(
        frame.slice(local + callersLength + 2, local + callersLength + 4), hex"00"));
      if (participant == participantIndex) {
        ownerCallers = frame.slice(local, local + callersLength);
      }
      local = local + callersLength + 4;
      require(local + resultLength + 2 <= frame.length);
      bigint projectionInput = int(bytes.concat(
        frame.slice(local + resultLength, local + resultLength + 2), hex"00"));
      require(projectionInput > previousProjectionInput && projectionInput < controllerInput);
      previousProjectionInput = projectionInput;
      if (participant == participantIndex) {
        require(projectionInput == this.activeInputIndex);
        require(participantInput < tx.inputs.length);
        resultVector = frame.slice(local, local + resultLength);
      }
      cursor = cursor + local + resultLength + 2;
    }
    require(cursor + 2 <= transcript.length);
    bigint invocationCount = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
    require(invocationCount >= 1 && invocationCount <= ${MAX_GRAPH_INVOCATIONS});
    bigint valueSkip = int(bytes.concat(ownerBatch.slice(5, 6), hex"00"));
    require(valueSkip == 0 || valueSkip == 1);
    valueSkip = valueSkip * 9;
    bigint resultCursor = 0;
    bigint localRow = 0;
    bigint callerCursor = 0;
    bigint batchCursor = 7;
    bigint emissionCursor = 0;
    bytes usedMask = ${emptyUsed};
    bytes activeCallees = ${emptyFrames};
    bigint tail = cursor + 2;
    for (bigint invocation = 0; invocation < invocationCount; invocation = invocation + 1) {
      // F4-2: X27's suffix split, the rewrite the controller's invocation loop already carries. ONE split per
      // row, then every field is read at a constant offset off the suffix instead of at \`tail + n\` off the
      // whole blob. \`row.length == transcript.length - tail\`, so each old \`tail + n <= transcript.length\`
      // bound is the same predicate as \`n <= row.length\`. The split is in range because tail <=
      // transcript.length holds on entry to every iteration - cursor + 2 <= transcript.length for the first,
      // and the last bound of the body for the rest.
      bytes row = transcript.slice(tail, transcript.length);
      require(row.length >= 14);
      bigint callee = int(bytes.concat(row.slice(2, 3), hex"00"));
      bigint depth = int(bytes.concat(row.slice(4, 5), hex"00"));
      require(callee < participantCount);
      // X5/E2: bit 0 is read-only mode and bit 1 is the singular raw-call value option. No higher option is
      // admitted, so this bound is the on-chain policy statement rather than an incidental range check. The
      // caller's compiled emission independently re-derives the exact byte (including the value bit).
      bigint callOptions = int(bytes.concat(row.slice(11, 12), hex"00"));
      require(callOptions <= 3);
      bigint argsLength = int(bytes.concat(row.slice(12, 14), hex"00"));
      require(16 + argsLength <= row.length);
      bigint resultLength = int(bytes.concat(row.slice(14 + argsLength, 16 + argsLength), hex"00"));
      require(16 + argsLength + resultLength <= row.length);
      // Frame index 0 is the permanent no-caller sentinel, so a depth-0 row reads no caller at all.
      bigint caller = int(bytes.concat(activeCallees.slice(depth, depth + 1), hex"00"));
      if (invocation == 0) {
        // X5: the transaction-origin row answers no callsite, so it has no parent edge and therefore no call
        // options at all. Every other row's byte is re-derived by its CALLER's compiled route and compared in
        // the emission-row equality below; the root has no caller, so without this bound its call-options byte
        // was a committed field no covenant ever read - forgeable in the transcript at zero cost.
        require(int(bytes.concat(row.slice(0, 2), hex"00")) == 65535 && depth == 0);
        require(callOptions == 0);
      } else {
        require(depth >= 1 && depth <= ${MAX_GRAPH_DEPTH});
      }
      usedMask = bytes.concat(
        usedMask.slice(0, callee), hex"01", usedMask.slice(callee + 1, ${MAX_GRAPH_PARTICIPANTS}));
      activeCallees = bytes.concat(activeCallees.slice(0, depth + 1), bytes1(callee),
        activeCallees.slice(depth + 2, ${frameSlots}));
      if (caller == participantIndex) {
        ${lbcLookup('callee', 'target')}
        // The canonical emission row is fully determined by the authenticated transcript record:
        // framed target || call mode || selector || framed args || framed result. The two trailing
        // frames are the record's own contiguous bytes, so the whole row compares in one slice.
        // X81: the framed target had its own local, whose single reader was this concat. Folding it in is
        // independent of the bound retired above and measures -5 on its own.
        bytes expectedRow = bytes.concat(
          bytes.concat(${lbcFramedPrefix('callee')}, targetLbc),
          row.slice(11, 12), row.slice(7, 11),
          row.slice(12, 16 + argsLength + resultLength));
        require(ownerEmissions.slice(emissionCursor, emissionCursor + expectedRow.length)
          == expectedRow);
        emissionCursor = emissionCursor + expectedRow.length;
      }
      if (callee == participantIndex) {
        if (invocation == 0) {
          bigint logicalCallerLength = int(bytes.concat(
            ownerCallers.slice(callerCursor, callerCursor + 2), hex"00"));
          require(logicalCallerLength == 0
            || ownerCallers.slice(callerCursor + 2, callerCursor + 2 + logicalCallerLength)
              == tx.origin);
          callerCursor = callerCursor + 2 + logicalCallerLength;
        } else {
          ${lbcLookup('caller', 'caller')}
          bytes expectedCaller = bytes.concat(${lbcFramedPrefix('caller')}, callerLbc);
          require(ownerCallers.slice(callerCursor, callerCursor + expectedCaller.length)
            == expectedCaller);
          callerCursor = callerCursor + expectedCaller.length;
        }
        require(int(bytes.concat(row.slice(3, 4), hex"00")) == localRow);
        require(ownerBatch.slice(batchCursor, batchCursor + 4) == row.slice(7, 11));
        require(int(bytes.concat(ownerBatch.slice(batchCursor + 4, batchCursor + 8), hex"00"))
          == localRow);
        require(int(bytes.concat(ownerBatch.slice(batchCursor + 8, batchCursor + 10), hex"00")) == 0);
        require(int(bytes.concat(ownerBatch.slice(batchCursor + 10, batchCursor + 12), hex"00"))
          == argsLength);
        if (valueSkip == 9) {
          require(int(bytes.concat(
            ownerBatch.slice(batchCursor + 12, batchCursor + 13), hex"00")) <= 1);
        }
        require(ownerBatch.slice(
          batchCursor + 12 + valueSkip, batchCursor + 12 + valueSkip + argsLength)
          == row.slice(14, 14 + argsLength));
        batchCursor = batchCursor + 12 + valueSkip + argsLength;
        localRow = localRow + 1;
        if (resultLength > 0) {
          require(resultVector.slice(resultCursor, resultCursor + resultLength)
            == row.slice(16 + argsLength, 16 + argsLength + resultLength));
          resultCursor = resultCursor + resultLength;
        }
      }
      tail = tail + 16 + argsLength + resultLength;
    }
    require(tail == transcript.length);
    require(usedMask.slice(0, participantCount) == ${allUsed}.slice(0, participantCount));
    require(localRow > 0 && batchCursor == ownerBatch.length);
    require(emissionCursor == ownerEmissions.length);
    require(callerCursor == ownerCallers.length);
    // X7: every returned byte is claimed by exactly one row.
    require(resultCursor == resultVector.length);
    require(this.activeInputIndex < tx.outputs.length);
    require(tx.outputs[this.activeInputIndex].value == 1000);
    require(tx.outputs[this.activeInputIndex].tokenCategory.length == 0);
    require(tx.outputs[this.activeInputIndex].nftCommitment.length == 0);
    require(tx.outputs[this.activeInputIndex].tokenAmount == 0);
    require(true);
  }
}`;
}

/**
 * A callsite whose reached method is not a compile-time name: received/reduced function pointers, varying
 * selector tables, address-array loops, and low-level `call`/`staticcall` whose method lives in the
 * canonical calldata. Its `functionName` is a placeholder rather than the method the concrete invocation
 * resolves to, so name equality must not be required against it.
 *
 * TRUST BOUNDARY. This predicate reads compiler-authored ABI metadata, and an artifact is NOT trusted input:
 * the SDK cannot tell a compiler-emitted artifact from a hand-written or third-party one. Every disjunct here
 * therefore only widens what a *builder* accepts; none of them weakens a covenant. Authority stays with the
 * transcript machinery and the compiled routes, which authenticate the concrete selector, arguments and
 * result regardless of what the ABI claimed. Given that, a disjunct is worth carrying only if the compiler
 * actually needs it: `possibleTargets` was removed because the compiler emits it strictly alongside
 * `selectorArrayVar` (`Artifact.ts` spreads it inside that guard), so it changed nothing for real compiler
 * output while silently disabling the name and result-schema checks for any artifact that carries it alone.
 */
const isRuntimeResolvedCallsite = (callsite: ExternalCallAbi): boolean =>
  callsite.fnPtrCall === true
  || callsite.selectorArrayVar !== undefined
  || callsite.loopArrayVar !== undefined
  || callsite.functionName === '__raw__'
  || callsite.opaqueReturn === true;

/**
 * Bind each reached child of one invocation to exactly one compiler-authored callsite of its handler.
 *
 * A result edge must name one unambiguous consumer occurrence, not merely a method name: a handler may
 * reach the same method more than once, and two callsites of the same name can differ in whether their
 * result is consumed. When every callsite is statically singular and the reached children exhaust them,
 * the binding is the source order itself. Otherwise conditional and loop callsites make the mapping
 * many-to-one, and the binding is accepted only while every remaining candidate agrees on the result
 * contract; a candidate set that disagrees is rejected rather than guessed.
 */
function bindConsumerCallsites(
  parent: number,
  callsites: readonly ExternalCallAbi[],
  reached: readonly string[],
): (ExternalCallAbi | undefined)[] {
  if (callsites.length === 0) return reached.map(() => undefined);
  const singular = callsites.every((callsite) =>
    callsite.occurrence === undefined || callsite.occurrence === 'once');
  // Positional binding checks order, so it applies only when the reached methods are a permutation of the
  // compiler-named ones. A reached method the compiler never named means the callsite resolves its target
  // method at runtime - a pointer, a selector table or low-level calldata - and order carries no meaning.
  const sorted = (names: readonly string[]): string => [...names].sort().join('\x00');
  const namesArePermuted = sorted(reached) === sorted(callsites.map((call) => call.functionName));
  if (singular && callsites.length === reached.length && namesArePermuted) {
    return reached.map((functionName, position) => {
      const callsite = callsites[position];
      if (!isRuntimeResolvedCallsite(callsite) && callsite.functionName !== functionName) {
        throw new Error(
          `layer3: invocation ${parent} reaches '${functionName}' where its compiler-authored callsite `
          + `${position} calls '${callsite.functionName}'`,
        );
      }
      return callsite;
    });
  }
  return reached.map((functionName) => {
    const candidates = callsites.filter((callsite) =>
      isRuntimeResolvedCallsite(callsite) || callsite.functionName === functionName);
    if (candidates.length === 0) return undefined;
    const contract = (callsite: ExternalCallAbi): string =>
      `${callsite.hasReturnValues === true}|${(callsite.returnTypes ?? []).join(',')}`;
    if (new Set(candidates.map(contract)).size > 1) {
      throw new Error(
        `layer3: invocation ${parent} cannot bind '${functionName}' to one callsite; its conditional or `
        + 'loop callsites disagree on the consumed result',
      );
    }
    return candidates[0];
  });
}

/**
 * X36: the one named refusal for a planned reached-row count, shared by both public planning entry points.
 *
 * A callsite's admitted row count is a property of the ARTIFACT, so it must not depend on which planner
 * reached it. `deriveCompiledGraphPlan` calls this with the count its derivation probe supplied for one
 * callsite; `planCompiledGraph` calls it with the count the caller-supplied rows force onto one callsite.
 * Keeping the message in `occurrenceCountViolation` means neither entry point can drift into its own wording
 * or its own legs.
 */
export function assertPlannedOccurrenceCount(call: ExternalCallAbi, count: number): void {
  const violation = occurrenceCountViolation(call, count);
  if (violation !== undefined) throw new Error(`layer3: ${violation}`);
}

/**
 * Rows one compiler-authored callsite can answer.
 *
 * The legs mirror `occurrenceCountViolation` exactly, so a count within the capacity can never be a violation
 * and a count above it always is. A collapsed repeated-call callsite names its rows outright. A non-loop
 * callsite is reached at most once whether or not the compiler spent bytes saying so. Only a loop can leave
 * its ceiling unproven, and an unproven ceiling admits any count up to the global invocation bound.
 */
const callsiteRowCapacity = (call: ExternalCallAbi): number => {
  if (call.batchInvocations !== undefined) return call.batchInvocations.length;
  const bound = occurrenceBoundOf(call);
  if (bound.kind !== 'loop') return 1;
  return bound.maximum ?? Number.POSITIVE_INFINITY;
};

/**
 * Refuse a caller-supplied row set one handler cannot have emitted, using the same bound as the other entry
 * point and naming the callsite the surplus would have to answer.
 *
 * This is deliberately computed from the handler's TOTAL published capacity rather than from
 * `bindConsumerCallsites`' per-row attribution. That attribution is an acknowledged guess - it binds by name
 * and takes the first matching candidate, so two callsites of one name collapse onto the first - and refusing
 * on a guess produces false rejections rather than a tightening. Filling the callsites in source order is
 * guess-free: with every earlier callsite at its published ceiling, the last one is the only place a further
 * row could come from, so the surplus is reported against it.
 *
 * Deliberately NOT touched: a loop callsite legitimately answers many rows, and a collapsed repeated-call
 * callsite legitimately answers `batchInvocations.length` of them. Both stay many-to-one; the bound, not the
 * arity, is what separates them from rows a `once` callsite cannot have emitted.
 */
function assertHandlerRowCapacity(callsites: readonly ExternalCallAbi[], rows: number): void {
  if (callsites.length === 0 || rows === 0) return;
  const capacities = callsites.map(callsiteRowCapacity);
  const total = capacities.reduce((sum, capacity) => sum + capacity, 0);
  if (rows <= total) return;
  const last = capacities.length - 1;
  const surplus = capacities[last] + (rows - total);
  const batched = callsites[last].batchInvocations;
  // A collapsed repeated-call callsite is `once` yet answers every row it NAMES, so the occurrence wording
  // would read "reached at most once" against a callsite that legitimately emits several. It publishes its own
  // exact count instead. `deriveCompiledGraphPlan` cannot reach this leg: it expands that callsite to exactly
  // `batchInvocations.length` rows by construction.
  if (batched !== undefined) {
    throw new Error(
      `layer3: callsite ${callsites[last].callsiteId ?? '?'} collapses ${batched.length} repeated calls, `
      + `but ${surplus} rows were planned`,
    );
  }
  assertPlannedOccurrenceCount(callsites[last], surplus);
}

/**
 * Rows one compiler-authored callsite MUST answer.
 *
 * The mirror of `callsiteRowCapacity`, leg for leg, on the same shared bound. A collapsed repeated-call
 * callsite names its rows outright. Every other class takes the floor `occurrenceBoundOf` publishes, which is
 * 1 for a straight-line `once` callsite - reached structurally, whether or not the compiler spent bytes saying
 * so - and, for a conditional or loop callsite, only what the compiler actually proved. An absent floor is
 * zero: a branch that was not taken legitimately emits no row.
 */
const callsiteRowFloor = (call: ExternalCallAbi): number => {
  if (call.batchInvocations !== undefined) return call.batchInvocations.length;
  return occurrenceBoundOf(call).minimum ?? 0;
};

/**
 * X179: refuse a caller-supplied row set that DROPS a row one handler must have emitted.
 *
 * `assertHandlerRowCapacity` bounds this from above only, and was skipped entirely for a handler planned with
 * no children at all - so a handler whose whole body is one unconditional external call could be planned with
 * the call simply left out, and the route published it as an admitted handler whose observable effect is
 * nothing. `deriveCompiledGraphPlan` cannot produce that plan: it expands every `once` callsite
 * unconditionally and `takeTarget` throws when no participant answers it, which is the derivation entry
 * point's statement that a dropped edge is not an outcome. This is the same statement on the entry point that
 * takes rows from the caller.
 *
 * THE VM AGREES, FOR THE ORDINARY SHAPE. A caller route partitions its authenticated emission vector row by
 * row, so a dropped edge leaves it with nothing to split and the transaction is refused at the caller's own
 * master input - `Layer3DroppedEdgeX179.test.ts` settles both argument shapes co-spent and refuses both with
 * the child removed, and `Layer3OccurrenceExhaustion.test.ts` records the same signature for a transcript
 * that omits a reached occurrence. This turns that unnamed `OP_SPLIT` failure into a named plan-time
 * diagnostic, in the same way `assertSingleConsumedResult` does for result fan-in.
 *
 * IT IS NOT A BOUNDARY. `Attack.attack` - one unconditional callsite, counterparty bus-inadmissible - settles
 * with an EMPTY emission vector (`Layer3RecoveredVoidWriterX177.test.ts`), so for at least that handler shape
 * the caller covenant does not bind its own outgoing edge and this refusal is the only thing between the
 * composer and a published handler that does nothing. The SDK is an untrusted witness constructor: a spender
 * who hand-assembles the plan is not subject to this at all. Closing it properly is compiler-side.
 *
 * Reported against the first callsite the rows do not reach, for the same reason the ceiling side reports
 * against the last: with every earlier callsite at its published floor, that is the only callsite a missing
 * row can belong to, so the attribution is guess-free rather than `bindConsumerCallsites`' by-name guess.
 */
function assertHandlerRowFloor(callsites: readonly ExternalCallAbi[], rows: number): void {
  if (callsites.length === 0) return;
  const floors = callsites.map(callsiteRowFloor);
  if (rows >= floors.reduce((sum, floor) => sum + floor, 0)) return;
  let remaining = rows;
  for (const [index, callsite] of callsites.entries()) {
    if (remaining >= floors[index]) {
      remaining -= floors[index];
      continue;
    }
    // A collapsed repeated-call callsite is `once` yet emits every row it NAMES, so the occurrence wording
    // would read "reached at most once" against a callsite that legitimately emits several.
    if (callsite.batchInvocations !== undefined) {
      throw new Error(
        `layer3: callsite ${callsite.callsiteId ?? '?'} collapses ${callsite.batchInvocations.length} `
        + `repeated calls, but only ${remaining} rows were planned`,
      );
    }
    assertPlannedOccurrenceCount(callsite, remaining);
    // The shared bound admitted a count this floor does not, so the two have drifted. Refuse rather than
    // fall through to a plan whose only remaining decider is a covenant measured not to bind this edge.
    throw new Error(
      `layer3: callsite ${callsite.callsiteId ?? '?'} must be answered by ${floors[index]} rows, `
      + `but ${remaining} were planned`,
    );
  }
}

/**
 * X3: refuse a handler asked to consume more than one producer result - result fan-in.
 *
 * This is a capability gap, not a policy: no compiler-emitted artifact can execute such a row. The wall has a
 * measured shape, and none of it is in the SDK.
 *
 *   1. `SymbolTableTraversal` refuses to LOWER a graph-emission handler holding more than one call slot when
 *      any of them returns, so the artifact never exists. That predicate is broader than fan-in: one returning
 *      call plus one void call is refused by the same clause.
 *   2. `GenerateTargetTraversal.verifyGraphEmissionRow` cannot compose a returning row. The void arm builds a
 *      row and leaves it for the dispatch site to concatenate; the returning arm instead SPLITS the caller's
 *      whole emission vector at its own prefix and then requires the remainder to be exactly one framed
 *      result, so a returning row consumes the entire vector and nothing can follow it.
 *   3. The multi-slot dispatch site builds the vector by concatenating every row and comparing once, which
 *      cannot interleave the per-row result decodes a second returning slot would need.
 *
 * Everything downstream of the artifact already handles fan-in: `resultDependencies` is a list, the dependency
 * resolver takes any acyclic table, `finalizeCompiledGraph` frames one emission row per child, and the
 * projection verifier walks a caller's rows with a cursor rather than a single equality. Closing this needs
 * (2) rewritten to the cursor form `consumeGraphRuntimeEmissionRow` already uses for loop rows - split one row
 * off the front, decode its result, keep the remainder - and (3) rewritten to interleave those decodes; then
 * (1) can be narrowed. Both files are compiler-side.
 *
 * Refusing here converts that into a named plan-time diagnostic. A fan-in plan is otherwise accepted, and its
 * unexecutable transaction fails as an unnamed script error at the consumer's own master input.
 */
function assertSingleConsumedResult(parent: number, producers: readonly number[]): void {
  if (producers.length <= 1) return;
  throw new Error(
    `layer3: invocation ${parent} consumes results from invocations ${producers.join(', ')}; a graph handler `
    + 'binds at most one producer result, so result fan-in is not an admitted graph shape',
  );
}

/** Block slots that carry a call option or an unconditioned value movement. */
const OPTION_SLOT_KINDS: ReadonlySet<string> = new Set([
  'satoshiContainer', 'transfer', 'tokenContainer', 'tcTransfer',
]);

/**
 * Name the compiler gives one handler's graph EMISSION clone.
 *
 * `compiler.ts` clones every `graphTailHandlers` member as `__scb_graph_<handler>`.
 *
 * SUPERSEDED IN PART, and the note is kept rather than deleted because the gate below still reads this name.
 * `computeScalarJournalClosures` used to exclude every emission clone from SEC-18's widened closure, which is
 * what made this name a reliable answer to "does this row read the pre-state". It no longer is: a clone is now
 * admitted for its PLAIN SCALAR slots, so a clone reading `state:<scalar>` loads through the live journal and
 * the covenant itself refuses the stale composition - proven by bypass constructors in
 * `Layer3EmissionCloneJournalX111.test.ts`. X146 subsequently completed the clone journal and closed the
 * DYNAMIC half at consensus too. The gate below is therefore a planner diagnostic on current compiler output,
 * not a security boundary. Keep it fail-closed for older artifacts, but do not trust its name vocabulary or
 * invocation metadata.
 *
 * X138 removed the one ADMISSION a published claim could buy - see the note on the write claim in
 * `assertNoStaleEmissionCloneReads`. It is still not a boundary: a spender that never calls
 * `planCompiledGraph` is not subject to it at all. `Layer3EmissionCloneFakeWriteX138.test.ts` preserves the
 * hand-assembled bypass and proves X146 moved its refusal into the covenant.
 */
const GRAPH_EMISSION_CLONE_PREFIX = '__scb_graph_';

/**
 * State-variable name behind one footprint resource, for both spellings a variable appears under.
 *
 * A scalar slot is `state:<name>`; an entry of a collection or state array is `collection:<name>:<key>`. Both
 * matter on the WRITE side: `legs.push(..)` publishes only `collection:legs:*`, yet it moves that variable's
 * scalar length slot, which is what `computeScalarJournalClosures` counts as a write (`StateArrayPushNode`).
 * Reading the write side as scalar-only would therefore miss a push writer entirely.
 */
const footprintVariable = (resource: string): string | undefined => {
  if (resource.startsWith('state:')) return resource.slice('state:'.length);
  if (!resource.startsWith('collection:')) return undefined;
  const rest = resource.slice('collection:'.length);
  const separator = rest.lastIndexOf(':');
  return separator < 0 ? rest : rest.slice(0, separator);
};

/** Scalar slots one summary reads. The scalar journal is what SEC-18 widened, so this side stays exact. */
const scalarReadsOf = (summary: InvocationAnalysisFunction): readonly string[] => summary.reads
  .filter((resource) => resource.startsWith('state:'))
  .map((resource) => resource.slice('state:'.length));

/** Every state variable one summary writes, under either spelling. */
const writtenVariablesOf = (summary: InvocationAnalysisFunction): readonly string[] => summary.writes
  .map(footprintVariable)
  .filter((name): name is string => name !== undefined);

/**
 * X138. Chunk-backed state variables of one participant, taken from the STATE LAYOUT rather than from a
 * per-function footprint.
 *
 * `stateLayout` is the shape the participant's own covenant rebuilds and compares against its data NFT, so a
 * participant that misdeclares it cannot settle at all. A per-function `writes`/`reads` list is not like that
 * - nothing in the transaction commits to `invocationAnalysis`, which is exactly why one fabricated write on
 * an emission clone used to buy admission (X138). Both are fields of an artifact the spender hands the
 * planner, so neither is trusted; the difference is that a lie about this one is self-defeating.
 */
const dynamicVariablesOf = (artifact: Artifact): ReadonlySet<string> => new Set(
  (artifact.stateLayout?.variables ?? []).filter((variable) => variable.dynamic).map((v) => v.name),
);

/** One row of one owner, in the order that owner's SCB1 route executes them. */
interface OwnerRow { localRow: number; function: string }

/**
 * X111. Refuse a route whose ROW SET makes a read-only graph emission clone observe the PRE-transaction value
 * of a slot an EARLIER row of the same owner already wrote.
 *
 * SEC-18 widened the scalar journal to every route-reachable function, so a pure reader observes the newest
 * write. Emission clones were excluded from that widening, so a clone which touched a scalar slot and wrote
 * none still read the authenticated input commitment. That was exploitable exactly as SEC-18 was: the caller
 * contract's own body emits the guard row, so a spender cannot drop it, and a post-condition then passes
 * against the value the transaction is changing.
 *
 * THE PREMISE ABOVE IS NO LONGER TRUE FOR SCALAR SLOTS. The exclusion was called non-negotiable at
 * code-generation time and it was not: `computeScalarJournalClosures` now admits an emission clone for its
 * plain scalar slots, and the two constructors that bypass this function entirely - the hand-assembled plan
 * and the artifact with the clone dropped from `invocationAnalysis` - are refused by the vault's own covenant.
 * X146 later completed the clone's dynamic journal and proved the hand-assembled bypass is refused at the
 * participant's dynamic master while the live-read and reader-first controls settle. This rule remains a
 * fail-closed diagnostic for older artifacts; it must not be cited as the consensus boundary.
 *
 * WHY THIS IS THE RIGHT SITE. The equivalent compile-time refusal was implemented and measured: it
 * false-refused the C2 capstone entirely, because `registerCredit`/`registerDebit` write `legs` and sit in the
 * route CLOSURE even when no such row exists in the transaction. Route-closure membership is not
 * route-composition membership. Here the row set is concrete, so the writers considered are the ones the
 * transaction really contains.
 *
 * WHY ORDER IS PART OF THE RULE. A clone at local row 0 reading the pre-state is reading the sequentially
 * correct value - there is no earlier write for it to have missed. Only an EARLIER writer of the same slot
 * makes the read stale, and the journal is sequential, so a later write can never reach an earlier read.
 * Ignoring order would refuse the honest reader-first composition.
 *
 * WHAT IS CONSERVATIVE. A clone whose footprint is `unknown` has no enumerable read set, so any writer of any
 * slot on the same owner refuses it. A participant publishing no invocation analysis at all cannot be
 * diagnosed and is refused rather than skipped. This keeps the planner fail-closed for older artifacts even
 * though current compiler output enforces the property in the covenant.
 */
function assertNoStaleEmissionCloneReads(
  participants: readonly CompiledGraphParticipant[],
  rowsByOwner: readonly (readonly OwnerRow[])[],
): void {
  participants.forEach((participant, owner) => {
    const summaries = participant.artifact.invocationAnalysis?.functions;
    if (summaries === undefined) {
      throw new Error(
        `layer3: participant ${owner} publishes no invocation analysis, so a stale graph emission-clone read `
        + 'cannot be diagnosed; recompile the participant with a compiler that publishes it',
      );
    }
    const byName = new Map(summaries.map((summary) => [summary.name, summary]));
    const rows = rowsByOwner[owner];
    // Earliest local row writing each variable, over the rows THIS transaction contains.
    const writtenAt = new Map<string, OwnerRow>();
    for (const row of rows) {
      const executed = byName.get(`${GRAPH_EMISSION_CLONE_PREFIX}${row.function}`)
        ?? byName.get(row.function);
      if (executed === undefined) continue;
      for (const name of writtenVariablesOf(executed)) {
        if (!writtenAt.has(name)) writtenAt.set(name, row);
      }
    }
    const refuse = (row: OwnerRow, writer: OwnerRow, slot: string): never => {
      throw new Error(
        `layer3: participant ${owner} row ${row.localRow} '${row.function}' is a read-only graph emission `
        + `clone reading '${slot}', which row ${writer.localRow} '${writer.function}' of the same owner `
        + 'writes earlier in the route; the clone reads the pre-transaction value, so this composition is '
        + 'not an admitted graph shape',
      );
    };
    // X138. The write claim below is the SPENDER'S, and it used to be read first and unconditionally: one
    // published `writes: ['state:nosuchslot']` on a read-only clone turned the whole rule off. That is a
    // claim-driven ADMISSION, the one direction a witness-side check may never take, and behind it the
    // chunk-backed residual settles - `Layer3EmissionCloneFakeWriteX138.test.ts` broadcasts a transaction
    // whose guard row is true of the pre-state 30 and false of the 40 the same transaction commits, on an
    // artifact whose bytecode and address are byte-identical to the honest one.
    //
    // The claim is now honoured for a PLAIN SCALAR slot only. There it is not load-bearing: the compiler
    // journals a clone's scalar slots whether or not it writes, and the covenant refuses the stale scalar
    // composition itself, so believing a liar costs a diagnostic and nothing else. On a chunk-backed slot the
    // compiler journals nothing unless the clone really is a writer, so the claim is the entire boundary and
    // is refused outright. Dynamism comes from `stateLayout`, which the participant's own covenant enforces.
    const dynamic = dynamicVariablesOf(participant.artifact);
    for (const row of rows) {
      const clone = byName.get(`${GRAPH_EMISSION_CLONE_PREFIX}${row.function}`);
      if (clone === undefined) continue;
      const claimsWrite = writtenVariablesOf(clone).length > 0;
      if (clone.unknown) {
        // No enumerable read set, so the dynamic arm cannot be isolated: the claim is honoured only when the
        // participant declares no chunk-backed slot for the unnamed read to be on.
        if (claimsWrite && dynamic.size === 0) continue;
        for (const [slot, writer] of writtenAt) {
          if (writer.localRow < row.localRow) refuse(row, writer, slot);
        }
        continue;
      }
      for (const slot of scalarReadsOf(clone)) {
        const writer = writtenAt.get(slot);
        if (writer === undefined || writer.localRow >= row.localRow) continue;
        if (claimsWrite && !dynamic.has(slot)) continue;
        refuse(row, writer, slot);
      }
    }
  });
}

/**
 * Resolve the single ABI function one graph row names.
 *
 * Overloads share a name, so a name alone can select a different dispatch target than the caller meant, and
 * the transcript would then commit the wrong selector and argument vector consistently. Entries agreeing on
 * their selector are the same target and are not ambiguous.
 */
export function resolveGraphAbiFunction(artifact: Artifact, name: string): AbiFunction | undefined {
  const matches = artifact.abi.filter((candidate) => candidate.name === name);
  if (matches.length > 1
    && new Set(matches.map((candidate) => candidate.selector ?? '')).size > 1) {
    throw new Error(
      `layer3: participant artifact declares ${matches.length} distinct ABI functions named '${name}'`,
    );
  }
  return matches[0];
}

/**
 * Measure the call options one graph invocation's function carries that the executed SCB1 route does not.
 *
 * `IFoo(addr).m{value: v}()` publishes `transferCount` and `satoshiContainer`/`transfer` slots on the DIRECT
 * block layout, while the SCB1 route layout, the handler projection and the transcript row stay byte identical
 * to the option-free form. Executing such a function as a graph row therefore drops the option silently unless
 * something commits it - which is what the row's call-options byte is for.
 *
 * A first-party `this.transfer(..)` publishes the SAME direct-mode fields yet is carried into the route, which
 * is why the direct block layout alone cannot tell a bound effect from a dropped one and why this compares the
 * two projections instead of flagging every value-moving function. The measured discriminator is the SCB1
 * handler: an option contributes nothing to `handler.transfers`, a first-party transfer contributes one entry
 * and eight route `transfer` slots. Dropped token-container operations are already refused at compile time;
 * the container arm here is the SDK-side backstop for the same class.
 *
 * X5: this is ONE measurement with two consumers - `assertNoUnboundCallOptions`, which turns it into the single
 * named refusal, and `planCompiledGraph`, which encodes it into the committed row. Splitting the measurement
 * would let the refusal and the committed byte disagree about the same artifact.
 */
export function measureUnboundCallOptions(
  artifact: Artifact, fn: AbiFunction, name: string,
): { optionBits: number; detail?: string } {
  const handler = artifact.hiddenBatch?.handlers.find((candidate) => candidate.name === name);
  const routeKinds = new Set((artifact.hiddenBatch?.route.blockLayout?.slots ?? [])
    .map((slot) => slot.kind as string));
  const unboundValue = (fn.transferCount ?? 0) - (handler?.transfers?.length ?? 0);
  const unboundContainer = (fn.tokenContainerAccesses?.length ?? 0)
    - (handler?.tokenContainerAccesses?.length ?? 0);
  // Backstop for an artifact whose per-handler projection is absent or understated: a direct-mode option slot
  // kind the route never reserves cannot be settled by the row, whatever the counts claim.
  const droppedKinds = [...new Set((fn.blockLayout?.slots ?? [])
    .filter((slot) => OPTION_SLOT_KINDS.has(slot.kind) && !routeKinds.has(slot.kind))
    .map((slot) => slot.kind))];
  const optionBits = (unboundValue > 0 ? CALL_OPTION_VALUE : 0)
    | (unboundContainer > 0 ? CALL_OPTION_TOKEN_CONTAINER : 0)
    | (droppedKinds.length > 0 ? CALL_OPTION_BLOCK_SLOT : 0);
  let detail: string | undefined;
  if (unboundValue > 0) detail = `${unboundValue} value option(s)/transfer(s)`;
  else if (unboundContainer > 0) detail = `${unboundContainer} token-container operation(s)`;
  else if (droppedKinds.length > 0) detail = `block slots ${droppedKinds.join(', ')}`;
  return { optionBits, ...(detail !== undefined && { detail }) };
}

/**
 * The single named refusal for a graph row whose function carries an unbound call option.
 *
 * X31: one exported function, reached from both public planning entry points, so the same artifact produces a
 * byte-identical string whichever one the caller used.
 */
export function assertNoUnboundCallOptions(
  lockingBytecode: string, artifact: Artifact, fn: AbiFunction, name: string,
): void {
  const { detail } = measureUnboundCallOptions(artifact, fn, name);
  if (detail === undefined) return;
  throw new Error(
    `layer3: function '${name}' of participant ${lockingBytecode.slice(0, 12)} declares `
    + `${detail}, which the transcript row does not bind; call options are not an admitted graph edge`,
  );
}

/**
 * Group a finite logical graph by physical owner while preserving global invocation order.
 *
 * Each owner receives one real compiler-generated SCB1 plan, regardless of how often a cycle re-enters it.
 * The resulting `localRow` projection is deterministic and is the bridge between global call edges and the
 * owner-local sequential journal. This function intentionally does not accept selectors, encoded arguments,
 * or results from the caller: all are derived from compiler artifacts.
 */
export function planCompiledGraph(
  participants: readonly CompiledGraphParticipant[],
  invocations: readonly CompiledGraphInvocation[],
): CompiledGraphPlan {
  if (participants.length < 1 || participants.length > MAX_GRAPH_PARTICIPANTS) {
    throw new Error(
      `layer3: compiled graph participant count must be between 1 and ${MAX_GRAPH_PARTICIPANTS}`,
    );
  }
  if (invocations.length > MAX_GRAPH_INVOCATIONS) {
    throw new Error(`layer3: compiled graph has more than ${MAX_GRAPH_INVOCATIONS} invocations`);
  }
  const identities = new Set<string>();
  participants.forEach((participant, index) => {
    const lbc = participant.lockingBytecode.toLowerCase();
    if (!/^([0-9a-f]{2})+$/.test(lbc)) {
      throw new Error(`layer3: participant ${index} locking bytecode must be hex bytes`);
    }
    if (identities.has(lbc)) {
      throw new Error('layer3: two participant rows name the same physical locking bytecode');
    }
    identities.add(lbc);
    // X106: the artifact's published blob envelope has to fit the generated controller's compiled-in bound.
    // Skipped for an artifact publishing no envelope at all, which fails later by name at `hiddenBatch!`.
    assertGraphBatchBlobEnvelope(participant.artifact, index);
  });
  if (invocations.length === 0 || invocations[0].parent !== null
    || invocations.slice(1).some((invocation) => invocation.parent === null)) {
    throw new Error('layer3: compiled graph requires exactly one root invocation at index 0');
  }

  const perOwner: HiddenBatchInvocation[][] = participants.map(() => []);
  const globalByOwner: number[][] = participants.map(() => []);
  const subtreeEnds = invocations.map((_invocation, index) => index);
  const active: number[] = [];
  invocations.forEach((invocation, index) => {
    if (!Number.isInteger(invocation.callee)
      || invocation.callee < 0 || invocation.callee >= participants.length) {
      throw new Error(`layer3: invocation ${index} callee is out of range`);
    }
    if (index === 0) {
      active.push(0);
    } else {
      if (!Number.isInteger(invocation.parent)
        || invocation.parent! < 0 || invocation.parent! >= index) {
        throw new Error(`layer3: invocation ${index} parent must be a preceding invocation`);
      }
      while (active.length > 0 && active[active.length - 1] !== invocation.parent) active.pop();
      if (active.length === 0) {
        throw new Error(`layer3: invocation ${index} re-enters a completed subtree`);
      }
      for (const ancestor of active) subtreeEnds[ancestor] = index;
      active.push(index);
    }
    if (active.length - 1 > MAX_GRAPH_DEPTH) {
      throw new Error(`layer3: compiled graph depth exceeds ${MAX_GRAPH_DEPTH}`);
    }
    perOwner[invocation.callee].push({
      function: invocation.function,
      args: invocation.args,
      ...(invocation.parent !== null && {
        logicalCaller: hexToBin(participants[invocations[invocation.parent].callee].lockingBytecode),
      }),
    });
    globalByOwner[invocation.callee].push(index);
  });

  // X31: the policy checks `deriveCompiledGraphPlan` runs during expansion. They live here too because this is
  // the other public planning entry point and every committed capstone fixture uses it - an option-bearing
  // graph used to settle through it with the option silently dropped. Ordered after the structural walk so a
  // malformed graph still reports its structural defect first.
  const optionBits = invocations.map((invocation, index) => {
    if (invocation.callMode !== undefined
      && invocation.callMode !== 'call' && invocation.callMode !== 'staticcall') {
      throw new Error(
        `layer3: invocation ${index} declares call mode '${invocation.callMode}', `
        + 'which is not a participant-graph edge',
      );
    }
    const participant = participants[invocation.callee];
    const abiFunction = resolveGraphAbiFunction(participant.artifact, invocation.function);
    // An absent ABI entry is refused rather than skipped, matching `deriveCompiledGraphPlan`'s `functionAbi`.
    // Skipping it silently disabled the call-option check for the one artifact shape that can hide the
    // evidence: the direct-mode `transferCount`/`blockLayout` an option publishes live on this entry, so a row
    // whose handler exists but whose ABI entry does not had nothing left to compare against.
    if (abiFunction === undefined) {
      throw new Error(
        `layer3: participant ${invocation.callee} declares no ABI function '${invocation.function}'`,
      );
    }
    assertNoUnboundCallOptions(
      participant.lockingBytecode, participant.artifact, abiFunction, invocation.function,
    );
    // X5: the refusal above precedes this, so an accepted plan always measures zero option bits. Deriving them
    // anyway - from that same measurement - is what makes the committed byte a real field: relax the refusal and
    // the option travels into the transcript, where the projection verifier rejects it, instead of vanishing.
    let bits = measureUnboundCallOptions(participant.artifact, abiFunction, invocation.function).optionBits;
    // A bound raw `{value:}` option belongs to this row's PARENT EDGE, not to the invocation of the
    // caller handler that authored it. E2 admits exactly one unconditional raw edge, so its compiler-owned
    // transfer marker identifies the one child row without guessing from runtime values.
    if (invocation.parent !== null) {
      const parentInvocation = invocations[invocation.parent];
      const parentParticipant = participants[parentInvocation.callee];
      const parentHandler = parentParticipant.artifact.hiddenBatch?.handlers
        .find((candidate) => candidate.name === parentInvocation.function);
      if (parentHandler?.transfers?.some((transfer) => transfer.callOption === 'value')) {
        bits |= CALL_OPTION_VALUE;
      }
    }
    return bits;
  });

  const executions = participants.map((participant, owner) => {
    if (perOwner[owner].length === 0) {
      throw new Error(`layer3: participant ${owner} has no invocation and must not be co-spent`);
    }
    return Object.freeze({
      participant: owner,
      lockingBytecode: participant.lockingBytecode.toLowerCase(),
      batch: encodeHiddenBatch(participant.artifact, perOwner[owner], participant.unboundRouteWitnesses),
      invocations: Object.freeze(globalByOwner[owner]),
      blockLayout: participant.artifact.hiddenBatch!.route.blockLayout!,
    });
  });

  const localCursor = participants.map(() => 0);
  const depths = invocations.map(() => 0);
  for (let index = 1; index < invocations.length; index += 1) {
    depths[index] = depths[invocations[index].parent!] + 1;
    if (depths[index] > 7) throw new Error('layer3: compiled graph exceeds maximum depth 7');
  }
  const plannedBase = invocations.map((invocation, index) => {
    const execution = executions[invocation.callee];
    const localRow = localCursor[invocation.callee];
    localCursor[invocation.callee] += 1;
    const row = execution.batch.rows[localRow];
    const result = execution.batch.results.find((candidate) => candidate.row === localRow);
    const caller = invocation.parent === null ? null : invocations[invocation.parent].callee;
    let callMode: 'call' | 'staticcall' = invocation.callMode ?? 'call';
    if (invocation.parent === null) {
      // X5: the transaction-origin row answers no callsite, so there is no published mode for a caller-supplied
      // one to agree with, and the committed byte the covenant now bounds must be exactly 0. Coercing it to
      // `call` instead would silently discard what the caller asked for - the shape this row is about.
      if (invocation.callMode !== undefined && invocation.callMode !== 'call') {
        throw new Error(
          `layer3: root invocation ${index} declares call mode '${invocation.callMode}', but the transaction `
          + 'origin answers no callsite and carries no call options',
        );
      }
    } else {
      const parentInvocation = invocations[invocation.parent];
      const parentArtifact = participants[parentInvocation.callee].artifact;
      const parentFunction = resolveGraphAbiFunction(parentArtifact, parentInvocation.function);
      const candidates = parentFunction?.externalCalls?.filter((call) =>
        call.functionName === invocation.function) ?? [];
      const modes = [...new Set(candidates.map((call) => call.callMode ?? 'call'))];
      // The compiler-authored mode is read whether or not the caller supplied one. Reading it only on the
      // INFERENCE path meant an explicit `callMode: 'call'` executed a delegate edge as an ordinary call,
      // unseen by either check - exactly the coercion `edgeCallMode` refuses on the other entry point, where
      // no supplied mode exists to shadow it.
      if (modes.includes('delegatecall')) {
        throw new Error('layer3: delegatecall is not a participant-graph call mode');
      }
      if (invocation.callMode === undefined) {
        if (modes.length > 1) {
          throw new Error(`layer3: call mode for invocation ${index} is ambiguous`);
        }
        callMode = modes[0] === 'staticcall' ? 'staticcall' : 'call';
      }
      if (callMode === 'staticcall') {
        const calleeFunction = resolveGraphAbiFunction(
          participants[invocation.callee].artifact, invocation.function,
        );
        if (!calleeFunction || calleeFunction.writesState
          || (calleeFunction.emits?.length ?? 0) > 0) {
          throw new Error(`layer3: staticcall target '${invocation.function}' is not compiler-proven read-only`);
        }
      }
      // X5: the remaining half of the round-15 divergence. Refusing only `delegatecall` left the two ordinary
      // modes free to disagree: a caller-supplied `call` on a callsite the compiler published as `staticcall`
      // was committed as `call`, which also skipped the read-only proof above. The compiled caller route
      // rebuilds this byte from its own slot and rejects the mismatch, so the transaction never settled - but it
      // failed as an unnamed script error at the caller's input rather than as a planning refusal.
      //
      // Ordered AFTER the read-only proof on purpose: when a supplied `staticcall` disagrees with a published
      // `call` AND names a state-writing callee, both would fire, and "target is not compiler-proven read-only"
      // is the more specific answer.
      //
      // A name-matched candidate set is the only place a published mode exists to compare against. When it is
      // empty the callsite resolves its method at runtime - a raw `__raw__` edge, a function pointer, a selector
      // table - and its `functionName` is a placeholder, so there is nothing to disagree with here; that shape
      // stays bound by the caller's own emission-row equality on the VM.
      if (invocation.callMode !== undefined && candidates.length > 0
        && !modes.includes(invocation.callMode)) {
        throw new Error(
          `layer3: invocation ${index} declares call mode '${invocation.callMode}', but its compiler-authored `
          + `callsite declares '${modes.join("'/'")}'`,
        );
      }
    }
    return Object.freeze({
      index,
      parent: invocation.parent,
      caller,
      callee: invocation.callee,
      subtreeEnd: subtreeEnds[index],
      localRow,
      depth: depths[index],
      function: row.function,
      selectorHex: row.selectorHex,
      callMode,
      callOptions: (callMode === 'staticcall' ? CALL_OPTION_READ_ONLY : 0) | optionBits[index],
      argsHex: row.argsHex,
      resultTypes: Object.freeze([...(result?.types ?? [])]),
    });
  });
  // X111: ordered after `plannedBase` because the rule reads each owner's local row ORDER, and before the
  // result-dependency walk so a stale-read composition names its own cause rather than whatever schema or
  // callsite mismatch it happens to also carry.
  assertNoStaleEmissionCloneReads(
    participants,
    globalByOwner.map((owned) => owned.map((index) => ({
      localRow: plannedBase[index].localRow, function: plannedBase[index].function,
    }))),
  );
  const childrenOf: number[][] = invocations.map(() => []);
  for (let child = 1; child < invocations.length; child += 1) {
    childrenOf[invocations[child].parent!].push(child);
  }
  const consumerCallsites: (number | undefined)[] = invocations.map(() => undefined);
  const resultDependencies: number[][] = invocations.map(() => []);
  for (let parent = 0; parent < invocations.length; parent += 1) {
    const children = childrenOf[parent];
    const parentInvocation = invocations[parent];
    const parentFunction = resolveGraphAbiFunction(
      participants[parentInvocation.callee].artifact, parentInvocation.function,
    );
    // X179: the floor, ordered before the ceiling and before the `children.length === 0` skip, because a
    // handler planned with NO children is exactly the shape it refuses - the skip is what let a dropped edge
    // through. The ABI lookup above already ran once per invocation in `optionBits`, so a handler with no ABI
    // entry has already been refused by name and this cannot be the first place it is noticed.
    assertHandlerRowFloor(parentFunction?.externalCalls ?? [], children.length);
    if (children.length === 0) continue;
    // X36: the occurrence bound `deriveCompiledGraphPlan` applies during expansion, applied here to the rows
    // this entry point is handed instead. Ordered before the binding so a row count the handler cannot have
    // emitted is named as such rather than surfacing as a result-schema or covenant partition mismatch.
    assertHandlerRowCapacity(parentFunction?.externalCalls ?? [], children.length);
    const bindings = bindConsumerCallsites(
      parent, parentFunction?.externalCalls ?? [],
      children.map((child) => invocations[child].function),
    );
    children.forEach((child, position) => {
      const callsite = bindings[position];
      consumerCallsites[child] = callsite?.callsiteId;
      if (!callsite?.hasReturnValues) return;
      const produced = plannedBase[child].resultTypes;
      if (produced.length === 0) {
        throw new Error(
          `layer3: invocation ${parent} consumes a result from void invocation ${child}`,
        );
      }
      // Producer/consumer ABI equality. A runtime-resolved callsite has no compile-time method, and an
      // opaque low-level return is intentionally untyped, so neither publishes a schema to compare.
      const expected = callsite.returnTypes;
      if (!callsite.opaqueReturn && !isRuntimeResolvedCallsite(callsite) && expected !== undefined
        && expected.join(',') !== produced.join(',')) {
        throw new Error(
          `layer3: invocation ${parent} expects result schema (${expected.join(',')}) from invocation `
          + `${child}, which produces (${produced.join(',')})`,
        );
      }
      resultDependencies[parent].push(child);
    });
    assertSingleConsumedResult(parent, resultDependencies[parent]);
  }
  assertResolvableResultDependencies(invocations.length, resultDependencies);
  const planned = plannedBase.map((invocation, index) => Object.freeze({
    ...invocation,
    ...(consumerCallsites[index] !== undefined && { consumerCallsiteId: consumerCallsites[index] }),
    resultDependencies: Object.freeze(resultDependencies[index]),
  }));

  return Object.freeze({
    participants: Object.freeze(executions),
    invocations: Object.freeze(planned),
  });
}
import {
  binToHex, hexToBin, sha256, utf8ToBin,
} from '@bitauth/libauth';
