/**
 * Driving the derivation from the shipped compiler's own output.
 *
 * The resumable derivation (`derivation.ts`) is written against an injected host. This module supplies the real
 * one: the stop sites come from the table the compiler published on the artifact, and each step runs the compiled,
 * placeholder-filled master program in the BCH-2026 machine against a draft transaction.
 *
 * A step does not trust the site it is handed. It runs the master first, with the site's witness still unfilled,
 * and notes where the program stopped. It then fills that witness into the draft and runs the master again. The
 * site is reported as filled only when the second run strictly advanced on the first — the program accepted, or
 * stopped further along its own instruction sequence. A fill that does not move the program is not progress, and
 * the step reports nothing, which the driver refuses as a stall.
 *
 * The design gap this host works around: the compiled master does not report an identity at each stop site. Its
 * head is emitted as one opaque program and the sites' checks carry no published instruction offsets, so a run's
 * failing state (its `ip` and error) cannot be mapped back to a published site. The host therefore takes the site
 * from the driver, which reaches them in the published order, and proves it with the two real runs rather than
 * reading it off the machine. Closing the gap needs the compiler to publish, per site, the program offset at which
 * its witness is consumed (or the program to push a site ordinal before consuming one); until then a step can
 * confirm that filling a named site is what moved the program, but cannot discover the site from the VM alone.
 *
 * How a master's input, its callees and its outputs are laid out is the composer's layout and assembly, wired to
 * this host by `draft.ts`: `createComposedDerivationHost` takes the artifacts and a plan, and produces the
 * `ShippedMasterRun`s, including each execution's starting witness block and the VM program it runs. The host
 * itself still consumes runs, which keeps it usable with a hand-built fixture; everything it derives from a run —
 * which stop site was filled, and which callee a call reaches — comes from the real compiler output and the real
 * VM, not a stand-in.
 *
 * The published `CallStopSite` holds only the call's index, so the host names a callee through the source-side
 * facts the compiler publishes beside it (interface, method, target address), resolved to a contract by the run
 * that owns the edge.
 */

import { binToHex, createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind,
  validateStopSiteMetadata,
  witnessKindOf,
  type Artifact,
  type PublishedEntryStopSites,
  type PublishedPerCallStopSites,
  type StopSite,
  type StopSiteMetadata,
  type WitnessBlock,
} from '@solidcash/utils';
import type { DerivationHost, FrameRequest, StepOutcome } from './derivation.js';

// The table a per-call artifact publishes on `artifact.composition.stopSites`.
export type { PublishedCallSite, PublishedEntryStopSites, PublishedPerCallStopSites } from '@solidcash/utils';

type VirtualMachine = ReturnType<typeof createVirtualMachineBch2026>;

/** The exact program a master runs: the transaction, its source outputs, and the input under evaluation. */
export type ShippedVmProgram = Parameters<VirtualMachine['evaluate']>[0];

/** Raised when the host is asked for something the artifact or the runs do not describe. */
export class ShippedHostError extends Error {
  public readonly name = 'ShippedHostError';

  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}

/** Reads and validates the stop-site table an artifact publishes. */
export function readPublishedStopSites(artifact: Pick<Artifact, 'composition'>): PublishedPerCallStopSites {
  const published = artifact.composition?.stopSites;
  if (published === undefined || typeof published !== 'object') {
    throw new ShippedHostError(
      'PER_CALL_HOST_STOP_SITES_UNPUBLISHED',
      'the artifact publishes no per-call stop-site table',
    );
  }
  if (published.version !== 1) {
    throw new ShippedHostError(
      'PER_CALL_HOST_STOP_SITES_VERSION',
      `unsupported stop-site table version: ${String(published.version)}`,
    );
  }
  if (!Array.isArray(published.entries)) {
    throw new ShippedHostError('PER_CALL_HOST_STOP_SITES_SHAPE', 'the stop-site table has no entries array');
  }
  for (const entry of published.entries) {
    validateStopSiteMetadata(entry.sites);
    // A call marked `repeated` is reached a number of times the source does not fix, so the table describes the
    // source's calls rather than enumerating one execution's witnesses. It is read rather than refused: a step is
    // proven by two real runs of the program, so a driver whose sequence no longer describes the execution stops
    // at the stall below rather than filling a witness the program did not ask for.
  }
  return published;
}

/**
 * One execution: the compiled program, and how to run it against a growing draft.
 *
 * `draft.ts` builds these from a plan, laying the participants out and assembling their references; a low-level
 * fixture may still hand one in directly. `initialBlock` returns the block the execution starts from — the frame
 * fields the source fixes, with the witness slots the driver will fill still unset. `programFor` places a block on
 * the execution's input and returns the VM program. `fill` writes one site's witness into the block and reports
 * the callee a call site reaches.
 */
