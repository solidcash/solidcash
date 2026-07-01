import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import type { EventLog } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// ethers-v6 events facade over SolidCash NFT-commitment events: queryFilter / filters / getEvent / on / once.
const SRC = `pragma solidcash >=0.8.0;
contract EventEmitter() {
  event Transfer(bigint indexed from, bigint indexed to, bigint amount);
  bigint counter;
  function fire(bigint f, bigint t, bigint amt) {
    emit Transfer(f, t, amt);
    this.counter = this.counter + 1;
  }
}`;

describe('StatefulContract events facade (ethers queryFilter / filters / getEvent)', () => {
  const art = compileString(SRC);

  async function deploy(): Promise<{ sc: StatefulContract; }> {
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    return { sc: new StatefulContract(categoryId, art, provider) };
  }

  it('queryFilter(name) returns decoded EventLogs', async () => {
    const { sc } = await deploy();
    await sc.fire(1n, 2n, 100n).send();
    const logs = await sc.queryFilter('Transfer');
    expect(logs).toHaveLength(1);
    expect(logs[0].eventName).toBe('Transfer');
    expect(logs[0].eventSignature).toBe('Transfer(bigint,bigint,bigint)');
    expect(logs[0].args).toEqual({ from: 1n, to: 2n, amount: 100n });
    expect(logs[0].txid).toBeDefined();
  });

  it('getEvent(name) is a callable handle with metadata', async () => {
    const { sc } = await deploy();
    const ev = sc.getEvent('Transfer');
    expect(ev.eventName).toBe('Transfer');
    expect(ev.signature).toBe('Transfer(bigint,bigint,bigint)');
    // Uncalled handle -> queryFilter with no filter.
    expect(sc.filters.Transfer).toBeDefined();
    expect(sc.filters.Nope).toBeUndefined();
  });

  it('filters.Event(indexedArgs) filters by indexed params (null = wildcard)', async () => {
    const { sc } = await deploy();
    await sc.fire(1n, 2n, 100n).send();
    await sc.fire(9n, 2n, 200n).send();

    // Filter by the first indexed param `from`.
    const fromOne = await sc.queryFilter(sc.filters.Transfer(1n));
    expect(fromOne.map((l) => l.args.amount)).toEqual([100n]);

    // Wildcard `from`, filter the second indexed param `to`.
    const toTwo = await sc.queryFilter(sc.filters.Transfer(null, 2n));
    expect(toTwo.map((l) => l.args.amount).sort()).toEqual([100n, 200n]);

    // Too many indexed args throws.
    expect(() => sc.filters.Transfer(1n, 2n, 3n, 4n)).toThrow(/indexed parameter/);
  });

  it('queryFilter("*") returns events across all definitions', async () => {
    const { sc } = await deploy();
    await sc.fire(1n, 2n, 100n).send();
    const all = await sc.queryFilter('*');
    expect(all).toHaveLength(1);
    expect(all[0].eventName).toBe('Transfer');
  });
});

describe('StatefulContract event listeners (ethers on / once / off)', () => {
  const art = compileString(SRC);

  async function deploy(): Promise<{ sc: StatefulContract; }> {
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    return { sc: new StatefulContract(categoryId, art, provider) };
  }

  it('on() fires for events that appear after subscribing (driven by a manual poll)', async () => {
    const { sc } = await deploy();
    const seen: EventLog[] = [];
    await sc.on('Transfer', (log) => seen.push(log));
    expect(await sc.listenerCount('Transfer')).toBe(1);

    await sc.fire(7n, 8n, 300n).send();
    await (sc as unknown as { _pollEvents(): Promise<void> })._pollEvents();

    expect(seen).toHaveLength(1);
    expect(seen[0].args).toEqual({ from: 7n, to: 8n, amount: 300n });
  });

  it('once() fires a single time then unsubscribes', async () => {
    const { sc } = await deploy();
    const seen: EventLog[] = [];
    await sc.once('Transfer', (log) => seen.push(log));

    await sc.fire(1n, 1n, 1n).send();
    await (sc as unknown as { _pollEvents(): Promise<void> })._pollEvents();
    await sc.fire(2n, 2n, 2n).send();
    await (sc as unknown as { _pollEvents(): Promise<void> })._pollEvents();

    expect(seen).toHaveLength(1); // only the first
    expect(await sc.listenerCount('Transfer')).toBe(0);
  });

  it('off() / removeAllListeners() stop delivery', async () => {
    const { sc } = await deploy();
    const seen: EventLog[] = [];
    const cb = (log: EventLog): void => { seen.push(log); };
    await sc.on('Transfer', cb);
    await sc.off('Transfer', cb);
    expect(await sc.listenerCount('Transfer')).toBe(0);

    await sc.fire(1n, 2n, 3n).send();
    await (sc as unknown as { _pollEvents(): Promise<void> })._pollEvents();
    expect(seen).toHaveLength(0);
  });
});
