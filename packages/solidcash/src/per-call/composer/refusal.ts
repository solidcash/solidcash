/**
 * The reason a refused composition was refused, attributed to the innermost frame that refused.
 *
 * The machine runs one program per frame, so a composition that is refused reports a per-input objection. That
 * objection is a bare operation failure — `Program failed an OP_VERIFY operation.` — and names neither the frame
 * nor the source construct that failed. This module turns the objection back into the frame's own reason: which
 * frame refused, and, from the artifact's debug metadata, the source line, the compiler's message for the failing
 * `require`, or the custom error a `revert` named.
 *
 * A source `revert <Error>(...)` is emitted as an unconditional `OP_0 OP_VERIFY`: the compiler type-checks the
 * error's arguments but does not evaluate them (there is no revert-data channel on BCH). It publishes the error's
 * name in the debug message, its declared argument list on `artifact.errors`, and where each argument sits when the
 * revert fails: a variable's place on the stack, a literal's bytes, and a cast's own conversion. The report reads
 * the values from the failing state, and names only the declared parameters of an argument it cannot place.
 *
 * The debug metadata is written before a per-call master's head is emitted in front of the body, so its pointers
 * are offset from the shipped program by the head's own length. The offset is exactly the difference between the
 * source map's entry count and the program's instruction count, so it is read from the artifact rather than
 * assumed: without it an objection's instruction pointer lands on an unrelated instruction.
 */

import {
  binToHex, binToUtf8, createVirtualMachineBch2026, decodeAuthenticationInstructions, encodeDataPush, hexToBin,
  vmNumberToBigInt,
} from '@bitauth/libauth';
import {
  FrameKind, sourceMapToLocationData, type Artifact, type ErrorDefinitionAbi, type RequireStatement,
  type RevertArgumentSource,
} from '@solidcash/utils';
import { UNFILLED_CALLEE_REF, type CompositionDraft } from './draft.js';

type VirtualMachine = ReturnType<typeof createVirtualMachineBch2026>;

/** A custom error the source declared, as the artifact publishes it. */
export interface DeclaredRevertError {
  readonly name: string;
  /** The declared argument list, by name and type. Absent when the name is overloaded. */
  readonly parameters?: ErrorDefinitionAbi['parameters'];
  /** Every signature the artifact declares under this name, so an overloaded name is reported as ambiguous. */
  readonly signatures: readonly string[];
}

/** What a failing frame's own source said, when it can be told from the published metadata. */
export interface FrameRevertReason {
  /** The source line of the failing site. */
  readonly line?: number;
  /** The compiler's message for the failing site: a `require`'s message, or `revert <Error>(...)`. */
  readonly message?: string;
  /** The custom error a `revert` named, with its declared argument list. */
  readonly error?: DeclaredRevertError;
  /** The values the `revert` named, in declared order, when every one of them could be read. */
  readonly arguments?: readonly RevertArgumentValue[];
}

/** A decoded argument: an integer, a boolean, a string, or other bytes as `0x`-prefixed hex. */
export type RevertArgumentValue = bigint | boolean | string;

/** One frame the machine refused. */
export interface RefusedFrame {
  readonly master: string;
  readonly contract: string;
  readonly functionName: string;
  /** The input index the frame's program was evaluated at. */
  readonly index: number;
  /** Distance from a frame no other frame entered: a root is `0`, its callee `1`, and so on. */
  readonly depth: number;
  /** The machine's own objection, verbatim. */
  readonly objection: string;
  /**
   * The instruction the machine's program counter had reached when the frame refused, when it reported one.
   *
   * It is the pointer the source reason is read at, so a caller that wants to see the failing site itself - the
   * emitted code, or the operation the reason's own message does not name - reads it rather than the source line.
   */
  readonly ip?: number;
  readonly reason: FrameRevertReason;
}

/** A composition's frame refusals, with the innermost one named. */
export interface CompositionRefusal {
  readonly accepted: boolean;
  /** Every frame whose program the machine refused, in input order. */
  readonly refusals: readonly RefusedFrame[];
  /** The deepest refusing frame: a callee's reason is what bubbles up through its callers. */
  readonly innermost?: RefusedFrame;
}

/** Raised for a refused composition, carrying the report a caller reads the innermost reason from. */
export class PerCallCompositionRefusedError extends Error {
  public readonly name = 'PerCallCompositionRefusedError';

