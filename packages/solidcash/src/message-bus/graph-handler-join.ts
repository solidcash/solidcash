/**
 * Selector-first graph handler join: kernel graph joins resolve handlers by published selector (stable id).
 * Name is diagnostic / legacy-only.
 *
 * Implementation lives in `handler-selector-authority.ts` so `resolveMessageBusHandler`
 * and these find* helpers cannot drift.
 */

import type { Artifact } from '@solidcash/utils';
import {
  resolvePublishedHandlerByNameOrSelector,
  resolvePublishedHandlerForInvocation,
  type MessageBusPublishedHandler,
} from './handler-selector-authority.js';

export type { MessageBusPublishedHandler };

/**
 * Resolve a published message-bus handler for a graph invocation.
 * Kernel (`kernel-row-loop`): selector is authority; name is ignored for matching.
 * Legacy: name+selector (then name-only) fallback.
 */
export function findMessageBusHandlerForInvocation(
  artifact: Artifact,
  invocation: { function: string; selectorHex: string },
): MessageBusPublishedHandler | undefined {
  return resolvePublishedHandlerForInvocation(artifact, invocation);
}

/**
 * Resolve a handler by optional selector + diagnostic name.
 * Kernel with a selector uses selector-only; kernel without selector fails closed.
 */
export function findMessageBusHandlerByNameOrSelector(
  artifact: Artifact,
  params: { name: string; selector?: string },
): MessageBusPublishedHandler | undefined {
  return resolvePublishedHandlerByNameOrSelector(artifact, params);
}
