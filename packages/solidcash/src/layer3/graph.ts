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
): FinalizedCompiledGraph {
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

  const parts: Uint8Array[] = [GRAPH_DOMAIN, uint(plan.participants.length, 1)];
  for (const participant of plan.participants) {
    const lbc = hexToBin(participant.lockingBytecode);
    parts.push(framed(lbc), framed(participant.batch.blob));
  }
  parts.push(uint(plan.invocations.length, 2));
  plan.invocations.forEach((invocation, index) => {
    const args = hexToBin(invocation.argsHex);
    const result = hexToBin(resultHex[index]);
    parts.push(
      uint(invocation.parent === null ? 0xffff : invocation.parent, 2),
      uint(invocation.callee, 1),
      uint(invocation.localRow, 1),
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
  });
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
