import type { AbiFunction } from '@solidcash/utils';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { isPoolInfoInput, poolInfoCoSpend } from '../oracle/pool/reader.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

/** A participant of a transaction, whose entry's function-pointer targets may read the pool it binds. */
export interface PoolReaderParticipant {
  readonly abiFunction: AbiFunction | undefined;
  readonly pool: string | undefined;
  readonly name: string;
  /** The input that runs the entry, for a call group. */
  readonly master?: Pick<Utxo, 'txid' | 'vout'>;
}

/** The participant a call group runs, when it names a contract. */
export function groupPoolReader(group: ExternalCallUtxoGroup): PoolReaderParticipant[] {
  const inner = group.externalContract?.inner;
  if (inner?.artifact === undefined) return [];
  return [{
    abiFunction: group.directCall?.abiFunction
      ?? (inner.artifact.abi as readonly AbiFunction[]).find((fn) => fn.name === group.functionName),
    pool: inner.oraclePool,
    name: inner.name,
    master: group.masterUtxo,
  }];
}

/** The participants a transaction's nested and low-level calls run; a logical alias of another call runs none. */
export function calleePoolReaders(
  externalCallUtxoGroups: readonly ExternalCallUtxoGroup[], lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[],
): PoolReaderParticipant[] {
  return [
    ...externalCallUtxoGroups.filter((group) => group.sharedGroupIndex === undefined).flatMap(groupPoolReader),
    ...lowLevelCallUtxoGroups.flatMap(groupPoolReader),
  ];
}

/**
 * The block-info coins a transaction co-spends for function-pointer targets, which find them by category and flags:
 * one per pool a participant's entry reads that way (`indirectPoolReads`), unless a live info coin of that pool is
 * already placed.
 */
export async function resolveUnslottedPoolInfoCoins(
  provider: NetworkProvider, readers: readonly PoolReaderParticipant[], placed: readonly UnlockableUtxo[],
): Promise<UnlockableUtxo[]> {
  const coins: UnlockableUtxo[] = [];
  for (const reader of readers) {
    if (reader.abiFunction?.indirectPoolReads?.blockInfo !== true) continue;
    const { pool } = reader;
    if (pool === undefined) throw new Error(`${reader.name} reads the block oracle, and binds no oracle pool`);
    if ([...placed, ...coins].some((input) => isPoolInfoInput(input, pool))) continue;
    coins.push(await poolInfoCoSpend(provider, pool));
  }
  return coins;
}
