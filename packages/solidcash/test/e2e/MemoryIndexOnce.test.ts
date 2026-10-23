import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * A memory index with a side effect runs it once on the direct convention, as Solidity evaluates an index once.
 *
 * The memory model addresses an element more than once - at both ends of a load, at the head and the tail of a store,
 * and in the index check - and evaluated the index at each, so `a[next()]` ran `next()` three times. The index is now
 * bound where the access first evaluates it and read back from the binding. Each entry checks the counter `next()`
 * steps against the value it held before the access, and the counter the contract keeps is read back after.
 */

const SOURCE = `pragma solidcash ^0.14.0; contract C {
  uint n;
  function next() internal returns (uint) { this.n = this.n + 1; return this.n - 1; }
  function readOnce(uint e) {
    uint[] memory a = new uint[](3); a[0] = 7; a[1] = 8; a[2] = 9;
    uint before = this.n; uint x = a[next()]; require(this.n == before + 1); require(x == e);
  }
  function writeOnce(uint e) {
    uint[] memory a = new uint[](3); uint before = this.n; a[next()] = e;
    require(this.n == before + 1); require(a[before] == e);
  }
  function postfixOnce(uint e) {
    uint[] memory a = new uint[](3); uint i = 1; a[i++] = e; uint x = a[i++];
    require(i == 3); require(a[1] == e); require(x == 0);
  }
  function check(uint e) { require(this.n == e); }
}`;

type Calls = Record<string, (...args: unknown[]) => { send(): Promise<unknown> }>;

describe('a direct memory index evaluated once', () => {
  it('calls a function in the index once for a read and a write, and steps a postfix index once', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { n: 0n }, { saltContract: true },
    );
    const calls = StatefulContract.withCategory(contract, categoryId) as unknown as Calls;
    await calls.readOnce!(7n).send();
    await calls.readOnce!(8n).send();
    await calls.writeOnce!(4n).send();
    await calls.postfixOnce!(6n).send();
    await expect(calls.check!(5n).send()).rejects.toThrow();
    await calls.check!(3n).send();
  });
});
