/**
 * The order an execution meets its frames' refusals in (spec V6).
 *
 * The validator derives the execution order depth first from the call tree: a frame's segment 0, then every frame its
 * call 0 enters, then its segment 1, and so on. A frame that refuses stops inside one segment, so the frames below a
 * call it never made are never entered, and every frame below a call it did make ran before it stopped. Of the frames
 * no refusing caller stopped above, the execution therefore meets the first in post-order: a callee before its caller,
 * and the frames of an earlier call before those of a later one.
 *
 * Whether a refusing frame made a call is read from the machine rather than from the draft. A derivation that stalls
 * at a call site has already written that call's reference, so a filled reference does not mean the frame reached the
 * call. The frame is run again with that one reference unfilled: a frame that stopped before the call stops exactly
 * where it stopped, and one that made the call stops reading the reference instead.
 */

import type { createVirtualMachineBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-vm.js';
import { FrameKind } from '@solidcash/utils';
import { UNFILLED_CALLEE_REF, type CompositionDraft } from './draft.js';

type VirtualMachine = ReturnType<typeof createVirtualMachineBch2026>;

/** Where one run of a frame stopped. */
export interface FrameStop {
  readonly ip?: number;
  readonly error?: string;
  /** The control stack, one token per entry: two stops in different functions or branches differ here. */
  readonly control: string;
}

/** The stop a refused evaluation ended at. */
export function frameStopOf(state: unknown): FrameStop {
  const typed = state as { readonly ip?: number; readonly error?: unknown; readonly controlStack?: readonly unknown[] };
  const control = (typed.controlStack ?? []).map((entry) => {
    if (typeof entry === 'boolean' || typeof entry === 'number') return String(entry);
    // An entered function is the entry that holds the position execution returns to.
    const ip = (entry as { readonly ip?: unknown } | null)?.ip;
    return typeof ip === 'number' ? `f${ip}` : '?';
  }).join(',');
  return {
    ...(typed.ip === undefined ? {} : { ip: typed.ip }),
    ...(typed.error === undefined ? {} : { error: String(typed.error) }),
    control,
  };
}

/** True when two runs stopped at the same instruction, in the same functions and branches, for the same reason. */
function sameStop(left: FrameStop, right: FrameStop): boolean {
  return left.ip === right.ip && left.error === right.error && left.control === right.control;
}

/** The call tree a draft's plan states, read from the assembled calls rather than from the references a run filled. */
export interface CallTree {
  /** The masters no other master calls, in input order. */
  readonly roots: readonly string[];
  /** Each master's callees, in the order its calls are recorded. */
  readonly calleesOf: ReadonlyMap<string, readonly string[]>;
  /** Each called master's caller and the position of the call in the caller's records. */
  readonly parentOf: ReadonlyMap<string, { readonly caller: string; readonly call: number }>;
}

/** The call tree of a draft. */
export function callTreeOf(draft: CompositionDraft): CallTree {
  const calleesOf = new Map<string, string[]>();
  const parentOf = new Map<string, { readonly caller: string; readonly call: number }>();
  for (const call of draft.assembly.calls) {
    const callees = calleesOf.get(call.from) ?? [];
    if (!parentOf.has(call.callee)) parentOf.set(call.callee, { caller: call.from, call: callees.length });
    callees.push(call.callee);
    calleesOf.set(call.from, callees);
  }
  const roots = draft.layout.participants
    .filter((placed) => placed.kind === 'master' && !parentOf.has(placed.id))
    .sort((left, right) => left.index - right.index)
    .map((placed) => placed.id);
  return { roots, calleesOf, parentOf };
}

/**
 * Each master's position in the order the execution finishes frames: a callee before its caller, and the frames of
 * an earlier call before those of a later one. A master the tree does not reach has no position.
 */
export function executionRanks(tree: CallTree): ReadonlyMap<string, number> {
  const ranks = new Map<string, number>();
  const entered = new Set<string>();
  const visit = (master: string): void => {
    if (entered.has(master)) return;
    entered.add(master);
    for (const callee of tree.calleesOf.get(master) ?? []) visit(callee);
    ranks.set(master, ranks.size);
  };
  for (const root of tree.roots) visit(root);
  return ranks;
}

/**
 * Whether a frame that refused at `stop` made its call `call`.
 *
 * A call whose reference is unfilled was not made: a frame that reached it would have stopped reading it. A filled
 * reference is checked on the machine by running the frame once more with that reference unfilled.
 */
export function frameMadeCall(
  draft: CompositionDraft,
  vm: VirtualMachine,
  master: string,
  call: number,
  stop: FrameStop,
): boolean {
  const block = draft.blockOf(master);
  const record = block.calls[call];
  if (record === undefined || record.calleeRef === UNFILLED_CALLEE_REF) return false;
  const run = draft.runs.find((candidate) => candidate.master === master);
  if (run === undefined) return true;
  const probe = {
    ...block,
    calls: block.calls.map((entry, at) => (at === call ? { ...entry, calleeRef: UNFILLED_CALLEE_REF } : entry)),
  };
  const state = vm.evaluate(run.programFor(probe));
  return vm.stateSuccess(state) === true || !sameStop(frameStopOf(state), stop);
}

/** The kinds a call record can carry, under each of which a record no callee stands behind is tried. */
const CALL_KINDS = [FrameKind.CALL, FrameKind.STATIC, FrameKind.DELEGATE, FrameKind.INTERNAL, FrameKind.CREATE];

/**
 * Whether a frame that refused at `stop` read the record of its call `call`, one no callee stands behind.
 *
 * Such a record carries no target or digest the site's own checks accept, so a frame that reaches the site stops on
 * the record before it reads the reference. The frame is run again once per call kind in the record: the site's kind
 * check passes under one of them and fails under the rest, so a frame that read the record stops differently under
 * one of them at least, and one that stopped before the site stops exactly where it stopped.
 */
export function frameReadsCallRecord(
  draft: CompositionDraft,
  vm: VirtualMachine,
  master: string,
  call: number,
  stop: FrameStop,
): boolean {
  const block = draft.blockOf(master);
  const run = draft.runs.find((candidate) => candidate.master === master);
  if (run === undefined || block.calls[call] === undefined) return true;
  return CALL_KINDS.some((kind) => {
    const probe = { ...block, calls: block.calls.map((entry, at) => (at === call ? { ...entry, kind } : entry)) };
    const state = vm.evaluate(run.programFor(probe));
    return vm.stateSuccess(state) === true || !sameStop(frameStopOf(state), stop);
  });
}
