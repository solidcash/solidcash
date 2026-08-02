import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// A library function taking a STRUCT storage pointer (`Map storage map`) is inlined at its call site, with the
// pointer substituted by the caller's struct var. `map.values[k]` in the body flattens to the caller's
// `m__values` collection through the SAME parse-time path a direct `m.values[k]` uses, so the inlined write and
// read hit the same entry slot and round-trip across transactions.
const SOURCE = `
library Lib {
    struct Map { mapping(uint256 => uint256) values; }
    function set(Map storage map, uint256 k, uint256 v) internal { map.values[k] = v; }
    function checkEq(Map storage map, uint256 k, uint256 ev) internal view { require(map.values[k] == ev); }
}
contract C {
    Lib.Map m;
    function put(uint256 k, uint256 v) external { Lib.set(m, k, v); require(true); }
    function verify(uint256 k, uint256 ev) external { Lib.checkEq(m, k, ev); }
}
`;

describe('library function with a struct storage pointer (inlined)', () => {
  const artifact = compileString(SOURCE, { forceStateful: true });

  it('writes via the library pointer and reads it back through another library fn', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await sc.put(1n, 5n).send();
    await expect(sc.verify(1n, 5n)).resolves.toBeDefined();   // inlined set() wrote m__values[1]=5, checkEq reads it
  });

  it('a wrong expected value fails (the inlined read actually ran)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await sc.put(2n, 7n).send();
    await expect(sc.verify(2n, 9n)).rejects.toThrow('layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
  });
});