export interface ShippedMasterRun {
  /** The master identity the driver compares; matches `FrameRequest.master`. */
  readonly master: string;
  /** The entry identity the published table keys on; matches `FrameRequest.functionName`. */
  readonly functionName: string;
  /** The compiled, placeholder-filled master program this execution runs. */
  readonly program: Uint8Array;
  /** The witness block the execution starts from. */
  initialBlock(): WitnessBlock;
  /** The VM program that evaluates this execution with `block` on its input. */
  programFor(block: WitnessBlock): ShippedVmProgram;
  /** Writes `site`'s witness into `block`, naming the callee a call site reaches. */
  fill(site: StopSite, block: WitnessBlock): { readonly callee?: FrameRequest };
}

/** What one real run of a master ended with. */
export interface ExecutionStop {
  readonly accepted: boolean;
  /** Where the run stopped, as the instruction pointer; absent when it accepted. */
  readonly ip?: number;
  /**
   * The return position of each function the run had entered when it stopped, outermost first: `ip` is a position
   * in the innermost one's instructions, so these say where in the program that function was entered from.
   */
  readonly frames?: readonly number[];
  readonly error?: string;
  /**
   * The main and alternate stacks the run stopped with, as one opaque fingerprint.
   *
   * A site one execution reaches several times is a single instruction every visit stops on, so the instruction
   * pointer cannot tell one visit from the next: what differs is how much of the block the walk had consumed. The
   * fingerprint is what the host compares for those visits.
   */
  readonly stack?: string;
}

export interface ShippedHostOptions {
  /** Every contract in the composition, whose published tables are merged into one lookup. */
  readonly artifacts: readonly Pick<Artifact, 'composition'>[];
  /** Every execution the derivation may reach, keyed by `master`. */
  readonly runs: readonly ShippedMasterRun[];
  /** The BCH-2026 machine to run masters in. Defaults to the consensus machine. */
  readonly vm?: VirtualMachine;
  /** Called after each real run, for diagnostics. */
  readonly onRun?: (master: string, site: StopSite, stop: ExecutionStop) => void;
}

/**
 * True when `after` reached further than `before`: the run accepted, or stopped further along the program.
 *
 * "Further along the program" is not always a higher instruction pointer. A site a loop reaches stops at the same
 * instruction on every visit and what moved is the block the walk had consumed; and a master that dispatches by
 * selector stops its own head at the same instruction whatever call record the run failed on, so the pointer is the
 * same for a fill that moved the run and for one that did not. In both cases the stack carries what the pointer
 * does not: the block the run consumed, or the call data the fill put there. A fill that changes nothing the
 * program read leaves both the pointer and the stack as they were, which is still not progress.
 */
function reachedFurther(before: ExecutionStop, after: ExecutionStop): boolean {
  if (after.accepted) return true;
  if ((after.ip ?? 0) > (before.ip ?? 0)) return true;
  if (enteredLater(before, after)) return true;
  return after.ip !== undefined && after.ip === before.ip
    && after.stack !== undefined && after.stack !== before.stack;
}

/**
 * True when `after` stopped inside a function the program entered later than the one `before` stopped in.
 *
 * A body's repeated spans are outlined into functions, so two stops can share one instruction pointer and one stack:
 * the same check of one function entered from two places, as the two segment closes around a call that leaves
 * nothing on the stack are. Where each function was entered from, outermost first, tells them apart.
 */
function enteredLater(before: ExecutionStop, after: ExecutionStop): boolean {
  const left = before.frames ?? [];
  const right = after.frames ?? [];
  for (let depth = 0; depth < Math.min(left.length, right.length); depth += 1) {
    if (right[depth] !== left[depth]) return right[depth]! > left[depth]!;
  }
  return false;
}

/** The VM's verdict for one program, as the host reads it. */
function runOnce(vm: VirtualMachine, program: ShippedVmProgram): ExecutionStop {
  const state = vm.evaluate(program);
  if (vm.stateSuccess(state) === true) return { accepted: true };
  const typed = state as {
    readonly ip?: number;
    readonly error?: string;
    readonly stack?: readonly Uint8Array[];
    readonly altStack?: readonly Uint8Array[];
    readonly controlStack?: readonly unknown[];
  };
  const fingerprintOf = (items: readonly Uint8Array[] | undefined): string | undefined =>
    items?.map((item) => binToHex(item)).join('|');
  const stack = typed.stack === undefined
    ? undefined
    : [fingerprintOf(typed.stack), fingerprintOf(typed.altStack)].join('#');
  // An entered function is the control-stack entry that holds the position execution returns to.
  const frames = (typed.controlStack ?? []).flatMap((entry) => (typeof entry === 'object' && entry !== null
    && typeof (entry as { readonly ip?: unknown }).ip === 'number' ? [(entry as { readonly ip: number }).ip] : []));
  return {
    accepted: false,
    ...(typed.ip === undefined ? {} : { ip: typed.ip }),
    ...(frames.length === 0 ? {} : { frames }),
    ...(typed.error === undefined ? {} : { error: String(typed.error) }),
    ...(stack === undefined ? {} : { stack }),
  };
}

