import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';
// A struct field typed as a contract/interface (C c) resolves to an address and round-trips through state
// encoding exactly like a plain `address` field.
const SRC = `contract C {}
contract T {
  struct S { uint256 n; C c; address a; }
  S s;
  function setit(uint256 n, C c, address a) public { s = S(n, c, a); }
  function chk(uint256 n, address c, address a) public view {
    require(s.n == n && address(s.c) == c && s.a == a);
  }
}`;
const artifact = compileString(SRC, { forceStateful: true });
describe('contract-typed struct field (runtime)', () => {
  it('a struct field of contract type round-trips through state (address encode/decode)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    const addr = '0x' + '11'.repeat(20);
    const other = '0x' + '22'.repeat(20);
    await sc.setit(7n, addr, other);
    await expect(sc.chk(7n, addr, other)).resolves.toBeDefined();
  });
});
