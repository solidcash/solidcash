import type { AbiFunction, Artifact } from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { indirectPoolReads, isPoolInfoInput, poolInfoCoSpend } from '../oracle/pool/reader.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

/** A participant of a transaction, whose entry's function-pointer targets may read the pool it binds. */
export interface PoolReaderParticipant {
  readonly artifact: Artifact;
  readonly abiFunction: AbiFunction | undefined;
  readonly pool: string | undefined;
  readonly name: string;
}

/** The participant a call group runs. */
export function groupPoolReader(group: ExternalCallUtxoGroup): PoolReaderParticipant {
  const { inner } = group.externalContract;
  return {
    artifact: inner.artifact,
    abiFunction: group.compilerRoute?.abiFunction
      ?? (inner.artifact.abi as readonly AbiFunction[]).find((fn) => fn.name === group.functionName),
    pool: inner.oraclePool,
    name: inner.name,
  };
}

/**
 * The block-info coins a transaction co-spends for function-pointer targets, which find them by category and flags:
 * one per pool a participant reads that way, unless a live info coin of that pool is already placed.
 */
export async function resolveUnslottedPoolInfoCoins(
  provider: NetworkProvider, readers: readonly PoolReaderParticipant[], placed: readonly UnlockableUtxo[],
): Promise<UnlockableUtxo[]> {
  const coins: UnlockableUtxo[] = [];
  for (const reader of readers) {
    if (!indirectPoolReads(reader.artifact, reader.abiFunction).blockInfo) continue;
    const { pool } = reader;
    if (pool === undefined) throw new Error(`${reader.name} reads the block oracle, and binds no oracle pool`);
    if ([...placed, ...coins].some((input) => isPoolInfoInput(input, pool))) continue;
    coins.push(await poolInfoCoSpend(provider, pool));
  }
  return coins;
}
