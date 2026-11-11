import { describe, expect, it, vi } from 'vitest';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../../src/network/NetworkProvider.js';
import {
  PoolOrder, facetPool, inPoolOrder, poolOrderFor, type FramedDeploymentSet,
} from '../../../src/framed/deploy/index.js';

/**
 * The order a call takes a deployment's pools in. A constant source keeps a pool as it was listed, and each outpoint
 * keeps its rank for the whole call, so a call that reads a pool twice takes the same UTXOs both times.
 */

const coin = (vout: number): Utxo => ({ txid: 'ab'.repeat(32), vout, satoshis: 1_200n });
const vouts = (pool: readonly Utxo[]): readonly number[] => pool.map((utxo) => utxo.vout);

/** Answers the numbers given, in turn, as a source a test can read a draw back from. */
const scripted = (...draws: readonly number[]): (() => number) => {
  const left = [...draws];
  return () => {
    const next = left.shift();
    if (next === undefined) throw new Error('the source was drawn more times than the test planned');
    return next;
  };
};

describe('a call\'s pool order', () => {
  it('keeps a pool as listed under a source that answers zero', () => {
    const pool = [coin(5), coin(1), coin(3)];
    expect(vouts(new PoolOrder(() => 0).arrange(pool))).toStrictEqual([5, 1, 3]);
  });

  it('sorts a pool by the ranks the source draws', () => {
    expect(vouts(new PoolOrder(scripted(0.9, 0.1, 0.5)).arrange([coin(0), coin(1), coin(2)])))
      .toStrictEqual([1, 2, 0]);
  });

  it('draws one rank per outpoint, so a pool read again comes back in the same order', () => {
    const order = new PoolOrder(scripted(0.9, 0.1, 0.5));
    const first = order.arrange([coin(0), coin(1), coin(2)]);
    expect(order.arrange([coin(2), coin(0), coin(1)])).toStrictEqual(first);
  });

  it('keeps the order of what remains when a pool loses a UTXO between reads', () => {
    const order = new PoolOrder(scripted(0.9, 0.1, 0.5));
    order.arrange([coin(0), coin(1), coin(2)]);
    expect(vouts(order.arrange([coin(0), coin(2)]))).toStrictEqual([2, 0]);
  });

  it('leaves the pool it is given as it was', () => {
    const pool = [coin(0), coin(1)];
    new PoolOrder(scripted(0.9, 0.1)).arrange(pool);
    expect(vouts(pool)).toStrictEqual([0, 1]);
  });

  it('takes the provider\'s source', () => {
    const provider = { poolRandom: scripted(0.9, 0.1) } as unknown as NetworkProvider;
    expect(vouts(poolOrderFor(provider).arrange([coin(0), coin(1)]))).toStrictEqual([1, 0]);
  });

  it('takes Math.random on a provider that names no source', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
    try {
      expect(vouts(poolOrderFor({} as NetworkProvider).arrange([coin(0), coin(1)]))).toStrictEqual([1, 0]);
    } finally {
      random.mockRestore();
    }
  });

  it('keeps pools as listed on the mock chain, until a test names a source', () => {
    const provider = new MockNetworkProvider();
    expect(vouts(poolOrderFor(provider).arrange([coin(2), coin(1)]))).toStrictEqual([2, 1]);
    provider.poolRandom = scripted(0.9, 0.1);
    expect(vouts(poolOrderFor(provider).arrange([coin(2), coin(1)]))).toStrictEqual([1, 2]);
  });

  it('never draws a coin that carries a token at a facet\'s lock, which anyone can pay', () => {
    const paid: Utxo = { ...coin(1), token: { category: 'cd'.repeat(32), amount: 1n } };
    expect(vouts(facetPool([coin(0), paid, coin(2)], new PoolOrder(scripted(0.9, 0.1))))).toStrictEqual([2, 0]);
  });

  it('orders a deployment\'s masters, validators and lock groups, and no other UTXO', () => {
    const masters = [coin(0), coin(1)];
    const validators = [coin(2), coin(3)];
    const records = [coin(4), coin(5)];
    const deployment: FramedDeploymentSet = {
      masters, validators, records, chunks: [], collectionNodes: [],
      nodesByCollection: new Map(), mastersByLock: new Map([['lock', masters]]),
    };
    const ordered = inPoolOrder(deployment, new PoolOrder(scripted(0.9, 0.1, 0.8, 0.2)));
    expect(vouts(ordered.masters)).toStrictEqual([1, 0]);
    expect(vouts(ordered.validators)).toStrictEqual([3, 2]);
    expect(vouts(ordered.mastersByLock.get('lock')!)).toStrictEqual([1, 0]);
    expect(ordered.records).toBe(records);
  });
});
