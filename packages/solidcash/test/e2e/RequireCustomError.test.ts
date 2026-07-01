import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// require(cond, CustomError(args)): reverts with the custom error if cond is false. On BCH the
// error is tooling metadata (no revert data); the runtime behaviour is require(cond).
// Compiled with { forceStateful: true } so each spend is the short `await sc.call.f(arg)` self-poke
// covenant (no dummy state, no manual UTXO gathering).
const SOURCE = `
contract RequireError() {
    error TooSmall(int min);
    function f(int x) {
        require(x >= 10, TooSmall(10));
    }
}
`;

async function spend(arg: bigint): Promise<unknown> {
  const sc = await deployStateful(compileString(SOURCE, { forceStateful: true }));
  return sc.call.f(arg); // thenable: the caller awaits, which sends
}

describe('require with custom error', () => {
  it('passes when the condition holds', async () => {
    await expect(spend(15n)).resolves.toBeDefined();
  });
  it('fails when the condition is false', async () => {
    await expect(spend(5n)).rejects.toThrow();
  });
});
