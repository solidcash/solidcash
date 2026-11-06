/**
 * Whether an error is the network failing rather than a plan failing.
 *
 * A call searches over plans, and a plan that throws is dropped for the next one. A request that timed out or a
 * connection that dropped says nothing about the plan it interrupted, so the search has to stop there. Dropping that
 * plan would try the call under assumptions that do not hold and report that plan's refusal, which blames a frame that
 * never runs that way for what was a slow server. A provider's errors have no class of their own, because they come
 * from the Electrum client as well as from this package, so they are told apart by their message. A contract's own
 * refusal is never one of them, whatever its revert string says.
 */

import { FramedCompositionRefusedError } from '../composer/refusal.js';

const TRANSPORT_FAILURE = /timed out|timeout|connection lost|disconnected|not connected|socket|ECONN|ETIMEDOUT|EPIPE|EAI_AGAIN/i;

export function isTransportFailure(error: unknown): boolean {
  return error instanceof Error && !(error instanceof FramedCompositionRefusedError)
    && TRANSPORT_FAILURE.test(error.message);
}
