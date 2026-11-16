/**
 * The block clock a builder states beside a contract's state when it plans that contract's calls. The compiler
 * publishes `block.number` and `block.timestamp` as `state:__block_number` and `state:__block_timestamp`; a root call
 * states both from its pool coin (`recipeState`), and so must every frame that plans a called contract's calls.
 */

import type { Artifact, StateValue } from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';
import { artifactOraclePool, readPoolClock } from '../oracle/pool/reader.js';

/** Whether a compiler-published value reads the block clock. */
export function readsBlockClock(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const { kind, name } = value as { kind?: unknown; name?: unknown };
  if (kind === 'state' && (name === '__block_number' || name === '__block_timestamp')) return true;
  return Object.values(value).some((child) => readsBlockClock(child, seen));
}

/**
 * The pool whose info coin a run of `artifact`'s code slices: the pool the executing contract binds, else the one the
 * artifact was last bound to, as the nested-callee block takes its info coin.
 */
export function executingOraclePool(
  executor: { oraclePool?: string } | undefined, artifact: Artifact,
): string | undefined {
  return executor?.oraclePool ?? artifactOraclePool(artifact);
}

/**
 * The clock a run of `artifact`'s code reads, from the info coin of `pool` the transaction co-spends for it. Empty
 * when `reads` reads neither field, or the code reads no block.
 */
export async function blockClockState(
  provider: NetworkProvider, artifact: Artifact, pool: string | undefined, reads: unknown,
): Promise<Record<string, StateValue>> {
  if (artifact.usesBlockOracle !== true || pool === undefined || !readsBlockClock(reads)) return {};
  const { number, timestamp } = await readPoolClock(provider, pool);
  return { __block_number: number, __block_timestamp: timestamp };
}
