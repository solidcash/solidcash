import { POOL_FLAG_SLOT, type PoolInfoFields, type PoolSlotFields } from '@solidcash/utils';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { type PoolCoin, checkPoolCategory, poolInfoCoin, poolSlotCoin } from './coins.js';

/** The EVM blockhash window: a block this much older than its residue's newest reads as zero. */
export const POOL_BLOCKHASH_WINDOW = 256n;

export interface PoolSlotSelection extends PoolCoin<PoolSlotFields> {
  /** The slot holds n itself; otherwise it holds a block of n's residue at least 256 newer, so n reads as zero. */
  readonly exact: boolean;
}

async function categoryCoins(provider: NetworkProvider, category: string): Promise<Utxo[]> {
  if (provider.getUtxosByTokenCategory === undefined) {
    throw new Error('oracle pool selection needs a provider that lists UTXOs by token category');
  }
  return provider.getUtxosByTokenCategory(checkPoolCategory(category));
}

function pick<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * A random live info coin of the pool (flags 0x00), or undefined when it has none. A live coin at `prefer`, when
 * there is one, is chosen instead.
 */
export async function selectPoolInfoCoin(
  provider: NetworkProvider, category: string, prefer?: Pick<Utxo, 'txid' | 'vout'>,
): Promise<PoolCoin<PoolInfoFields> | undefined> {
  const live = (await categoryCoins(provider, category))
    .map((utxo) => poolInfoCoin(utxo, category))
    .filter((coin): coin is PoolCoin<PoolInfoFields> => coin !== undefined && coin.fields.flags === 0);
  return live.find(({ utxo }) => prefer !== undefined && utxo.vout === prefer.vout
    && utxo.txid.toLowerCase() === prefer.txid.toLowerCase()) ?? pick(live);
}

/**
 * A random live slot (flags 0x80) for block n: one holding exactly n, else one holding a block of n's residue at
 * least 256 newer (the zero case), else undefined. A coin in `exclude`, one a transaction already spends, is skipped.
 */
export async function selectPoolSlot(
  provider: NetworkProvider, category: string, n: bigint, exclude: readonly Pick<Utxo, 'txid' | 'vout'>[] = [],
): Promise<PoolSlotSelection | undefined> {
  const spent = ({ utxo }: PoolCoin<PoolSlotFields>): boolean => exclude.some(({ txid, vout }) => vout === utxo.vout
    && txid.toLowerCase() === utxo.txid.toLowerCase());
  const live = (await categoryCoins(provider, category))
    .map((utxo) => poolSlotCoin(utxo, category))
    .filter((coin): coin is PoolCoin<PoolSlotFields> => coin !== undefined && coin.fields.flags === POOL_FLAG_SLOT
      && !spent(coin));
  const exact = pick(live.filter(({ fields }) => fields.n === n));
  if (exact !== undefined) return { ...exact, exact: true };
  const zero = pick(live.filter(({ fields }) => fields.depth > 0 && fields.n >= n + POOL_BLOCKHASH_WINDOW
    && (fields.n - n) % BigInt(fields.depth) === 0n));
  return zero === undefined ? undefined : { ...zero, exact: false };
}
