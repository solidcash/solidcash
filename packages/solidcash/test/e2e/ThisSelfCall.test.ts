import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const inputZeroVerifyFailure = /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;

// `this.f(args)` is an external self-call in Solidity; on BCH the covenant is the contract itself, so it
// resolves to a direct call to the contract's own function `f`. Verified end-to-end: a public helper called
// via `this.` returns the right value into the covenant check.
const SRC = `contract C() {
  function dbl(int x) internal pure returns(int) { return x * 2; }
  function addOne(int x) returns(int) { return x + 1; }
  function ext(int x) external pure returns(int) { return x * 3; }
  function check(int v, int e) { require(this.dbl(v) + this.addOne(v) == e); }
  function checkExt(int v, int e) { require(this.ext(v) == e); }
}`;

describe('this.f() external self-call resolves to the own function', () => {
  const provider = createTestProvider();
  it('this.dbl(v) + this.addOne(v) computes via the own functions', async () => {
    const art = compileString(SRC, { solidityImportCompat: true, forceStateful: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);
    // dbl(5)=10, addOne(5)=6 -> 16
    const tx = await sc.check(5n, 16n).send();
    expect(tx.txid).toBeDefined();
    await expect(sc.check(5n, 15n).send()).rejects.toThrow(inputZeroVerifyFailure);
  });

  it('this.ext(v) invokes an external function as a subroutine', async () => {
    const art = compileString(SRC, { solidityImportCompat: true, forceStateful: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);
    // ext(4) = 12
    const tx = await sc.checkExt(4n, 12n).send();
    expect(tx.txid).toBeDefined();
    await expect(sc.checkExt(4n, 11n).send()).rejects.toThrow(inputZeroVerifyFailure);
  });
});