  public constructor(public readonly report: CompositionRefusal) {
    super(`PER_CALL_COMPOSITION_REFUSED: ${describeInnermost(report.innermost)}`);
  }

  /** The innermost frame's custom error arguments, as a Solidity-style matcher reads them. */
  public get errorArgs(): readonly RevertArgumentValue[] | undefined {
    return this.report.innermost?.reason.arguments;
  }
}

/** The source reason a frame's refusal carries: the error a `revert` named, or a `require`'s message. */
export function describeFrameReason(reason: FrameRevertReason): string | undefined {
  if (reason.error !== undefined) {
    const declared = reason.error.parameters?.map((parameter) => parameter.type).join(', ') ?? '...';
    return `revert ${reason.error.name}(${declared})`;
  }
  return reason.message;
}

/** One line naming a refused frame, its site and its own reason, with the machine's objection. */
export function describeRefusedFrame(frame: RefusedFrame): string {
  const reason = describeFrameReason(frame.reason) ?? 'no source message';
  const line = frame.reason.line === undefined ? '' : ` at line ${frame.reason.line}`;
  return `frame "${frame.master}" of ${frame.functionName}${line}: ${reason} (${frame.objection})`;
}

/** One line naming a refused frame and its reason, for an error message. */
export function describeInnermost(frame: RefusedFrame | undefined): string {
  return frame === undefined ? 'the machine refused no frame' : describeRefusedFrame(frame);
}

/** The offset a per-call master's debug pointers carry relative to the shipped program. */
function debugSkew(artifact: Artifact, program: Uint8Array): number {
  const sourceMap = artifact.debug?.sourceMap;
  if (sourceMap === undefined || sourceMap.length === 0) return 0;
  const entries = sourceMap.split(';').length;
  const instructions = decodeAuthenticationInstructions(program).length;
  // Only a shorter program is a head the debug metadata does not carry; a program with as many instructions as
  // the map has entries is already described one-to-one.
  return Math.max(0, entries - instructions);
}

/** The custom error a `revert <Error>(...)` message names, resolved against the artifact's error ABI. */
function declaredError(artifact: Artifact, message: string): DeclaredRevertError | undefined {
  const match = /^revert\s+([A-Za-z_$][\w$]*)\s*\(/.exec(message);
  if (match === null) return undefined;
  const name = match[1]!;
  const declared = (artifact.errors ?? []).filter((entry) => entry.name === name);
  const only = declared.length === 1 ? declared[0] : undefined;
  return {
    name,
    ...(only === undefined ? {} : { parameters: only.parameters }),
    signatures: declared.map((entry) => entry.signature),
  };
}

/** Runs a published conversion over one stack item, on the machine itself, and returns what it leaves on top. */
function convert(item: Uint8Array, conversion: Uint8Array): Uint8Array | undefined {
  const vm = createVirtualMachineBch2026(false);
  const state = vm.evaluate({
    inputIndex: 0,
    sourceOutputs: [{ lockingBytecode: conversion, valueSatoshis: 1_000n }],
    transaction: {
      version: 2, locktime: 0,
      inputs: [{
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0,
        unlockingBytecode: encodeDataPush(item),
      }],
      outputs: [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000n }],
    },
  }) as { readonly stack?: readonly Uint8Array[]; readonly error?: unknown };
  return state.error === undefined ? state.stack?.at(-1) : undefined;
}

/** One argument's value, decoded the way its declared type reads a stack item. */
function decodeArgument(item: Uint8Array, type: string): RevertArgumentValue | undefined {
  if (/^u?int\d*$/.test(type)) {
    const value = vmNumberToBigInt(item, { requireMinimalEncoding: false });
    return typeof value === 'bigint' ? value : undefined;
  }
  if (type === 'bool') return item.some((byte) => byte !== 0);
  if (type === 'string') return binToUtf8(item);
  return `0x${binToHex(item)}`;
}

/**
 * The values a failing `revert` named, from the places the compiler published and the failing state's stack.
 *
 * All or nothing: an argument the compiler could not place, or a declaration the error ABI does not resolve, leaves
 * the values unreported rather than reporting some of them.
 */
