import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Solidity's push-returns-reference chains desugar to pre-push length capture + nested keyed pushes.
// Each function requires the resulting lengths/values, so the VM proves shape AND data flow.
const SOURCE = `pragma solidity ^0.8.0;
contract ChainedPush {
    int[][] array2d;
    uint[][] c;
    uint[] b;
    uint[][] both;
    uint[][] viaPtr;
    function chainStatement() public {
        array2d.push().push();
        require(array2d.length == 1 && array2d[array2d.length - 1].length == 1);
        require(array2d[0][0] == 0);
    }
    function chainAssign() public {
        c.push().push() = 2;
        require(c.length == 1 && c[0].length == 1 && c[0][0] == 2);
    }
    function chainArg() public {
        c.push().push(7);
        require(c[c.length - 1][0] == 7);
    }
    function pushAsLhsAndRhs() public {
        b.push() = b.push();
        uint length = b.length;
        require(length == 2 && b[length - 1] == 0 && b[length - 1] == b[length - 2]);
    }
    function twoDeepBothSides() public {
        both.push().push() = both.push().push();
        uint length = both.length;
        require(length == 2);
        require(both[length - 1].length == 1 && both[length - 2].length == 1);
        require(both[length - 1][0] == both[length - 2][0]);
    }
    function pointerFromPush() public {
        uint[] storage pointer = viaPtr.push();
        pointer.push(4);
        pointer.push(5);
        require(viaPtr.length == 1 && viaPtr[0].length == 2);
        require(viaPtr[0][0] == 4 && viaPtr[0][1] == 5);
    }
}`;

describe('chained storage push (runtime)', () => {
  const artifact = compileString(SOURCE, { solidityImportCompat: true, forceStateful: true });
  it('runs every chained push form with the expected lengths and values', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.chainStatement()).resolves.toBeDefined();
    await expect(sc.chainAssign()).resolves.toBeDefined();
    await expect(sc.chainArg()).resolves.toBeDefined();
    await expect(sc.pushAsLhsAndRhs()).resolves.toBeDefined();
    await expect(sc.twoDeepBothSides()).resolves.toBeDefined();
    await expect(sc.pointerFromPush()).resolves.toBeDefined();
  });
});
