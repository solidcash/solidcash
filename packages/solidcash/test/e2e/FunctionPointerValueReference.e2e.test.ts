import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// A side-effect-free single-return helper carrying EXTERNAL function-pointer parameters, referenced only as a
// function-pointer VALUE (`... p = m;`) and invoked THROUGH that pointer. The foreign-fn-ptr return inliner used
// to drop the helper because it classified it as a call-site candidate, even though there was no call site - the
// pointer then had nothing to resolve to. The spend only succeeds if `m` survives and the pointer dispatch runs.
const SOURCE = `
contract ExtPtrValue() {
    function m(
        function() external returns (int) a,
        function() external returns (int) b
    ) internal returns (function() external returns (int)) {
        return a;
    }

    function foo() public pure returns (int) { return 6; }

    function check(int expected) {
        function(
            function() external returns (int),
            function() external returns (int)
        ) internal returns (function() external returns (int)) p = m;
        require(p(this.foo, this.foo)() == expected);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('value-referenced fn-ptr helper with external fn-ptr params', () => {
  it('keeps the helper and dispatches through the pointer on the VM', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.check(6n)).resolves.toBeDefined();
  });
});
