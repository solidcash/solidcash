/**
 * phase-boundary extract: faithful/sparse probe-trace evaluation + BoundedProbeTraceCollector
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import {
  Op,
  hash256 as hash256Sync,
  sha256 as sha256Sync,
  VALUE_CHUNK_SIZE,
  VALUE_CHUNK_MAX_COUNT,
  VALUE_HEAD_SIZE,
} from '@solidcash/utils';
import {
  createFaithfulTraceVmForProvider,
  createVirtualMachineBch2026ForProvider,
  usesFastVmPaths,
} from '../network/createVirtualMachine.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { CALL_RECORD_INLINE_RESULT_BYTES } from './call-record.js';
import { captureProbeContinuations } from './probe-instruction-sequence.js';

export function isP2sh32LockingBytecode(bytes: Uint8Array | undefined): boolean {
  return !!bytes && bytes.length === 35 && bytes[0] === 0xaa && bytes[1] === 0x20 && bytes[34] === 0x87;
}

/** Sparse probe observations needed by output derivation and deferred compute-preimage discovery. */
const PROBE_TRACE_OPCODES = new Set<number>([
  Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_OUTPUTBYTECODE, Op.OP_OUTPUTVALUE,
  Op.OP_OUTPUTTOKENAMOUNT, Op.OP_OUTPUTTOKENCATEGORY,
  Op.OP_INPUTBYTECODE, Op.OP_EQUALVERIFY,
]);

/** The sparse observer's operations: OP_SHA256 only keeps a hashed call record's result and projects no state. */
const SPARSE_PROBE_OPCODES = new Set<number>([...PROBE_TRACE_OPCODES, Op.OP_SHA256]);

/** A callee run pins one record; a probe keeps at most this many hashed record results. */
const MAX_PROBE_RECORD_RESULTS = 16;

/**
 * True at a callee's `ELSE SHA256 2 ENDIF`, where its call record replaces a result past the inline capacity with
 * that result's SHA256: no later observation holds the result, so the sparse trace keeps it here.
 */
export function isCallRecordHashStep(state: AuthenticationProgramStateCommon): boolean {
  const { instructions, ip } = state;
  return instructions[ip]?.opcode === Op.OP_SHA256 && instructions[ip - 1]?.opcode === Op.OP_ELSE
    && instructions[ip + 1]?.opcode === Op.OP_2 && instructions[ip + 2]?.opcode === Op.OP_ENDIF
    && !state.controlStack.some((frame) => frame === false)
    && (state.stack.at(-1)?.length ?? 0) > CALL_RECORD_INLINE_RESULT_BYTES;
}

/** Compiler value-chunk identity scan's terminal `DROP, EQUALVERIFY, 2DROP` count check. */
export function isValueChunkIdentityCountPin(
  instructions: ReadonlyArray<{ opcode: number }>,
  ip: number,
): boolean {
  const opcode = instructions[ip]?.opcode;
  return (opcode === Op.OP_EQUALVERIFY
    && instructions[ip - 1]?.opcode === Op.OP_DROP
    && instructions[ip + 1]?.opcode === Op.OP_2DROP)
    || (opcode === Op.OP_2DROP
      && instructions[ip - 1]?.opcode === Op.OP_EQUALVERIFY
      && instructions[ip - 2]?.opcode === Op.OP_DROP);
}

interface CachedProbeVm {
  collector: BoundedProbeTraceCollector;
  vm: ReturnType<typeof createVirtualMachineBch2026ForProvider>;
}

interface CachedFaithfulTraceVm {
  trace: AuthenticationProgramStateCommon[];
  /** Phase exits reported by the cached P2SH evaluator during the current evaluation. */
  phaseExits: number;
  vm: ReturnType<typeof createVirtualMachineBch2026ForProvider>;
}

// Probe evaluation is synchronous, and a provider's consensus limits are immutable for its lifetime. Rebuilding
// libauth's complete BCH-2026 instruction set (then wrapping the observed opcode handlers) for every convergence
// step is therefore pure overhead. Keep the VM and its observer closure, resetting only the small trace buffer.
const probeVmCache = new WeakMap<NetworkProvider, CachedProbeVm>();
const debugVmCache = new WeakMap<NetworkProvider, ReturnType<typeof createVirtualMachineBch2026ForProvider>>();
const faithfulTraceVmCache = new WeakMap<NetworkProvider, CachedFaithfulTraceVm>();

/** The scalar-return fallback inspects only the execution tail, never an unbounded VM debug trace. */
export const MAX_BOUNDED_PROBE_STATES = 96;
const MAX_BOUNDED_PROBE_CANDIDATE_BYTES = 64 * 1024;
type ProbeProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0];
type BoundedCandidateVm = {
  vm: ReturnType<typeof createVirtualMachineBch2026ForProvider>;
  stacks: Uint8Array[][];
  next: number;
  count: number;
};
const boundedCandidateVmCache = new WeakMap<NetworkProvider, BoundedCandidateVm>();

/** Collect at most four live stack values from each of the last 96 executed states. */
export function evaluateBoundedProbeCandidates(
  provider: NetworkProvider,
  program: ProbeProgram,
): Uint8Array[] {
  let cached = boundedCandidateVmCache.get(provider);
  if (!cached) {
    cached = { vm: undefined as unknown as BoundedCandidateVm['vm'], stacks: [], next: 0, count: 0 };
    const capture = (unknownState: unknown): void => {
      const state = unknownState as AuthenticationProgramStateCommon;
      cached!.stacks[cached!.next] = state.stack.slice(-4)
        .filter((item) => item.length <= MAX_BOUNDED_PROBE_CANDIDATE_BYTES)
        .map((item) => item.slice());
      cached!.next = (cached!.next + 1) % MAX_BOUNDED_PROBE_STATES;
      cached!.count = Math.min(cached!.count + 1, MAX_BOUNDED_PROBE_STATES);
    };
    cached.vm = createFaithfulTraceVmForProvider(provider, capture, capture);
    boundedCandidateVmCache.set(provider, cached);
  }
  cached.stacks = [];
  cached.next = 0;
  cached.count = 0;
  const finalState = cached.vm.evaluate(program) as AuthenticationProgramStateCommon;
  // Include the final phase exit even when the ordinary-size VM has no phase hook.
  cached.stacks[cached.next] = finalState.stack.slice(-4)
    .filter((item) => item.length <= MAX_BOUNDED_PROBE_CANDIDATE_BYTES)
    .map((item) => item.slice());
  cached.next = (cached.next + 1) % MAX_BOUNDED_PROBE_STATES;
  cached.count = Math.min(cached.count + 1, MAX_BOUNDED_PROBE_STATES);
  const candidates: Uint8Array[] = [];
  for (let age = 1; age <= cached.count; age += 1) {
    const stack = cached.stacks[(cached.next - age + MAX_BOUNDED_PROBE_STATES) % MAX_BOUNDED_PROBE_STATES];
    for (let index = stack.length - 1; index >= 0; index -= 1) candidates.push(stack[index]);
  }
  return candidates;
}

