import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// A library function returning a SUB-mapping storage pointer (`return mm[key]`) written through directly
// (`L.choose(m, i)[j] = v;`). The write must land on the entry the key path names: `m[i][j]`. The compiler hoists
// the call result into a `mapping(..) storage __mrv_N = m[i]` alias and the alias lowering must prepend `i` to
// every use, so a wrong binding would write the wrong entry and the reads below would diverge.
const SOURCE = `
library L {
    function choose(mapping(uint => mapping(uint => uint)) storage mm, uint key)
        external returns (mapping(uint => uint) storage) { return mm[key]; }
}
contract Mrv() {
    mapping(uint => mapping(uint => uint)) m;
    function fill() public {
        L.choose(m, 0)[0] = 1;
        L.choose(m, 0)[2] = 42;
        L.choose(m, 1)[0] = 23;
        L.choose(m, 1)[2] = 99;
    }
    function checkA() public {
        require(m[0][0] == 1);
        require(m[0][1] == 0);
        require(m[0][2] == 42);
    }
    function checkB() public {
        require(m[1][0] == 23);
        require(m[1][1] == 0);
        require(m[1][2] == 99);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('library sub-mapping return written through directly', () => {
  it('writes each key path to its own entry on the VM', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.fill()).resolves.toBeDefined();
    await expect(sc.checkA()).resolves.toBeDefined();
    await expect(sc.checkB()).resolves.toBeDefined();
  });
});