/** The identity a published entry uses, matching `entryFunctionName` in the compiler's stop-site module. */
export function publishedEntryName(contract: string, entry: string): string {
  return `${contract}.${entry}()`;
}

/**
 * Builds the real derivation host: published sites for `sitesFor`, and a running master for `step`.
 *
 * The file's header explains the evidence each step uses; `reachedFurther` is where the host refuses to call a
 * fill progress when the program did not move.
 */
export function createShippedDerivationHost(options: ShippedHostOptions): DerivationHost {
  const published = options.artifacts.map(readPublishedStopSites);
  const entries = new Map<string, PublishedEntryStopSites>();
  for (const table of published) {
    for (const entry of table.entries) entries.set(entry.functionName, entry);
  }
  // The bodies the compiler refused are published beside the table. They are not derivable: their program fails
  // whenever the dispatcher reaches it, so a driver that asked for one has an answer here rather than a spend that
  // fails for a reason it cannot name.
  const refused = new Map<string, string>();
  for (const artifact of options.artifacts) {
    for (const entry of artifact.composition?.refusedEntries ?? []) refused.set(entry.functionName, entry.reason);
  }
  const runs = new Map<string, ShippedMasterRun>();
  for (const run of options.runs) {
    if (runs.has(run.master)) {
      throw new ShippedHostError('PER_CALL_HOST_DUPLICATE_RUN', `two runs share the master "${run.master}"`);
    }
    runs.set(run.master, run);
  }
  const vm = options.vm ?? createVirtualMachineBch2026(false);
  const blocks = new Map<string, WitnessBlock>();
  /**
   * Where each master's last run stopped.
   *
   * A step fills one site and nothing else moves the draft, so the state a step starts from is exactly the state
   * the previous step's run ended with. Reusing that verdict is what keeps the cost at one fresh run per site
   * rather than two: the run before a fill is only made when the master has not been run yet.
   */
  const lastStop = new Map<string, ExecutionStop>();

  const blockFor = (run: ShippedMasterRun): WitnessBlock => {
    let block = blocks.get(run.master);
    if (block === undefined) {
      block = run.initialBlock();
      blocks.set(run.master, block);
    }
    return block;
  };

  return {
    sitesFor(functionName: string): StopSiteMetadata {
      const refusal = refused.get(functionName);
      if (refusal !== undefined) {
        throw new ShippedHostError(
          'PER_CALL_HOST_ENTRY_REFUSED',
          `${functionName} is refused by the compiler: ${refusal}`,
        );
      }
      const entry = entries.get(functionName);
      if (entry === undefined) {
        throw new ShippedHostError(
          'PER_CALL_HOST_ENTRY_UNPUBLISHED',
          `no stop sites are published for "${functionName}"`,
        );
      }
      return entry.sites;
    },

    step(request: FrameRequest, site: StopSite): StepOutcome {
      const run = runs.get(request.master);
      if (run === undefined) {
        throw new ShippedHostError(
          'PER_CALL_HOST_RUN_UNKNOWN',
          `no run is registered for master "${request.master}" of ${request.functionName}`,
        );
      }
      if (run.functionName !== request.functionName) {
        throw new ShippedHostError(
          'PER_CALL_HOST_RUN_MISMATCH',
          `master "${request.master}" runs ${run.functionName}, not ${request.functionName}`,
        );
      }

      const block = blockFor(run);
      // The state before the fill: the master's previous run ended on this draft, so its verdict stands unless
      // this is the first step for the master.
      const before = lastStop.get(run.master) ?? runOnce(vm, run.programFor(block));
      options.onRun?.(run.master, site, before);
      const { callee } = run.fill(site, block);
      // The run after the fill: does the real program move?
      const after = runOnce(vm, run.programFor(block));
      lastStop.set(run.master, after);
      options.onRun?.(run.master, site, after);

      if (!reachedFurther(before, after)) return {};
      if (site.kind === 'call') {
        // A call's witness is the callee, so the draft must have been missing it: a run that already accepted
        // before the fill means the site was not what the program stopped at, and the step reports nothing.
        if (before.accepted) return {};
        if (callee === undefined) return {};
        return { filled: witnessKindOf(site), callee };
      }
      return { filled: witnessKindOf(site) };
    },
  };
}

/** The callee a published call site names, once a target address is resolved to a contract and master. */
export function publishedCallee(
  entry: PublishedEntryStopSites,
  callIndex: number,
  target: { readonly contract: string; readonly master: string },
): FrameRequest {
  const call = entry.calls.find((candidate) => candidate.callIndex === callIndex);
  if (call === undefined) {
    throw new ShippedHostError(
      'PER_CALL_HOST_CALL_UNPUBLISHED',
      `${entry.functionName} publishes no call site ${callIndex}`,
    );
  }
  return {
    contract: target.contract,
    functionName: publishedEntryName(target.contract, call.functionName),
    kind: FrameKind.CALL,
    master: target.master,
  };
}