export function cachedDebugVm(provider: NetworkProvider): ReturnType<typeof createVirtualMachineBch2026ForProvider> {
  const existing = debugVmCache.get(provider);
  if (existing) return existing;
  const vm = createVirtualMachineBch2026ForProvider(provider);
  debugVmCache.set(provider, vm);
  return vm;
}

/** Keys libauth's `partiallyCloneProgramState` shallow-clones; every other key is deep-cloned there. */
const TRACE_SHALLOW_ARRAY_KEYS = new Set(['alternateStack', 'controlStack', 'signedMessages', 'stack']);

/**
 * Snapshot one program state for a faithful trace, mirroring libauth's `partiallyCloneProgramState`.
 *
 * The one deliberate difference is `functionTable`. libauth deep-clones it - the complete OP_DEFINE'd body table,
 * tens of kilobytes for an outlined contract - on every operation, which is what made a 6,132-state probe spend
 * 2.4 s almost entirely inside `structuredClone`. Sharing it is observationally equivalent: a repeated function
 * identifier is a VM error, so the table only ever grows, and no consumer reads it from a historical trace.
 * Everything else (including `metrics`) is copied exactly as libauth copies it, so an inactive-branch or
 * mutated-item difference cannot hide behind this change.
 */
function snapshotProgramState(state: AuthenticationProgramStateCommon): AuthenticationProgramStateCommon {
  return Object.fromEntries(Object.entries(state).map(([key, value]) => {
    if (key === 'instructions' || key === 'program' || key === 'functionTable') return [key, value];
    if (TRACE_SHALLOW_ARRAY_KEYS.has(key)) return [key, (value as unknown[]).slice()];
    return [key, structuredClone(value)];
  })) as AuthenticationProgramStateCommon;
}

function cachedFaithfulTraceVm(provider: NetworkProvider): CachedFaithfulTraceVm {
  const existing = faithfulTraceVmCache.get(provider);
  if (existing) return existing;
  const cached = {
    trace: [] as AuthenticationProgramStateCommon[],
    phaseExits: 0,
  } as CachedFaithfulTraceVm;
  cached.vm = createFaithfulTraceVmForProvider(provider, (unknownState) => {
    cached.trace.push(snapshotProgramState(unknownState as AuthenticationProgramStateCommon));
    // The faithful recorder runs on its own VM instance, so the observer in `cachedVm` never sees the operations
    // that actually fail here. Mirror the out-lined-subprogram dump for the trace that matters.
    const debugEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const spanInstructions = Number(debugEnv?.SOLIDC_DEBUG_SPAN_INSTRUCTIONS ?? Number.NaN);
    const state = unknownState as AuthenticationProgramStateCommon;
    // Match `emitPreferLockingBytecode`'s exact body (`DUP SIZE NIP…` ending in `EQUALVERIFY`): other out-lined
    // subprograms share the same instruction count.
    // Never scan the whole program at every step for an optional diagnostic. A large route executes
    // thousands of instructions, so even a disabled opcode projection otherwise makes tracing quadratic.
    if (Number.isFinite(spanInstructions) && state.instructions.length === spanInstructions
      && state.instructions.length === 15
      && state.instructions[0].opcode === 118 && state.instructions[1].opcode === 130
      && state.instructions[2].opcode === 119 && state.instructions[14].opcode === 136) {
      console.error('derive-span-faithful', JSON.stringify({
        ordinal: cached.trace.length - 1,
        inputIndex: state.program.inputIndex,
        ip: state.ip,
        opcode: state.instructions[state.ip]?.opcode,
        error: state.error === undefined ? undefined : String((state.error as { error?: unknown }).error
          ?? state.error),
        top: state.stack.slice(-4).map((item) => `${item.length}:${binToHex(item).slice(0, 80)}`),
      }));
    }
  }, (unknownState) => {
    cached.phaseExits += 1;
    cached.trace.push(snapshotProgramState(unknownState as AuthenticationProgramStateCommon));
  });
  faithfulTraceVmCache.set(provider, cached);
  return cached;
}

/**
 * Evaluate `program` while recording a faithful trace, in the exact shape `vm.debug()` returns: each evaluation
 * phase's entry state, the state after every operation of that phase, the state the phase ends with, and finally
 * the evaluation result itself. The observer records the state *before* each operation (the entry state for the
 * first one), the phase hook records each exit, and the result is appended last, so the sequence matches the
 * reference state for state - including the duplicate of the final state that `debug()` appends as `finalResult`.
 */
export function evaluateFaithfulProbeTrace(
  provider: NetworkProvider,
  program: Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0],
): AuthenticationProgramStateCommon[] {
  const cached = cachedFaithfulTraceVm(provider);
  cached.trace.length = 0;
  cached.phaseExits = 0;
  const finalState = cached.vm.evaluate(program) as AuthenticationProgramStateCommon;
  cached.trace.push(snapshotProgramState(finalState));
  const completed = cached.trace;
  cached.trace = [];
  return completed;
}

/**
 * Evaluate a probe program faithfully: the shallow recorder on a private/mock provider, libauth's `debug()`
 * everywhere else.
 *
 * The recorder is equivalent to `debug()` only while the cached P2SH evaluator supplies the phase exits, and
 * that evaluator is installed exactly when `usesFastVmPaths(provider)`. Otherwise the reference is kept, so a
 * live network sees no change at all. Callers that need a full faithful trace (rather than the sparse observer's
 * reduced one) use this instead of calling `debug()` directly.
 */
export function evaluateFaithfulOrDebugTrace(
  provider: NetworkProvider,
  program: Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0],
): AuthenticationProgramStateCommon[] {
  if (!usesFastVmPaths(provider)) return cachedDebugVm(provider).debug(program) as AuthenticationProgramStateCommon[];
  const faithful = evaluateFaithfulProbeTrace(provider, program);
  if ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.SOLIDC_DEBUG_TRACE_PARITY === '1') {
    logProbeTraceParity(cachedDebugVm(provider).debug(program) as AuthenticationProgramStateCommon[], faithful);
  }
  return faithful;
}

/**
 * Compare the faithful recorder's trace with libauth's `debug()` reference and report the first divergence.
 *
 * Diagnostic only, enabled by `SOLIDC_DEBUG_TRACE_PARITY=1`: it is how the shallow recorder is held to the
 * reference on a real probe, where a mutation-in-place or inactive-branch difference would otherwise be silent.
 */
