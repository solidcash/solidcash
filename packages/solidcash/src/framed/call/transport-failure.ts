/**
 * Whether an error ends a call's search over plans.
 *
 * A call searches over plans, and a plan that throws is dropped for the next one. Two failures say nothing about the
 * plan they interrupted, so the search has to stop on them. A request that timed out or a connection that dropped never
 * reached a verdict. A node that refused a broadcast refused a plan every covenant accepted, so another plan will not
 * do better: its usual reason is that a rival spent a coin first, and the caller has to compose again. Dropping either
 * would try the call under assumptions that do not hold and report that plan's refusal, which blames a frame that never
 * runs that way, for what was a slow server or a lost race. A provider's errors have no class of their own, because they
 * come from the Electrum client as well as from this package, so they are told apart by their message. A contract's own
 * refusal is never one of them, whatever its revert string says.
 */

import { FramedCompositionRefusedError } from '../composer/refusal.js';

const TRANSPORT_FAILURE =
  /timed out|timeout|connection lost|disconnected|not connected|socket|ECONN|ETIMEDOUT|EPIPE|EAI_AGAIN/i;
const NODE_REFUSAL = /rejected by network rules/i;

export function endsPlanSearch(error: unknown): boolean {
  return error instanceof Error && !(error instanceof FramedCompositionRefusedError)
    && (TRANSPORT_FAILURE.test(error.message) || NODE_REFUSAL.test(error.message));
}
