import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Named call args f({b:.., a:..}) reorder to the function's declared parameter order. sub is
// non-commutative, so a wrong binding would compute the wrong result and fail the require.
// Compiled with { forceStateful: true } so the spend is the short `await sc.check(x, y)`.
const SOURCE = `
contract NamedArgs() {
    function check(int x, int y) {
        require(sub({b: y, a: x}) == x - y);
    }
    function sub(int a, int b) internal returns (int) {
        return a - b;
    }
}
`;

const artifact = compileString(SOURCE, { forceStateful: true });

describe('Named call arguments', () => {
  it('binds named args to the right parameters regardless of source order', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.check(10n, 3n)).resolves.toBeDefined();
  });
});