function logProbeTraceParity(
  reference: AuthenticationProgramStateCommon[],
  candidate: AuthenticationProgramStateCommon[],
): void {
  const stackOf = (state: AuthenticationProgramStateCommon): string[] =>
    state.stack.map((item) => binToHex(item));
  const describe = (state: AuthenticationProgramStateCommon): Record<string, unknown> => ({
    ip: state.ip,
    instructions: state.instructions.length,
    error: state.error,
    stack: stackOf(state),
    alternateStack: state.alternateStack.map((item) => binToHex(item)),
    controlDepth: state.controlStack.length,
  });
  if (reference.length !== candidate.length) {
    const boundaries = (trace: AuthenticationProgramStateCommon[]): number[] => {
      const found: number[] = [];
      let previous: unknown;
      trace.forEach((state, index) => {
        if (state.instructions !== previous) {
          previous = state.instructions;
          found.push(index);
        }
      });
      return found;
    };
    console.error('probe-trace-parity', {
      equal: false,
      reason: 'length',
      referenceStates: reference.length,
      candidateStates: candidate.length,
      referenceBoundaries: boundaries(reference),
      candidateBoundaries: boundaries(candidate),
    });
    return;
  }
  for (let index = 0; index < reference.length; index += 1) {
    const left = JSON.stringify(describe(reference[index]));
    const right = JSON.stringify(describe(candidate[index]));
    if (left !== right) {
      console.error('probe-trace-parity', {
        equal: false,
        reason: 'state',
        index,
        reference: left.slice(0, 2000),
        candidate: right.slice(0, 2000),
      });
      return;
    }
  }
  console.error('probe-trace-parity', { equal: true, states: reference.length });
}

function fingerprintBytecode(bytes: Uint8Array, cache: WeakMap<Uint8Array, string>): string {
  const cached = cache.get(bytes);
  if (cached !== undefined) return cached;
  const fingerprint = binToHex(hash256Sync(bytes));
  cache.set(bytes, fingerprint);
  return fingerprint;
}

/** Content-sensitive tx identity without serializing multi-megabyte unlocking scripts on every probe. */
export function fingerprintLibauthTransaction(
  transaction: Parameters<typeof encodeTransaction>[0],
  bytecodeCache: WeakMap<Uint8Array, string>,
): string {
  const inputs = transaction.inputs.map((input) => [
    binToHex(input.outpointTransactionHash),
    String(input.outpointIndex),
    String(input.sequenceNumber),
    fingerprintBytecode(input.unlockingBytecode, bytecodeCache),
  ].join(':'));
  const outputs = transaction.outputs.map((output) => [
    output.valueSatoshis.toString(),
    fingerprintBytecode(output.lockingBytecode, bytecodeCache),
    output.token?.category === undefined ? '' : binToHex(output.token.category),
    output.token?.amount?.toString() ?? '',
    output.token?.nft?.capability ?? '',
    output.token?.nft?.commitment === undefined ? '' : binToHex(output.token.nft.commitment),
  ].join(':'));
  return `${transaction.version}|${transaction.locktime}|${inputs.join(',')}|${outputs.join(',')}`;
}

const MAX_PROJECTED_PROBE_STATES = 262_144;
const MAX_PROJECTED_PROBE_VALUES = 4_096;
const MAX_PROJECTED_PROBE_VALUE_BYTES = 64 * 1024 * 1024;
const PROJECTED_PROBE_FULL_STACK_WINDOW = 96;
const MAX_PROJECTED_PROBE_WINDOW_ITEMS = 1_048_576;

type ProjectedProbeState = {
  ordinal: number;
  state: AuthenticationProgramStateCommon;
  stackItems: number;
};

/**
 * Bounded online projection of the sparse VM observations consumed by state derivation.
 *
 * Output-pin extractors need only opcode-local operands, while return fallback needs the complete stacks from
 * the last 96 sparse observations. Chunked collection recovery additionally needs distinct long values and the
 * hashes/tails/locks which authenticate them. Keeping those three forms separately avoids retaining every live
 * stack container while preserving the existing extractor-facing trace representation.
 */
export class BoundedProbeTraceCollector {
  private awaitingVerification = false;
  private ordinal = 0;
  private projected: ProjectedProbeState[] = [];
  private recent: ProjectedProbeState[] = [];
  private recentStackItems = 0;
  private evidence = new Map<string, Uint8Array>();
  private evidenceBytes = 0;
  private longItems = new Map<string, Uint8Array>();
  private authItems = new Map<string, Uint8Array>();
  private tailRootHexes = new Set<string>();
  private lockDigestHexes = new Set<string>();
  private sameStackAuthenticated = new Set<string>();
  private digestCache = new WeakMap<Uint8Array, string>();
  private hexCache = new WeakMap<Uint8Array, string>();
  private scannedEvidenceItems = new WeakSet<Uint8Array>();
  private longItemKeys = new WeakMap<Uint8Array, string>();
  private recordResults: Uint8Array[] = [];

  reset(): void {
    this.recordResults = [];
    this.awaitingVerification = false;
    this.ordinal = 0;
    this.projected = [];
    this.recent = [];
    this.recentStackItems = 0;
    this.evidence = new Map();
    this.evidenceBytes = 0;
    this.longItems = new Map();
    this.authItems = new Map();
    this.tailRootHexes = new Set();
    this.lockDigestHexes = new Set();
    this.sameStackAuthenticated = new Set();
    this.digestCache = new WeakMap();
    this.hexCache = new WeakMap();
    this.scannedEvidenceItems = new WeakSet();
    this.longItemKeys = new WeakMap();
  }

  private digestOf(value: Uint8Array): string {
    const cached = this.digestCache.get(value);
    if (cached !== undefined) return cached;
    const digest = binToHex(sha256Sync(value));
    this.digestCache.set(value, digest);
    return digest;
  }

  private hexOf(value: Uint8Array): string {
    const cached = this.hexCache.get(value);
    if (cached !== undefined) return cached;
    const hex = binToHex(value);
    this.hexCache.set(value, hex);
    return hex;
  }

  private retainEvidence(key: string, value: Uint8Array): void {
    if (this.evidence.has(key)) return;
    if (this.evidence.size >= MAX_PROJECTED_PROBE_VALUES
      || this.evidenceBytes + value.byteLength > MAX_PROJECTED_PROBE_VALUE_BYTES) {
      throw new Error('Sparse route probe produced too much distinct extractor evidence to retain safely.');
    }
    this.evidence.set(key, value);
    this.evidenceBytes += value.byteLength;
  }

