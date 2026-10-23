import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * An assignment to a state variable used as an expression, on the direct convention: a ternary condition, a call
 * argument, and a short-circuit operand. Each writes the state and yields the value, and the short-circuit operand
 * writes only when the short circuit reaches it. The type checker refused all three whenever the source had no
 * `++`/`--`, as the pass that turns such an assignment into a statement ran only for those.
 */

const SOURCE = `pragma solidcash ^0.14.0; contract C {
  uint n; bool z;
  function twice(uint x) internal returns (uint) { return x * 2; }
  function condition(uint e) { uint y = (z = true) ? 5 : 6; require(z); require(y == e); }
  function argument(uint v, uint e) { uint y = twice(n = v); require(y == e); require(n == v); }
  function shortAnd(bool c, uint e) { if (c && (z = true)) { n = 9; } require(n == e); }
}`;

type Calls = Record<string, (...args: unknown[]) => { send(): Promise<unknown> }> & {
  getState(): Promise<Record<string, unknown>>;
};

describe('a direct state assignment used as an expression', () => {
  it('writes the state and yields the value as a ternary condition, a call argument and a short-circuit operand',
    async () => {
      const provider = createTestProvider();
      const artifact = compileString(SOURCE);
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, contract, artifact.stateLayout!, { n: 0n, z: false }, { saltContract: true },
      );
      const calls = StatefulContract.withCategory(contract, categoryId) as unknown as Calls;
      await calls.shortAnd!(false, 0n).send();
      expect(await calls.getState()).toMatchObject({ n: 0n, z: false });
      await expect(calls.condition!(6n).send()).rejects.toThrow();
      await calls.condition!(5n).send();
      expect(await calls.getState()).toMatchObject({ n: 0n, z: true });
      await expect(calls.argument!(4n, 4n).send()).rejects.toThrow();
      await calls.argument!(4n, 8n).send();
      expect(await calls.getState()).toMatchObject({ n: 4n, z: true });
      await calls.shortAnd!(true, 9n).send();
      expect(await calls.getState()).toMatchObject({ n: 9n, z: true });
    });
});
