import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
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
