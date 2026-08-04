import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// A self-targeted EXTERNAL function pointer: `function() external f = this.g`. Solidity types it external,
// but on BCH a self external-call is a direct call to the own function, so it routes through the internal
// functionId + OP_INVOKE path. The spend only succeeds if `this.g` dispatches correctly at runtime.
const SOURCE = `
contract SelfExtPtr() {
    function g(int y) public pure returns (int) { return y * 2; }
    function check(int z) {
        function(int) external returns (int) f = this.g;
        require(f(z) == z * 2);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('self-external function pointer (this.f)', () => {
  it('routes this.g through OP_INVOKE and dispatches correctly on the VM', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.check(21n)).resolves.toBeDefined();
  });
});
