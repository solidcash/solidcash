import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// 2D (nested) memory arrays: `new uint256[][](n)`, inner alloc `b[i]=new uint256[](m)`, and the nested element
// write `b[i][j]=v`. The write desugars to a read-modify-write (`tmp=b[i]; tmp[j]=v; b[i]=tmp;`). VM-verifies
// the write round-trips, sibling elements stay at their default, and the outer/inner structure is preserved.
const SOURCE = `
contract NestedArrayWrite {
    function verify(uint256 x, uint256 y, uint256 expected) {
        uint256[][] memory b = new uint256[][](2);
        b[0] = new uint256[](3);
        b[1] = new uint256[](3);
        b[0][1] = x;
        b[1][2] = y;
        require(b[0][1] == x);            // read-after-write on the modified element
        require(b[0][0] == 0);            // sibling element in the same inner array stays default
        require(b[0][2] == 0);
        require(b[1][2] == y);            // a write in a different inner array
        require(b[1][0] == 0);
        require(b[0][1] + b[1][2] == expected);
    }
}
`;

describe('nested (2D) memory array element write b[i][j]=v', () => {
  const artifact = compileString(SOURCE, { forceStateful: true });

  it('writes round-trip and siblings stay default (10,20 -> 30)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.verify(10n, 20n, 30n)).resolves.toBeDefined();
  });

  it('a wrong expected sum fails (the nested writes + reads actually ran)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.verify(10n, 20n, 999n)).rejects.toThrow(verifyFailure);
  });
});
