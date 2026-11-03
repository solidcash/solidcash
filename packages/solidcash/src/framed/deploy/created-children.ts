import type { Artifact, FunctionSplitBundle } from '@solidcash/utils';
import type NetworkProvider from '../../network/NetworkProvider.js';

/**
 * The artifacts a creator publishes for the children it creates (`composition.creates`).
 *
 * A creating entry's transaction mints the child's genesis, so the composer needs the child's artifact and its
 * per-entry bundle to lay out that genesis, and its initializer's body to fold into the state. A child is not
 * deployed when its creator runs, so it has no deployment registration: the project that knows the artifact
 * registers it here by contract name.
 */
export interface FramedCreatedChild {
  readonly artifact: Artifact;
  readonly split?: FunctionSplitBundle;
  /**
   * The key that updates the block oracle each creation of a child that reads block.* mints. Unset, the provider's
   * own key on a simulator or devnet; a live network names one.
   */
  readonly blockOracleOwnerPublicKey?: Uint8Array;
}

/** What a project states about a child beside its artifact. */
export interface FramedCreatedChildOptions {
  /** The key that updates the block oracle each creation of a child that reads block.* mints. */
  readonly blockOracleOwnerPublicKey?: Uint8Array;
}

const registry = new WeakMap<object, Map<string, FramedCreatedChild>>();

/** Registers the artifact a creator's `create2` names, so a call can compose the child's genesis. */
export function registerFramedCreatedChild(
  provider: NetworkProvider, contractName: string, artifact: Artifact, split?: FunctionSplitBundle,
  options: FramedCreatedChildOptions = {},
): void {
  const key = provider as unknown as object;
  // The child's masters are minted at the locks its creator checks, which are the same for every category: a child
  // that reads block.* derives its own category's oracle lock on chain, and its genesis mints that oracle.
  const byName = registry.get(key) ?? new Map<string, FramedCreatedChild>();
  byName.set(contractName, {
    artifact,
    ...(split === undefined ? {} : { split }),
    ...(options.blockOracleOwnerPublicKey === undefined
      ? {} : { blockOracleOwnerPublicKey: options.blockOracleOwnerPublicKey }),
  });
  registry.set(key, byName);
}

/** The artifact registered for a created contract, if the project registered one. */
export function framedCreatedChildOf(
  provider: NetworkProvider, contractName: string,
): FramedCreatedChild | undefined {
  return registry.get(provider as unknown as object)?.get(contractName);
}
