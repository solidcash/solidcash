import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// Compound assignment operators desugar to `x = x <op> e` and inherit the binary operator's type
// rules (arithmetic/shift on int; bitwise on bytes). Each function computes a known result and
// requires it, so the spend only succeeds if every operator behaved correctly on the VM.
const SOURCE = `
contract CompoundAssign() {
    function arith(int x) {
        int a = x;   // 10
        a += 5;      // 15
        a -= 3;      // 12
        a *= 2;      // 24
        a /= 4;      // 6
        a %= 4;      // 2
        a <<= 3;     // 16
        a >>= 1;     // 8
        require(a == 8);
    }
    function bitwise(bytes1 x) {
        bytes1 a = x;  // 0xff
        a &= 0x0f;     // 0x0f
        a |= 0x30;     // 0x3f
        a ^= 0x0f;     // 0x30
        require(a == 0x30);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('Compound assignment operators', () => {
  it('arithmetic/shift compound ops on int compute the expected result', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.arith(10n)).resolves.toBeDefined();
  });

  it('arithmetic compound ops fail when the result differs', async () => {
    // x=0 -> 5,2,4,1,1,8,4 -> a==4, not 8
    const sc = await deployStateful(artifact);
    await expect(sc.arith(0n)).rejects.toThrow();
  });

  it('bitwise compound ops on bytes compute the expected result', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.bitwise(Uint8Array.from([0xff]))).resolves.toBeDefined();
  });
});
