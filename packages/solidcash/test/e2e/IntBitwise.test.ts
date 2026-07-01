import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// Integer bitwise & | ^ ~ on fixed-width ints. The contract recomputes each op and requires it equals
// the expected value passed in, so the spend only succeeds if the sign-magnitude <-> two's-complement
// codegen is correct on the VM (incl. negative signed operands).
// Compiled with { forceStateful: true } so each spend is the short `sc.<fn>(args)` self-poke covenant.
const SOURCE = `
contract IntBitwise() {
    function checkUnsigned(uint8 a, uint8 b, uint8 eAnd, uint8 eOr, uint8 eXor, uint8 eNot) {
        require((a & b) == eAnd);
        require((a | b) == eOr);
        require((a ^ b) == eXor);
        require((~a) == eNot);
    }
    function checkSigned(int8 a, int8 b, int8 eAnd, int8 eOr, int8 eXor, int8 eNot) {
        require((a & b) == eAnd);
        require((a | b) == eOr);
        require((a ^ b) == eXor);
        require((~a) == eNot);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('integer bitwise', () => {
  // a=0xCC, b=0xAA -> and=0x88, or=0xEE, xor=0x66, ~a=0x33
  it('unsigned & | ^ ~ on uint8', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.checkUnsigned(204n, 170n, 136n, 238n, 102n, 51n)).resolves.toBeDefined();
  });

  // a=-2 (0xFE), b=3 (0x03) -> and=2, or=-1, xor=-3, ~a=1
  it('signed & | ^ ~ on int8 with negatives', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.checkSigned(-2n, 3n, 2n, -1n, -3n, 1n)).resolves.toBeDefined();
  });

  it('rejects a wrong expected result', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.checkUnsigned(204n, 170n, 0n, 238n, 102n, 51n)).rejects.toThrow();
  });
});
