import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate, getContractFactory } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos, fundedSigner } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// `(x >>= 1)` used as an expression updates x AND yields its new value (Solidity assignment-as-expression).
// Verified on-chain: a most-significant-bit loop computes the right answer each iteration from the read-back.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  int result;
  function msb(int x, pubkey pk, sig s) {
    require(checkSig(s, pk));
    int i = 0;
    while ((x >>= 1) > 0) { i = i + 1; }
    this.result = i;
  }
}`;

describe('assignment-as-expression (runtime)', () => {
  const provider = createTestProvider();
  it('a `while ((x >>= 1) > 0)` loop computes the most-significant-bit position on-chain', async () => {
    const art = compileString(SRC);
    const c = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, c, art.stateLayout!, { result: 0n }, { saltContract: true });
    const sc = StatefulContract.withCategory(c, categoryId);
    await sc.msb(12n, alicePub, new SignatureTemplate(alicePriv)).send();
    expect((await sc.getState()).result).toBe(3n); // 12 = 0b1100 -> shifts 6,3,1 (i=3) then 0 stops
  });
});

// Chained assignments and ternary branch assignments (Solidity forms) desugar to sequential statements /
// if-else in the AstBuilder. Each function requires the expected values, so the VM proves value AND order.
const CHAINS = `pragma solidity ^0.8.0;
contract Chains {
    uint value2;
    function chain(uint v) public pure {
        uint x = 0; uint y = 0; uint z = 0;
        x = y = z = v;
        require(x == v && y == v && z == v);
    }
    function compoundChain() public pure {
        uint a = 1; uint b = 2; uint c = 3;
        a += b += c;
        require(b == 5, "b gets c first");
        require(a == 6, "a gets the updated b");
    }
    function declInitChain(uint n) public pure {
        uint x = 0;
        uint y = x = n;
        require(y == n && x == n);
    }
    function elementChain() public pure {
        uint[10] memory arr;
        arr[8] = arr[9] = 4;
        require(arr[8] == 4 && arr[9] == 4 && arr[0] == 0);
    }
    function inner(uint x) internal pure returns (uint) {
        uint v = x;
        return v += 7;
    }
    function returnAssign() public pure {
        require(inner(3) == 10);
    }
    function returnStateAssign() public {
        uint got = value2 += 7;
        require(got == 7 && value2 == 7);
    }
    function ternaryStatement(bool cond) public pure {
        uint a = 0; uint b = 0;
        cond ? a = 5 : b = 7;
        require(cond ? (a == 5 && b == 0) : (a == 0 && b == 7));
    }
    function ternaryInit(bool cond) public pure {
        uint y = 0;
        uint x = cond ? y = 3 : 6;
        if (cond) { require(x == 3 && y == 3); }
        else { require(x == 6 && y == 0); }
    }
}`;

describe('assignment chains and ternary branch assignments (runtime)', () => {
  const artifact = compileString(CHAINS, { solidityImportCompat: true, forceStateful: true });
  it('runs every chained/ternary assignment form with the expected values and order', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.chain(42n)).resolves.toBeDefined();
    await expect(sc.compoundChain()).resolves.toBeDefined();
    await expect(sc.declInitChain(9n)).resolves.toBeDefined();
    await expect(sc.elementChain()).resolves.toBeDefined();
    await expect(sc.returnAssign()).resolves.toBeDefined();
    await expect(sc.returnStateAssign()).resolves.toBeDefined();
    await expect(sc.ternaryStatement(true)).resolves.toBeDefined();
    await expect(sc.ternaryStatement(false)).resolves.toBeDefined();
    await expect(sc.ternaryInit(true)).resolves.toBeDefined();
    await expect(sc.ternaryInit(false)).resolves.toBeDefined();
  });
});