  private scanEvidence(state: AuthenticationProgramStateCommon): void {
    const maximumCandidateBytes = VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * VALUE_CHUNK_MAX_COUNT;
    for (const stack of [state.stack, state.alternateStack ?? []]) {
      // VM operations replace byte arrays rather than mutating existing stack items, as required by the
      // shallow trace snapshots and digest cache above. Encode each authentication value once per probe,
      // but recompute stack membership: a previously seen value can acquire its digest in a later state.
      const localDigests = new Set<string>();
      const pendingLongAuthentication: Array<{ key: string; digest: string }> = [];
      for (const item of stack) {
        if (item.length === 32) localDigests.add(this.hexOf(item));
        // VM frames contain many small numeric operands. None can be a long preimage, its digest, a value
        // tail, or a P2SH32 lock; do not track their identities or revisit them on every observed opcode.
        if (item.length !== 32 && item.length !== 35
          && (item.length <= 60 || item.length > maximumCandidateBytes)) continue;
        if (item.length > 60 && item.length <= maximumCandidateBytes) {
          const digest = this.digestOf(item);
          let key = this.longItemKeys.get(item);
          if (key === undefined) {
            key = `${item.length}:${digest}`;
            this.longItemKeys.set(item, key);
          }
          if (!this.sameStackAuthenticated.has(key)) pendingLongAuthentication.push({ key, digest });
          if (!this.scannedEvidenceItems.has(item)) {
            this.retainEvidence(key, item);
            this.longItems.set(key, item);
          }
        }
        // Evidence membership and authentication markers depend only on immutable item bytes. The co-presence
        // check above remains live because a later stack may authenticate an already-observed long value.
        if (this.scannedEvidenceItems.has(item)) continue;
        this.scannedEvidenceItems.add(item);
        if (item.length === 64) {
          const storedLength = item[0]! | (item[1]! << 8) | (item[2]! << 16) | (item[3]! << 24);
          if (storedLength > 60) this.tailRootHexes.add(this.hexOf(item).slice(8, 72));
        }
        const isLock = isP2sh32LockingBytecode(item);
        if (isLock) this.lockDigestHexes.add(this.hexOf(item).slice(4, 68));
        if (item.length === 32 || item.length === 64 || isLock) {
          const key = `${item.length}:${this.hexOf(item)}`;
          this.retainEvidence(key, item);
          this.authItems.set(key, item);
        }
      }
      // Check after the one pass over the stack: the authenticating digest can precede or follow its value.
      for (const { key, digest } of pendingLongAuthentication) {
        if (localDigests.has(digest)) this.sameStackAuthenticated.add(key);
      }
    }
  }

  private projectState(
    state: AuthenticationProgramStateCommon, terminal = false,
  ): AuthenticationProgramStateCommon {
    const maximumCandidateBytes = VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * VALUE_CHUNK_MAX_COUNT;
    const bounded = (items: Uint8Array[]): Uint8Array[] => items.filter(
      (item) => item.length <= maximumCandidateBytes,
    );
    const opcode = state.instructions[state.ip]?.opcode;
    let stack: Uint8Array[];
    if (isValueChunkIdentityCountPin(state.instructions, state.ip)) {
      stack = bounded(state.stack.filter((item, index) => index >= state.stack.length - 2
        || (item.length > 60 && item.length <= maximumCandidateBytes)
        || isP2sh32LockingBytecode(item)));
    } else if (terminal) {
      stack = bounded(state.stack.filter((item, index) => index >= state.stack.length - 16
        || item.length <= 8 || item.length === 32 || item.length === 35
        || (item.length >= 60 && item.length <= maximumCandidateBytes)));
    } else if (opcode === Op.OP_INPUTBYTECODE) {
      stack = bounded(state.stack.slice(-3));
    } else if (opcode === Op.OP_EQUALVERIFY) {
      stack = bounded(state.stack.slice(-2));
    } else {
      stack = bounded(state.stack.slice(-4));
    }
    return {
      ...state,
      ...captureProbeContinuations(state),
      stack,
      alternateStack: [],
      // Object frames retain caller stacks. Instruction-array identity on each observation preserves the
      // OP_INVOKE boundary used by the extractors without retaining those caller stack containers.
      controlStack: state.controlStack.filter((frame) => typeof frame === 'boolean'),
    };
  }

  observe(state: AuthenticationProgramStateCommon): void {
    const opcode = state.instructions[state.ip]?.opcode;
    if (opcode === Op.OP_SHA256) {
      const result = state.stack.at(-1);
      if (result !== undefined && isCallRecordHashStep(state) && !this.recordResults.includes(result)
        && this.recordResults.length < MAX_PROBE_RECORD_RESULTS) this.recordResults.push(result);
      return;
    }
    const identityCountPin = isValueChunkIdentityCountPin(state.instructions, state.ip);
    if (opcode === Op.OP_EQUALVERIFY && !this.awaitingVerification && !identityCountPin) return;
    if (this.projected.length >= MAX_PROJECTED_PROBE_STATES) {
      throw new Error('Sparse route probe produced too many semantic observations to retain safely.');
    }

    this.scanEvidence(state);
    const ordinal = this.ordinal++;
    this.projected.push({ ordinal, state: this.projectState(state), stackItems: 0 });

    const full = {
      ...state,
      ...captureProbeContinuations(state),
      stack: state.stack.slice(),
      alternateStack: state.alternateStack.slice(),
      controlStack: state.controlStack.filter((frame) => typeof frame === 'boolean'),
    };
    const stackItems = full.stack.length + full.alternateStack.length;
    this.recent.push({ ordinal, state: full, stackItems });
    this.recentStackItems += stackItems;
    if (this.recent.length > PROJECTED_PROBE_FULL_STACK_WINDOW) {
      this.recentStackItems -= this.recent.shift()!.stackItems;
    }
    if (this.recentStackItems > MAX_PROJECTED_PROBE_WINDOW_ITEMS) {
      throw new Error('Sparse route probe return window is too large to retain safely.');
    }
    this.awaitingVerification = opcode !== Op.OP_EQUALVERIFY && opcode !== Op.OP_INPUTBYTECODE;
  }

  finish(finalState: AuthenticationProgramStateCommon): AuthenticationProgramStateCommon[] {
    this.scanEvidence(finalState);
    const recent = new Map(this.recent.map((entry) => [entry.ordinal, entry.state]));
    const trace = this.projected.map((entry) => recent.get(entry.ordinal) ?? entry.state);

    let widest: Uint8Array | undefined;
    const candidates: Uint8Array[] = [];
    for (const [key, item] of this.longItems) {
      if (!widest || item.length >= widest.length) widest = item;
      const digest = this.digestOf(item);
      if (this.sameStackAuthenticated.has(key) || this.tailRootHexes.has(digest)
        || this.lockDigestHexes.has(digest)) candidates.push(item);
    }
    if (widest && !candidates.includes(widest)) candidates.push(widest);
    if (candidates.length > 0 || this.authItems.size > 0 || this.recordResults.length > 0) {
      trace.push({
        ...finalState,
        ip: -1,
        instructions: [],
        // A hashed call record's result, which `rawOfReturnRecord` finds by the record's SHA256.
        stack: [...candidates, ...this.authItems.values(), ...this.recordResults],
        alternateStack: [],
        controlStack: [],
      });
    }
    trace.push(this.projectState(finalState, true));
    return trace;
  }

