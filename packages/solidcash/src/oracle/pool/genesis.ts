import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  POOL_COIN_SATS, POOL_FLAG_SLOT, POOL_MAX_DEPTH, encodePoolBatonCommitment, encodePoolInfoCommitment,
  encodePoolSlotCommitment,
} from '@solidcash/utils';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  type AssembledPoolTransaction, type PoolBlock, type PoolBlockFields, assemblePoolTransaction, assembledUtxo,
  p2pkhLockOf, p2pkhSpend, poolLocks, poolOutput, poolOwnerOf, purseCoin,
} from './coins.js';

export interface OraclePoolOptions {
  /** Its hash is every coin's owner; it signs the pool's updates, stops, sweeps and rotations. */
  readonly ownerKey: Uint8Array;
  /** Block-info coins to mint. */
  readonly infoCoins: number;
  /** The baton's and every slot's depth, 1 to 256: the ring holds the last `ringDepth` blocks. */
  readonly ringDepth: number;
  /** Slots per ring block; 0 omits the ring. Default 1. */
  readonly slotReplicas?: number;
  /** Its P2PKH pays for the pool and takes the change. */
  readonly funder: Uint8Array;
  /** The tip's fields. A simulator supplies its own, `simulatorPoolFields` of its height and block time. */
  readonly tip?: PoolBlockFields;
  /** The hash of block n in display order. Defaults to the provider's `getBlockHash`. */
  readonly blockHash?: (n: bigint) => Promise<Uint8Array>;
}

export interface OraclePool {
  /** The pool category, display order: the funding transaction's txid. */
  readonly category: string;
  readonly fundingTxid: string;
  readonly genesisTxid: string;
}

export interface OraclePoolGenesisPlan {
  /** A token-free coin at the funder's P2PKH. */
  readonly funding: Utxo;
  readonly funder: Uint8Array;
  readonly ownerKey: Uint8Array;
  readonly infoCoins: number;
  readonly ringDepth: number;
  /** Slots minted per block of `ring`. */
  readonly slotReplicas: number;
  readonly tip: PoolBlockFields;
  /** The ring's blocks. */
  readonly ring: readonly PoolBlock[];
}

export interface OraclePoolGenesis {
  readonly category: string;
  /** The funding transaction, then the genesis that spends its vout 0. */
  readonly transactions: readonly [AssembledPoolTransaction, AssembledPoolTransaction];
}

/** A simulator's block fields: its height and time, with fixed difficulty, size, fees and coinbase. */
export function simulatorPoolFields(height: number, time: number): PoolBlockFields {
  return {
    number: BigInt(height),
    timestamp: BigInt(time),
    difficulty: 0n,
    size: 1000n,
    totalFees: 0n,
    coinbase: hexToBin(`76a914${'00'.repeat(20)}88ac`),
  };
}

function checkCount(value: number, what: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`oracle pool ${what} ${value} is not a whole number`);
}

function checkDepth(depth: number): void {
  if (!Number.isInteger(depth) || depth < 1 || depth > POOL_MAX_DEPTH) {
    throw new Error(`oracle pool ringDepth ${depth} is not an integer from 1 to ${POOL_MAX_DEPTH}`);
  }
}

/**
 * The two genesis transactions. The first moves the funding coin to vout 0 of the funder's P2PKH, which a genesis
 * needs; the second spends it, so the pool category is the first's txid. It mints, at 1,200 satoshis each, the info
 * coins at the tip's fields and flags 0x00, the ring's slots with flags 0x80, and the baton, which holds the owner
 * and the depth. The change returns to the funder.
 */
export function buildOraclePoolGenesis(plan: OraclePoolGenesisPlan): OraclePoolGenesis {
  checkCount(plan.infoCoins, 'infoCoins');
  checkCount(plan.slotReplicas, 'slotReplicas');
  checkDepth(plan.ringDepth);
  const purse = p2pkhLockOf(plan.funder);
  const funding = assemblePoolTransaction([p2pkhSpend(plan.funding, plan.funder)], [], 0, purse);
  const category = funding.txid;
  const locks = poolLocks(category);
  const owner = poolOwnerOf(plan.ownerKey);
  const info = encodePoolInfoCommitment({ ...plan.tip, flags: 0, owner });
  const slots = plan.ring.flatMap(({ n, hash }) => Array.from({ length: plan.slotReplicas }, () => (
    encodePoolSlotCommitment({ flags: POOL_FLAG_SLOT, n, hash, owner, depth: plan.ringDepth }))));
  const outputs = [
    ...Array.from({ length: plan.infoCoins }, () => poolOutput(locks.info, POOL_COIN_SATS, category, 'mutable', info)),
    ...slots.map((slot) => poolOutput(locks.slot, POOL_COIN_SATS, category, 'mutable', slot)),
    poolOutput(locks.baton, POOL_COIN_SATS, category, 'minting', encodePoolBatonCommitment({
      owner, depth: plan.ringDepth,
    })),
  ];
  const genesis = assemblePoolTransaction([p2pkhSpend(assembledUtxo(funding, 0), plan.funder)], outputs, 0, purse);
  return { category, transactions: [funding, genesis] };
}

async function simulatorTip(provider: NetworkProvider): Promise<PoolBlockFields> {
  const { getBlockTime } = provider as { getBlockTime?: () => number };
  if (provider.simulator !== true || getBlockTime === undefined) {
    throw new Error('createOraclePool needs `tip` on a live network: only a simulator supplies its own fields');
  }
  return simulatorPoolFields(await provider.getBlockHeight(), getBlockTime.call(provider));
}

function providerBlockHash(provider: NetworkProvider): (n: bigint) => Promise<Uint8Array> {
  const { getBlockHash } = provider as { getBlockHash?: (height: number) => Promise<string> };
  if (getBlockHash === undefined) throw new Error('createOraclePool needs `blockHash`: the provider has no getBlockHash');
  return async (n) => hexToBin(await getBlockHash.call(provider, Number(n)));
}

/**
 * Mints a pool by two ordinary transactions (see `buildOraclePoolGenesis`): `infoCoins` info coins at the tip's
 * fields, `slotReplicas` slots for each of the last `ringDepth` blocks, and the baton.
 */
export async function createOraclePool(provider: NetworkProvider, options: OraclePoolOptions): Promise<OraclePool> {
  const slotReplicas = options.slotReplicas ?? 1;
  checkCount(options.infoCoins, 'infoCoins');
  checkCount(slotReplicas, 'slotReplicas');
  checkDepth(options.ringDepth);
  const tip = options.tip ?? await simulatorTip(provider);
  const ring: PoolBlock[] = [];
  if (slotReplicas > 0) {
    const blockHash = options.blockHash ?? providerBlockHash(provider);
    const first = tip.number - BigInt(options.ringDepth) + 1n;
    for (let n = first < 0n ? 0n : first; n <= tip.number; n += 1n) ring.push({ n, hash: await blockHash(n) });
  }
  const funding = await purseCoin(provider, options.funder);
  const { category, transactions } = buildOraclePoolGenesis({
    funding, funder: options.funder, ownerKey: options.ownerKey, infoCoins: options.infoCoins,
    ringDepth: options.ringDepth, slotReplicas, tip, ring,
  });
  for (const transaction of transactions) await provider.sendRawTransaction(transaction.hex);
  return { category, fundingTxid: transactions[0].txid, genesisTxid: transactions[1].txid };
}
