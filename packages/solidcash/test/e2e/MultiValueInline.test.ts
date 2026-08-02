/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// A multi-value (tuple) returning helper that reads a state entry must be INLINED at its call site (entry-access
// slots live in the entry-point's block layout - a subroutine has none: "Block layout not available"). Previously
// only scalar helpers were inlined. VM-verifies the values split correctly across the tuple.
const SOURCE = `
contract MultiValueInline {
    uint256[3] data;
    function _calc(uint256 i) private view returns (uint256 x, uint256 y) {
        uint256 s = data[i];
        x = s + 1;
        y = s + 2;
    }
    function checkAssign(uint256 i, uint256 ex, uint256 ey) {
        (uint256 x, uint256 y) = _calc(i);   // tuple destructure at the call site
        require(x == ex && y == ey);
    }
}
`;

describe('multi-value state-reading helper inlining', () => {
  const artifact = compileString(SOURCE, { forceStateful: true });

  it('splits a tuple-returning helper into per-value temps (data[0]=0 -> x=1, y=2)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    expect(await sc.checkAssign(0n, 1n, 2n)).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });

  it('a wrong expected value fails (the inlined body + state read actually ran)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.checkAssign(0n, 1n, 3n)).rejects.toThrow('layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
  });
});