function revertArguments(
  sources: readonly RevertArgumentSource[] | undefined,
  parameters: ErrorDefinitionAbi['parameters'] | undefined,
  stack: readonly Uint8Array[] | undefined,
): RevertArgumentValue[] | undefined {
  if (sources === undefined || parameters === undefined || sources.length !== parameters.length) return undefined;
  const values: RevertArgumentValue[] = [];
  for (const [index, source] of sources.entries()) {
    let item = source.depth !== undefined
      ? stack?.[stack.length - 1 - source.depth]
      : source.push !== undefined ? hexToBin(source.push) : undefined;
    if (item !== undefined && source.then !== undefined) item = convert(item, hexToBin(source.then));
    const value = item === undefined ? undefined : decodeArgument(item, parameters[index]!.type);
    if (value === undefined) return undefined;
    values.push(value);
  }
  return values;
}

/** The requirement recorded at `index`, or at the instruction before it, which libauth reports for some opcodes. */
function requirementAt(
  requirements: readonly RequireStatement[],
  index: number,
): RequireStatement | undefined {
  // libauth reports the state at the instruction that follows a failed operation for some opcodes and on the
  // failing instruction for others, so both neighbours are tried rather than assuming one.
  return requirements.find((entry) => entry.ip === index) ?? requirements.find((entry) => entry.ip === index - 1);
}

/** The selector the published entry identity names, so its own debug metadata can be looked up. */
function entrySelector(artifact: Artifact, functionName: string | undefined): string | undefined {
  if (functionName === undefined) return undefined;
  return artifact.abi.find((entry) => entry.name === functionName
    || `${artifact.contractName}.${entry.name}()` === functionName)?.selector;
}

/**
 * The reason a frame's program refused, read from the frame's artifact and the machine's failing instruction.
 *
 * A dispatched entry's body runs through `OP_INVOKE`, which reports its failing pointer relative to the invoked
 * body rather than the whole program, and the compiler publishes that body's own `requires` and source map under
 * `debug.functionDebug`, keyed by the entry's selector. An entry compiled inline publishes its `requires` on the
 * artifact instead, with pointers offset from the shipped program by the emitted head's own length. Both are read,
 * so a refusal names the entry's own message. A recorded `require` at the failing pointer gives the source line and
 * the compiler's message; a message that names a custom error is resolved against the artifact's error ABI. When
 * nothing is recorded there, the source map that indexes the pointer gives the line.
 */
export function frameRevertReason(
  artifact: Artifact | undefined,
  program: Uint8Array,
  ip: number | undefined,
  functionName?: string,
  stack?: readonly Uint8Array[],
): FrameRevertReason {
  if (artifact?.debug === undefined || ip === undefined) return {};
  const selector = entrySelector(artifact, functionName);
  const body = selector === undefined ? undefined : artifact.debug.functionDebug?.[selector];
  const debugIndex = ip + debugSkew(artifact, program);

  // A body's requirements index the raw pointer; the artifact's index the pointer shifted by the emitted head.
  const matched = (body === undefined ? undefined : requirementAt(body.requires, ip))
    ?? requirementAt(artifact.debug.requires ?? [], debugIndex);

  // Prefer the source map that indexes whichever pointer the reason was read at. A dispatched body always indexes
  // the raw pointer, whether or not a requirement matched there.
  const inBody = body !== undefined;
  const sourceMap = inBody ? body.sourceMap : artifact.debug.sourceMap;
  const line = matched?.line ?? sourceMapToLocationData(sourceMap)[inBody ? ip : debugIndex]?.location?.start.line;
  const message = matched?.message;
  const error = message === undefined ? undefined : declaredError(artifact, message);
  const values = revertArguments(matched?.arguments, error?.parameters, stack);
  return {
    ...(line === undefined ? {} : { line }),
    ...(message === undefined ? {} : { message }),
    ...(error === undefined ? {} : { error }),
    ...(values === undefined ? {} : { arguments: values }),
  };
}

/**
 * Every master's distance from a root, read from the assembled caller references.
 *
 * A frame's witness block names its caller's input, so a frame whose caller is another master of the composition
 * is one deeper than that master; a frame whose caller is outside the participants (a user's signed input, or the
 * reserved "no caller" value) is a root.
 */
