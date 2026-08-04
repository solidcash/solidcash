/* eslint-disable max-len -- decoded-access fixture remains readable as one source declaration */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Typechain/ethers .toObject()/.toArray() parity on values the SDK hands back to the caller. Attached at the
// user-facing boundary (getState / event args / receipt.events) - NOT in the shared decoder, so the internal
// state-derivation path never sees these non-enumerable accessors.
const SRC = `pragma solidcash >=0.8.0;
contract SS() {
  struct Pair { bigint x; bigint y; }
  Pair p;
  bigint[] xs;
  function set(bigint a, bigint b) { this.p = Pair(a, b); this.xs.push(a); }
}`;

describe('getState() attaches typechain .toObject()/.toArray()', () => {
  it('struct + array state values carry non-enumerable accessors', async () => {
    const art = compileString(SRC);
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, { p: { x: 0n, y: 0n }, xs: [] }, { saltContract: true },
    );
    const sc = new StatefulContract(categoryId, art, provider);
    await sc.set(5n, 7n).send();
    const state = await sc.getState();
    // struct state var -> toObject()
    expect(typeof (state.p as { toObject?: unknown }).toObject).toBe('function');
    expect((state.p as { toObject: () => unknown }).toObject()).toEqual({ x: 5n, y: 7n });
    expect(Object.keys(state.p as object)).toEqual(['x', 'y']); // accessor is non-enumerable
    // array state var -> toArray()
    expect(typeof (state.xs as { toArray?: unknown }).toArray).toBe('function');
    expect((state.xs as { toArray: () => unknown }).toArray()).toEqual([5n]);
  });
});

// Struct/array params in event args (receipt.events + queryFilter) also carry the accessors.
const EVENT_SRC = `pragma solidcash >=0.8.0;
contract E() {
  struct Pt { bigint x; bigint y; }
  bigint n;
  event Moved(Pt indexed who, bigint amt);
  function fire(bigint a, bigint b, bigint amt) { emit Moved(Pt(a, b), amt); this.n = this.n + 1; }
}`;

describe('event args attach accessors to struct params (receipt.events + queryFilter)', () => {
  it('receipt.events[i].args.<struct>.toObject() and queryFilter parity', async () => {
    const art = compileString(EVENT_SRC);
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, { n: 0n }, { saltContract: true },
    );
    const sc = new StatefulContract(categoryId, art, provider) as unknown as {
      fire: (a: bigint, b: bigint, amt: bigint) => { send: () => Promise<{ wait: () => Promise<{ events: Array<{ args: Record<string, { toObject: () => unknown } & Record<string, bigint>> }> }> }> };
      queryFilter: (name: string) => Promise<Array<{ args: Record<string, { toObject: () => unknown }> }>>;
    };
    const receipt = await (await sc.fire(3n, 4n, 99n).send()).wait();
    const rArgs = receipt.events[0].args;
    expect(typeof rArgs.who.toObject).toBe('function');
    expect(rArgs.who.toObject()).toEqual({ x: 3n, y: 4n });
    expect(rArgs.amt as unknown as bigint).toBe(99n);
    const logs = await sc.queryFilter('Moved');
    expect(typeof logs[0].args.who.toObject).toBe('function');
    expect(logs[0].args.who.toObject()).toEqual({ x: 3n, y: 4n });
  });
});
