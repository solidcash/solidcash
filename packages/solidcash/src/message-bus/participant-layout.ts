import type { FunctionBlockLayout } from '@solidcash/utils';

/**
 * Reserved `lowLevelCall` slot index for the implementation which executes a delegated message-bus route.
 * Source-level low-level calls use non-negative call-site indices, so the executor identity cannot be confused
 * with a handler-owned call slot when a route publishes both kinds.
 */
export const MESSAGE_BUS_DELEGATE_EXECUTOR_SLOT = -1;

export interface MessageBusParticipantLayout {
  blockLayout: FunctionBlockLayout;
  executorOffset?: number;
}

/**
 * Extend a compiler-published route with SDK-owned physical identities.
 *
 * The compiler-authenticated route block remains an unchanged prefix. A delegated route's implementation
 * executor occupies the first slot after that prefix, and logical-identity anchors follow it. Keeping this one
 * construction shared by atomic and nested composition prevents either builder from embedding the executor in
 * a route entry/resource slot or confusing it with a source-level low-level call.
 */
export function messageBusParticipantLayout(
  layout: FunctionBlockLayout,
  options: { delegated: boolean; identityAnchorCount?: number },
): MessageBusParticipantLayout {
  const identityAnchorCount = options.identityAnchorCount ?? 0;
  if (!Number.isSafeInteger(identityAnchorCount) || identityAnchorCount < 0) {
    throw new Error('messageBus: identity anchor count must be a non-negative integer');
  }

  const executorOffset = options.delegated ? layout.blockSize : undefined;
  const executorSlots = executorOffset === undefined ? [] : [{
    kind: 'lowLevelCall' as const,
    offset: executorOffset,
    slotIndex: MESSAGE_BUS_DELEGATE_EXECUTOR_SLOT,
  }];
  const identityBase = layout.blockSize + executorSlots.length;
  const identitySlots = Array.from({ length: identityAnchorCount }, (_unused, index) => ({
    kind: 'identityAnchor' as const,
    offset: identityBase + index,
  }));
  const added = executorSlots.length + identitySlots.length;

  return {
    blockLayout: added === 0 ? layout : {
      ...layout,
      blockSize: layout.blockSize + added,
      slots: [...layout.slots, ...executorSlots, ...identitySlots],
      fixedSuffix: (layout.fixedSuffix ?? 0) + added,
    },
    ...(executorOffset !== undefined && { executorOffset }),
  };
}