function frameDepths(draft: CompositionDraft): ReadonlyMap<string, number> {
  const masterIds = new Set(
    draft.layout.participants.filter((participant) => participant.kind === 'master').map((p) => p.id),
  );
  const idByIndex = new Map(draft.layout.participants.map((participant) => [participant.index, participant.id]));
  const depths = new Map<string, number>();
  const depthOf = (id: string, seen: ReadonlySet<string>): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    const caller = idByIndex.get(draft.blockOf(id).callerRef);
    const depth = caller !== undefined && masterIds.has(caller) && caller !== id
      ? depthOf(caller, new Set([...seen, id])) + 1
      : 0;
    depths.set(id, depth);
    return depth;
  };
  for (const id of masterIds) depthOf(id, new Set());
  return depths;
}

/**
 * Whether a frame refused only on a call reference the derivation never filled: a frame the execution did not reach
 * fails reading it as an input index, not on a reason of its own source.
 */
function readsUnfilledReference(draft: CompositionDraft, refusal: RefusedFrame): boolean {
  return refusal.objection.includes('invalid transaction input index')
    && holdsUnfilledReference(draft, refusal.master);
}

/** Whether a frame holds a call reference the derivation never filled. */
function holdsUnfilledReference(draft: CompositionDraft, master: string): boolean {
  return draft.blockOf(master).calls.some((call) => call.calleeRef === UNFILLED_CALLEE_REF);
}

/**
 * Whether a refusal is attributed to a source construct the artifact published: a `require`'s message or a named
 * custom error. An internal verification failure (an unstated write or return candidate) carries neither.
 */
function namesSourceReason(reason: FrameRevertReason): boolean {
  return reason.message !== undefined || reason.error !== undefined;
}

/** Every master's caller, when that caller is another master of the composition. */
function frameCallers(draft: CompositionDraft): ReadonlyMap<string, string> {
  const masterIds = new Set(
    draft.layout.participants.filter((participant) => participant.kind === 'master').map((p) => p.id),
  );
  const idByIndex = new Map(draft.layout.participants.map((participant) => [participant.index, participant.id]));
  const callers = new Map<string, string>();
  for (const id of masterIds) {
    const caller = idByIndex.get(draft.blockOf(id).callerRef);
    if (caller !== undefined && caller !== id && masterIds.has(caller)) callers.set(id, caller);
  }
  return callers;
}

/**
 * Whether every call on a frame's path from a root was bound, so the frame's program is one the execution reached.
 *
 * A frame below a call the derivation never filled is not on the executed path: its caller stopped reading that
 * reference rather than entering it. The reference is checked on the caller's own call, not on the frame itself,
 * because a frame the execution did enter can also hold unfilled references of its own, and those do not make it
 * unreached - whether it reached *its* callees is what its own refusal is read for.
 */
function reachedThroughCalls(
  draft: CompositionDraft,
  callers: ReadonlyMap<string, string>,
  master: string,
): boolean {
  const idByIndex = new Map(draft.layout.participants.map((participant) => [participant.index, participant.id]));
  let child = master;
  let caller = callers.get(child);
  while (caller !== undefined) {
    // A delegate frame is entered by the proxy whose fallback forwards to it, a structural edge the derivation
    // does not bind: an unfilled reference into it does not mean the frame went unentered. Every other frame is
    // entered by a call, and only a filled reference means the caller reached it rather than stopping on the read.
    if (draft.blockOf(child).kind !== FrameKind.DELEGATE) {
      const call = draft.blockOf(caller).calls.find((candidate) => candidate.calleeRef !== UNFILLED_CALLEE_REF
        && idByIndex.get(candidate.calleeRef) === child);
      if (call === undefined) return false;
    }
    child = caller;
    caller = callers.get(caller);
  }
  return true;
}

export interface CompositionRefusalOptions {
  readonly draft: CompositionDraft;
  /** Every contract in the composition, whose error ABIs and debug metadata the reasons are read from. */
  readonly artifacts: readonly Artifact[];
  /** The machine to evaluate the frames on. Defaults to the consensus BCH-2026 machine. */
  readonly vm?: VirtualMachine;
  /**
   * Masters the caller itself evaluated, whose own refusals are candidates even when the reference into them is not
   * yet bound.
   *
   * A settle evaluates one frame of a draft whose caller may not be derived yet, so the reference into that frame
   * is still unfilled even though the frame's program ran. Naming it keeps it a candidate for the innermost reason;
   * the frames below a call the caller never reached are still excluded by their own unfilled references, and a
   * reached frame that names a source reason still outranks it.
   */
  readonly reached?: readonly string[];
}

