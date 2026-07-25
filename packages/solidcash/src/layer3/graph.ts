import type { Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import {
  encodeHiddenBatch, type EncodedHiddenBatch, type HiddenBatchInvocation,
} from './hidden-batch.js';

export interface CompiledGraphParticipant {
  artifact: Artifact;
  lockingBytecode: string;
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
  argsHex: string;
  resultTypes: readonly string[];
}

export interface CompiledParticipantExecution {
  participant: number;
  lockingBytecode: string;
  batch: EncodedHiddenBatch;
  /** Global invocation indices, in the exact order executed by this owner's SCB1 route. */
  invocations: readonly number[];
}

export interface CompiledGraphPlan {
  participants: readonly CompiledParticipantExecution[];
  invocations: readonly PlannedGraphInvocation[];
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
  returnOutputs: readonly (number | null)[];
  /** Inner SCB1 packed result vector (before the outer `bytes` return-event framing), by participant. */
  participantResultVectorsHex: readonly string[];
}

export interface CompiledGraphPhysicalLayout {
  /** Physical master input of each participant, by participant index. */
  participantInputs: readonly number[];
  /** One-shot controller NFT input carrying `FinalizedCompiledGraph.root`. */
  controllerInput: number;
  /** Exact balanced transaction input/output count. */
  totalSlots: number;
  /**
   * Optional return-event output per participant. Required when that participant's SCB1 plan returns values.
   * The corresponding expected full NFT commitment is supplied in `resultCommitmentsHex`.
   */
  returnOutputs?: readonly (number | null)[];
}

const GRAPH_DOMAIN = utf8ToBin('L3GRAPH1\0');
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
): FinalizedCompiledGraph {
  if (participantInputs.length !== plan.participants.length
    || participantInputs.some((input) => !Number.isInteger(input) || input < 0 || input > 0xffff)
    || participantInputs.some((input, index) => index > 0 && input <= participantInputs[index - 1])) {
    throw new Error('layer3: participant physical inputs must be strictly increasing uint16 values');
  }
  if (returnOutputs.length !== plan.participants.length
    || participantResultVectorsHex.length !== plan.participants.length) {
    throw new Error('layer3: return outputs/result vectors must align with participants');
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
    const lbcFrame = framed(lbc);
    const batchFrame = framed(participant.batch.blob);
    const returnFrame = uint(returnOutputs[participantIndex] ?? 0xffff, 2);
    const resultFrame = framed(hexToBin(participantResultVectorsHex[participantIndex]));
    parts.push(inputFrame, lbcFrame, batchFrame, returnFrame, resultFrame);
    encodedLength += inputFrame.length + lbcFrame.length + batchFrame.length
      + returnFrame.length + resultFrame.length;
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
    returnOutputs: Object.freeze([...returnOutputs]),
    participantResultVectorsHex: Object.freeze(
      participantResultVectorsHex.map((vector) => vector.toLowerCase()),
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
    ...execution.batch.routeWitnesses,
  ]);
}

/**
 * Fixed-code one-shot graph-root controller. Its locking bytecode is independent of any transcript, so
 * application artifacts can pin it at compile time. A mint-once mutable NFT supplies the root commitment;
 * `attest` authenticates the complete transcript bytes and burns the unique category.
 */
