/**
 * The order one call takes a deployment's pools in.
 *
 * A master, a validator, a facet and a compute side-car are each one of a pool whose UTXOs serve alike: a composition
 * spends one and recreates it in place. Only one of two transactions that spend a UTXO can be mined, so callers that all
 * take a pool's first UTXO collide however large a pool the deployment funded. Each call takes the pools in an order of
 * its own instead, so two independent calls usually spend different UTXOs. This is no lease: two calls can still draw
 * the same UTXO, and the chance falls with the pool's size.
 *
 * A UTXO keeps the rank it first drew for the whole call. A call reads a pool again each time it is planned, and the
 * proxy hop reads its pools once more to broadcast, so the same UTXOs come first every time, and a frame that takes the
 * next of a pool takes one the frames before it left.
 */

import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type { FramedDeploymentSet } from './records.js';

/** A source of numbers in `[0, 1)`, as `Math.random`. One that always answers 0 keeps a pool as listed. */
export type PoolRandom = () => number;

/** The order one call takes pools in. */
export class PoolOrder {
  private readonly ranks = new Map<string, number>();

  public constructor(private readonly random: PoolRandom) {}

  private rankOf(utxo: Pick<Utxo, 'txid' | 'vout'>): number {
    const key = `${utxo.txid}:${utxo.vout}`;
    let rank = this.ranks.get(key);
    if (rank === undefined) {
      rank = this.random();
      this.ranks.set(key, rank);
    }
    return rank;
  }

  /** `pool` in this call's order. UTXOs of one rank keep their listed order. */
  public arrange<T extends Pick<Utxo, 'txid' | 'vout'>>(pool: readonly T[]): T[] {
    return pool.map((utxo) => ({ utxo, rank: this.rankOf(utxo) }))
      .sort((left, right) => left.rank - right.rank)
      .map(({ utxo }) => utxo);
  }
}

/**
 * A new call's order on `provider`, drawn from the provider's `poolRandom`. Nothing about a pick is secret, since
 * every spent outpoint is public, so `Math.random` serves, as it does for the oracle pool's coins.
 */
export function poolOrderFor(provider: NetworkProvider): PoolOrder {
  return new PoolOrder(provider.poolRandom ?? Math.random);
}

/**
 * The UTXOs at a facet's lock that serve as that facet, in `order`. Anyone can pay the lock, so one that carries a
 * token, which the input a composition states for a facet does not, must not be drawn.
 */
export function facetPool(utxos: readonly Utxo[], order: PoolOrder): Utxo[] {
  return order.arrange(utxos.filter((utxo) => utxo.token === undefined));
}

/** `deployment` with its pools in `order`. Its records, chunks and nodes are no pools, and keep their places. */
export function inPoolOrder(deployment: FramedDeploymentSet, order: PoolOrder): FramedDeploymentSet {
  return {
    ...deployment,
    masters: order.arrange(deployment.masters),
    validators: order.arrange(deployment.validators),
    mastersByLock: new Map([...deployment.mastersByLock].map(([lock, group]) => [lock, order.arrange(group)])),
  };
}