  stats(): { observations: number; retainedValues: number; retainedValueBytes: number; recentStackItems: number } {
    return {
      observations: this.projected.length,
      retainedValues: this.evidence.size,
      retainedValueBytes: this.evidenceBytes,
      recentStackItems: this.recentStackItems,
    };
  }
}

function cachedProbeVm(provider: NetworkProvider): CachedProbeVm {
  const existing = probeVmCache.get(provider);
  if (existing) return existing;
  const cached = {
    collector: new BoundedProbeTraceCollector(),
  } as CachedProbeVm;
  const debugTraceOperationMode = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.SOLIDC_DEBUG_DERIVE_TRACE_OPS;
  const debugTraceOperations = debugTraceOperationMode === '1'
    || debugTraceOperationMode === 'project' || debugTraceOperationMode === 'range';
  cached.vm = createVirtualMachineBch2026ForProvider(provider, {
    opcodes: debugTraceOperationMode === 'range'
      ? new Set(Array.from({ length: 256 }, (_, opcode) => opcode as Op))
      : debugTraceOperationMode === '1'
      // OP_INVOKE and OP_UTXOBYTECODE are the two operations that decide a subprogram call: the first shows the
      // operands a caller hands down (the callee consumes them immediately), the second shows which input a
      // participant check resolved to. Both are absent from the production observer set.
        ? new Set([...SPARSE_PROBE_OPCODES, Op.OP_EQUAL, Op.OP_VERIFY, Op.OP_HASH160,
          Op.OP_INVOKE, Op.OP_UTXOBYTECODE,
          // `emitPickTrackedFromBottom` is `OP_DEPTH; n; OP_SUB; OP_PICK`, so observing these three names which frame
          // slot (i.e. which hidden ABI witness) a participant check resolved its coordinate from.
          Op.OP_PICK, Op.OP_DEPTH, Op.OP_INPUTINDEX])
        : debugTraceOperationMode === 'project'
          ? new Set([...SPARSE_PROBE_OPCODES, Op.OP_HASH160])
          : SPARSE_PROBE_OPCODES,
    beforeOperation: (unknownState) => {
      const state = unknownState as AuthenticationProgramStateCommon;
      const debugEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env;
      // The observer runs for every selected VM opcode. Keep ordinary probes clear of diagnostic range parsing;
      // environment changes between evaluations still take effect when a diagnostic is enabled later.
      if (!debugTraceOperations && debugEnv?.SOLIDC_DEBUG_SPAN_INSTRUCTIONS === undefined
        && debugEnv?.SOLIDC_DEBUG_SPAN_CALLER_INSTRUCTIONS === undefined) {
        cached.collector.observe(state);
        return;
      }
      const opcode = state.instructions[state.ip]?.opcode;
      const debugFrom = Number(debugEnv?.SOLIDC_DEBUG_DERIVE_TRACE_FROM_IP ?? Number.NaN);
      const debugTo = Number(debugEnv?.SOLIDC_DEBUG_DERIVE_TRACE_TO_IP ?? Number.NaN);
      const debugInstructionCount = Number(
        debugEnv?.SOLIDC_DEBUG_DERIVE_TRACE_INSTRUCTION_COUNT ?? Number.NaN,
      );
      const debugInputIndex = Number(
        debugEnv?.SOLIDC_DEBUG_DERIVE_TRACE_INPUT_INDEX ?? Number.NaN,
      );
      // Trace one out-lined subprogram (identified by its instruction count) operation by operation, inside nested
      // OP_INVOKE frames: an invoked program's recorded state carries the caller's frame, so the trace tail cannot
      // show the operands a guard actually sees.
      const debugSpanInstructions = Number(debugEnv?.SOLIDC_DEBUG_SPAN_INSTRUCTIONS ?? Number.NaN);
      // An outlined span executes its OWN instruction array, while the frame OP_INVOKE recorded for the caller keeps
      // the enclosing body. Selecting by instruction count therefore cannot reach the caller's own emissions; select
      // by the CALLER chain instead so a span's invocation site and operand tuple become visible.
      const debugSpanCallerInstructions = Number(
        debugEnv?.SOLIDC_DEBUG_SPAN_CALLER_INSTRUCTIONS ?? Number.NaN,
      );
      const spanCallerMatches = !Number.isFinite(debugSpanCallerInstructions) ? false
        : state.controlStack.some((frame) => typeof frame === 'object' && frame !== null
          && (frame as { instructions?: unknown[] }).instructions?.length === debugSpanCallerInstructions);
      if ((Number.isFinite(debugSpanInstructions)
        && state.instructions.length === debugSpanInstructions) || spanCallerMatches) {
        console.error('derive-span', JSON.stringify({
          inputIndex: state.program.inputIndex,
          ip: state.ip,
          opcode,
          own: state.instructions.length,
          // The frames that invoked this subprogram: their instruction counts identify the enclosing scripts, and
          // their ip/opcode name the OP_INVOKE site that handed the operand frame down.
          callers: state.controlStack.flatMap((frame) => (typeof frame === 'object' && frame !== null
            ? [{
              len: (frame as { instructions?: unknown[] }).instructions?.length,
              ip: (frame as { ip?: number }).ip,
              op: (frame as { instructions?: Array<{ opcode?: number }>; ip?: number }).instructions
                ?.[(frame as { ip?: number }).ip ?? -1]?.opcode,
            }] : [])).slice(-3),
          // libauth keeps the top of the stack at the END of the array (`useOneStackItem` pops), so the operands an
          // operation will consume are the last items.
          top: state.stack.slice(-4).map((item) => `${item.length}:${binToHex(item).slice(0, 80)}`),
        }));
      }
      if (debugTraceOperations
        && (debugTraceOperationMode !== 'project'
          || opcode === Op.OP_OUTPUTTOKENCOMMITMENT || opcode === Op.OP_HASH160)
        && Number.isFinite(debugFrom) && Number.isFinite(debugTo)
        && (!Number.isFinite(debugInstructionCount)
          || state.instructions.length === debugInstructionCount)
        && (!Number.isFinite(debugInputIndex) || state.program.inputIndex === debugInputIndex)
        && state.ip >= debugFrom && state.ip <= debugTo) {
        const focusDepth = Number(debugEnv?.SOLIDC_DEBUG_DERIVE_TRACE_STACK_DEPTH ?? Number.NaN);
        console.error('derive-op', JSON.stringify({
          inputIndex: state.program.inputIndex,
          ip: state.ip,
          opcode,
          callerFrames: debugEnv?.SOLIDC_DEBUG_DERIVE_TRACE_CALLERS === '1'
            ? state.controlStack.flatMap((frame) => typeof frame === 'object' && frame !== null
              ? [{
                instructionCount: frame.instructions.length,
                ip: frame.ip,
                opcode: frame.instructions[frame.ip]?.opcode,
                window: debugEnv?.SOLIDC_DEBUG_DERIVE_TRACE_CALLER_WINDOW === '1'
                  ? frame.instructions.slice(Math.max(0, frame.ip - 24), frame.ip + 5)
                    .map((instruction, offset) => ({
                      ip: Math.max(0, frame.ip - 24) + offset,
                      opcode: instruction.opcode,
                      data: !('data' in instruction) || instruction.data === undefined
                        ? undefined : binToHex(instruction.data).slice(0, 96),
                    }))
                  : undefined,
              }] : []).slice(-4)
            : undefined,
          stack: state.stack.slice(-16).map((item) => `${item.length}:${binToHex(item.slice(0, 96))}`),
          ...(Number.isFinite(focusDepth) && {
            depthWindow: Array.from({ length: 9 }, (_, offset) => {
              const depth = focusDepth - 4 + offset;
              const item = state.stack[state.stack.length - 1 - depth];
              return { depth, value: item === undefined
                ? undefined : `${item.length}:${binToHex(item.slice(0, 96))}` };
            }),
            matchingTopDepths: state.stack.flatMap((item, index) => (
              state.stack.length > 0 && binToHex(item) === binToHex(state.stack[state.stack.length - 1])
                ? [state.stack.length - 1 - index] : []
            )),
          }),
        }));
      }
      // Diagnostic-only observations must not change the reduced trace consumed by the derivation extractors.
      // In particular, retaining OP_EQUAL/OP_VERIFY here breaks otherwise-adjacent introspection/EQUALVERIFY
      // pairs and can make enabling diagnostics change transaction construction.
      if (debugTraceOperations && !SPARSE_PROBE_OPCODES.has(opcode as Op)) return;
      cached.collector.observe(state);
    },
  });
  probeVmCache.set(provider, cached);
  return cached;
}

