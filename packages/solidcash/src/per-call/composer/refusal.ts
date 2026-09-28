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
 * error's arguments but does not evaluate them (there is no revert-data channel on BCH), and publishes only the
 * error's name in the debug message and the error's declared argument list on `artifact.errors`. So the report
 * names the error and its declared parameters; the values passed at the revert site are not on chain and cannot be
 * recovered from the machine.
 *
 * The debug metadata is written before a per-call master's head is emitted in front of the body, so its pointers
 * are offset from the shipped program by the head's own length. The offset is exactly the difference between the
 * source map's entry count and the program's instruction count, so it is read from the artifact rather than
 * assumed: without it an objection's instruction pointer lands on an unrelated instruction.
 */

import { createVirtualMachineBch2026, decodeAuthenticationInstructions } from '@bitauth/libauth';
import { sourceMapToLocationData, type Artifact, type ErrorDefinitionAbi } from '@solidcash/utils';
import type { CompositionDraft } from './draft.js';

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
}

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
}

/** One line naming a refused frame and its reason, for an error message. */
export function describeInnermost(frame: RefusedFrame | undefined): string {
  if (frame === undefined) return 'the machine refused no frame';
  const reason = frame.reason.error !== undefined
    ? `revert ${frame.reason.error.name}(${frame.reason.error.parameters?.map((p) => p.type).join(', ') ?? '...'})`
    : frame.reason.message ?? 'no source message';
  const line = frame.reason.line === undefined ? '' : ` at line ${frame.reason.line}`;
  return `frame "${frame.master}" of ${frame.functionName}${line}: ${reason} (${frame.objection})`;
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

/**
 * The reason a frame's program refused, read from the frame's artifact and the machine's failing instruction.
 *
 * The failing instruction pointer is shifted by the head's offset first, so it indexes the artifact's debug
 * metadata rather than the shipped program. A recorded `require` at that pointer gives the source line and the
 * compiler's message; a message that names a custom error is resolved against the artifact's error ABI. When
 * nothing is recorded there, the source map alone gives the line.
 */
export function frameRevertReason(
  artifact: Artifact | undefined,
  program: Uint8Array,
  ip: number | undefined,
): FrameRevertReason {
  if (artifact?.debug === undefined || ip === undefined) return {};
  const debugIndex = ip + debugSkew(artifact, program);
  const requirements = artifact.debug.requires ?? [];
  // libauth reports the state at the instruction that follows a failed operation for some opcodes and on the
  // failing instruction for others, so both neighbours are tried rather than assuming one.
  const matched = requirements.find((entry) => entry.ip === debugIndex)
    ?? requirements.find((entry) => entry.ip === debugIndex - 1);

  const locations = sourceMapToLocationData(artifact.debug.sourceMap);
  const line = matched?.line ?? locations[debugIndex]?.location?.start.line;
  const message = matched?.message;
  const error = message === undefined ? undefined : declaredError(artifact, message);
  return {
    ...(line === undefined ? {} : { line }),
    ...(message === undefined ? {} : { message }),
    ...(error === undefined ? {} : { error }),
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

export interface CompositionRefusalOptions {
  readonly draft: CompositionDraft;
  /** Every contract in the composition, whose error ABIs and debug metadata the reasons are read from. */
  readonly artifacts: readonly Artifact[];
  /** The machine to evaluate the frames on. Defaults to the consensus BCH-2026 machine. */
  readonly vm?: VirtualMachine;
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
    const typed = state as { readonly ip?: number; readonly error?: unknown };
    const run = draft.runs.find((candidate) => candidate.master === placed.id);
    const artifact = artifacts.find((candidate) => candidate.contractName === placed.contract);
    refusals.push({
      master: placed.id,
      contract: placed.contract,
      functionName: run?.functionName ?? placed.contract,
      index: placed.index,
      depth: depths.get(placed.id) ?? 0,
      objection: typed.error === undefined ? 'the machine refused without a reason' : String(typed.error),
      reason: frameRevertReason(artifact, run?.program ?? new Uint8Array(0), typed.ip),
    });
  }

  let innermost: RefusedFrame | undefined;
  for (const refusal of refusals) {
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
