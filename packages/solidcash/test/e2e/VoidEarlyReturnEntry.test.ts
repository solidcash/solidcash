import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// A bare `return;` (void early exit) in an ENTRY-POINT function: EarlyReturnTransformation nests the rest into
// an else branch and codegen emits the tail `return;` as a no-op (previously entry-point void returns were
// rejected outright). VM-verifies the guard's control flow is sound - the early path skips the branch body and
// spends, the taken path runs it. Mirrors the enumerable-mapping `remove` guard (`if (!inserted[key]) return;`).
const SOURCE = `
contract C {
    mapping(uint256 => uint256) m;
    function put(uint256 k, uint256 v) external { m[k] = v; require(true); }
    function readIf(uint256 k, uint256 ev, bool doit) external { if (!doit) { return; } require(m[k] == ev); }
}
`;

describe('void early return in an entry-point function', () => {
  const artifact = compileString(SOURCE, { forceStateful: true });

  it('the early-return guard skips the branch body; the taken path runs it', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await sc.put(1n, 5n).send();
    await expect(sc.readIf(1n, 99n, false).send()).resolves.toBeDefined(); // guard hit: check skipped, spends
    await expect(sc.readIf(1n, 5n, true)).resolves.toBeDefined();          // taken: m[1] == 5 holds
    await expect(sc.readIf(1n, 99n, true).send()).rejects.toThrow(verifyFailure);
  });
});
