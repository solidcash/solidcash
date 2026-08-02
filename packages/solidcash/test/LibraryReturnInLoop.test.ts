import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { getContractFactory } from '../src/index.js';
import { fundedSigner } from './test-util.js';

// A `return` inside a loop of a LIBRARY function (a namespaced free function invoked as an OP_INVOKE
// subroutine): DesugarReturnInLoop only visited contract functions, so the library body kept the raw
// return-in-loop cleanup that corrupts the loop stack ("Expected variable 'i' does not exist").
// Free functions are now desugared too. Mirrors solc's internal_types_in_library.sol.
const SOURCE = `
library Lib {
    function find(uint16[] storage _haystack, uint16 _needle) public view returns (uint) {
        for (uint i = 0; i < _haystack.length; ++i)
            if (_haystack[i] == _needle)
                return i;
        return type(uint).max;
    }
}
contract LibFindLoop {
    uint16[] data;

    function seed() public {
        data.push(5);
        data.push(9);
        data.push(3);
    }

    function check() public view {
        require(Lib.find(data, 9) == 1);
        require(Lib.find(data, 3) == 2);
        require(Lib.find(data, 7) == type(uint).max);
    }

    function checkWrong() public view {
        require(Lib.find(data, 9) == 0);
    }
}`;

describe('library function with return-in-loop (VM-verified)', () => {
  it('finds the right indices and returns max on a miss', async () => {
    const sc = await getContractFactory(
      compileString(SOURCE, { solidityImportCompat: true }), await fundedSigner(),
    ).deploy();
    await sc.seed();
    await expect(sc.check()).resolves.toBeDefined();
  });

  it('rejects a wrong expected index (guard against vacuous pass)', async () => {
    const sc = await getContractFactory(
      compileString(SOURCE, { solidityImportCompat: true }), await fundedSigner(),
    ).deploy();
    await sc.seed();
    await expect(sc.checkWrong()).rejects.toThrow(
      /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
  });
});
