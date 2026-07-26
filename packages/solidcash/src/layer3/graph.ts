import type { Artifact } from '@solidcash/utils';
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
  argsHex: string;
  resultTypes: readonly string[];
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
  });
}

const GRAPH_DOMAIN = utf8ToBin('L3GRAPH1\0');
const MAX_GRAPH_PARTICIPANTS = 8;
const MAX_GRAPH_INVOCATIONS = 24;
const MAX_GRAPH_DEPTH = 7;
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
      framed(target), uint(invocation.callMode === 'staticcall' ? 1 : 0, 1),
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
      uint(invocation.callMode === 'staticcall' ? 1 : 0, 1),
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
  const activeFrames = Array.from({ length: 8 }, (_unused, depth) =>
    `bigint activeIndex${depth} = -1; bigint activeEnd${depth} = -1;`).join('\n    ');
  const depthDispatch = Array.from({ length: 7 }, (_unused, offset) => {
    const depth = offset + 1;
    return `${depth === 1 ? 'if' : 'else if'} (depth == ${depth}) {
        require(parent == activeIndex${depth - 1});
        require(invocation <= activeEnd${depth - 1});
        require(subtreeEnd <= activeEnd${depth - 1});
        activeIndex${depth} = invocation;
        activeEnd${depth} = subtreeEnd;
      }`;
  }).join('\n      ');
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
    require(transcript.length >= 10 && transcript.slice(0, 9) == hex"4c3347524150483100");
    bigint participantCount = int(bytes.concat(transcript.slice(9, 10), hex"00"));
    require(participantCount >= 1 && participantCount <= 8);
    bigint cursor = 10;
    bigint expectedInput = 0;
    bigint previousReturnOutput = -1;
    bigint previousProjectionInput = -1;
    bigint firstProjectionInput = -1;
    for (bigint participant = 0; participant < participantCount; participant = participant + 1) {
      require(cursor + 2 <= transcript.length);
      bigint participantInput = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(participantInput == expectedInput && participantInput < tx.inputs.length);
      bigint blockSize = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(blockSize >= 1 && participantInput + blockSize <= tx.inputs.length);
      expectedInput = participantInput + blockSize;
      bigint lbcLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(lbcLength > 0 && cursor + lbcLength <= transcript.length);
      bytes participantLbc = transcript.slice(cursor, cursor + lbcLength);
      cursor = cursor + lbcLength;
      require(tx.inputs[participantInput].lockingBytecode == participantLbc);
      bigint batchLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(batchLength >= 7 && batchLength <= 223 && cursor + batchLength <= transcript.length);
      bytes batchBlob = transcript.slice(cursor, cursor + batchLength);
      cursor = cursor + batchLength;
      bytes unlocking = tx.inputs[participantInput].unlockingBytecode;
      require(unlocking.slice(0, 5) == hex"0453434231");
      if (batchLength <= 75) {
        require(int(bytes.concat(unlocking.slice(5, 6), hex"00")) == batchLength);
        require(unlocking.slice(6, 6 + batchLength) == batchBlob);
      } else {
        require(unlocking.slice(5, 6) == hex"4c");
        require(int(bytes.concat(unlocking.slice(6, 7), hex"00")) == batchLength);
        require(unlocking.slice(7, 7 + batchLength) == batchBlob);
      }
      bigint emissionsLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(cursor + emissionsLength <= transcript.length);
      cursor = cursor + emissionsLength;
      bigint callersLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(cursor + callersLength <= transcript.length);
      cursor = cursor + callersLength;
      bigint returnOutput = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      bigint resultVectorLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(resultVectorLength <= 126 && cursor + resultVectorLength <= transcript.length);
      bytes resultVector = transcript.slice(cursor, cursor + resultVectorLength);
      cursor = cursor + resultVectorLength;
      if (resultVectorLength == 0) {
        require(returnOutput == 65535);
      } else {
        require(returnOutput >= participantInput && returnOutput < participantInput + blockSize);
        require(returnOutput > previousReturnOutput && returnOutput < tx.outputs.length);
        previousReturnOutput = returnOutput;
        bytes expectedCommitment;
        if (resultVectorLength <= 75) {
          expectedCommitment = bytes.concat(bytes1(resultVectorLength), resultVector);
        } else {
          expectedCommitment = bytes.concat(hex"4c", bytes1(resultVectorLength), resultVector);
        }
        require(tx.outputs[returnOutput].nftCommitment == expectedCommitment);
      }
      bigint projectionInput = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(projectionInput > previousProjectionInput && projectionInput < tx.inputs.length);
      if (participant == 0) {
        firstProjectionInput = projectionInput;
      } else {
        require(projectionInput == previousProjectionInput + 1);
      }
      previousProjectionInput = projectionInput;
      require(tx.inputs[projectionInput].lockingBytecode == hex"${verifier}");
    }
    require(firstProjectionInput == expectedInput);
    require(this.activeInputIndex == expectedInput + participantCount);
    require(tx.inputs.length == this.activeInputIndex + 2);
    require(tx.outputs.length == tx.inputs.length);
    bigint invocationCount = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
    cursor = cursor + 2;
    require(invocationCount >= 1 && invocationCount <= ${MAX_GRAPH_INVOCATIONS});
    ${activeFrames}
    bigint previousDepth = -1;
    for (bigint invocation = 0; invocation < invocationCount; invocation = invocation + 1) {
      require(cursor + 11 <= transcript.length);
      bigint parent = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      bigint callee = int(bytes.concat(transcript.slice(cursor, cursor + 1), hex"00"));
      cursor = cursor + 2;
      bigint depth = int(bytes.concat(transcript.slice(cursor, cursor + 1), hex"00"));
      cursor = cursor + 1;
      bigint subtreeEnd = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 7;
      require(callee < participantCount);
      if (invocation == 0) {
        require(parent == 65535 && depth == 0 && subtreeEnd == invocationCount - 1);
        activeIndex0 = 0; activeEnd0 = subtreeEnd;
      } else {
        require(parent < invocation && depth >= 1 && depth <= 7 && depth <= previousDepth + 1);
        require(subtreeEnd >= invocation && subtreeEnd < invocationCount);
        ${depthDispatch}
        else { revert("depth out of range"); }
      }
      previousDepth = depth;
      bigint argsLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2 + argsLength;
      require(cursor + 2 <= transcript.length);
      bigint resultLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2 + resultLength;
      require(cursor <= transcript.length);
    }
    require(cursor == transcript.length);
    bytes controllerCategory = tx.inputs[this.activeInputIndex].tokenCategory;
    require(controllerCategory.length >= 32);
    controllerCategory = controllerCategory.slice(0, 32);
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

