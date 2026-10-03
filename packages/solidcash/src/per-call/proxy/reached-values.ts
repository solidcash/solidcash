/**
 * The value a mapping node holds where a later reach of a hop reads it: as the earlier reaches of the hop left it.
 *
 * Every reach is planned against the deployment, which holds each node as it was before the hop. A reach placed after
 * another that created the node (`continuedNodes`) or rewrote it (`rewrittenNodes`) reads what that reach left, and
 * the last of them when several did: a rewrite always follows the node's creation, so a rewrite is the later of the
 * two. A planner that reads the deployment's node instead states a value the body never sees: a field the later
 * write keeps comes out as it was before the hop, and a long value's run of chunk records, whose address is salted
 * with the value's own digest, is laid where the body that computes the other value finds none of its chunks.
 */

import { bytesEqual } from '@solidcash/utils';
import type { HopLiveDeployment } from './entry-writes.js';

/** One node an earlier reach of the hop left, with the bytes it left there when that reach stated them. */
interface ReachedNode {
  readonly collection: string;
  readonly slot: Uint8Array;
  readonly value?: Uint8Array;
}

/** The last of `nodes` that names the slot of `collection`, or undefined when none does. */
function lastOf(nodes: readonly ReachedNode[] | undefined, collection: string, slot: Uint8Array): ReachedNode | undefined {
  return [...(nodes ?? [])].reverse()
    .find((node) => node.collection === collection && bytesEqual(node.slot, slot));
}

/**
 * The node of `collection` at `slot` as the earlier reaches of the hop left it, or undefined when none of them wrote
 * it. A reach that wrote it without stating the bytes leaves `value` undefined: the node's value is then the body's
 * to compute, and nothing read from the deployment stands in for it.
 */
export function reachedNodeValue(
  deployment: Pick<HopLiveDeployment, 'continuedNodes' | 'rewrittenNodes'>, collection: string, slot: Uint8Array,
): { readonly value?: Uint8Array } | undefined {
  const reached = lastOf(deployment.rewrittenNodes, collection, slot) ?? lastOf(deployment.continuedNodes, collection, slot);
  return reached === undefined ? undefined : (reached.value === undefined ? {} : { value: reached.value });
}
