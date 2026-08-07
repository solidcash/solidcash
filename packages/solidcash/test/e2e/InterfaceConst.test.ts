import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// `IERC20 constant U = IERC20(0)` (BentoBoxV1's USE_ETHEREUM sentinel): the parser emits a FunctionCall for the
// user-type cast, which folds to the zero-address handle. The covenant requires the constant equals IERC20(0),
// so the spend only validates if the interface-typed constant folds to a usable value on the VM.
const SOURCE = `
interface IERC20 { function transfer(address to, uint256 v) external returns (bool); }
contract InterfaceConst() {
    IERC20 constant USE_ETHEREUM = IERC20(0);
    function check(int x) {
        require(x == 42);
        require(USE_ETHEREUM == IERC20(0));
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('interface-typed constant folds to a usable value (IERC20(0))', () => {
  it('compiles IERC20(0) to a constant handle usable on the VM', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.check(42n)).resolves.toBeDefined();
  });
});