/** Fixed proof-slot covenant: exhaustively compares one owner's global rows to its SCB1/result projection. */
export function generateGraphProjectionVerifier(): string {
  const lbcDeclarations = Array.from({ length: MAX_GRAPH_PARTICIPANTS }, (_unused, index) =>
    `bytes participantLbc${index};`).join('\n    ');
  const lbcAssignments = Array.from({ length: MAX_GRAPH_PARTICIPANTS }, (_unused, index) =>
    `${index === 0 ? 'if' : 'else if'} (participant == ${index}) {
        participantLbc${index} = participantLbc;
      }`).join('\n      ');
  const activeCallees = Array.from({ length: MAX_GRAPH_DEPTH + 1 }, (_unused, depth) =>
    `bigint activeCallee${depth} = -1;`).join('\n    ');
  const participantUsed = Array.from({ length: MAX_GRAPH_PARTICIPANTS }, (_unused, index) =>
    `bool participantUsed${index} = false;`).join('\n    ');
  const markParticipantUsed = Array.from({ length: MAX_GRAPH_PARTICIPANTS }, (_unused, index) =>
    `${index === 0 ? 'if' : 'else if'} (callee == ${index}) {
        participantUsed${index} = true;
      }`).join('\n      ');
  const requireParticipantUsed = Array.from({ length: MAX_GRAPH_PARTICIPANTS }, (_unused, index) =>
    `${index === 0 ? 'if' : 'else if'} (participantCount == ${index + 1}) {
        require(${Array.from({ length: index + 1 }, (_unused2, used) =>
    `participantUsed${used}`).join(' && ')});
      }`).join('\n      ');
  const callerDispatch = Array.from({ length: MAX_GRAPH_DEPTH }, (_unused, offset) => {
    const depth = offset + 1;
    return `${depth === 1 ? 'if' : 'else if'} (depth == ${depth}) {
        caller = activeCallee${depth - 1};
        activeCallee${depth} = callee;
      }`;
  }).join('\n      ');
  const targetDispatch = Array.from({ length: MAX_GRAPH_PARTICIPANTS }, (_unused, index) =>
    `${index === 0 ? 'if' : 'else if'} (callee == ${index}) {
          expectedTarget = participantLbc${index};
        }`).join('\n        ');
  const callerLbcDispatch = Array.from({ length: MAX_GRAPH_PARTICIPANTS }, (_unused, index) =>
    `${index === 0 ? 'if' : 'else if'} (caller == ${index}) {
          expectedCaller = participantLbc${index};
        }`).join('\n        ');
  return `pragma solidcash >=0.8.0;
contract GraphProjectionVerifier() {
  function verify(bytes transcript, bigint controllerInput, bigint participantIndex) {
    require(controllerInput >= 0 && controllerInput < tx.inputs.length);
    require(tx.inputs[controllerInput].nftCommitment == sha256(transcript));
    require(transcript.length >= 10 && transcript.slice(0, 9) == hex"4c3347524150483100");
    bigint participantCount = int(bytes.concat(transcript.slice(9, 10), hex"00"));
    require(participantCount >= 1 && participantCount <= ${MAX_GRAPH_PARTICIPANTS});
    require(participantIndex >= 0 && participantIndex < participantCount);
    bigint cursor = 10;
    bigint expectedParticipantInput = 0;
    bigint previousProjectionInput = -1;
    bytes ownerBatch;
    bytes ownerEmissions;
    bytes ownerCallers;
    bytes resultVector;
    ${lbcDeclarations}
    for (bigint participant = 0; participant < participantCount; participant = participant + 1) {
      require(cursor + 6 <= transcript.length);
      bigint participantInput = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      bigint blockSize = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(blockSize >= 1 && participantInput == expectedParticipantInput);
      expectedParticipantInput = expectedParticipantInput + blockSize;
      require(participantInput < controllerInput && expectedParticipantInput <= controllerInput);
      bigint lbcLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(lbcLength > 0 && cursor + lbcLength <= transcript.length);
      bytes participantLbc = transcript.slice(cursor, cursor + lbcLength);
      cursor = cursor + lbcLength;
      require(tx.inputs[participantInput].lockingBytecode == participantLbc);
      ${lbcAssignments}
      require(cursor + 2 <= transcript.length);
      bigint batchLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(batchLength >= 7 && cursor + batchLength <= transcript.length);
      bytes batchBlob = transcript.slice(cursor, cursor + batchLength);
      cursor = cursor + batchLength;
      require(cursor + 2 <= transcript.length);
      bigint emissionsLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(cursor + emissionsLength <= transcript.length);
      bytes emissions = transcript.slice(cursor, cursor + emissionsLength);
      cursor = cursor + emissionsLength;
      require(cursor + 2 <= transcript.length);
      bigint callersLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(cursor + callersLength + 4 <= transcript.length);
      bytes callers = transcript.slice(cursor, cursor + callersLength);
      cursor = cursor + callersLength + 2;
      bigint resultLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(cursor + resultLength + 2 <= transcript.length);
      bytes results = transcript.slice(cursor, cursor + resultLength);
      cursor = cursor + resultLength;
      bigint projectionInput = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(projectionInput > previousProjectionInput && projectionInput < controllerInput);
      previousProjectionInput = projectionInput;
      if (participant == participantIndex) {
        require(projectionInput == this.activeInputIndex);
        require(participantInput < tx.inputs.length);
        ownerBatch = batchBlob;
        ownerEmissions = emissions;
        ownerCallers = callers;
        resultVector = results;
      }
    }
    bigint invocationCount = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
    cursor = cursor + 2;
    require(invocationCount >= 1 && invocationCount <= ${MAX_GRAPH_INVOCATIONS});
    bigint batchCursor = 7;
    bigint ownerValueMode = int(bytes.concat(ownerBatch.slice(5, 6), hex"00"));
    require(ownerValueMode == 0 || ownerValueMode == 1);
    bigint resultCursor = 0;
    bigint emissionCursor = 0;
    bigint callerCursor = 0;
    bigint localRow = 0;
    ${activeCallees}
    ${participantUsed}
    for (bigint invocation = 0; invocation < invocationCount; invocation = invocation + 1) {
      require(cursor + 12 <= transcript.length);
      bigint parent = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      bigint callee = int(bytes.concat(transcript.slice(cursor, cursor + 1), hex"00"));
      cursor = cursor + 1;
      bigint row = int(bytes.concat(transcript.slice(cursor, cursor + 1), hex"00"));
      cursor = cursor + 1;
      bigint depth = int(bytes.concat(transcript.slice(cursor, cursor + 1), hex"00"));
      cursor = cursor + 3;
      bytes selector = transcript.slice(cursor, cursor + 4);
      cursor = cursor + 4;
      bigint callMode = int(bytes.concat(transcript.slice(cursor, cursor + 1), hex"00"));
      cursor = cursor + 1;
      require(callMode == 0 || callMode == 1);
      bigint argsLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(cursor + argsLength + 2 <= transcript.length);
      bytes args = transcript.slice(cursor, cursor + argsLength);
      cursor = cursor + argsLength;
      bigint resultLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(cursor + resultLength <= transcript.length);
      bytes result = transcript.slice(cursor, cursor + resultLength);
      cursor = cursor + resultLength;
      bigint caller = -1;
      ${markParticipantUsed}
      else { revert("callee out of range"); }
      if (invocation == 0) {
        require(parent == 65535 && depth == 0);
        activeCallee0 = callee;
      } else {
        ${callerDispatch}
        else { revert("depth out of range"); }
      }
      if (caller == participantIndex) {
        bigint targetLength = int(bytes.concat(
          ownerEmissions.slice(emissionCursor, emissionCursor + 2), hex"00"
        ));
        emissionCursor = emissionCursor + 2;
        bytes emittedTarget = ownerEmissions.slice(emissionCursor, emissionCursor + targetLength);
        emissionCursor = emissionCursor + targetLength;
        bigint emittedCallMode = int(bytes.concat(
          ownerEmissions.slice(emissionCursor, emissionCursor + 1), hex"00"
        ));
        emissionCursor = emissionCursor + 1;
        bytes emittedSelector = ownerEmissions.slice(emissionCursor, emissionCursor + 4);
        emissionCursor = emissionCursor + 4;
        bigint emittedArgsLength = int(bytes.concat(
          ownerEmissions.slice(emissionCursor, emissionCursor + 2), hex"00"
        ));
        emissionCursor = emissionCursor + 2;
        bytes emittedArgs = ownerEmissions.slice(emissionCursor, emissionCursor + emittedArgsLength);
        emissionCursor = emissionCursor + emittedArgsLength;
        bigint emittedResultLength = int(bytes.concat(
          ownerEmissions.slice(emissionCursor, emissionCursor + 2), hex"00"
        ));
        emissionCursor = emissionCursor + 2;
        bytes emittedResult = ownerEmissions.slice(emissionCursor, emissionCursor + emittedResultLength);
        emissionCursor = emissionCursor + emittedResultLength;
        bytes expectedTarget;
        ${targetDispatch}
        else { revert("callee out of range"); }
        require(emittedTarget == expectedTarget);
        require(emittedCallMode == callMode);
        require(emittedSelector == selector);
        require(emittedArgsLength == argsLength && emittedArgs == args);
        require(emittedResultLength == resultLength && emittedResult == result);
      }
      if (callee == participantIndex) {
        bigint logicalCallerLength = int(bytes.concat(
          ownerCallers.slice(callerCursor, callerCursor + 2), hex"00"
        ));
        callerCursor = callerCursor + 2;
        bytes logicalCaller = ownerCallers.slice(callerCursor, callerCursor + logicalCallerLength);
        callerCursor = callerCursor + logicalCallerLength;
        if (invocation == 0) {
          require(logicalCallerLength == 0 || logicalCaller == tx.origin);
        } else {
          bytes expectedCaller;
          ${callerLbcDispatch}
          else { revert("caller out of range"); }
          require(logicalCaller == expectedCaller);
        }
        require(row == localRow);
        localRow = localRow + 1;
        require(ownerBatch.slice(batchCursor, batchCursor + 4) == selector);
        batchCursor = batchCursor + 4;
        bigint callsite = int(bytes.concat(ownerBatch.slice(batchCursor, batchCursor + 4), hex"00"));
        batchCursor = batchCursor + 4;
        require(callsite == row);
        bigint occurrence = int(bytes.concat(ownerBatch.slice(batchCursor, batchCursor + 2), hex"00"));
        batchCursor = batchCursor + 2;
        require(occurrence == 0);
        bigint localArgsLength = int(bytes.concat(ownerBatch.slice(batchCursor, batchCursor + 2), hex"00"));
        batchCursor = batchCursor + 2;
        if (ownerValueMode == 1) {
          bigint valueNegative = int(bytes.concat(
            ownerBatch.slice(batchCursor, batchCursor + 1), hex"00"
          ));
          require(valueNegative == 0 || valueNegative == 1);
          batchCursor = batchCursor + 9;
        }
        require(localArgsLength == argsLength);
        require(ownerBatch.slice(batchCursor, batchCursor + localArgsLength) == args);
        batchCursor = batchCursor + localArgsLength;
        if (resultLength > 0) {
          require(resultVector.slice(resultCursor, resultCursor + resultLength) == result);
          resultCursor = resultCursor + resultLength;
        }
      }
    }
    require(cursor == transcript.length);
    ${requireParticipantUsed}
    else { revert("participant count out of range"); }
    require(localRow > 0 && batchCursor == ownerBatch.length);
    require(emissionCursor == ownerEmissions.length);
    require(callerCursor == ownerCallers.length);
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
    let callMode: 'call' | 'staticcall' = 'call';
    if (invocation.parent !== null) {
      const parentInvocation = invocations[invocation.parent];
      const parentArtifact = participants[parentInvocation.callee].artifact;
      const parentFunction = parentArtifact.abi.find((candidate) =>
        candidate.name === parentInvocation.function);
      const candidates = parentFunction?.externalCalls?.filter((call) =>
        call.functionName === invocation.function) ?? [];
      const modes = [...new Set(candidates.map((call) => call.callMode ?? 'call'))];
      if (modes.length > 1) {
        throw new Error(`layer3: call mode for invocation ${index} is ambiguous`);
      }
      if (modes[0] === 'delegatecall') {
        throw new Error('layer3: delegatecall is not a participant-graph call mode');
      }
      callMode = modes[0] === 'staticcall' ? 'staticcall' : 'call';
      if (callMode === 'staticcall') {
        const calleeFunction = participants[invocation.callee].artifact.abi.find((candidate) =>
          candidate.name === invocation.function);
        if (!calleeFunction || calleeFunction.writesState
          || (calleeFunction.emits?.length ?? 0) > 0) {
          throw new Error(`layer3: staticcall target '${invocation.function}' is not compiler-proven read-only`);
        }
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
      argsHex: row.argsHex,
      resultTypes: Object.freeze([...(result?.types ?? [])]),
    });
  });
  const resultDependencies: number[][] = invocations.map(() => []);
  for (let child = 1; child < plannedBase.length; child += 1) {
    const parent = invocations[child].parent!;
    const parentInvocation = invocations[parent];
    const parentFunction = participants[parentInvocation.callee].artifact.abi.find((candidate) =>
      candidate.name === parentInvocation.function);
    const matchingCallsites = parentFunction?.externalCalls?.filter((call) =>
      call.functionName === invocations[child].function) ?? [];
    if (matchingCallsites.some((call) => call.hasReturnValues)) {
      if (plannedBase[child].resultTypes.length === 0) {
        throw new Error(
          `layer3: invocation ${parent} consumes a result from void invocation ${child}`,
        );
      }
      resultDependencies[parent].push(child);
    }
  }
  assertResolvableResultDependencies(invocations.length, resultDependencies);
  const planned = plannedBase.map((invocation, index) => Object.freeze({
    ...invocation,
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