/**
 * Asks the machine for a verdict on every frame of a draft and reports the refusals, innermost first.
 *
 * Only frames are reported: a validator or a record input is not a frame and does not carry a source reason, so a
 * refusal there is left to the caller. The frames are evaluated on the draft as it stands, so a composition whose
 * derivation stalled before it could complete still reports the frame whose program refused.
 */
export function reportCompositionRefusal(options: CompositionRefusalOptions): CompositionRefusal {
  const { draft, artifacts } = options;
  const vm = options.vm ?? createVirtualMachineBch2026(false);
  const masters = draft.layout.participants.filter((participant) => participant.kind === 'master');
  if (masters.length === 0) return { accepted: true, refusals: [] };

  // Every frame shares one transaction and one source-output set, so the first frame's program supplies them.
  const shared = draft.programFor(masters[0]!.id);
  const depths = frameDepths(draft);
  const refusals: RefusedFrame[] = [];
  for (const placed of masters) {
    const state = vm.evaluate({
      inputIndex: placed.index, sourceOutputs: shared.sourceOutputs, transaction: shared.transaction,
    });
    if (vm.stateSuccess(state) === true) continue;
    const typed = state as { readonly ip?: number; readonly error?: unknown; readonly stack?: readonly Uint8Array[] };
    const run = draft.runs.find((candidate) => candidate.master === placed.id);
    const artifact = artifacts.find((candidate) => candidate.contractName === placed.contract);
    refusals.push({
      master: placed.id,
      contract: placed.contract,
      functionName: run?.functionName ?? placed.contract,
      index: placed.index,
      depth: depths.get(placed.id) ?? 0,
      objection: typed.error === undefined ? 'the machine refused without a reason' : String(typed.error),
      ...(typed.ip === undefined ? {} : { ip: typed.ip }),
      reason: frameRevertReason(
        artifact, run?.program ?? new Uint8Array(0), typed.ip, run?.functionName, typed.stack,
      ),
    });
  }

  const callers = frameCallers(draft);
  const seeded = new Set(options.reached ?? []);
  // The entry's own check the execution fails before it reaches a call is a reason of its own, and it outranks a
  // callee the caller probed: the caller stopped on its own check, so it never entered the callee the settle ran.
  // A frame whose path is not bound is therefore a candidate only when a reached ancestor did not refuse at a
  // source reason; when none did, the caller simply was not derived (the stopped-plan case the seed exists for),
  // and the frame stands.
  const refusedSourceAncestor = (master: string): boolean => {
    let caller = callers.get(master);
    while (caller !== undefined) {
      const refusal = refusals.find((candidate) => candidate.master === caller);
      if (refusal !== undefined && namesSourceReason(refusal.reason)) return true;
      caller = callers.get(caller);
    }
    return false;
  };
  // A frame is reached when every call on its path from a root was bound, when it did not merely stop reading an
  // unfilled reference of its own, or when the caller evaluated it directly. A frame the execution never entered can
  // still refuse - its own inputs are not the execution's - so it is not a candidate for the innermost reason. A
  // frame the settle probed can name that reason even when its path is not yet bound, unless the frame its caller
  // stopped at refused at a source reason first. The deepest reached frame is the one whose refusal the execution
  // actually met; only when no frame was reached is a refusal read without that check.
  const reached = refusals.filter((refusal) => {
    if (readsUnfilledReference(draft, refusal)) return false;
    if (reachedThroughCalls(draft, callers, refusal.master)) return true;
    return (seeded.has(refusal.master) || namesSourceReason(refusal.reason))
      && !refusedSourceAncestor(refusal.master);
  });
  const pool = (() => {
    const named = reached.filter((refusal) => namesSourceReason(refusal.reason));
    if (named.length > 0) return named;
    return reached.length > 0 ? reached : refusals;
  })();
  let innermost: RefusedFrame | undefined;
  for (const refusal of pool) {
    if (innermost === undefined || refusal.depth > innermost.depth) innermost = refusal;
  }
  return { accepted: refusals.length === 0, refusals, ...(innermost === undefined ? {} : { innermost }) };
}

/** Reports a refused composition as an error, so a caller that only wants the reason can throw it. */
export function assertCompositionAccepted(options: CompositionRefusalOptions): CompositionRefusal {
  const report = reportCompositionRefusal(options);
  if (!report.accepted) throw new PerCallCompositionRefusedError(report);
  return report;
}