export function generateGraphRootController(): string {
  const localCounters = Array.from({ length: 8 }, (_unused, owner) =>
    `bigint localRow${owner} = 0;`).join('\n    ');
  const resultVectors = Array.from({ length: 8 }, (_unused, owner) =>
    `bytes resultVector${owner} = hex""; bigint resultCursor${owner} = 0;`).join('\n    ');
  const resultAssignments = Array.from({ length: 8 }, (_unused, owner) =>
    `${owner === 0 ? 'if' : 'else if'} (participant == ${owner}) { resultVector${owner} = resultVector; }`)
    .join('\n      ');
  const activeFrames = Array.from({ length: 8 }, (_unused, depth) =>
    `bigint activeIndex${depth} = -1; bigint activeEnd${depth} = -1;`).join('\n    ');
  const localDispatch = Array.from({ length: 8 }, (_unused, owner) =>
    `${owner === 0 ? 'if' : 'else if'} (callee == ${owner}) {
        require(localRow == localRow${owner});
        localRow${owner} = localRow${owner} + 1;
        if (resultLength > 0) {
          require(resultCursor${owner} + resultLength <= resultVector${owner}.length);
          require(resultVector${owner}.slice(
            resultCursor${owner}, resultCursor${owner} + resultLength
          ) == resultBytes);
          resultCursor${owner} = resultCursor${owner} + resultLength;
        } else {
          require(resultVector${owner}.length == 0);
        }
      }`).join('\n      ');
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
contract GraphRootController() {
  function attest(bytes transcript) {
    require(tx.inputs[this.activeInputIndex].nftCommitment.length == 32);
    require(tx.inputs[this.activeInputIndex].nftCommitment == sha256(transcript));
    require(transcript.length >= 10);
    require(transcript.slice(0, 9) == hex"4c3347524150483100");
    bigint participantCount = int(bytes.concat(transcript.slice(9, 10), hex"00"));
    require(participantCount >= 1 && participantCount <= 8);
    bigint cursor = 10;
    bigint previousInput = -1;
    bigint previousReturnOutput = -1;
    ${resultVectors}
    for (bigint participant = 0; participant < participantCount; participant = participant + 1) {
      require(cursor + 2 <= transcript.length);
      bigint participantInput = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(participantInput > previousInput && participantInput < tx.inputs.length);
      previousInput = participantInput;
      require(cursor + 2 <= transcript.length);
      bigint lbcLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(lbcLength > 0 && cursor + lbcLength <= transcript.length);
      bytes participantLbc = transcript.slice(cursor, cursor + lbcLength);
      cursor = cursor + lbcLength;
      require(tx.inputs[participantInput].lockingBytecode == participantLbc);
      require(cursor + 2 <= transcript.length);
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
      require(cursor + 4 <= transcript.length);
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
      ${resultAssignments}
      else { revert("participant out of range"); }
    }
    require(cursor + 2 <= transcript.length);
    bigint invocationCount = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
    cursor = cursor + 2;
    require(invocationCount >= 1 && invocationCount <= 24);
    ${localCounters}
    ${activeFrames}
    bigint previousDepth = -1;
    for (bigint invocation = 0; invocation < invocationCount; invocation = invocation + 1) {
      require(cursor + 11 <= transcript.length);
      bigint parent = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      bigint callee = int(bytes.concat(transcript.slice(cursor, cursor + 1), hex"00"));
      cursor = cursor + 1;
      bigint localRow = int(bytes.concat(transcript.slice(cursor, cursor + 1), hex"00"));
      cursor = cursor + 1;
      bigint depth = int(bytes.concat(transcript.slice(cursor, cursor + 1), hex"00"));
      cursor = cursor + 1;
      bigint subtreeEnd = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      bytes selector = transcript.slice(cursor, cursor + 4);
      cursor = cursor + 4;
      require(callee < participantCount);
      require(selector.length == 4);
      if (invocation == 0) {
        require(parent == 65535 && depth == 0 && subtreeEnd == invocationCount - 1);
        activeIndex0 = 0;
        activeEnd0 = subtreeEnd;
      } else {
        require(parent < invocation && depth >= 1 && depth <= 7 && depth <= previousDepth + 1);
        require(subtreeEnd >= invocation && subtreeEnd < invocationCount);
        ${depthDispatch}
        else { revert("depth out of range"); }
      }
      previousDepth = depth;
      require(cursor + 2 <= transcript.length);
      bigint argsLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(cursor + argsLength <= transcript.length);
      cursor = cursor + argsLength;
      require(cursor + 2 <= transcript.length);
      bigint resultLength = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      cursor = cursor + 2;
      require(cursor + resultLength <= transcript.length);
      bytes resultBytes = transcript.slice(cursor, cursor + resultLength);
      cursor = cursor + resultLength;
      ${localDispatch}
      else { revert("callee out of range"); }
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
  if (participants.length < 1 || participants.length > 255) {
    throw new Error('layer3: compiled graph participant count must be between 1 and 255');
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
    perOwner[invocation.callee].push({
      function: invocation.function,
      args: invocation.args,
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
      batch: encodeHiddenBatch(participant.artifact, perOwner[owner]),
      invocations: Object.freeze(globalByOwner[owner]),
    });
  });

  const localCursor = participants.map(() => 0);
  const depths = invocations.map(() => 0);
  for (let index = 1; index < invocations.length; index += 1) {
    depths[index] = depths[invocations[index].parent!] + 1;
    if (depths[index] > 7) throw new Error('layer3: compiled graph exceeds maximum depth 7');
  }
  const planned = invocations.map((invocation, index) => {
    const execution = executions[invocation.callee];
    const localRow = localCursor[invocation.callee];
    localCursor[invocation.callee] += 1;
    const row = execution.batch.rows[localRow];
    const result = execution.batch.results.find((candidate) => candidate.row === localRow);
    const caller = invocation.parent === null ? null : invocations[invocation.parent].callee;
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
      argsHex: row.argsHex,
      resultTypes: Object.freeze([...(result?.types ?? [])]),
    });
  });

  return Object.freeze({
    participants: Object.freeze(executions),
    invocations: Object.freeze(planned),
  });
}
import {
  binToHex, hexToBin, sha256, utf8ToBin,
} from '@bitauth/libauth';