/**
 * Reduce a faithful VM trace to the pairing shape consumed by the output-pin extractors. The compiler may
 * outline the inspected operation and its EQUALVERIFY into different invocation frames; ordinary dispatch and
 * stack-management instructions between them are deliberately invisible to the sparse observer and must be
 * invisible on the faithful path too.
 */
export function reduceProbeTrace(
  full: AuthenticationProgramStateCommon[],
): AuthenticationProgramStateCommon[] {
  const filtered: AuthenticationProgramStateCommon[] = [];
  let awaitingVerification = false;
  for (const state of full) {
    const opcode = state.instructions[state.ip]?.opcode;
    const identityCountPin = isValueChunkIdentityCountPin(state.instructions, state.ip);
    if (opcode === undefined || (!PROBE_TRACE_OPCODES.has(opcode) && !identityCountPin)) continue;
    if (opcode === Op.OP_EQUALVERIFY && !awaitingVerification && !identityCountPin) continue;
    filtered.push(state);
    // The INPUTBYTECODE observation is self-contained; its following equality is not consumed by output-pin
    // extraction and can retain the complete unlocking bytecode in an otherwise reduced production trace.
    awaitingVerification = opcode !== Op.OP_EQUALVERIFY && opcode !== Op.OP_INPUTBYTECODE;
  }
  if (full.length > 0) filtered.push(full[full.length - 1]);
  return filtered;
}

/** The compiler's value-chunk loop computes `i * 72 + 28` in the frame which owns the pin. */
export function isValueChunkProbeFrame(
  instructions: AuthenticationProgramStateCommon['instructions'],
): boolean {
  const ops = instructions as Array<{ opcode: number; data?: Uint8Array }>;
  return ops.some((instruction, at) => instruction.data?.length === 1
    && instruction.data[0] === VALUE_CHUNK_SIZE && ops[at + 1]?.opcode === Op.OP_MUL
    && ops[at + 2]?.data?.length === 1 && ops[at + 2]?.data?.[0] === VALUE_HEAD_SIZE
    && ops[at + 3]?.opcode === Op.OP_ADD);
}

/**
 * Compact a faithful OP_INVOKE trace to the semantic observations consumed by route settlement. Byte-array
 * values are immutable in libauth, so retained projections share them while releasing cloned stack containers.
 */
