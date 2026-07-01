import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// Named returns desugar to default-initialized locals + `return <names>;`. compute() assigns named
// returns then bare-returns; zero() never assigns its named return (defaults to 0).
const SOURCE = `
contract NamedReturns() {
    function check(int a, int b) {
        (int s, int p) = compute(a, b);
        require(s == a + b && p == a * b);
    }
    function defaultReturn() {
        require(zero() == 0);
    }
    function compute(int x, int y) internal returns (int sum, int prod) {
        sum = x + y;
        prod = x * y;
        return;
    }
    function zero() internal returns (int z) {
        return;
    }
}
`;

async function spend(fn: string, ...args: bigint[]): Promise<unknown> {
  const sc = await deployStateful(compileString(SOURCE, { forceStateful: true }));
  return sc.call[fn](...args); // thenable: the caller awaits, which sends
}

describe('Named return values', () => {
  it('binds assigned named returns correctly', async () => {
    await expect(spend('check', 3n, 4n)).resolves.toBeDefined();
  });
  it('defaults an unassigned named return to 0', async () => {
    await expect(spend('defaultReturn')).resolves.toBeDefined();
  });
});
