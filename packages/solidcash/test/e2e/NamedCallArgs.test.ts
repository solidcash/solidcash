import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// Named call args f({b:.., a:..}) reorder to the function's declared parameter order. sub is
// non-commutative, so a wrong binding would compute the wrong result and fail the require.
// Compiled with { forceStateful: true } so the spend is the short `await sc.call.check(x, y)`.
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

async function spend(x: bigint, y: bigint): Promise<unknown> {
  const sc = await deployStateful(compileString(SOURCE, { forceStateful: true }));
  return sc.call.check(x, y); // thenable: the caller awaits, which sends
}

describe('Named call arguments', () => {
  it('binds named args to the right parameters regardless of source order', async () => {
    await expect(spend(10n, 3n)).resolves.toBeDefined();
  });
});
