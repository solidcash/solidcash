import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// bytesN ordering < <= > >=: equal-width fixed bytes compare as unsigned big-endian (Solidity).
// The contract recomputes each comparison and requires it equals the expected bool, so the spend only
// succeeds if the big-endian reverse + unsigned sign-pad codegen is correct on the VM.
const SOURCE = `
contract BytesOrder() {
    function cmp(bytes4 a, bytes4 b, bool eLt, bool eLe, bool eGt, bool eGe) {
        require((a < b) == eLt);
        require((a <= b) == eLe);
        require((a > b) == eGt);
        require((a >= b) == eGe);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

const B = (...bytes: number[]): Uint8Array => Uint8Array.from(bytes);

describe('bytesN ordering', () => {
  it('orders by value (1 < 2)', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.cmp(B(0, 0, 0, 1), B(0, 0, 0, 2), true, true, false, false)).resolves.toBeDefined();
  });

  // 0x01000000 (big-endian = 16777216) > 0x00000002: proves the leftmost byte is most significant.
  it('treats the leftmost byte as most significant', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.cmp(B(1, 0, 0, 0), B(0, 0, 0, 2), false, false, true, true)).resolves.toBeDefined();
  });

  // 0x80000000 > 0x7FFFFFFF: proves the high bit is treated as magnitude (unsigned), not sign.
  it('compares as unsigned (high bit is magnitude)', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.cmp(B(0x80, 0, 0, 0), B(0x7f, 0xff, 0xff, 0xff), false, false, true, true)).resolves.toBeDefined();
  });

  it('handles equality for <= and >=', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.cmp(B(0x12, 0x34, 0x56, 0x78), B(0x12, 0x34, 0x56, 0x78), false, true, false, true))
      .resolves.toBeDefined();
  });

  it('rejects a wrong expected relation', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.cmp(B(0, 0, 0, 1), B(0, 0, 0, 2), false, true, false, false))
      .rejects.toThrow(verifyFailure);
  });
});
