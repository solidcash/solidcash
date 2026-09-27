/**
 * Resumable depth-first derivation.
 *
 * A composition is derived by running each execution's program against draft witnesses, stopping at the first
 * witness it does not have, filling that witness, and resuming from the same stop site. A call site hands the
 * driver the callee, which the driver derives fully before the caller resumes, so a callee always completes first.
 *
 * The driver never restarts an execution: its cursor only moves forward, so the number of program runs is bounded
 * by the number of published stop sites. Progress is filling a witness — a read's record commitment, a call
 * result, or a segment's records. A step that fills none is refused, not retried.
 */

import {
  type FrameKindValue,
  type StopSite,
  type StopSiteMetadata,
  type StopSiteWitnessKind,
  nextStopSite,
  validateStopSiteMetadata,
  witnessKindOf,
} from '@solidcash/utils';
import { derivationStalled } from './refusals.js';

/** One execution's place in the derivation. */
export interface FrameRequest {
  /** The contract that owns the master this execution runs on. */
  readonly contract: string;
  readonly functionName: string;
  /** How the execution was entered: `ROOT` for a user's entry, otherwise a call kind. */
  readonly kind: FrameKindValue;
  /** Compiler-authored identity of the master the caller assigned. The driver only compares it. */
  readonly master: string;
}

/**
 * What one resumed run did, reported by the injected step.
 *
 * A run resumes from the execution's current stop site, fills that site's witness and stops at the next missing
 * one. At a call site the witness to fill is the call result, which the driver cannot supply until the callee is
 * derived: the run names the callee and the driver derives it fully before the execution resumes.
 */
export interface StepOutcome {
  /** The witness this run filled. A run that fills none is refused rather than retried. */
  readonly filled?: StopSiteWitnessKind;
  /** The callee to derive fully before this execution resumes. Present at a call site. */
  readonly callee?: FrameRequest;
}

/** One resumed run as the driver requested it. */
export interface DerivationRun {
  readonly frame: FrameRequest;
  readonly site: StopSite;
}

/** The outcome of deriving one root, or every root of a composition. */
export interface DerivationResult {
  /** Every resumed run, in the order it was requested. A callee's runs sit between its caller's. */
  readonly runs: readonly DerivationRun[];
  /** Every execution that reached its end, in the order it completed: callee before caller. */
  readonly completed: readonly FrameRequest[];
}

/** The program-execution side of derivation, injected so the driver holds no VM dependency. */
export interface DerivationHost {
  /** The published stop sites of a function. Validated before the function is derived. */
  sitesFor(functionName: string): StopSiteMetadata;
  /** One resumed run of a function's program, stopping at `site`. */
  step(request: FrameRequest, site: StopSite): StepOutcome;
}

/** Derives one execution and everything it calls, depth-first, refusing a step that fills no witness. */
export function deriveDepthFirst(root: FrameRequest, host: DerivationHost): DerivationResult {
  const runs: DerivationRun[] = [];
  const completed: FrameRequest[] = [];
  deriveExecution(root, host, runs, completed);
  return { runs, completed };
}

function deriveExecution(
  request: FrameRequest,
  host: DerivationHost,
  runs: DerivationRun[],
  completed: FrameRequest[],
): void {
  const metadata = host.sitesFor(request.functionName);
  validateStopSiteMetadata(metadata);

  let ordinal = -1;
  for (;;) {
    const site = nextStopSite(metadata, ordinal);
    if (site === undefined) break;

    // One run per site. The step must fill this site's witness; a step that fills nothing is the stall refusal.
    runs.push({ frame: request, site });
    const outcome = host.step(request, site);
    if (outcome.filled !== witnessKindOf(site)) {
      // A site whose call the source does not fix may have nothing to fill on this path: the arm that ran names
      // another call at the same position, and this site's own record is one the execution never made. The program
      // is what answered that — the step ran it and it did not advance — so the site is stepped over rather than
      // read as a stall. Every other unfilled site is still a stall.
      if (site.kind === 'call' && site.conditional === true) {
        ordinal = site.site;
        continue;
      }
      throw derivationStalled(request, site);
    }

    if (site.kind === 'call') {
      // The call result is the callee's return value, so the callee is derived before this execution resumes.
      if (outcome.callee === undefined) throw derivationStalled(request, site);
      deriveExecution(outcome.callee, host, runs, completed);
    }

    ordinal = site.site;
  }

  completed.push(request);
}
