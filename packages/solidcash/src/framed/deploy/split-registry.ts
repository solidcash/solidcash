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

import type { Artifact, FunctionSplitBundle } from '@solidcash/utils';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { bindBlockOracleLock, blockOracleLockFor } from '../../oracle/block-oracle-lock.js';

const REGISTRY = Symbol.for('@solidcash/function-split-registry');

function bundlesOf(provider: NetworkProvider): Map<string, FunctionSplitBundle> | undefined {
  return (provider as unknown as Record<symbol, Map<string, FunctionSplitBundle> | undefined>)[REGISTRY];
}

const normal = (categoryId: string): string => categoryId.replace(/^0x/i, '').toLowerCase();

/**
 * Binds every program of `bundle` that reads the block oracle to the provider's oracle lock, as the process that
 * minted the category bound them: a master's lock is the P2SH32 of its program with that lock in it. A process that
 * attaches a category another process deployed registers the bundle from its published JSON, whose programs no
 * genesis here bound; without this, every entry's lock it computes misses the category's masters. A program already
 * bound keeps its lock, and a provider that knows no oracle binds nothing.
 */
export function bindBundleOracle(provider: NetworkProvider, bundle: FunctionSplitBundle): void {
  const lock = provider.blockOracleLock;
  if (lock === undefined) return;
  const bind = (artifact: Artifact | undefined): void => {
    if (artifact === undefined || blockOracleLockFor(artifact) !== undefined) return;
    if ((artifact.blockOracleLockSlots?.length ?? 0) === 0 && artifact.usesBlockOracle !== true) return;
    bindBlockOracleLock(artifact, lock);
  };
  bind((bundle as { logical?: Artifact }).logical);
  for (const shard of bundle.shards) bind(shard.artifact);
  for (const cut of bundle.internalCuts ?? []) bind(cut.artifact);
}

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
  bindBundleOracle(provider, bundle);
  bundles.set(normal(categoryId), bundle);
}

/** The bundle a category was deployed from, or undefined for a monolith or a category this provider never saw. */
export function functionSplitFor(provider: NetworkProvider, categoryId: string): FunctionSplitBundle | undefined {
  const bundle = bundlesOf(provider)?.get(normal(categoryId));
  // A bundle registered before the provider learned its oracle (a devnet advertises it when it connects) binds now.
  if (bundle !== undefined) bindBundleOracle(provider, bundle);
  return bundle;
}
