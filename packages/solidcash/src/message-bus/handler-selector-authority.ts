/**
 * Shared selector-authority module for message-bus handler / ABI joins.
 *
 * `resolveMessageBusHandler` / `resolveMessageBusAbiFunction` (message-bus.ts) and
 * `findMessageBusHandlerForInvocation` / `findMessageBusHandlerByNameOrSelector`
 * (graph-handler-join.ts) both funnel kernel selector matching through this module
 * so dual resolvers cannot drift.
 */

import type { Artifact } from '@solidcash/utils';

export type MessageBusPublishedHandler = NonNullable<
  NonNullable<Artifact['messageBus']>['handlers']
>[number];

export const normalizeMessageBusFunctionSelector = (
  selector: string,
): string | undefined => {
  const normalized = selector.startsWith('0x') || selector.startsWith('0X')
    ? selector.slice(2)
    : selector;
  return /^[0-9a-fA-F]{8}$/.test(normalized) ? normalized.toLowerCase() : undefined;
};

const requireNormalizedSelector = (selector: string): string => {
  const normalized = normalizeMessageBusFunctionSelector(selector);
  if (normalized === undefined) {
    throw new Error(
      `messageBus: function selector '${selector}' must be exactly four hexadecimal bytes`,
    );
  }
  return normalized;
};

const handlersOf = (artifact: Artifact): MessageBusPublishedHandler[] => (
  artifact.messageBus?.handlers ?? []
);

/**
 * Kernel selector-only handler join. Returns undefined on miss; throws on ambiguity.
 */
export function findKernelHandlerBySelector(
  artifact: Artifact,
  selector: string,
): MessageBusPublishedHandler | undefined {
  const normalized = requireNormalizedSelector(selector);
  const bySelector = handlersOf(artifact).filter(
    (handler) => handler.selector.toLowerCase() === normalized,
  );
  if (bySelector.length === 1) return bySelector[0];
  if (bySelector.length === 0) return undefined;
  throw new Error(
    `messageBus: kernel handler join ambiguous for selector ${normalized} `
    + `in '${artifact.contractName}'`
    + (bySelector.some((handler) => handler.name)
      ? ` (${bySelector.map((handler) => handler.name).join(',')})`
      : ''),
  );
}

/**
 * Resolve a published handler for a graph invocation.
 * Kernel: selector is authority. Legacy: name+selector then name-only.
 */
export function resolvePublishedHandlerForInvocation(
  artifact: Artifact,
  invocation: { function: string; selectorHex: string },
): MessageBusPublishedHandler | undefined {
  if (artifact.messageBus?.convention === 'kernel-row-loop') {
    return findKernelHandlerBySelector(artifact, invocation.selectorHex);
  }
  const selector = invocation.selectorHex.toLowerCase();
  const handlers = handlersOf(artifact);
  return handlers.find((handler) => (
    handler.name === invocation.function
    && handler.selector.toLowerCase() === selector
  )) ?? handlers.find((handler) => handler.name === invocation.function);
}

/**
 * Resolve a handler by optional selector + diagnostic name.
 * Kernel with a selector uses selector-only; kernel without selector fails closed.
 */
export function resolvePublishedHandlerByNameOrSelector(
  artifact: Artifact,
  params: { name: string; selector?: string },
): MessageBusPublishedHandler | undefined {
  const convention = artifact.messageBus?.convention;
  if (params.selector !== undefined && params.selector.length > 0) {
    if (convention === 'kernel-row-loop') {
      return findKernelHandlerBySelector(artifact, params.selector);
    }
    const selector = requireNormalizedSelector(params.selector);
    const bySelector = handlersOf(artifact).filter(
      (handler) => handler.selector.toLowerCase() === selector,
    );
    return bySelector.find((handler) => handler.name === params.name) ?? bySelector[0];
  }
  if (convention === 'kernel-row-loop') {
    throw new Error(
      `messageBus: kernel handler join requires selector (name '${params.name}' is diagnostic only)`,
    );
  }
  return handlersOf(artifact).find((handler) => handler.name === params.name);
}

/**
 * Kernel selector-only ABI join. Throws on miss or ambiguity (matches resolveMessageBusAbiFunction).
 */
export function findKernelAbiFunctionBySelector(
  artifact: Artifact,
  selector: string,
): Artifact['abi'][number] {
  const normalized = requireNormalizedSelector(selector);
  const bySelector = artifact.abi.filter(
    (candidate) => candidate.selector?.toLowerCase() === normalized,
  );
  if (bySelector.length === 1) return bySelector[0];
  if (bySelector.length === 0) {
    throw new Error(
      `messageBus: selector ${normalized} does not identify an ABI function `
      + `in '${artifact.contractName}'`,
    );
  }
  throw new Error(
    `messageBus: kernel ABI join ambiguous for selector ${normalized} `
    + `in '${artifact.contractName}'`,
  );
}
