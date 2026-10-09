/**
 * Process-global mock-network reset hooks.
 *
 * The hook registry is intentionally isolated from `MockNetworkProvider.js` so the stateful builder and genesis
 * reservations can register reset hooks without importing the whole mock provider (and its `@mem-cash/*` and HD
 * signer dependencies) into the eager stateful graph.
 */

const mockNetworkResetHooks: Array<() => void> = [];

/** Register a hook that must drop process-global, chain-derived caches when the mock chain is wiped or rewound. */
export function onMockNetworkProviderReset(hook: () => void): void {
  mockNetworkResetHooks.push(hook);
}

/** Fire every registered hook (called by `MockNetworkProvider` when it resets or rewinds). */
export function runMockNetworkProviderResetHooks(): void {
  for (const hook of mockNetworkResetHooks) hook();
}
