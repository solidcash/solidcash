import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Internal function pointer: `f` is chosen at runtime (up ? inc : dec) and called indirectly. The spend
// only succeeds if the indirect call dispatches to the correct function and returns its value, so this
// VM-verifies the `<functionId> OP_INVOKE` path (and the parseFunctionType return-type fix feeding it).
const SOURCE = `
contract FnPtr() {
    function inc(int y) internal returns (int) { return y + 1; }
    function dec(int y) internal returns (int) { return y - 1; }
    function apply(function(int) internal returns (int) f, int x) internal returns (int) { return f(x); }
    function check(int z, bool up) {
        function(int) internal returns (int) f = up ? inc : dec;
        require(f(z) == (up ? z + 1 : z - 1));
        require(apply(inc, z) == z + 1);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('internal function pointer', () => {
  it('dispatches a runtime-chosen pointer + a forwarded pointer on the VM', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.check(10n, true)).resolves.toBeDefined();
    await expect(sc.check(10n, false)).resolves.toBeDefined();
  });
});