export function compactFaithfulProbeTrace(
  full: AuthenticationProgramStateCommon[],
): AuthenticationProgramStateCommon[] {
  if (full.length === 0) return [];

  const maximumCandidateBytes = VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * VALUE_CHUNK_MAX_COUNT;
  const selected = new Set<number>();
  let redeemAnchor = -1;
  let longestInstructions = -1;
  let redeemInstructions: AuthenticationProgramStateCommon['instructions'] | undefined;
  const longItems = new Map<string, Uint8Array>();
  const authItems = new Map<string, Uint8Array>();
  const tailRootHexes = new Set<string>();
  const lockDigestHexes = new Set<string>();
  const sameStackAuthenticated = new Set<string>();
  const digestCache = new WeakMap<Uint8Array, string>();
  const digestOf = (value: Uint8Array): string => {
    const cached = digestCache.get(value);
    if (cached !== undefined) return cached;
    const digest = binToHex(sha256Sync(value));
    digestCache.set(value, digest);
    return digest;
  };
  const stacksOf = (state: AuthenticationProgramStateCommon): readonly (readonly Uint8Array[])[] => [
    state.stack, state.alternateStack ?? [],
  ];
  // Script stack limits bound the live candidates, but a malformed/debug-only trace must not turn distinct
  // intermediate values into another unbounded retention path. Exceeding this limit is an internal settlement
  // failure rather than permission to silently discard authenticated evidence.
  const MAX_COMPACT_TRACE_VALUES = 4096;
  const retainBounded = (values: Map<string, Uint8Array>, key: string, item: Uint8Array): void => {
    if (values.has(key)) return;
    if (values.size >= MAX_COMPACT_TRACE_VALUES) {
      throw new Error('Faithful route probe produced too many distinct extractor values to compact safely.');
    }
    values.set(key, item);
  };

  for (let index = 0; index < full.length; index++) {
    const state = full[index];
    const opcode = state.instructions[state.ip]?.opcode;
    if (state.ip === 0 && state.instructions.length > longestInstructions) {
      longestInstructions = state.instructions.length;
      redeemInstructions = state.instructions;
    }
    const identityCountPin = isValueChunkIdentityCountPin(state.instructions, state.ip);
    if (opcode !== undefined && (PROBE_TRACE_OPCODES.has(opcode) || identityCountPin)) selected.add(index);
    for (const stack of stacksOf(state)) {
      const localDigests = new Set(stack.filter((item) => item.length === 32).map(binToHex));
      for (const item of stack) {
        if (item.length > 60 && item.length <= maximumCandidateBytes) {
          // Hashing avoids allocating a multi-megabyte hex string for every cloned occurrence. The digest is
          // also the authentication primitive used by the value-tail extractor, so content-equivalent clones
          // collapse under the same key without weakening its selection rule.
          const digest = digestOf(item);
          const key = `${item.length}:${digest}`;
          retainBounded(longItems, key, item);
          if (localDigests.has(digest)) sameStackAuthenticated.add(key);
        }
        if (item.length === 64) {
          const storedLength = item[0]! | (item[1]! << 8) | (item[2]! << 16) | (item[3]! << 24);
          if (storedLength > 60) tailRootHexes.add(binToHex(item.subarray(4, 36)));
        }
        if (isP2sh32LockingBytecode(item)) lockDigestHexes.add(binToHex(item.subarray(2, 34)));
        if ((item.length === 32 || item.length === 64 || isP2sh32LockingBytecode(item))
        ) {
          retainBounded(authItems, `${item.length}:${binToHex(item)}`, item);
        }
      }
    }
  }

  if (redeemInstructions) {
    for (let index = full.length - 1; index >= 0; index--) {
      if (full[index].ip === 0 && full[index].instructions === redeemInstructions) {
        redeemAnchor = index;
        break;
      }
    }
  }

  // Outlining may leave the chunk-loop signature in the caller rather than the OUTPUTBYTECODE helper.
  for (const index of [...selected]) {
    const state = full[index];
    if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTBYTECODE) continue;
    for (let prior = index - 1; prior >= Math.max(0, index - 96); prior--) {
      if (full[prior].instructions === state.instructions) continue;
      if (!isValueChunkProbeFrame(full[prior].instructions)) continue;
      selected.add(prior);
      break;
    }
  }
  if (redeemAnchor >= 0) selected.add(redeemAnchor);
  selected.add(full.length - 1);

  const projectStack = (state: AuthenticationProgramStateCommon, terminal: boolean): Uint8Array[] => {
    const opcode = state.instructions[state.ip]?.opcode;
    const bounded = (items: Uint8Array[]): Uint8Array[] => items.filter(
      (item) => item.length <= maximumCandidateBytes,
    );
    if (isValueChunkIdentityCountPin(state.instructions, state.ip)) {
      return bounded(state.stack.filter((item, index) => index >= state.stack.length - 2
        || (item.length > 60 && item.length <= maximumCandidateBytes)
        || isP2sh32LockingBytecode(item)));
    }
    if (terminal) {
      return bounded(state.stack.filter((item, index) => index >= state.stack.length - 16
        || item.length <= 8 || item.length === 32 || item.length === 35
        || (item.length >= 60 && item.length <= maximumCandidateBytes)));
    }
    if (opcode === Op.OP_INPUTBYTECODE) return bounded(state.stack.slice(-3));
    if (opcode === Op.OP_EQUALVERIFY) return bounded(state.stack.slice(-2));
    if (opcode !== undefined && PROBE_TRACE_OPCODES.has(opcode)) return bounded(state.stack.slice(-4));
    return [];
  };
  const project = (state: AuthenticationProgramStateCommon, terminal = false): AuthenticationProgramStateCommon => ({
    ...state,
    ...captureProbeContinuations(state),
    stack: projectStack(state, terminal),
    alternateStack: [],
    controlStack: state.controlStack.filter((frame) => typeof frame === 'boolean'),
  });
  const compact = [...selected].sort((left, right) => left - right)
    .map((index) => project(full[index], index === full.length - 1));

  // Keep authenticated full-value candidates and the widest count-pin fallback. A synthetic non-instruction
  // state makes these values visible to the existing stack extractor without interrupting output/equality pairs.
  let widest: Uint8Array | undefined;
  const candidates: Uint8Array[] = [];
  for (const [key, item] of longItems) {
    if (!widest || item.length >= widest.length) widest = item;
    const digest = digestOf(item);
    if (sameStackAuthenticated.has(key) || tailRootHexes.has(digest) || lockDigestHexes.has(digest)) {
      candidates.push(item);
    }
  }
  if (widest && !candidates.includes(widest)) candidates.push(widest);
  if (candidates.length > 0 || authItems.size > 0) {
    const terminal = full[full.length - 1];
    compact.splice(Math.max(0, compact.length - 1), 0, {
      ...terminal,
      ip: -1,
      instructions: [],
      stack: [...candidates, ...authItems.values()],
      alternateStack: [],
      controlStack: [],
    });
  }
  return compact;
}

/** Bounds the operand dump: one probe is evaluated many times during deferred-compute learning. */
let probeOperandDumps = 0;

/**
 * Diagnostic: report the operands of the instruction a probe failed on.
 *
 * A trace records the state BEFORE each operation and appends the evaluation result last, so the terminal entry has
 * already consumed the operands that explain the abort - which is exactly the pair a mis-addressed check hides.
 * The entry one position earlier still holds them: for an identity check emitted as `... <expected> <index> DUP
 * UTXOBYTECODE EQUALVERIFY`, the observed locking bytecode, the expected one and the input index that was
 * addressed are the top three items. Gated separately from the terminal dump because the observer path needs a
 * second evaluation of the probe to recover that state.
 */
function dumpProbeOperands(
  debugEnv: Record<string, string | undefined> | undefined,
  before: AuthenticationProgramStateCommon | undefined,
): void {
  if (debugEnv?.SOLIDC_DEBUG_PROBE_OPERANDS !== '1' || before === undefined) return;
  if (probeOperandDumps >= 24) return;
  const instructions = before.instructions as readonly { opcode: number; data?: Uint8Array }[];
  const failing = instructions[before.ip];
  if (failing === undefined) return;
  probeOperandDumps += 1;
  console.error('probe-operands', JSON.stringify({
    inputIndex: before.program.inputIndex,
    inputs: before.program.transaction.inputs.length,
    ip: before.ip,
    ownInstructions: instructions.length,
    opcode: failing.opcode,
    data: failing.data === undefined ? undefined : binToHex(failing.data).slice(0, 96),
    // Top of stack first, so an identity check reports (observed, expected, addressed index) in that order.
    stack: before.stack.slice(-5).reverse().map((item, offset) => `${offset}:${item.length}:${item.length <= 300
      ? binToHex(item) : `${binToHex(item.subarray(0, 24))}..${binToHex(item.subarray(-8))}`}`),
  }));
}

