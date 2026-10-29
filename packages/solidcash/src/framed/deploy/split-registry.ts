/**
 * The per-entry bundles a provider's framed deployments were minted from, by category.
 *
 * A deployment of a `split: 'func'` bundle runs each entry on that entry's own shard, at the shard's own lock, while
 * every frame names the contract by its category. The genesis registers the bundle here, so a frame that reaches the
 * category as a root, a callee or a read resolves the shard its selector names rather than the logical program.
 *
 * The table lives on the provider itself under a process-wide symbol, as the deployment registry's does, so a wrapper
 * that forwards property reads (the call path's simulation provider) sees the same bundles.
 */

import type { FunctionSplitBundle } from '@solidcash/utils';
import type NetworkProvider from '../../network/NetworkProvider.js';

const REGISTRY = Symbol.for('@solidcash/function-split-registry');

function bundlesOf(provider: NetworkProvider): Map<string, FunctionSplitBundle> | undefined {
  return (provider as unknown as Record<symbol, Map<string, FunctionSplitBundle> | undefined>)[REGISTRY];
}

const normal = (categoryId: string): string => categoryId.replace(/^0x/i, '').toLowerCase();

/** Records the bundle a category's genesis minted its entry pools from. */
export function registerFunctionSplit(
  provider: NetworkProvider, categoryId: string, bundle: FunctionSplitBundle,
): void {
  let bundles = bundlesOf(provider);
  if (bundles === undefined) {
    bundles = new Map();
    Object.defineProperty(provider, REGISTRY, {
      value: bundles, writable: true, enumerable: false, configurable: true,
    });
  }
  bundles.set(normal(categoryId), bundle);
}

/** The bundle a category was deployed from, or undefined for a monolith or a category this provider never saw. */
export function functionSplitFor(provider: NetworkProvider, categoryId: string): FunctionSplitBundle | undefined {
  return bundlesOf(provider)?.get(normal(categoryId));
}
