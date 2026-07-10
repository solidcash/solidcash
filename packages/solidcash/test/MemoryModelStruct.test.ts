import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// EXPERIMENTAL memory model (P5a): a value-field `struct memory` is a pointer to a block of 32-byte field words.
// A field write `s.f = v` (which desugars to `s = S(s.f0, v, s.f2)`) becomes an in-place store, so multiple
// field writes compose. Uninitialized structs are zero. require()s are VM gates.
const SOURCE = `
contract C() {
    int counter;
    struct P { uint a; uint b; uint c; }
    function compose() {
        P memory s = P(1, 2, 3);
        s.a = 5;
        s.b = 9;
        s.a = 7;
        require(s.a == 7);
        require(s.b == 9);
        require(s.c == 3);
        this.counter = 1;
    }
    function uninitialized() {
        P memory s;
        require(s.a == 0);
        require(s.b == 0);
        s.a = 4;
        require(s.a == 4);
        require(s.b == 0);
        this.counter = 2;
    }
    function namedFieldsReordered() {
        P memory s = P({c: 30, a: 10, b: 20});
        require(s.a == 10);
        require(s.b == 20);
        require(s.c == 30);
        this.counter = 5;
    }
    function swap() {
        P memory s = P(10, 20, 30);
        s = P(s.b, s.a, s.c);
        require(s.a == 20);
        require(s.b == 10);
        require(s.c == 30);
        this.counter = 3;
    }
    function aliasing() {
        P memory a = P(1, 2, 3);
        P memory b = a;
        b.a = 5;
        require(a.a == 5);
        require(b.b == 2);
        this.counter = 4;
    }
}`;

describe('experimental memory model: value-field struct memory', () => {
  const opts = {};
  const run = async (
    method: 'compose' | 'uninitialized' | 'swap' | 'namedFieldsReordered' | 'aliasing',
  ): Promise<void> => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, opts);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc[method]().send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  };

  it('composes multiple in-place field writes', async () => { await run('compose'); });
  it('zero-initializes an uninitialized struct', async () => { await run('uninitialized'); });
  it('handles a self-referential rebuild (field swap) via read-all-then-store', async () => { await run('swap'); });
  it('stores named-field construction to the right slots (reordered)', async () => { await run('namedFieldsReordered'); });
  it('shares the buffer on a struct alias (b = a; b.f = v mutates a)', async () => { await run('aliasing'); });
});