/** Diagnostic: dump the failing probe's program identity, instruction window and stack top. */
function dumpProbeTerminal(
  debugEnv: Record<string, string | undefined> | undefined,
  state: AuthenticationProgramStateCommon | undefined,
): void {
  if (debugEnv?.SOLIDC_DEBUG_PROBE_FRAMES !== '1' || state === undefined) return;
  const instructions = state.instructions as readonly { opcode: number; data?: Uint8Array }[];
  const ip = state.ip;
  console.error('probe-terminal', JSON.stringify({
    error: state.error === undefined ? undefined : String(
      typeof state.error === 'object' && state.error !== null && 'error' in state.error
        ? (state.error as { error: unknown }).error : state.error,
    ),
    ip,
    ownInstructions: instructions.length,
    callers: state.controlStack.flatMap((frame) => (typeof frame === 'object' && frame !== null
      ? [{
        len: (frame as { instructions?: unknown[] }).instructions?.length,
        ip: (frame as { ip?: number }).ip,
      }] : [])).slice(-6),
    window: instructions.slice(Math.max(0, ip - 8), ip + 2).map((instruction) => {
      const data = instruction.data;
      return data === undefined || data.length === 0
        ? instruction.opcode
        : `${instruction.opcode}:${binToHex(data).slice(0, 16)}`;
    }),
    // The full frame, not the last ten items: a base that lands on a neighbouring operand is only visible when
    // the compiler's tracked model (DBG-COMPUTE-BASE `stackTop`) can be aligned with the runtime stack - and the
    // operands that matter sit further down. Kept bounded by the same gate.
    stack: state.stack.slice(-40).map((item, offset, items) => (item.length <= 300
      ? `${items.length - 1 - offset}:${item.length}:${binToHex(item)}`
      : `${items.length - 1 - offset}:${item.length}:${binToHex(item.subarray(0, 8))}`
        + `..${binToHex(item.subarray(-8))}`)),
  }));
}

/** Evaluate a probe without retaining millions of irrelevant VM states under relaxed private-network limits. */
export function evaluateProbeTrace(
  provider: NetworkProvider,
  program: Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0],
  forceFullDebug = false,
): AuthenticationProgramStateCommon[] {
  const maxIn = provider.consensusLimits?.maximumInputBytes ?? 10_000;
  const debugEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (debugEnv?.SOLIDC_DEBUG_PROBE_SHAPE === '1') {
    // Every probe evaluation reports its frame shape and the emitting call site: a participant-local probe driven
    // with aggregate input coordinates is invisible otherwise.
    console.error('probe-shape', JSON.stringify({
      inputs: program.transaction.inputs.length,
      outputs: program.transaction.outputs.length,
      inputIndex: program.inputIndex,
      frames: new Error('probe-shape').stack?.split('\n').slice(2, 6)
        .map((frame) => frame.trim().replace('file:///Code/cashscript/.worktrees/kernel-beta-candidate/', '')),
    }));
  }
  // Production-sized inputs retain the faithful trace for diagnostics. Relaxed/private-network inputs always
  // use the opcode observer: libauth debug() structured-clones every intermediate state and stack, which made a
  // cold large-contract fixture spend nearly all CPU cloning and collecting a trace these derivations reduce to
  // six opcodes. SC_FORCE_FULL_PROBE_TRACE remains available for diagnosing an observer discrepancy.
  const preferFullDebug = maxIn <= 10_000
    || debugEnv?.SC_FORCE_FULL_PROBE_TRACE === '1'
    || debugEnv?.SOLIDC_DEBUG_ROUTE_CONCISE === '1'
    || debugEnv?.SOLIDC_DEBUG_ROUTE_FULL_OPS === '1';
  const probeTraceTiming = debugEnv?.SOLIDC_DEBUG_PROBE_TRACE_TIMING === '1';
  // Above ordinary capacity `debug()` is not merely slow, it deep-clones the whole OP_DEFINE'd body table at
  // every instruction. Prefer the faithful shallow recorder there; `debug()` remains the reference for ordinary
  // capacity (where it is bounded) and for the explicit diagnostic overrides.
  const useFaithfulRecorder = forceFullDebug && !preferFullDebug;
  if (debugEnv?.SOLIDC_DEBUG_TRACE_PARITY === '1' && useFaithfulRecorder) {
    const reference = cachedDebugVm(provider).debug(program) as AuthenticationProgramStateCommon[];
    const candidate = evaluateFaithfulProbeTrace(provider, program);
    logProbeTraceParity(reference, candidate);
  }
  if (preferFullDebug || forceFullDebug) {
    const debugStartedAt = probeTraceTiming ? Date.now() : 0;
    if (useFaithfulRecorder) {
      const faithful = evaluateFaithfulProbeTrace(provider, program);
      if (probeTraceTiming) console.error('probe-trace-faithful', {
        ms: Date.now() - debugStartedAt,
        states: faithful.length,
        maxIn,
        inputs: program.transaction.inputs.length,
        outputs: program.transaction.outputs.length,
      });
      return faithful;
    }
    try {
      const full = cachedDebugVm(provider)
        .debug(program) as AuthenticationProgramStateCommon[];
      if (probeTraceTiming) console.error('probe-trace-debug', {
        ms: Date.now() - debugStartedAt,
        states: full.length,
        forced: forceFullDebug,
        preferFullDebug,
        maxIn,
        inputs: program.transaction.inputs.length,
        outputs: program.transaction.outputs.length,
      });
      // Live-network pairing fix (solidcash_v0.13.1): `extractCommitmentMapFromTrace` pairs a commitment
      // read with the OP_EQUALVERIFY that FOLLOWS it and resets on any other opcode, which only holds for
      // a trace containing just the probe opcodes. A raw debug trace makes every pair look interrupted.
      if (maxIn <= 10_000 && debugEnv?.SOLIDC_DEBUG_ROUTE_CONCISE !== '1'
        && debugEnv?.SOLIDC_DEBUG_ROUTE_FULL_OPS !== '1') {
        dumpProbeTerminal(debugEnv, full.at(-1));
        dumpProbeOperands(debugEnv, full.at(-2));
        return reduceProbeTrace(full);
      }
      dumpProbeTerminal(debugEnv, full.at(-1));
      dumpProbeOperands(debugEnv, full.at(-2));
      return full;
    } catch (err) {
      // V8 arg-limit / OOM on an oversized script: fall through to the observer.
      if (maxIn <= 10_000) throw err;
    }
  }
  // Keep the sparse observer tight: output extractors treat any observed non-dispatch opcode between an
  // introspection and OP_EQUALVERIFY as breaking that pair. OP_INPUTBYTECODE is the one additional observation
  // required for deferred keccak; if it appears, it correctly breaks any pending output pair because the next
  // equality binds the side-car preimage rather than that earlier output.
  const cached = cachedProbeVm(provider);
  cached.collector.reset();
  const finalState = cached.vm.evaluate(program) as AuthenticationProgramStateCommon;
  dumpProbeTerminal(debugEnv, finalState);
  return cached.collector.finish(finalState);
}
