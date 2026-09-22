/**
 * F5″: kernel graph joins resolve handlers by published selector (stable id).
 * Name is diagnostic / legacy-only.
 */

import type { Artifact } from '@solidcash/utils';

export type MessageBusPublishedHandler = NonNullable<
  NonNullable<Artifact['messageBus']>['handlers']
>[number];

/**
 * Resolve a published message-bus handler for a graph invocation.
 * Kernel (`kernel-row-loop`): selector is authority; name is ignored for matching.
 * Legacy: name+selector (then name-only) fallback.
 */
export function findMessageBusHandlerForInvocation(
  artifact: Artifact,
  invocation: { function: string; selectorHex: string },
): MessageBusPublishedHandler | undefined {
  const handlers = artifact.messageBus?.handlers ?? [];
  const selector = invocation.selectorHex.toLowerCase();
  const bySelector = handlers.filter((handler) => handler.selector.toLowerCase() === selector);
  if (artifact.messageBus?.convention === 'kernel-row-loop') {
    if (bySelector.length === 1) return bySelector[0];
    if (bySelector.length === 0) return undefined;
    throw new Error(
      `messageBus: kernel handler join ambiguous for selector ${selector} `
      + `(${bySelector.map((handler) => handler.name).join(',')})`,
    );
  }
  return handlers.find((handler) => (
    handler.name === invocation.function
    && handler.selector.toLowerCase() === selector
  )) ?? handlers.find((handler) => handler.name === invocation.function);
}

/**
 * Resolve a handler by optional selector + diagnostic name.
 * Kernel with a selector uses selector-only; kernel without selector fails closed.
 */
export function findMessageBusHandlerByNameOrSelector(
  artifact: Artifact,
  params: { name: string; selector?: string },
): MessageBusPublishedHandler | undefined {
  const handlers = artifact.messageBus?.handlers ?? [];
  const convention = artifact.messageBus?.convention;
  if (params.selector !== undefined && params.selector.length > 0) {
    const selector = params.selector.toLowerCase();
    const bySelector = handlers.filter((handler) => handler.selector.toLowerCase() === selector);
    if (convention === 'kernel-row-loop') {
      if (bySelector.length === 1) return bySelector[0];
      if (bySelector.length === 0) return undefined;
      throw new Error(
        `messageBus: kernel handler join ambiguous for selector ${selector}`,
      );
    }
    return bySelector.find((handler) => handler.name === params.name) ?? bySelector[0];
  }
  if (convention === 'kernel-row-loop') {
    throw new Error(
      `messageBus: kernel handler join requires selector (name '${params.name}' is diagnostic only)`,
    );
  }
  return handlers.find((handler) => handler.name === params.name);
}
