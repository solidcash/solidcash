import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// addmod(x,y,k) = (x+y)%k, mulmod(x,y,k) = (x*y)%k. The contract recomputes the result and requires
// it equals the builtin, so the spend only succeeds if both builtins are correct on the VM.
// Compiled with { forceStateful: true } so each spend is the short `await sc.check(...)` self-poke
// covenant (no dummy state, no manual UTXO gathering).
const SOURCE = `
contract AddMulMod() {
    function check(int x, int y, int k) {
        require(addmod(x, y, k) == (x + y) % k);
        require(mulmod(x, y, k) == (x * y) % k);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('addmod / mulmod', () => {
  it('computes (x+y)%k and (x*y)%k on the VM', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.check(7n, 5n, 6n)).resolves.toBeDefined();
  });
});
